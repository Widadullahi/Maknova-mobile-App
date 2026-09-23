# Figma To Expo App Gap Analysis

Audit date: August 1, 2026  
App baseline: Expo SDK 57, React Native 0.86, React 19.2.3, JavaScript, React Navigation, Hugeicons, DM Sans, dark theme.
Implementation update: a UI-first dummy-data scaffold now exists for the partial/missing Figma flows in `src/screens/figmaFlows/FigmaFlowScreens.js` and is reachable through Profile/Quick Add/Auth navigation. Visitor pass creation/QR verification, in-app notifications, public estate reports, maintenance lifecycle, and analytics exports now have database schema and backend routes, with mobile backend-first fallback behavior where relevant.

## Scope And Figma Access

The original Figma file key `wwn5HxvgxN7HUh9WlBxZIT` could be opened in the browser but did not resolve through the Codex Figma connector. The duplicated file now resolves through the connector:

- Working duplicate: `Hf2lE6rtXOvB5QZzyXmOQZ`
- Confirmed design context: `498:2` / `EstateFlowAddEstateScreen 1`
- Confirmed metadata: nodes `498:2` through `498:23`, except skipped original IDs that Figma may have re-keyed during duplication.

Some later original node IDs still return `INVALID_ARGUMENT` in the duplicate. Based on the visible Figma layer list, those frames exist in the duplicate but likely need fresh copied node links from the copied file.

## Visual Direction Decision

Preserve the current app skin:

- Keep DM Sans via `@expo-google-fonts/dm-sans`.
- Keep the dark palette from `src/theme/colors.js`: `#0A0A0C` background, dark surfaces, green primary, amber accent, semantic success/warning/danger/info.
- Keep React Native `StyleSheet` and shared theme primitives.
- Keep Hugeicons for in-app iconography.
- Do not copy Figma's visual skin if it uses a lighter, teal, or different brand treatment. Use Figma for workflow depth, information architecture, layout density, and missing states.

## Figma Frame Inventory

### Confirmed In Copied File

| Node | Figma Frame | App Area |
| --- | --- | --- |
| `498:2` | `EstateFlowAddEstateScreen 1` | Estate management |
| `498:3` | `EstateFlowAddPlotScreen 1` | Plot/property management |
| `498:4` | `EstateFlowAdminDashboard 1` | Admin dashboard |
| `498:5` | `EstateFlowBillingPaymentDashboard 1` | Payments/billing |
| `498:6` | `EstateFlowCheckoutPayment 1` | Payment checkout |
| `498:7` | `EstateFlowCommunicationHub 1` | Communication hub |
| `498:9` | `EstateFlowDigitalFormsDashboard 1` | Digital forms |
| `498:10` | `EstateFlowDocumentPreviewSign 1` | Document preview/signature |
| `498:13` | `EstateFlowEstateUserManagement 1` | Estate user/resident/staff management |
| `498:14` | `EstateFlowFillFormDocumentUpload 1` | Form fill/document upload |
| `498:15` | `EstateFlowHelpSupport 1` | Help/support |
| `498:16` | `EstateFlowInstallmentManagement 1` | Installment payments |
| `498:17` | `EstateFlowLoginScreen 1` | Auth |
| `498:18` | `EstateFlowMaintenanceDetails 1` | Maintenance detail |
| `498:19` | `EstateFlowMaintenanceRequest 1` | Maintenance request |
| `498:20` | `EstateFlowOTPVerificationScreen 1` | OTP verification |
| `498:22` | `EstateFlowPlotMapScreen 1` | Plot map |
| `498:23` | `EstateFlowPremiumChat 1` | Premium chat/messaging |

### Visible In Figma Layer List, Fresh Copied Node Links Needed

- `EstateFlowProfile 1`
- `EstateFlowReportsAnalytics 1`
- `EstateFlowSettings 1`
- `EstateFlowTransactionHistory 1`
- `EstateFlowVisitorHistoryAnalytics 1`
- `EstateFlowVisitorHistoryAnalytics 2`
- `EstateFlowVisitorManagementDashboard`
- `EstateFlowVisitorManagementDashboard` variant/second frame
- `EstateFlowVisitorVerificationPass 1`

## Current App Baseline

### Exists

