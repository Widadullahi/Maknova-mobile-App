"""Offline staging migration. Never imported by the running Flask application.

Default commands inspect local files only. Export uses a read-only MySQL snapshot;
import requires an explicit staging table and writes through DynamoDB transactions.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from decimal import Decimal
from pathlib import Path
import re
from urllib.parse import urlparse

VERSION = 1
ROOT = Path(__file__).resolve().parent


def encode(value):
    if isinstance(value, Decimal):
        return {"$type": "decimal", "value": str(value)}
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return {"$type": type(value).__name__, "value": value.isoformat()}
    if isinstance(value, dt.timedelta):
        return {"$type": "timedelta", "value": str(value.total_seconds())}
    if isinstance(value, bytes):
        return {"$type": "bytes", "value": base64.b64encode(value).decode()}
    if isinstance(value, dict):
        return {k: encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [encode(v) for v in value]
    if isinstance(value, float):
        return {"$type": "decimal", "value": str(value)}
    return value


def decode(value):
    if isinstance(value, dict):
        if set(value) == {"$type", "value"}:
            kind, raw = value["$type"], value["value"]
            if kind == "decimal":
                return Decimal(raw)
            if kind == "bytes":
                return base64.b64decode(raw, validate=True)
            if kind in {"datetime", "date", "time", "timedelta"}:
                return raw  # DynamoDB stores dates/durations as strings.
            raise ValueError(f"Unknown encoded type: {kind}")
        return {k: decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [decode(v) for v in value]
    return value


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def keypart(value):
    return base64.urlsafe_b64encode(canonical(value).encode()).decode().rstrip("=")


def row_key(entity, columns, row):
    if not re.fullmatch(r"[A-Za-z0-9_]+", entity):
        raise ValueError("Invalid entity name")
    if not columns or any(row.get(c) is None for c in columns):
        raise ValueError(f"Missing primary key for {entity}")
    return f"ROW#{entity}#{keypart([row[c] for c in columns])}"


def validate_snapshot(snapshot):
    if snapshot.get("version") != VERSION:
        raise ValueError("Unsupported snapshot version")
    if not snapshot.get("tables"):
        raise ValueError("Snapshot contains no tables")
    seen_tables = set()
    for table in snapshot["tables"]:
        name = table["name"]
        if name in seen_tables:
            raise ValueError(f"Duplicate table: {name}")
        seen_tables.add(name)
        if table["count"] != len(table["rows"]) or table["sha256"] != digest(table["rows"]):
            raise ValueError(f"Snapshot checksum/count mismatch: {name}")
        keys = [row_key(name, table["primary_key"], row) for row in table["rows"]]
        if len(keys) != len(set(keys)):
            raise ValueError(f"Duplicate primary key: {name}")
    return snapshot


def snapshot_id(snapshot):
    return digest(snapshot)


def items_for_row(table, row, import_id):
    entity = table["name"]
    pk = row_key(entity, table["primary_key"], row)
    item = {
        "PK": pk, "SK": "ROW", "entity": entity, "data": decode(row),
        "sourceHash": digest(row), "snapshotId": import_id,
        "GSI1PK": f"ENTITY#{entity}", "GSI1SK": pk,
    }
    yield item
    # Relationship records support key queries without table scans. Runtime code
    # must maintain these records atomically when relationships change.
    for column, value in row.items():
        if column.endswith("_id") and value is not None:
            yield {"PK": f"LINK#{entity}#{column}#{keypart(value)}", "SK": pk,
                   "recordPK": pk, "snapshotId": import_id}
    if entity == "users":
        email = str(row["email"]).strip().lower()
        yield {"PK": f"UNIQUE#users#email#{email}", "SK": "LOCK",
               "recordPK": pk, "snapshotId": import_id}


def plan(snapshot):
    validate_snapshot(snapshot)
    import_id = snapshot_id(snapshot)
    keys = set()
    records = edges = 0
    for table in snapshot["tables"]:
        for row in table["rows"]:
            batch = list(items_for_row(table, row, import_id))
            records += 1
            edges += len(batch) - 1
            if len(batch) > 100:
                raise ValueError("Row has too many relationships for a transaction")
            for item in batch:
                key = (item["PK"], item["SK"])
                if key in keys:
                    raise ValueError(f"Duplicate key or unique email in {table['name']}")
                keys.add(key)
    return {"snapshotId": import_id, "tables": len(snapshot["tables"]),
            "records": records, "relationship_and_email_items": edges,
            "target_items": len(keys), "runtime_cutover_ready": False}


def export_mysql(destination):
    import pymysql
    # Deliberately no .env loading: use a dedicated read-only account supplied
    # through the process environment, not the application's write account.
    connection = pymysql.connect(
        host=os.environ["SOURCE_MYSQL_HOST"], port=int(os.getenv("SOURCE_MYSQL_PORT", "3306")),
        user=os.environ["SOURCE_MYSQL_USER"], password=os.environ["SOURCE_MYSQL_PASSWORD"],
        database=os.environ["SOURCE_MYSQL_DATABASE"],
        cursorclass=pymysql.cursors.SSDictCursor, autocommit=False,
        ssl={"ca": os.environ["SOURCE_MYSQL_SSL_CA"]} if os.getenv("SOURCE_MYSQL_SSL_CA") else None,
    )
    tables = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cursor.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY")
            cursor.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
            names = sorted(next(iter(row.values())) for row in cursor.fetchall())
            for name in names:
                if name == "schema_migrations":
                    continue
                if not re.fullmatch(r"[A-Za-z0-9_]+", name):
                    raise ValueError("Unsupported source table name")
                cursor.execute(f"SHOW KEYS FROM `{name}` WHERE Key_name = 'PRIMARY'")
                keys = [r["Column_name"] for r in sorted(cursor.fetchall(), key=lambda r: r["Seq_in_index"])]
                if not keys:
                    raise ValueError(f"Source table needs a primary key: {name}")
                order = ",".join(f"`{k}`" for k in keys)
                cursor.execute(f"SELECT * FROM `{name}` ORDER BY {order}")
                rows = [encode(row) for row in cursor]
                tables.append({"name": name, "primary_key": keys, "count": len(rows),
                               "sha256": digest(rows), "rows": rows})
        snapshot = {"version": VERSION, "created_at": dt.datetime.now(dt.timezone.utc).isoformat(), "tables": tables}
        validate_snapshot(snapshot)
        destination = Path(destination)
        if destination.exists():
            raise ValueError("Refusing to overwrite a snapshot")
        destination.write_text(canonical(snapshot), encoding="utf-8")
        print(canonical(plan(snapshot)))
    finally:
        connection.rollback()
        connection.close()


def aws_table(name, region, endpoint, profile):
    import boto3
    if not re.fullmatch(r"maknova-staging-[A-Za-z0-9_.-]+", name):
        raise ValueError("Only maknova-staging-* table names are allowed")
    if endpoint:
        parsed = urlparse(endpoint)
        if (parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1"}
                or parsed.username or parsed.password or not parsed.port
                or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
            raise ValueError("Custom endpoints must be local DynamoDB emulators")
    session = boto3.Session(profile_name=profile, region_name=region)
    table = session.resource("dynamodb", endpoint_url=endpoint).Table(name)
    description = table.meta.client.describe_table(TableName=name)["Table"]
    if {x["AttributeName"]: x["KeyType"] for x in description["KeySchema"]} != {"PK": "HASH", "SK": "RANGE"}:
        raise ValueError("Unexpected DynamoDB key schema")
    if description["TableStatus"] != "ACTIVE":
        raise ValueError("Target table is not ACTIVE")
    return table


def preflight_items(snapshot):
    from boto3.dynamodb.types import TypeSerializer
    serializer = TypeSerializer()
    import_id = snapshot_id(snapshot)
    # Conservative wire-size bound; catches oversized items and unsupported
    # precision before ANY write. Large documents must be externalized to S3.
    for table in snapshot["tables"]:
        for row in table["rows"]:
            for item in items_for_row(table, row, import_id):
                if len(item["PK"].encode()) > 2048 or len(item["SK"].encode()) > 1024:
                    raise ValueError(f"DynamoDB key too long in {table['name']}")
                serialized = {k: serializer.serialize(v) for k, v in item.items()}
                wire = json.dumps(serialized, default=lambda b: base64.b64encode(b).decode())
                if len(wire.encode()) > 380_000:
                    raise ValueError(f"Item too large in {table['name']}; move large payloads to S3")


def import_snapshot(snapshot, table):
    details = plan(snapshot)
    preflight_items(snapshot)
    import_id = details["snapshotId"]
    # A nonempty table without our matching import marker is never modified.
    marker_key = {"PK": "MIGRATION", "SK": "SNAPSHOT"}
    marker = table.get_item(Key=marker_key, ConsistentRead=True).get("Item")
    if not marker:
        if table.scan(Limit=1, ConsistentRead=True).get("Items"):
            raise ValueError("Target table is not empty; use a fresh staging table")
        table.put_item(Item={**marker_key, "snapshotId": import_id, "status": "loading"},
                       ConditionExpression="attribute_not_exists(PK)")
    elif marker["snapshotId"] != import_id:
        raise ValueError("Target table belongs to a different snapshot")
    for source in snapshot["tables"]:
        for row in source["rows"]:
            actions = [{"Put": {"TableName": table.name, "Item": item,
                        "ConditionExpression": "attribute_not_exists(PK) OR (snapshotId = :snapshot AND recordPK = :record)",
                        "ExpressionAttributeValues": {":snapshot": import_id, ":record": item.get("recordPK", item["PK"])}}}
                       for item in items_for_row(source, row, import_id)]
            # Base rows have no recordPK, so use the same-snapshot condition.
            actions[0]["Put"]["ConditionExpression"] = "attribute_not_exists(PK) OR snapshotId = :snapshot"
            del actions[0]["Put"]["ExpressionAttributeValues"][":record"]
            table.meta.client.transact_write_items(TransactItems=actions)
    verify_snapshot(snapshot, table)
    table.update_item(Key=marker_key, UpdateExpression="SET #s = :status",
                      ExpressionAttributeNames={"#s": "status"},
                      ExpressionAttributeValues={":status": "verified"})
    return details


def verify_snapshot(snapshot, table):
    details = plan(snapshot)
    for source in snapshot["tables"]:
        for row in source["rows"]:
            for expected in items_for_row(source, row, details["snapshotId"]):
                actual = table.get_item(Key={"PK": expected["PK"], "SK": expected["SK"]},
                                        ConsistentRead=True).get("Item")
                if actual != expected:
                    raise ValueError(f"Verification failed: {source['name']}")
    return details


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["export", "plan", "import", "verify"])
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--table")
    parser.add_argument("--region")
    parser.add_argument("--profile")
    parser.add_argument("--endpoint")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.command == "export":
        export_mysql(args.snapshot)
        return
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    details = plan(snapshot)
    if args.command == "plan" or (args.command == "import" and not args.apply):
        print(canonical({**details, "writes_performed": False}))
        return
    if not args.table or not args.region:
        parser.error("--table and --region required for AWS operations")
    table = aws_table(args.table, args.region, args.endpoint, args.profile)
    result = import_snapshot(snapshot, table) if args.command == "import" else verify_snapshot(snapshot, table)
    print(canonical({**result, "verification": "passed"}))


if __name__ == "__main__":
    main()
