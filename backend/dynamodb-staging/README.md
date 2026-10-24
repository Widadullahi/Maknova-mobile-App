# Maknova DynamoDB migration — isolated local staging

Target region: **eu-west-1**. Status: **data migration tools and authentication prototype; not a complete replacement backend**.

This directory is isolated from the active Flask application under `backend/app`. No testing process, API URL, database, dashboard, DNS record, or existing account is changed. Do not point the existing apps at `staging_api.py`: most workflows intentionally return `503 MIGRATION_PENDING`.

## What is implemented

- Source inventory: 46 application tables, 339 SQL execute calls. See `inventory.json` for files and counts; `schema_migrations` is excluded from migrated business data.
- Read-only, consistent MySQL snapshot exporter. No INSERT, UPDATE, DELETE, ALTER, or trigger installation on the source. A dedicated read-only MySQL user is required.
- Local snapshot planning with checksums, table counts, duplicate key/email checks, stable composite keys, exact Decimal values, timestamps, and binary encoding.
- Staging-only DynamoDB import. Default is dry-run. Explicit `--apply` is required to write. Preflight rejects oversized/unsupported data before writing. A fresh target is required; the importer can resume the exact same snapshot after interruption. A different snapshot cannot overwrite the target.
- Strongly consistent item-by-item verification, including relationship and email lookup items. Verification compares values, not only counts.
- CloudFormation table template: on-demand capacity, encryption, point-in-time recovery, deletion protection, retained data, and a sparse entity inventory index. These features can incur charges; no resources are provisioned by tests.
- Separate Flask authentication prototype with DynamoDB login, role-based portal checks, profile retrieval, refresh, and logout response. It retains imported user IDs/password hashes and uses its own JWT secret. It never imports MySQL code or creates seeded users.
- Emulator tests use synthetic users and data only; no live backend requests or AWS credentials are required.

## Local verification

Use Python 3.11+ in a virtual environment:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-test.txt
.venv/Scripts/python -m unittest discover -s tests -v
```

The development session also supports `PYTHONPATH=deps` for its isolated package installation. `deps/` is not part of the deliverable. Tests exercise import/retry, data corruption detection, unique email collisions, money/binary/date preservation, production-name rejection, and authentication without MySQL.

## Source snapshot — later, after secure database access

Set `SOURCE_MYSQL_HOST`, `SOURCE_MYSQL_PORT`, `SOURCE_MYSQL_USER`, `SOURCE_MYSQL_PASSWORD`, and `SOURCE_MYSQL_DATABASE` in the process environment. Use `SOURCE_MYSQL_SSL_CA` for TLS certificate validation where available. Do not put credentials in commands or commit environment files. The existing live MySQL server remains authoritative.

```powershell
New-Item -ItemType Directory -Force snapshots
python migration.py export snapshots/source.snapshot.json
python migration.py plan snapshots/source.snapshot.json
```

The exporter assumes InnoDB source tables and no concurrent DDL. It buffers the source snapshot in memory, so it is intended for the current small staging dataset, not an unbounded production export. Source data can change after the snapshot; this tool does not provide change-data capture. Treat snapshots as sensitive because they include password hashes, personal records, tokens, and payment metadata. Store them encrypted with restricted access; never publish them.

## AWS staging — not run yet

Use a dedicated AWS profile with access only to this staging stack. Confirm its account ID with STS before deploying. The selected region is eu-west-1; no account ID has been supplied or assumed. No access keys are included.

```powershell
aws sts get-caller-identity --profile maknova-staging
aws cloudformation deploy --profile maknova-staging --region eu-west-1 --stack-name maknova-dynamodb-staging --template-file infra/dynamodb.json
python migration.py import snapshots/source.snapshot.json --table maknova-staging-migration --region eu-west-1 --profile maknova-staging
# Previous command is a dry-run. Actual writes, only after inspecting its plan:
python migration.py import snapshots/source.snapshot.json --table maknova-staging-migration --region eu-west-1 --profile maknova-staging --apply
python migration.py verify snapshots/source.snapshot.json --table maknova-staging-migration --region eu-west-1 --profile maknova-staging
```

Do not reuse the same table for a later snapshot. Create a fresh stage name, validate it, then retire older staging data deliberately. The template retains tables on stack deletion, so stack deletion alone does not stop their storage/backup charges.

## Data model and runtime migration work

Each source record is a DynamoDB item with `PK=ROW#<table>#<encoded-primary-key>`, `SK=ROW`, original columns under `data`, and snapshot provenance. User email uniqueness is represented by a normalized `UNIQUE#users#email#...` lock item. Columns ending in `_id` receive relationship lookup items under `LINK#<table>#<column>#<encoded-value>`.

This is a loss-preserving staging model, not a claim that the final runtime access design is finished. `ByEntity` provides a paginated inventory; its KEYS_ONLY projection needs follow-up reads. High-volume entity lists need time/status buckets or sharding rather than a single hot partition. Relationships using names such as `created_by` need explicit access patterns before their routes are ported. Other SQL UNIQUE constraints, foreign-key checks, cascades, sort/search behavior, and aggregate reports need application-level equivalents. Never implement a SQL-string adapter that scans the entire DynamoDB table per query.

Port workflows while retaining their HTTP request/response contracts:

1. Complete identity: registration/email verification, password reset delivery, account changes, account status changes, auditing, token revocation policy, and all auth edge cases.
2. Estate verification, private document access, estates, properties, reservations, sale status and allocations. Preserve user/estate scoping in every read and mutation.
3. Payment initialization/verification/webhooks, wallet balances and ledger entries, installments and commission. Use conditional transactions and explicit idempotency keys; concurrent requests must never double-credit, oversell, or allocate twice.
4. Conversation membership, direct/group messages, read receipts, announcements, notifications, device token ownership and visitor passes. Paginate all lists.
5. Forms/signatures, saved listings, residents/security assignments, maintenance, reports, support, account deletion, admin/staff permissions, audit logs and exports.

New DynamoDB writes must maintain data items, relationship items, unique locks and audit/ledger records in one transaction where integrity requires it. DynamoDB has no MySQL auto-increment: choose IDs deliberately and preserve existing externally referenced IDs. Never store currency as floating-point values. Store uploaded files in S3 and metadata/ownership in DynamoDB; use private buckets and signed access for private documents.

AWS limits: 400 KB per item; transactions support up to 100 distinct items and 4 MB in one region/account. The importer uses a conservative 380 KB wire-size bound; oversized records stop the import for explicit S3/chunking decisions. The authentication slice is a local prototype: it does not yet write audit events and does not expose account mutation routes.

## Cutover and rollback gates

Keep the current testing links and API intact throughout this work. Do not edit frontend base URLs, live server environment, MySQL contents, or DNS. Build a separate complete staging API and separately hosted app builds only after all route ports are finished.

Before cutover: compare all source/target records, exercise every role, verify tenant isolation, payment idempotency/concurrency, chat delivery between accounts, file retrieval permissions, push on devices, sale lifecycle and dashboard totals. Estimate read/write/transaction/index/backup/S3/hosting costs using measured test traffic. A DynamoDB move does not automatically lower the total AWS bill.

Choose either a scheduled final write freeze and final snapshot or a separately implemented/tested CDC strategy. Restore all writes to a single authoritative backend; do not casually dual-write payment or wallet data. Capture a MySQL backup and an explicit rollback procedure. Once new writes occur only in DynamoDB, switching the URL back to MySQL without reconciling those writes loses data. Retain MySQL through the rollback window; decommission it only after reconciliation and approval.

## AWS references

- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/migration-guide.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
- https://aws.amazon.com/dynamodb/pricing/