- Expo SDK 57 dependency baseline in `package.json`.
- DM Sans font loading in `App.js`.
- Dark theme tokens in `src/theme`.
- Shared UI primitives: `Screen`, `AppText`, `Button`, `TextField`, `Checkbox`, `StatusChip`, `EmptyState`, signature components, property listing card.
- Auth shell: boot, onboarding carousel, login, register, forgot password, reset password, restricted account screen.
- Role-based routing for estate manager/admin/super admin, buyer/public user, resident, and security.
- Buyer/public listing flow: browse/search/filter listings, saved listings, listing detail, purchases.
- Estate manager basics: dashboard/listings, estates list, properties list, quick estate/plot creation, sales workflow.
- Estate verification wizard: profile, required documents, supporting documents, terms, signature, review, submit.
- Resident home: stats, visitor pass generation, maintenance booking, issue report, notices.
- Security home: stats, verify pass, visitor log, recent activity.
- Backend scaffolding and routes for auth, users, estates, sales, forms, residents, verification, admin.

### Partial

- Many surfaces exist but are thin or mock-backed.
- Several workflows have happy-path forms but not full lifecycle screens.
- Admin functionality exists mostly as backend route scaffolding, not a web admin dashboard.
- Payments, subscriptions, analytics, messaging, notifications, QR scanning, exports, and real document storage are not complete product workflows.
- UI-first dummy-data previews now cover the missing Figma flows, but they are not yet feature-complete production implementations.
- Startup migrations are now supported through `RUN_MIGRATIONS_ON_STARTUP=true` and a `schema_migrations` ledger. MySQL `ADD COLUMN IF NOT EXISTS` is not used; idempotency is handled by one-statement-at-a-time migrations plus duplicate column/key/constraint error skipping.

### Missing

- Complete Figma frame-level parity mapping for the copied-file nodes that still need fresh IDs.
- Backend-backed admin dashboard.
- Flutterwave-backed payment dashboard and installment plan UX.
- Database-backed communication hub and chat.
- Visitor/security analytics and gate operations beyond QR check-in.
- Admin web dashboard.
- Push notification token registration and remote delivery.
- Production-ready file upload/storage and payment provider integration.

## Gap Matrix

