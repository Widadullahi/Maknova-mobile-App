# AWS hosting handoff

Target region: **eu-west-1**. AWS account, API hostname, storage resources, email provider, and payment webhook endpoint must be supplied by the hosting developer. No AWS deployment has been performed.

## Current state

- Mobile client: Expo/React Native, with a browser export for testing.
- Admin and manager portals: separate Next.js applications.
- Existing Flask application: SQL-based implementation, retained for porting and local development.
- DynamoDB work: isolated migration tools and login/profile/refresh prototype under `backend/dynamodb-staging`; not a complete runtime replacement.

All client API URLs must be set explicitly. There is no previous hosting-provider address or implicit fallback. A missing API URL produces a clear configuration error before the client sends a request.

## Configure the clients

For mobile and Expo browser builds, copy the root `.env.example` to `.env`, then set `EXPO_PUBLIC_API_BASE_URL` to the real deployed HTTPS API origin followed by `/api/v1`. For EAS Android preview builds, set that variable in the **preview** EAS environment before building. Do the same for the production EAS environment when preparing a production build.

For each dashboard, copy its `.env.example` to `.env.local`, then set `NEXT_PUBLIC_API_BASE_URL` to the real HTTPS API origin followed by `/api/v1`. Build each dashboard with its own configuration. These public variables are embedded in browser bundles; changing them requires rebuilding. Never place AWS access keys, JWT secrets, or payment secret keys in a public variable.

## Finish the AWS backend

Use `backend/dynamodb-staging/README.md` for the table template, export/import tools, test commands, and remaining workflow ports. The template creates only an isolated staging DynamoDB table, with on-demand capacity, encryption, recovery, and deletion protection. It does not provision the complete hosting stack.

Before the API is ready, the developer must:

1. Port the remaining estate, property, sales, wallet, payment, forms, communication, visitor, maintenance, report, and admin workflows to native DynamoDB access patterns. Preserve tenancy checks and conditional transactions.
2. Select and configure the AWS API compute service, HTTPS endpoint, execution role, secret storage, logs, and explicit CORS origins. Do not use static access keys in application source.
3. Implement S3 file storage and authorized document access. Current local-disk file routes are legacy code; changing an environment variable alone does not turn them into S3 storage.
4. Configure a verified email sender and actual delivery. Configure Paystack test-mode credentials on the backend and register its new HTTPS webhook URL. Test initialization, verification, webhook signature handling, and idempotency before real payments.
5. Configure and test device push using the actual build's credentials.
6. Run end-to-end tests for every account role against the separate staging endpoint.

## Existing data and fresh installation

No external hosting account is required to develop a fresh AWS environment with synthetic test data. Existing accounts and business records require an authorized source export/backup if they must be retained. The supplied export command requires a read-only source connection; it has not been run against real data. A source export is optional only when the owner explicitly accepts a fresh installation without the historical records.

Default role seeds are disabled, and example local accounts use reserved `.example` addresses. Create the real owner through a controlled bootstrap process with a private password. Do not carry default seed passwords into AWS.

## Testing continuity and release

The temporary previews already running on the developer's computer use their existing build and backend configuration. Source cleanup in a separate checkout does not move or restart them. They are not evidence of an AWS deployment.

Do not switch those previews, publish a new APK, remove the old database, or change DNS until the AWS backend and data validation are complete. Once ready, rebuild the clients with the new endpoint, release the separate AWS test links, and verify records and workflows before cutover. Define rollback and data reconciliation before accepting writes on the new backend.
