# Maknova backend

The hosting target is AWS in `eu-west-1`. See [the AWS handoff](../docs/AWS_HOSTING.md).

## Runtime status

`app/` is the existing Flask backend and still contains MySQL queries. It is retained as implementation reference and for local legacy development. It is **not** a completed DynamoDB backend.

`dynamodb-staging/` contains the separate DynamoDB migration tooling and authentication prototype. Its tests use synthetic data. Unported endpoints return `503 MIGRATION_PENDING`. Do not deploy it as the complete application API.

The source contains no hosted API default. Configure the real AWS API URL separately in the mobile app and both dashboards after the replacement backend is ready.

## Local legacy development

1. Install Python packages from `requirements.txt` into a virtual environment.
2. Copy `.env.example` to `.env` and configure a local development MySQL database.
3. Set unique local application and JWT secrets.
4. Run `python run.py`. The local API listens on port 4959; `GET /health` checks HTTP availability.

MySQL migrations in `migrations/` belong to the legacy implementation. Default role-account seeding is disabled. Only enable `SEED_DEFAULT_ROLE_ACCOUNTS=true` for a disposable local database. Demo accounts also require explicit `DEMO_LOGIN_ENABLED=true`.

## AWS deployment configuration

The hosting developer must configure DynamoDB access through an AWS role, private file storage in S3, JWT/application secrets through a secret store, an explicit CORS allowlist, verified email delivery, and Paystack backend credentials/webhooks. No cloud resources or gateway keys are provisioned by this repository's configuration examples.

Set `EMAIL_FROM` to your verified sender. Do not use development OTP-code responses in a hosted environment. Device push requires the Expo/Firebase credentials for the actual Android build and a real device test.

The app keeps the `/api/v1` request/response contract during migration. Validate authorization, payments, wallet consistency, chat, uploads, and push before switching any clients to the new API.