| Module | Current App Status | Figma/Product Expectation | Gap | Priority |
| --- | --- | --- | --- | --- |
| Onboarding | Exists. Three-slide image carousel with dark styling. | Likely intro/education frames. | Need confirm if Figma includes different user-type onboarding, permissions, or CTA path. | P2 |
| Auth | Exists. Login/register/reset screens with demo account shortcuts. | `EstateFlowLoginScreen 1`, `EstateFlowOTPVerificationScreen 1`. | Social sign-in is alert-only; OTP verification screen is missing; phone-first/auth-code paths need implementation. | P1 |
| Role Routing | Exists. User role chooses navigator. | Multi-persona app flows. | Estate manager verification gating is not fully enforced in navigator after login. | P0 |
| Buyer Browse | Exists. Listing feed, filters, saved, detail. | Plot/estate browsing screens. | Filter button has no advanced filter modal; listing data is mock/context-backed; no public estate reporting CTA. | P1 |
| Listing Detail | Exists. Plot detail, docs, status controls for managers. | Detailed listing/profile screens. | Needs richer estate profile, document visibility rules, gallery, report listing, reservation/purchase CTA states. | P1 |
| Saved Listings | Exists. | Saved/favorites. | Works locally only; no backend persistence. | P2 |
| Purchases | Exists. | Buyer purchase/installment tracking. | Currently shallow; no installment schedule, receipts, payment status, documents by purchase. | P1 |
| Estate Manager Dashboard | Partial. Reuses listing dashboard. | Operational manager dashboard. | Missing manager-specific KPIs, verification prompt, estate health, pending actions, sales pipeline, resident/security summaries. | P0 |
| Estate Management | Partial. Estate list and quick draft creation. | `EstateFlowAddEstateScreen 1`. | No full create/edit form, media gallery, amenities/features selector, estate status controls, location picker, legal document upload, or publish controls. | P0 |
| Plot/Property Management | Partial. Plot list, search, quick create, mark reserved. | `EstateFlowAddPlotScreen 1`, `EstateFlowPlotMapScreen 1`. | Missing full add-plot form, plot map, bulk import, lifecycle filters, plot dimensions/facing/features, price editing, title docs, full status history, allocation detail. | P0 |
| Sales Workflow | Partial. Buyer/reserve/sale/allocation actions. | Sales and allocation management. | Needs buyer records list, sale detail, reservation expiry, payment/installment linkage, document generation, audit trail UI. | P0 |
| Verification | Exists/partial. Wizard and status screen. | Estate manager onboarding + document verification. | Missing admin review UI, additional-info loop depth, per-document status, Cloudinary-backed upload, reviewer comments. | P0 |
| Digital Forms | Partial. Template list/fill flow exists. | `EstateFlowDigitalFormsDashboard 1`, `EstateFlowFillFormDocumentUpload 1`. | Needs manager template upload/creation, form assignment, submission status, document upload sections, document hash/version audit, export. | P1 |
| Electronic Signature | Partial. Typed/drawn signature component exists. | `EstateFlowDocumentPreviewSign 1`. | Needs document preview screen, server-stored acceptance metadata, document version/hash display, finalized signed record detail. | P1 |
| Resident Home | Partial. Good dark dashboard shell. | Resident dashboard. | Needs real resident profile, verification status, property link, maintenance/request history, notification center. | P1 |
| Resident/Staff/User Management | Partial. Manager resident list/add actions. | `EstateFlowEstateUserManagement 1`. | Missing user detail pages, role invites, security/staff assignment, resident document upload, status transition audit, property linking UI. | P1 |
| Visitor Pass Generation | Partial. Resident can generate local pass/PIN. | Visitor verification/pass-generation flow. | No QR asset, photo capture, pass type selector, host lookup, recurring/multi-day pass, server-backed expiry. | P0 |
| Security Home | Partial. Basic stats/actions/recent passes. | Rich officer dashboard from Figma notes. | Missing period toggle, total/active/today/alerts cards, alert banner, gate status grid, purpose breakdown, live activity feed backed by API. | P0 |
| Verify Pass | Mostly implemented. Camera QR scanning, PIN fallback, signed QR token validation, expiry handling, check-in/check-out state, verification log persistence, and DB schema/routes exist. | Scan QR or enter PIN. | Needs physical-device QA and stricter estate/gate authorization rules once estate/security assignment data is finalized. | P1 |
| Visitor Log | Partial. Searchable log. | Visitor history analytics/export. | Missing trend charts, date filters, export CSV/PDF, purpose breakdown, active visitors view. | P1 |
| Maintenance | Backend lifecycle implemented; mobile booking is backend-first with seeded fallback. | Maintenance requests + provider marketplace. | Provider marketplace data is still seeded unless managers create providers; attachment storage remains deferred until storage credentials are configured. | P1 |
| Issue Reporting | Backend workflow implemented; resident report form is backend-first with local fallback. | Fraud/misrepresentation and estate issue reporting. | Admin actions exist through API, including suspend/remove estate outcomes; admin web dashboard UI is intentionally deferred. Attachments wait on storage integration. | P1 |
| Communication Hub | Missing. | `EstateFlowCommunicationHub 1`, `EstateFlowPremiumChat 1`. | No messaging, announcements module, direct/group chat, notification center, unread states, premium chat, or push-token UX. | P1 |
| Payments | Missing. | `EstateFlowBillingPaymentDashboard 1`, `EstateFlowCheckoutPayment 1`, `EstateFlowInstallmentManagement 1`, visible `EstateFlowTransactionHistory 1`. | No payment dashboard, Flutterwave checkout, receipts, billing history, transaction history, revenue charts, active installment plan UI. | P0 |
| Admin Dashboard | Missing in mobile/web UI. | `EstateFlowAdminDashboard 1`. | Backend route exists but no web dashboard/admin UI. Build separately from mobile unless Figma intentionally scopes it to mobile admin. | P0 |
| Analytics/Reports | Backend aggregation and JSON/CSV export endpoints implemented. | Visible `EstateFlowReportsAnalytics 1`, visitor history analytics frames. | Mobile chart/report UI remains preview-style; admin web dashboard UI is intentionally deferred. | P1 |
| Help And Support | Missing. | `EstateFlowHelpSupport 1`. | No support center, FAQs, contact support, issue categories, or ticket state. | P2 |
| Settings/Profile | Partial. Profile screen exists. | Visible `EstateFlowProfile 1`, `EstateFlowSettings 1`. | Profile is basic and settings screen is missing; no preferences, security, support, or account controls. | P2 |
| Notifications | Partial. In-app/local notification provider, notification center, read/unread state, and backend notification routes exist. | Permission flow, notification center, role-relevant events. | Push token registration and remote delivery are intentionally deferred by request; more workflow event triggers can still be added later. | P1 |

