import copy
import datetime as dt
from decimal import Decimal
import json
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch
from types import SimpleNamespace
import os

import boto3
from moto import mock_aws
from werkzeug.security import generate_password_hash

from migration import (encode, decode, digest, plan, row_key, items_for_row,
                       import_snapshot, verify_snapshot, aws_table, export_mysql)
from staging_api import create_app


def snapshot(rows=None):
    users = rows if rows is not None else [{
        "id": 7, "email": "tester@example.invalid", "full_name": "Local Tester",
        "password_hash": generate_password_hash("local-only-test-password"),
        "role": "estate_manager", "account_status": "active", "phone": None,
    }]
    tables = [
        {"name": "users", "primary_key": ["id"], "rows": encode(users)},
        {"name": "conversation_participants", "primary_key": ["conversation_id", "user_id"],
         "rows": [{"conversation_id": 22, "user_id": 7, "last_read_at": None}]},
        {"name": "sales", "primary_key": ["id"], "rows": encode([
            {"id": 4, "buyer_id": 7, "sale_price": Decimal("123456.78"),
             "created_at": dt.datetime(2026, 10, 23, 12), "proof": b"\x00\xff"}])},
    ]
    for table in tables:
        table.update(count=len(table["rows"]), sha256=digest(table["rows"]))
    return {"version": 1, "created_at": "2026-10-23T12:00:00+00:00", "tables": tables}


def make_table():
    return boto3.resource("dynamodb", region_name="eu-west-1").create_table(
        TableName="maknova-staging-local-test", BillingMode="PAY_PER_REQUEST",
        KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
        AttributeDefinitions=[{"AttributeName": "PK", "AttributeType": "S"}, {"AttributeName": "SK", "AttributeType": "S"}],
    )


class SnapshotTests(unittest.TestCase):
    def test_decimal_binary_and_datetime(self):
        row = {"money": Decimal("9999999999999999999.01"), "blob": b"\x00\xff",
               "created": dt.datetime(2026, 10, 23, 12, 30)}
        decoded = decode(json.loads(json.dumps(encode(row))))
        self.assertEqual(decoded["money"], row["money"])
        self.assertEqual(decoded["blob"], row["blob"])
        self.assertEqual(decoded["created"], "2026-10-23T12:30:00")

    def test_composite_primary_keys_do_not_collide(self):
        self.assertNotEqual(row_key("membership", ["a", "b"], {"a": 1, "b": 23}),
                            row_key("membership", ["a", "b"], {"a": 12, "b": 3}))

    def test_tampering_fails(self):
        data = snapshot()
        data["tables"][0]["rows"][0]["email"] = "changed@example.invalid"
        with self.assertRaisesRegex(ValueError, "checksum"):
            plan(data)

    def test_email_uniqueness_is_case_insensitive(self):
        data = snapshot([{"id": 1, "email": "Test@Example.invalid"},
                         {"id": 2, "email": "test@example.invalid"}])
        with self.assertRaisesRegex(ValueError, "unique email"):
            plan(data)

    def test_count_mismatch_fails(self):
        data = snapshot()
        data["tables"][0]["count"] = 999
        with self.assertRaises(ValueError):
            plan(data)

    def test_cloudformation_is_staging_only(self):
        template = json.loads((Path(__file__).parents[1] / "infra/dynamodb.json").read_text())
        resource = template["Resources"]["StagingData"]
        self.assertEqual(resource["DeletionPolicy"], "Retain")
        self.assertEqual(resource["Properties"]["BillingMode"], "PAY_PER_REQUEST")
        self.assertTrue(resource["Properties"]["DeletionProtectionEnabled"])

    def test_export_only_uses_read_statements_and_rolls_back(self):
        class Cursor:
            def __init__(self):
                self.statements = []
                self.rows = []
            def __enter__(self): return self
            def __exit__(self, *_args): pass
            def execute(self, sql):
                self.statements.append(sql)
                if sql.startswith('SHOW FULL'):
                    self.rows = [{"Tables_in_test": "users", "Table_type": "BASE TABLE"}]
                elif sql.startswith('SHOW KEYS'):
                    self.rows = [{"Column_name": "id", "Seq_in_index": 1}]
                elif sql.startswith('SELECT'):
                    self.rows = [{"id": 1, "email": "local@example.invalid"}]
            def fetchall(self): return self.rows
            def __iter__(self): return iter(self.rows)
        class Connection:
            def __init__(self):
                self.current = Cursor()
                self.rolled_back = self.closed = False
            def cursor(self): return self.current
            def rollback(self): self.rolled_back = True
            def close(self): self.closed = True
        connection = Connection()
        fake_mysql = SimpleNamespace(connect=lambda **_kwargs: connection,
                                     cursors=SimpleNamespace(SSDictCursor=object))
        environment = {"SOURCE_MYSQL_HOST": "localhost", "SOURCE_MYSQL_USER": "reader",
                       "SOURCE_MYSQL_PASSWORD": "synthetic-test-value", "SOURCE_MYSQL_DATABASE": "test"}
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, environment), patch.dict('sys.modules', {"pymysql": fake_mysql}):
            destination = Path(tmp) / 'source.snapshot.json'
            export_mysql(destination)
            self.assertEqual(plan(json.loads(destination.read_text()))["records"], 1)
        self.assertTrue(connection.rolled_back and connection.closed)
        for sql in connection.current.statements:
            self.assertTrue(sql.startswith(('SET SESSION', 'START TRANSACTION', 'SHOW', 'SELECT')))
        self.assertIn('READ ONLY', connection.current.statements[1])


