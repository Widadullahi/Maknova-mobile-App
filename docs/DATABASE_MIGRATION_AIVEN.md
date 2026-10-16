# Runbook: Move MySQL From The OVH VPS To Aiven (Managed MySQL)

Goal: stop maintaining MySQL ourselves and get automated backups, **without touching any application code or SQL**. The Flask backend, both dashboards, and the mobile app are unaffected — only `backend/.env` changes on the server.

Chosen provider: **Aiven free tier** (always-free, no credit card, automated backups included). Limits: 1 vCPU / 1 GB RAM / ~1–5 GB disk — comfortable for current traffic, upgrade path to paid tiers later without code changes.

---

## 0. Prerequisites

- SSH access to the OVH VPS (`vps-ca66261d.vps.ovh.net`)
- The current `backend/.env` from the server
- `mysqldump` and `mysql` clients on the machine you migrate from (the VPS already has them)
- ~15 minutes of downtime, scheduled (the app is small; the dump/restore is minutes)

## 1. Create the Aiven service

1. Sign up at aiven.io (no credit card needed).
2. Create service → **MySQL** → region **close to the VPS** (pick an EU region near OVH, e.g. `google-europe-west1` or similar, to keep API latency low).
3. Plan: **Free** (single node).
4. When the service shows **RUNNING**, note from the service Overview page:
   - `Service URI` (contains host, port, user, password)
   - **CA Certificate** → download it as `ca.pem`

## 2. Dump the current database (on the VPS)

```bash
# Snapshot for safety before touching anything
mysqldump --single-transaction --routines --triggers \
  -u real_estate -p real_estate > ~/real_estate_pre_migration.sql.gz

# The dump we'll actually import
mysqldump --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces \
  -u real_estate -p real_estate | gzip > ~/real_estate_aiven.sql.gz
```

(If `--set-gtid-purged` is rejected by your mysqldump version, drop that flag — it is optional.)

## 3. Import into Aiven

Aiven's free tier may not expose a public data-sync tool, so import over TLS from the VPS (or any machine with the dump + the CA cert):

```bash
# TLS flags are mandatory: Aiven requires encrypted connections
gunzip -c ~/real_estate_aiven.sql.gz | mysql \
  --host=<AVEN_HOST> --port=<AIVEN_PORT> \
  --user=avnadmin -p \
  --ssl-ca=./ca.pem --ssl-mode=VERIFY_IDENTITY \
  real_estate
```

First create the (empty) schema if the service doesn't have it:

```bash
mysql --host=<AIVEN_HOST> --port=<AIVEN_PORT> --user=avnadmin -p \
  --ssl-ca=./ca.pem --ssl-mode=VERIFY_IDENTITY \
  -e "CREATE DATABASE IF NOT EXISTS real_estate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Sanity-check row counts vs the VPS:

```bash
mysql --ssl-ca=./ca.pem ... -e "
  SELECT 'users' t, COUNT(*) c FROM users
  UNION ALL SELECT 'estates', COUNT(*) FROM estates
  UNION ALL SELECT 'properties', COUNT(*) FROM properties
  UNION ALL SELECT 'sales', COUNT(*) FROM sales
  UNION ALL SELECT 'payment_transactions', COUNT(*) FROM payment_transactions
  UNION ALL SELECT 'form_submissions', COUNT(*) FROM form_submissions;"
```

(Compare the same query on the VPS. The counts must match.)

## 4. Move uploads? No — uploads stay on the VPS

Documents/plot photos are **files on the VPS disk** (`UPLOAD_DIR`, `PRIVATE_UPLOAD_DIR`), not DB rows. This runbook moves the database only. The Flask app keeps running on the VPS and keeps serving files from local disk.

## 5. Flip the backend over (one file)

On the VPS, edit `backend/.env`:

```env
MYSQL_HOST=<AIVEN_HOST>
MYSQL_PORT=<AIVEN_PORT>
MYSQL_USER=avnadmin           # or a dedicated user you create in Aiven
MYSQL_PASSWORD=<AIVEN_PASSWORD>
MYSQL_DATABASE=real_estate
MYSQL_SSL_CA=/opt/maknova/ca.pem
MYSQL_SSL_VERIFY_IDENTITY=true
```

Upload `ca.pem` to the VPS (e.g. `/opt/maknova/ca.pem`, `chmod 600`, owned by the service user).

Then:

```bash
sudo systemctl restart maknova   # or however the Flask app is supervised
curl -s http://127.0.0.1:4959/health
```

`db.py` now passes `ssl={"ca": ...}` to PyMySQL whenever `MYSQL_SSL_CA` is set — local/VPS-internal dev without the var is unchanged. `RUN_MIGRATIONS_ON_STARTUP=true` will verify/apply the schema ledger on first boot; it should report no changes (schema came from the dump).

## 6. Verify end-to-end before announcing success

- [ ] `GET /health` returns ok
- [ ] Log into the mobile app with a real account (auth queries hit Aiven now)
- [ ] Open the **admin dashboard** → verification list loads
- [ ] Open the **manager dashboard** → estates + properties lists load
- [ ] Trigger a Paystack **test-mode** payment → `payment_transactions` row updates in Aiven
- [ ] Visitor pass generate + verify works
- [ ] Upload a verification document (file still lands on VPS disk; its metadata row is in Aiven)

## 7. Rollback (if anything looks wrong)

`backend/.env` back to the old `MYSQL_HOST=127.0.0.1` values, restart, done — the VPS database was never modified, only read. This is why we schedule downtime instead of running both live.

## 8. Afterwards: backups

Once Aiven is the source of truth, its built-in automated backups take over. Optionally add the local `scripts/backup_database.sh` as a cron on the VPS pointed at Aiven (it honors the same `MYSQL_*` + `MYSQL_SSL_CA` env vars) and copy dumps off-site (rclone/SCP targets supported) for belt-and-braces.

## 9. Later: decommission the VPS MySQL

Only after a full week of stable operation:

```bash
sudo systemctl stop mysql
sudo apt remove --purge mysql-server   # optional; or just leave it stopped
```

Keep `~/real_estate_pre_migration.sql.gz` for at least a month as the final pre-migration snapshot.
