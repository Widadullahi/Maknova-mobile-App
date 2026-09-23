# Phase 0 Scope And Decisions

This file tracks the product decisions needed before the full build expands.

## Locked Decisions

- Mobile framework: Expo SDK 57 with React Native.
- Language: JavaScript.
- Navigation: React Navigation.
- Icons: Hugeicons.
- Backend: Flask.
- Database access: PyMySQL with raw SQL queries.
- Database: MySQL.
- Firebase: not required as the primary backend.
- Payment gateway: Flutterwave. All Naira payment initialization, verification, refunds, and webhook processing will be handled by the Flask backend; Flutterwave secret keys will never be bundled in the app.
- Object storage: Cloudinary. Estate images, onboarding documents, resident documents, maintenance attachments, and report evidence will upload through backend-authorized flows and store only Cloudinary public IDs/secure URLs plus ownership metadata in MySQL.
- Electronic signature: captured electronic acceptance. A signer must review the document, affirm their consent, enter their legal full name, and may add a drawn signature. The backend records the immutable document version/hash, signer identity, timestamp, IP/device metadata where available, and acceptance text. This is an auditable platform record, not a replacement for a third-party legally witnessed signature service.
- Business focus: land and plot distribution within managed estates, not general house sales or rentals.
- Market: based in Nigeria. Currency is Nigerian Naira (₦).
- Ownership structure: single main distributor (the business owner) operates the platform. Estate managers, agents, residents, buyers, and security accounts all operate under that one distributor's management rather than as independent tenants.

## Estate Onboarding Packages

Estate onboarding is a one-time activation and setup purchase. It is separate from monthly subscription billing. Each package includes every capability from the package before it.

| Package | Included onboarding scope |
| --- | --- |
| Basic Onboarding | Estate manager account setup, one estate profile, initial verification-document submission, legal acceptance record, and basic estate/plot setup guidance. |
| Standard Onboarding | Everything in Basic, plus assisted estate profile configuration, initial plot inventory import/setup, document organisation, resident/security setup assistance, and a structured launch review. |
| Premium Onboarding | Everything in Standard, plus priority white-glove setup, full initial estate and plot configuration support, staff onboarding support, branded operational forms/templates, launch-readiness review, and priority post-launch setup support. |

Package prices, included plot/staff limits, turnaround times, and support windows are commercial settings to be finalised by the platform owner. They must be stored separately from recurring subscriptions.

## Monthly Subscriptions

Monthly subscriptions govern continued access to platform features after onboarding. They are not replacements for, or extensions of, the one-time onboarding packages above. The subscription tier names, prices, renewal period, trial rules, feature limits, and grace-period policy remain to be confirmed before Phase 7 implementation.

## Open Decisions

- Admin dashboard stack: Vite React or Next.js.
- Launch target: Android first or Android and iOS together.
- Public plot browsing: public, authenticated only, or hybrid.
- Monthly subscription tier names, prices, feature limits, trial period, grace period, and billing rules.
- Exact data model for the distributor hierarchy (e.g., a `managed_by_user_id` column linking estate managers/agents back to the main distributor account). Not yet implemented in the current schema — estate managers are currently modeled as independent owners of the estates they create.

## Phase 1 Role Set

- Super Admin
- Admin
- Estate Manager
- Resident
- Buyer
- Security
- Public User

## Phase 1 Workflow Priority

1. Authentication and role-based access.
2. Estate manager onboarding and verification.
3. Estate and property management.
4. Sales, reservation, and allocation records.
5. Digital forms and document uploads.
6. Payments and subscriptions.
7. Resident, visitor, maintenance, notification, and reporting workflows.

## Client Inputs Needed

- Brand name and app display name.
- Logo, colors, and existing UI/UX files.
- Payment gateway account and API credentials.
- Domain and hosting preferences.
- Object storage provider credentials.
- Admin users to seed.
- Legal Terms of Service text.
- Required document wording and accepted file formats.