@mock_aws
class ImportTests(unittest.TestCase):
    def setUp(self):
        self.table = make_table()
        self.data = snapshot()

    def test_import_preserves_records_edges_and_can_resume(self):
        result = import_snapshot(self.data, self.table)
        self.assertEqual(result["records"], 3)
        import_snapshot(self.data, self.table)
        self.assertEqual(verify_snapshot(self.data, self.table)["records"], 3)
        self.assertEqual(self.table.scan(Select="COUNT")["Count"], result["target_items"] + 1)

    def test_partial_import_can_resume(self):
        from migration import snapshot_id
        sid = snapshot_id(self.data)
        self.table.put_item(Item={"PK": "MIGRATION", "SK": "SNAPSHOT", "snapshotId": sid, "status": "loading"})
        source = self.data["tables"][0]
        for item in items_for_row(source, source["rows"][0], sid):
            self.table.put_item(Item=item)
        import_snapshot(self.data, self.table)
        verify_snapshot(self.data, self.table)

    def test_nonempty_destination_is_not_overwritten(self):
        self.table.put_item(Item={"PK": "existing", "SK": "ROW", "important": True})
        with self.assertRaisesRegex(ValueError, "not empty"):
            import_snapshot(self.data, self.table)
        self.assertEqual(self.table.scan(Select="COUNT")["Count"], 1)

    def test_different_snapshot_cannot_replace_import(self):
        import_snapshot(self.data, self.table)
        changed = copy.deepcopy(self.data)
        changed["created_at"] = "different-snapshot"
        with self.assertRaisesRegex(ValueError, "different snapshot"):
            import_snapshot(changed, self.table)

    def test_oversized_item_rejected_before_first_write(self):
        data = snapshot([{"id": 1, "email": "huge@example.invalid", "body": "x" * 400000}])
        with self.assertRaisesRegex(ValueError, "too large"):
            import_snapshot(data, self.table)
        self.assertEqual(self.table.scan(Select="COUNT")["Count"], 0)

    def test_unsupported_money_precision_rejected_before_write(self):
        data = snapshot([{"id": 1, "email": "precision@example.invalid", "amount": Decimal('1' * 39)}])
        with self.assertRaises(Exception):
            import_snapshot(data, self.table)
        self.assertEqual(self.table.scan(Select="COUNT")["Count"], 0)

    def test_verify_detects_changed_data(self):
        import_snapshot(self.data, self.table)
        source = self.data["tables"][0]
        pk = row_key("users", ["id"], source["rows"][0])
        self.table.update_item(Key={"PK": pk, "SK": "ROW"}, UpdateExpression="SET #d = :d",
                               ExpressionAttributeNames={"#d": "data"}, ExpressionAttributeValues={":d": {"id": 99}})
        with self.assertRaisesRegex(ValueError, "Verification failed"):
            verify_snapshot(self.data, self.table)

    def test_production_name_rejected(self):
        with self.assertRaisesRegex(ValueError, "staging"):
            aws_table("maknova-production", "eu-west-1", None, None)

    def test_custom_endpoint_cannot_exfiltrate_to_remote_host(self):
        with self.assertRaisesRegex(ValueError, "local DynamoDB"):
            aws_table("maknova-staging-test", "eu-west-1", "http://127.0.0.1:8000@evil.example", None)


@mock_aws
class AuthTests(unittest.TestCase):
    def setUp(self):
        self.table = make_table()
        self.snapshot = snapshot()
        import_snapshot(self.snapshot, self.table)
        self.app = create_app(self.table, "local-test-secret-must-be-at-least-32-characters")
        self.client = self.app.test_client()

    def login(self, **extra):
        return self.client.post("/api/v1/auth/login", json={
            "email": "TESTER@example.invalid", "password": "local-only-test-password", **extra})

    def test_mysql_free_login_me_and_refresh(self):
        response = self.login(portal="manager")
        self.assertEqual(response.status_code, 200)
        data = response.json["data"]
        self.assertEqual(data["user"]["id"], 7)
        self.assertNotIn("password_hash", data["user"])
        profile = self.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + data["tokens"]["accessToken"]})
        self.assertEqual(profile.status_code, 200)
        refreshed = self.client.post("/api/v1/auth/refresh", headers={"Authorization": "Bearer " + data["tokens"]["refreshToken"]})
        self.assertEqual(refreshed.status_code, 200)

    def test_manager_cannot_enter_admin_portal(self):
        self.assertEqual(self.login(portal="admin").status_code, 403)

    def test_wrong_password_is_rejected(self):
        self.assertEqual(self.login(password="wrong").status_code, 401)

    def test_suspended_user_is_rejected(self):
        key = {"PK": row_key("users", ["id"], {"id": 7}), "SK": "ROW"}
        item = self.table.get_item(Key=key)["Item"]
        item["data"]["account_status"] = "suspended"
        self.table.put_item(Item=item)
        self.assertEqual(self.login().status_code, 403)

    def test_unported_routes_explicitly_fail(self):
        response = self.client.get("/api/v1/payments")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"]["code"], "MIGRATION_PENDING")

    def test_no_default_jwt_secret(self):
        with self.assertRaises(ValueError):
            create_app(self.table, "short")

    def test_incomplete_import_cannot_log_in(self):
        self.table.update_item(Key={"PK": "MIGRATION", "SK": "SNAPSHOT"}, UpdateExpression="SET #s = :s",
                              ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":s": "loading"})
        self.assertEqual(self.login().status_code, 503)


if __name__ == "__main__":
    unittest.main()
