# Real Estate API

Custom Flask backend for the Real Estate Management Platform.

## Stack

- Flask
- PyMySQL
- Raw SQL queries with parameter binding
- MySQL
- JWT authentication

## Setup

### Local development (Dockerized MySQL)

This is the setup currently used on the dev machine:

```bash
# 1. MySQL 8 in Docker (db: real_estate, user: real_estate/real_estate, port 3306 on localhost)
docker run -d --name maknova-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpw \
  -e MYSQL_DATABASE=real_estate \
  -e MYSQL_USER=real_estate \
  -e MYSQL_PASSWORD=real_estate \
  -p 127.0.0.1:3306:3306 mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

# 2. Python deps (PEP 668 systems like Ubuntu 24.04 need the override; installs to ~/.local)
python3 -m pip install --user --break-system-packages -r requirements.txt

# 3. Environment config
cp .env.example .env   # then edit; see "Local dev .env notes" below

# 4. Run (migrations 001-019 + demo accounts apply automatically on startup)
python3 run.py
```

The API listens on http://127.0.0.1:4959. Health check: `GET /health`.

### Local dev .env notes

- `EMAIL_SMTP_*` left empty: OTP emails are **not sent**; the verification endpoint returns
  the code as `devCode` in the response instead (dev convenience, never enable SMTP-less
  mode in production).
- `PAYSTACK_SUBACCOUNT_CODE` / `PAYSTACK_SPLIT_CODE` empty = legacy charge-on-top pricing.
- Paystack test/public keys fall back to the values in `app/config.py` when unset.
- `DEMO_LOGIN_ENABLED=true` if you need the seeded demo identities (demo@estate.com /
  demo1234). It is **off by default** — production must never set it.
- `EXPO_PUSH_ENABLED=true` (default) enables outbound Expo push dispatch. Set `false`
  locally if you don't want outbound push calls.

### Production (OVH VPS)

Production `.env` must NOT set `DEMO_LOGIN_ENABLED` (it defaults to off, keeping the
hardcoded demo accounts unusable). Push notifications require no extra server env — the
mobile app registers its Expo push token via `POST /notifications/push-token` and the
server dispatches through the Expo push service; only device/emulator builds with a
development client can receive pushes (not Expo Go on Android, SDK 53+).

### Production (OVH VPS)

The live backend runs on an OVH VPS (`vps-ca66261d.vps.ovh.net`, Ubuntu + nginx 1.26 reverse
proxy on `estate.watchup.site`, app port 4959). There is no CI/CD in this repo — deploys are
manual over SSH. Before redeploying: `mysqldump` the database (migrations run automatically
on startup, but the new code needs `EMAIL_SMTP_*` and optionally `PAYSTACK_SUBACCOUNT_CODE`/
`PAYSTACK_SPLIT_CODE` added to the server's `.env`).

Create the database, then apply SQL files in `migrations/` in order.

```sql
CREATE DATABASE real_estate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run the API:

```bash
python run.py
```

Health check:

```txt
GET http://localhost:4959/health
```
