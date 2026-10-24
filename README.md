# Maknova

Expo mobile app, admin portal, manager portal, and backend source for the Maknova property platform.

Hosting target: **AWS / eu-west-1**. Read [the AWS hosting handoff](docs/AWS_HOSTING.md) before deploying.

Backend URLs are configured explicitly through the environment examples in the app root and each dashboard. The DynamoDB migration tools and authentication prototype are under `backend/dynamodb-staging`; the remaining Flask workflows still need porting and validation.