## Implementation Priority

### P0: Must Fix Before Figma Parity Claims

1. Copy fresh node links for the duplicate-file frames whose original IDs no longer resolve, then capture their exact metadata.
2. Add estate manager verification gating after login so unverified managers cannot use full management tools.
3. Replace the estate manager dashboard with a true operational dashboard: verification status, estate count, plot lifecycle counts, pending documents, recent sales, quick actions.
4. Expand estates and plots into real create/edit/detail flows.
5. Complete sales/allocation workflow with buyer records, reservation detail, status history, and document/payment hooks.
6. Build payment and installment screens if any of the supplied Figma frames cover billing.
7. Upgrade security visitor flow UI around the completed QR/PIN backend: richer alert states, gate dashboard, and physical-device camera QA.
8. Add admin review surfaces, preferably in the separate web admin dashboard defined in the plan.

### P1: Important Product Depth

1. Communication hub: pinned announcements, chats, groups, notification center.
2. Maintenance module UI: request list/detail screens, attachment UX, and richer provider marketplace surfaces on top of the completed backend lifecycle.
3. Resident management: directory detail, verification documents, property linking, status transitions.
4. Digital forms: template management, assignments, submissions, export/audit.
5. Public estate reporting UI: listing-detail CTA, attachment UX, and admin web review surfaces on top of the completed backend workflow.
6. Visitor analytics UI: date filters, charts, exports, active visitors on top of the completed backend aggregation/export routes.
7. Buyer purchases: receipts, installment schedule, paid/remaining totals.

### P2: Polish And Completion

1. Advanced search/filter modals for listings and plot inventory.
2. Empty/loading/error states across every API-backed screen.
3. Replace hardcoded estate/residency labels with backend profile data.
4. Persist saved listings server-side.
5. Add chart components only after backend aggregation contracts are stable.
6. Tune spacing and density after exact Figma frames are available, keeping the dark DM Sans system.

## Recommended Implementation Order

1. Figma access pass: collect frame names, screenshots, and classify every node.
2. Navigation pass: add missing stacks/tabs only where Figma shows real workflows.
3. Data-contract pass: confirm backend endpoints required by each missing screen.
4. P0 screen pass: verification gating, manager dashboard, estate/plot detail, sales/allocation, security verification, payments/admin if present in frames.
5. P1 workflow pass: communication, maintenance, reporting, resident management, forms.
6. QA pass: role-by-role smoke tests, narrow-screen layout checks, loading/error/empty states.

## Design System Mapping Rules

- Convert Figma colors to existing dark tokens instead of copying raw colors.
- Convert Figma typography to the existing DM Sans variants unless a new type role is truly needed.
- Use `StatusChip` for lifecycle, payment, resident, visitor, verification, and maintenance statuses.
- Use `Button`, `TextField`, `Screen`, `AppText`, and shared `spacing` before creating one-off styles.
- Use Hugeicons equivalents where the glyph clearly matches. If an exact Figma-exported icon is required, commit the exported asset rather than drawing it manually.
- Keep card radius near the app's current operational surfaces; avoid introducing a separate visual language.

## Open Questions For The Figma Pass

- Which supplied nodes map to auth/onboarding versus role dashboards?
- Are payment, communication hub, visitor history, and security officer dashboards included in this specific node batch?
- Does Figma include admin dashboard frames, or only the mobile app?
- Are any frames intended as future scope rather than Phase 1?
- Are there exact copy/legal requirements in Figma that should override current placeholder copy?

## Current Conclusion

The app has a strong foundation and several real workflow shells, but it is not yet Figma-complete. The biggest gaps are workflow depth, backend-backed lifecycle state, admin/payment/security modules, and exact Figma frame parity. The next useful pass is not visual restyling; it is converting the Figma screens into dark-theme, DM Sans, Expo-native workflows using the app's existing component system.
