# Real Estate Management Platform Implementation Plan

This document defines the implementation plan for the Real Estate Management Platform mobile app and supporting systems.

The project will use:

- Expo SDK 57
- React Native with JavaScript, not TypeScript
- React Navigation, not Expo Router
- Hugeicons, not Lucide React Native
- A custom backend, not Firebase as the primary backend
- Strong responsive layout practices, avoiding fragile absolute positioning

## 1. Product Scope

### 1.1 Business Model

This platform is a **land and plot distribution and estate operations system**, not a general house-sale or rental marketplace. The primary focus is land: plots within managed estates, their allocation, sale, and title documentation.

The platform is operated by a single main distributor (the client/business owner). All other accounts that sign up (estate managers, sub-agents, residents, buyers, security personnel) operate **under that main distributor's management** rather than as independent, unrelated organizations. Estate managers are not competing landlords onboarding their own unrelated portfolios; they are staff, agents, or partners managing plots and estates on behalf of the main distributor.

Key implications for the build:

- Currency is **Nigerian Naira (₦)**, not USD or any other currency.
- The platform is **based in Nigeria**; locations, addresses, and identity/title document types should reflect Nigerian conventions (e.g., Certificate of Occupancy, Governor's Consent, Deed of Assignment, Survey Plan, NIN/BVN where relevant instead of generic "identity documents").
- Inventory is **plots of land within estates**, not standalone houses. Listings should describe plot number, plot size, title type, and location within the estate rather than bedrooms/bathrooms/house-style amenities.
- Buyers purchase or reserve plots (typically outright purchase or an installment plan), not month-to-month rentals.
- Every estate manager, agent, resident, and security account ultimately reports up to the one main distributor account. Future work should model this as an explicit hierarchy (e.g., a `managed_by_user_id` / distributor-scoped relationship) rather than treating estate managers as fully independent tenants.

### 1.2 Phase 1 Scope

The Phase 1 scope includes:

- User registration, login, roles, and access control
- Estate manager onboarding and verification
- Estate, plot, and land inventory management
- Plot sales, reservations, and allocations
- Buyer and owner management
- Digital document upload and categorization (land titles, survey plans, ownership documents)
- Digital forms and electronic acceptance/signature records
- Payment integration (Naira, with support for installment plans)
- Resident management
- Visitor and security management
- Maintenance management
- Communication and notifications
- Subscription and billing
- Admin dashboard
- Reporting and analytics
- Android and iOS mobile builds where supported
- Custom backend, database, API, deployment, and documentation

## 2. Technical Architecture

### 2.1 Mobile App

The mobile app will be built with Expo and React Native.

Core mobile decisions:

- Use JavaScript files: `.js` and `.jsx`.
- Use React Navigation for all navigation.
- Do not use Expo Router or file-based routing.
- Use Hugeicons for iconography.
- Use reusable layout primitives instead of one-off screen styling.
- Use `StyleSheet`, theme constants, safe area handling, and responsive dimensions.
- Avoid fixed absolute positioning for primary layouts.
- Use absolute positioning only for valid overlays such as modals, floating action buttons, toasts, map markers, or image overlays.

Recommended mobile dependencies:

- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`
- `react-native-screens`
- `react-native-safe-area-context`
- `react-native-gesture-handler`
- `react-native-reanimated`, only where needed
- Hugeicons React Native package
- `expo-secure-store`
- `expo-document-picker`
- `expo-image-picker`
- `expo-file-system`
- `expo-notifications`
- `expo-device`
- `expo-constants`
- `@react-native-async-storage/async-storage`, where non-sensitive local persistence is needed

Expo SDK packages should be installed with:

```bash
npx expo install package-name
```

This keeps native package versions aligned with Expo SDK 57.

### 2.2 Backend

The backend will be custom-built. Firebase is not required.

Recommended backend stack:

- Python
- Flask
- MySQL
- PyMySQL
- Raw SQL queries with parameter binding
- SQL migration files managed manually or with a lightweight migration runner
- Flask-JWT-Extended or an equivalent JWT auth package
- Marshmallow, Pydantic, or another validation layer
- Object storage for documents and images
- Redis for queues, sessions, rate limits, and background jobs where needed
- JWT access tokens and refresh tokens
- Server-side payment webhook verification
- REST API for mobile and admin dashboard

Recommended storage options:

- Cloudinary (selected): estate imagery, property imagery, documents, and evidence attachments.

Cloudinary uploads must be authorized by Flask. MySQL stores the Cloudinary public ID, secure URL, resource type, document category, owner, and access-control metadata. Secret credentials and unsigned upload privileges must not ship in the Expo app.

Recommended deployment options:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- AWS

### 2.3 Admin Dashboard

The admin dashboard should be a web application instead of being forced into the mobile app.

Recommended admin stack:

- React web app
- Vite or Next.js
- Same custom backend API
- Role-restricted admin access
- Responsive desktop-first data tables and review screens

The mobile app may include light admin views if needed, but verification review, reports, audit logs, documents, and analytics are better handled in a web dashboard.

## 3. Core Data Model

The backend should be designed around relational data stored in MySQL. Database access should use PyMySQL and explicit raw SQL queries. Queries must use parameter binding instead of string interpolation.

Primary entities:

- `users`
- `roles`
- `permissions`
- `estates`
- `estate_managers`
- `estate_verification_applications`
- `verification_documents`
- `supporting_documents`
- `properties`
- `property_status_history`
- `buyers`
- `reservations`
- `sales`
- `allocations`
- `residents`
- `resident_forms`
- `visitors`
- `visitor_logs`
- `maintenance_requests`
- `maintenance_updates`
- `digital_forms`
- `form_submissions`
- `signature_records`
- `payments`
- `payment_events`
- `onboarding_packages`
- `onboarding_package_purchases`
- `installment_plans`
- `installments`
- `subscriptions`
- `plans`
- `notifications`
- `conversations`
- `conversation_participants`
- `messages`
- `community_groups`
- `community_group_members`
- `visitor_passes`
- `estate_reports`
- `admin_actions`
- `audit_logs`

Entities added to support the enriched Phase 4/7/9/11 UI references (see those phases for detail): `installment_plans`/`installments` for the payment dashboard's installment tracking, `conversations`/`conversation_participants`/`community_groups`/`community_group_members` for the communication hub, and `visitor_passes` for QR/PIN-based visitor verification. The `estates` and `properties` tables also need the additional columns listed under Phase 4 (amenities, image gallery, plot dimensions/facing/features, internal notes, sales assignment) and, longer-term, a distributor-hierarchy column (e.g., `managed_by_user_id`) per the Business Model section above — none of this is implemented yet.

Important backend rules:

- Every sensitive status change must be audited.
- Every uploaded document must have ownership, category, and access rules.
- Client-side role checks must be treated as UI convenience only.
- Backend authorization must enforce all real access control.
- Payment success must be verified by server-side webhook or transaction verification endpoint.
- Sold or allocated properties must not appear as publicly available unless an authorized admin changes the status.

## 4. User Roles

### 4.1 The Three Primary User Groups

The client has clarified the platform's real-world structure as three groups, and this is the authoritative framing for how the system should behave (supersedes any looser "everyone is an independent tenant" reading elsewhere in this document):

**1. Estate Managers / Administrators (B2B users).** These are the business clients running gated communities on the platform, operating under the main distributor (see Section 1.1). They must complete self-onboarding and verification (Government Planning Approval, Land Title/C of O/Deed of Assignment, Survey Plan) before publishing estate information. Their day-to-day tasks: upload digital forms (Plot Allocation, Ownership Transfer), approve resident entries, verify tenant/resident records, and manage the plot sales lifecycle (Available → Reserved/Under Offer → Sold → Allocated).

**2. Estate Residents / Buyers (B2C users).** These are the everyday occupants, tenants, and property buyers living in or buying into the managed estates. In our technical role model this maps to the `resident` and `buyer` roles — two distinct database roles that represent the same business-facing persona group with overlapping app experience. Their tasks: submit Resident Verification Forms, request entry approval for their visitors, report estate-level issues or misrepresentation, and book maintenance services (including a maintenance-provider marketplace — e.g. requesting a plumber — not just an internal ticket system; see Phase 10).

**3. Super Administrators / Platform Owners.** This is the client's own internal governance layer over the entire platform across Nigeria — not a per-estate role. Tasks: audit and review submitted land documents from new estate managers, change verification statuses (Approved/Rejected/Additional Information Required), review fraud/misrepresentation reports, and temporarily or permanently suspend offending estate listings. This is the `super_admin` role (with `admin` as an optional lower-privilege reviewer under it), and it is the layer the Admin Dashboard (Section 2.16 / Phase 13) is built for.

`security` (security personnel) is not one of the three primary business-facing groups above — it's an operational role working for/under an Estate Manager (gate staff), not a separate persona the client interacts with directly. It stays as a distinct technical role for access control, but should be thought of as part of group 1's operations, not a fourth primary tier.

Initial role model (technical/database roles):

- Super Admin
- Admin or Reviewer
- Estate Manager
- Resident
- Buyer or Owner
- Security Personnel
- Public User or Guest

Role-based behavior:

- Public users can browse approved estates and report suspicious listings.
- Estate managers can onboard, upload documents, and manage estates after approval.
- Unverified estate managers cannot publish estate information or access full management tools.
- Residents can manage their profile, visitors, maintenance requests, and estate communication.
- Security personnel can manage visitor check-in, visitor logs, resident lookup, and access records.
- Admins can review applications, manage users, review reports, suspend estates, and access analytics.
- Super Admins can manage system-wide settings, plans, billing, admins, and final administrative actions.

## 5. Navigation Plan

React Navigation should be organized by authentication and role.

Navigation groups:

- `AuthStack`
- `PublicStack`
- `EstateManagerNavigator`
- `ResidentNavigator`
- `SecurityNavigator`
- `BuyerNavigator`
- `AdminNavigator`
- `RootNavigator`

Recommended route behavior:

- App starts in a loading gate.
- Loading gate checks token and current user profile.
- Unauthenticated users go to `AuthStack` or `PublicStack`.
- Authenticated users are routed by role.
- Estate managers with incomplete verification are routed to onboarding status screens.
- Suspended or rejected users see restricted access screens.

Recommended estate manager tabs:

- Dashboard
- Estates
- Properties
- Sales
- Documents
- More

Recommended resident tabs:

- Home
- Visitors
- Maintenance
- Messages
- Profile

Recommended security tabs:

- Check-In
- Visitors
- Residents
- Logs
- Profile

Recommended buyer tabs:

- Browse
- Saved
- Purchases
- Documents
- Profile

## 6. UI And Layout Standards

The app should feel professional, operational, and trustworthy.

Layout rules:

- Use safe area wrappers on all screens.
- Use consistent horizontal screen padding.
- Use scroll containers for long content.
- Use keyboard-aware behavior on form screens.
- Use lists for large data sets instead of manually stacked views.
- Use status chips for verification, property status, payment status, and maintenance status.
- Use bottom sheets or modals for focused actions.
- Use skeleton loaders or clear loading indicators.
- Use empty states that explain the next available action.
- Keep touch targets large enough for mobile use.
- Avoid overlapping text, icons, and buttons.
- Avoid text-heavy cards where a structured list or form works better.

Hugeicons usage:

- Use icons for tabs, action buttons, empty states, upload actions, filters, search, notifications, documents, visitors, maintenance, and payments.
- Keep icon style consistent across the app.
- Do not mix icon libraries unless a missing icon absolutely requires it.

Positioning rules:

- Use flexbox, gap, padding, margin, grid-like rows, and responsive constraints.
- Avoid using `position: absolute` for main screen sections.
- If absolute positioning is used, keep it limited to overlays and test on multiple screen sizes.

## 7. Phase-By-Phase Implementation

### Phase 0: Scope Lock And Product Decisions

Goal: convert the broad contract into a buildable execution map.

Tasks:

- Confirm user roles for Phase 1.
- Confirm whether buyer-facing browsing is public or authenticated.
- Payment gateway locked: Flutterwave for Naira payments. Flask owns payment initialization, verification, refunds, webhook verification, and payment-event recording.
- Storage provider locked: Cloudinary for estate images, property images, legal documents, and workflow attachments.
- Electronic signature rule locked: legal full-name entry and explicit consent are mandatory; a drawn signature is optional. Each acceptance stores the exact document version/hash, acceptance statement, signer, timestamp, and available request metadata. This is an auditable electronic acceptance record rather than a third-party witnessed-signature service.
- Confirm exact admin dashboard requirements.
- Confirm launch target: Android first, iOS second, or both.
- Confirm required legal document types and naming.
- Define recurring subscription packages and billing rules separately from one-time onboarding packages.

#### Estate Onboarding Packages (One-Time)

Estate onboarding is a separate activation purchase, not a monthly subscription. Package inheritance is mandatory: Standard includes Basic, and Premium includes Standard and Basic.

| Package | Scope |
| --- | --- |
| Basic Onboarding Package | Estate manager account configuration; one estate profile; verification document intake; legal acceptance setup; and basic estate/plot setup guidance. |
| Standard Onboarding Package | Everything in Basic; assisted estate profile configuration; initial plot inventory import/setup; document organisation; resident and security setup assistance; and launch review. |
| Premium Onboarding Package | Everything in Standard; priority white-glove setup; full initial estate/plot configuration support; staff onboarding support; branded operational forms/templates; launch-readiness review; and priority post-launch setup support. |

Commercial configuration still required: package prices, included plot and staff limits, turnaround targets, and support windows. Store package definitions, purchases, and fulfilment status separately from subscription tables.

#### Monthly Subscription Plans (Recurring)

Monthly subscriptions govern ongoing access after onboarding. Their tier names, prices, feature entitlements, user/estate/plot limits, trial period, grace period, and renewal rules remain a Phase 0 commercial decision; they must not reuse the Basic, Standard, and Premium onboarding-package records unless the owner explicitly chooses matching public names.

Deliverables:

- Final feature matrix
- Screen inventory
- API module inventory
- Data model draft
- Payment and storage decision
- Milestone acceptance checklist

Acceptance criteria:

- No major workflow ambiguity remains.
- Phase 1 features are separated from future enhancements.
- Client responsibilities and credentials are clearly listed.

### Phase 1: Project Foundation

Goal: establish the mobile app and backend foundation.

Mobile tasks:

- Install React Navigation and required native dependencies.
- Install Hugeicons.
- Create `src` folder structure.
- Create navigation shell.
- Create theme constants.
- Create base components:
  - `Screen`
  - `AppText`
  - `Button`
  - `IconButton`
  - `TextField`
  - `SelectField`
  - `StatusChip`
  - `EmptyState`
  - `LoadingState`
  - `ErrorState`
  - `DocumentUploadCard`
  - `PropertyCard`
  - `EstateCard`
- Create API client layer.
- Create auth context.
- Create environment configuration.

Backend tasks:

- Initialize backend project.
- Configure database.
- Set up PyMySQL database connection helpers.
- Add a migrations folder for versioned raw SQL schema changes.
- Create base API structure.
- Add auth middleware.
- Add role/permission middleware.
- Add audit log helper.
- Add file upload abstraction.
- Add error response format.
- Add request validation pattern.

Deliverables:

- Running mobile app shell
- Running backend API
- Database connected
- Navigation configured
- Base UI system created

Acceptance criteria:

- App starts without Expo Router.
- Navigation works with React Navigation.
- Hugeicons render.
- Backend health endpoint responds.
- Mobile API client can call backend health endpoint.

### Phase 2: Authentication And Access Control

Goal: implement identity, roles, and secure routing.

Mobile tasks:

- Login screen.
- Register screen.
- Forgot password screen.
- Password reset flow.
- Current user loading gate.
- Role-based home routing.
- Suspended account screen.
- Profile setup screen.

Backend tasks:

- User registration endpoint.
- Login endpoint.
- Refresh token endpoint.
- Logout endpoint.
- Password reset request endpoint.
- Password reset confirm endpoint.
- Current user endpoint.
- Role assignment.
- Permission enforcement.
- Auth audit logging.

Deliverables:

- Working auth flow
- Token storage
- Role-aware navigation
- Backend auth endpoints

Acceptance criteria:

- Users can register and log in.
- Users are routed by role.
- Protected routes reject unauthorized requests.
- Suspended users cannot access protected workflows.

### Phase 3: Estate Manager Onboarding And Verification

Goal: allow estate managers to self-onboard and submit documents for approval.

Mobile tasks:

- Estate manager onboarding wizard.
- Manager profile form.
- Estate information form.
- Required document upload screens.
- Supporting document upload screens.
- Terms acceptance screen.
- Signature or electronic acceptance screen.
- Submission review screen.
- Verification status screen.
- Additional information resubmission flow.

Backend tasks:

- Create verification application endpoint.
- Update draft application endpoint.
- Upload document endpoint.
- Submit application endpoint.
- Get application status endpoint.
- Admin review endpoints.
- Status transition logic.
- Document access authorization.

Verification statuses:

- Pending Review
- Approved
- Rejected
- Additional Information Required

Mandatory document categories:

- Government Planning Approval or Approved Estate Layout Plan
- Land Title or Registration Document
- Certificate of Occupancy, Deed of Assignment, or equivalent where applicable
- Survey Plan
- Estate Development Approval or Registration Certificate where applicable

Supporting document categories:

- Plot Allocation Form
- Ownership Transfer Form
- No Objection Certificate Issuance Form

Deliverables:

- Complete onboarding flow
- Document uploads
- Legal acceptance record
- Admin review workflow

Acceptance criteria:

- Estate manager cannot submit without mandatory documents.
- Submitted applications become pending review.
- Admin can approve, reject, or request more information.
- Unapproved estate managers cannot publish estates.

### Phase 4: Estate, Plot, And Property Management

Goal: allow approved estate managers to manage estates and inventory.

UI reference note: the client shared Figma reference screens ("Add New Estate", "Add New Plot") showing the expected level of detail for these forms. Build to that feature depth, but keep our own dark theme, DMSans typography, spacing scale, and existing component set (`Button`, `TextField`, `Checkbox`, `StatusChip`) rather than the light/teal visuals shown in the reference. The reference is a content/field checklist, not a skin to copy.

Mobile tasks:

- Estate list screen.
- Estate detail screen.
- Create estate screen, as a multi-step form (matching the register/verification wizard pattern already established):
  - Basic information: estate name, location/address, developer name, total area, total plot count, phase, zone.
  - Estate status selector (Active, Upcoming, Selling).
  - Description field.
  - Amenities & features as toggle chips (security, parks, wide roads, utilities, schools nearby, commercial areas, etc.).
  - Estate images: cover image plus gallery upload.
  - Legal documents upload (NOC/registry, government approval letter) — reuse the document upload pattern already built for verification.
- Edit estate screen (same fields as create, pre-filled).
- Property (plot) list screen.
- Property (plot) detail screen.
- Create property/plot screen, as a multi-step form:
  - Plot identity: plot number, block, plot size, phase, price, dimensions (width x depth), facing direction.
  - Plot type selector (Residential, Commercial, Industrial).
  - Plot status selector (Available, Reserved, Sold) with a confirmation step noting that changing status to Sold triggers the ownership/allocation transfer flow from Phase 5.
  - Plot features as toggles (corner plot, road facing, near park, utilities available).
  - Owner assignment: attach a buyer record (call/message/view-documents quick actions), matching Phase 5's buyer records.
  - Internal notes field (private, staff-only; not shown to the buyer).
  - Sales assignment: assign the plot to an agent/sales staff member, with a "reserve for customer" quick action tying into Phase 5 reservations.
- Edit property/plot screen.
- Property image upload.
- Property document upload.
- Search and filter interface.
- Status update action sheet.

Backend tasks:

- Estate CRUD endpoints.
- Property CRUD endpoints.
- Property media endpoints.
- Property document endpoints.
- Property search endpoint.
- Status update endpoint.
- Status history table.
- Availability rules.
- Schema extension needed: the current `estates` and `properties` tables only cover the minimal fields built in the Phase 1 foundation (name, location, description, status, price, plot size). Supporting the richer forms above requires new columns/tables for: developer name, total area, total plot count, zone, amenities (likely a join table or JSON column), estate image gallery, plot dimensions (width/depth), facing direction, plot type, plot feature toggles, internal notes (staff-only, excluded from any buyer-facing serialization), and sales-staff assignment (`assigned_to_user_id` on `properties`). Not yet implemented — flagged here for the Phase 4 build-out.

Property statuses:

- Available
- Reserved
- Under Offer
- Sold
- Allocated
- Unavailable

Allowed lifecycle:

- Available to Reserved
- Available to Under Offer
- Reserved to Sold
- Under Offer to Sold
- Sold to Allocated
- Admin override for exceptional cases

Deliverables:

- Estate management
- Property management
- Search and filters
- Status lifecycle

Acceptance criteria:

- Only approved estate managers can publish or manage active estate listings.
- Sold and allocated properties do not appear as generally available.
- All property status changes are recorded.
- Users can search and filter by status.

### Phase 5: Buyer, Sales, Reservation, And Allocation

Goal: connect properties to buyers and transaction records.

Mobile tasks:

- Buyer list screen.
- Buyer detail screen.
- Create buyer screen.
- Reservation flow.
- Sale recording flow.
- Allocation recording flow.
- Sales history screen.
- Allocation detail screen.

Backend tasks:

- Buyer CRUD endpoints.
- Reservation endpoints.
- Sale endpoints.
- Allocation endpoints.
- Duplicate active transaction prevention.
- Property status synchronization.
- Sales audit logging.

Deliverables:

- Buyer management
- Property reservation
- Sales records
- Allocation records

Acceptance criteria:

- A property cannot have conflicting active reservations or sales.
- Reservation updates property status.
- Sale updates property status.
- Allocation updates property status.
- Buyer and owner records are linked to property records.

### Phase 6: Digital Forms And Signature Records

Goal: digitize internal estate forms and preserve acceptance records.

Mobile tasks:

- Dynamic form renderer or reusable form templates.
- Plot Allocation Form.
- Ownership Transfer Form.
- NOC Issuance Form.
- Resident Entry Approval Form.
- Resident Verification Form.
- Signature capture or electronic acceptance component.
- Submitted forms list.
- Submitted form detail screen.

Backend tasks:

- Form template endpoints.
- Form submission endpoints.
- Signature record endpoints.
- Submitted form storage.
- Form access authorization.
- Immutable submitted record handling.

Recorded signature metadata:

- User ID
- User role
- Estate ID
- Property ID where applicable
- Form version
- Acceptance timestamp
- IP address where available
- Device metadata where available
- Signature method

Deliverables:

- Digital forms
- Signature or acceptance records
- Form submission storage

Acceptance criteria:

- Users can complete and submit forms.
- Signed forms cannot be silently modified.
- Form submissions are linked to the correct estate, user, resident, or property.

### Phase 7: Payment And Billing

Goal: implement secure payment and billing workflows, including installment plans for plot purchases.

UI reference note: the client shared a Figma "Payment Dashboard" reference (revenue summary, monthly revenue trend, payment distribution breakdown, weekly collection chart, active installment plans, recent transactions). Match that feature set and layout density, but render it with our existing dark theme and component library, not the reference's light/teal skin. All currency values must render in Naira (₦) using the existing `formatNaira` helper convention.

Mobile tasks:

- Payment initiation screen.
- Payment status screen.
- Billing history screen.
- Subscription plan screen.
- Invoice or receipt detail screen.
- Payment dashboard screen (primarily for estate managers/distributor staff):
  - Total revenue summary card with period-over-period change.
  - Quick actions: make payment, view installment plans, view invoices, view history.
  - Monthly revenue trend chart.
  - Payment distribution breakdown (completed vs. pending vs. overdue).
  - Weekly collection chart.
  - Active installment plans list per buyer, each with progress (installments paid / total), next due date, and a "Pay now" / "Send reminder" action.
  - Recent transactions list.
- Installment plan screen for buyers: view their own plan schedule, amount paid, amount remaining, next due date, and pay the next installment.

Backend tasks:

- Flutterwave payment initialization endpoint.
- Flutterwave transaction verification endpoint.
- Flutterwave webhook endpoint with signature verification and idempotent payment-event storage.
- Payment event storage.
- Subscription plan endpoints.
- Estate onboarding package endpoints: list packages, create package purchase, track payment and fulfilment status. These one-time purchases must be distinct from recurring subscription records.
- Subscription activation and expiry logic.
- Billing history endpoint.
- Installment plan endpoints: create a plan against a sale (number of installments, amount per installment, due dates), record each installment payment, compute plan progress and overdue status.
- Revenue/collection aggregation endpoints for the payment dashboard (by estate, by period).

Recommended payment flow:

- Mobile requests payment initialization from backend.
- Backend creates transaction with provider.
- Mobile opens checkout.
- Provider redirects or returns result.
- Backend verifies transaction server-side.
- Webhook records final payment event.
- Backend updates subscription or transaction status.

Deliverables:

- Payment integration
- Billing history
- Subscription records

Acceptance criteria:

- Client-side payment success is not trusted alone.
- Backend verifies all payments.
- Payment records are stored.
- Subscription access is enforced by backend.

### Phase 8: Resident Management

Goal: manage residents, resident records, and resident access.

Mobile tasks:

- Resident dashboard.
- Resident profile screen.
- Resident directory for managers.
- Resident verification form.
- Resident entry approval form.
- Resident document upload.
- Resident status management.

Backend tasks:

- Resident CRUD endpoints.
- Resident-property linking.
- Resident verification endpoints.
- Resident document endpoints.
- Resident status updates.
- Access authorization.

Resident statuses:

- Pending
- Verified
- Active
- Suspended
- Moved Out

Deliverables:

- Resident records
- Resident verification
- Resident access management

Acceptance criteria:

- Residents are linked to estates and properties.
- Estate managers can manage residents for their estates.
- Security personnel only see access-relevant resident information.

### Phase 9: Visitor And Security Management

Goal: support visitor access workflows for estate security teams.

UI reference note: the client shared three Figma references for this phase — a "Visitor History" analytics screen, an "Officer" security home dashboard, and a "Visitor Verification" pass-generation flow. Build to that feature depth (this replaces the placeholder `SecurityNavigator` "coming soon" screen once implemented), using our dark theme and component library rather than the reference's light/teal visuals.

Mobile tasks:

- Security home dashboard (replaces the current placeholder):
  - Estate summary header with total visitors, active visitors, today/this-week/30-day toggle.
  - Stat cards: total visitors, active visitors, today's visitors, security alerts.
  - Security alert banner for flagged/unrecognized visitors, with "Call guard" and "Trigger emergency" actions.
  - Quick actions row (generate QR, scan QR, verify PIN, emergency log, report).
  - Gate status grid (per gate: open/closed, staffed/unstaffed).
  - Recent visitors list with live status chips (in estate / checked out / pending / blocked).
  - Live activity feed (entries, exits, denied attempts) as a real-time-feeling log.
  - Visit-purpose breakdown for the current period (family, business, delivery, medical, other).
- Visitor verification / pass flow:
  - Visitor information form (full name, phone, national ID/NIN, plate number, visit purpose).
  - Resident/host lookup (name, estate, block/phase) to link the visit.
  - Visit details (date, expected arrival window).
  - Pass type selector (single entry, multi-day, recurring).
  - Generate visitor pass: produces a QR code and a numeric PIN as alternate verification, shown alongside the visitor's photo if captured.
  - Verify pass screen: scan the QR code, or fall back to manual PIN entry on a numeric keypad, to check the visitor in.
- Visitor invite screen (resident-initiated, pre-registers an expected visitor).
- Visitor approval screen.
- Security check-in screen.
- Security check-out screen.
- Active visitors screen.
- Visitor logs screen with export (PDF/CSV report) and visitor trend/entry-by-date charts.
- Resident lookup screen.

Backend tasks:

- Visitor invite endpoints.
- Visitor approval endpoints.
- Check-in endpoint.
- Check-out endpoint.
- Visitor log endpoints.
- Visitor pass endpoints: generate pass (QR payload + PIN), verify pass by QR or PIN, expire pass after use or window close.
- Security alert endpoint (flag an unrecognized/denied visitor, notify estate manager and other on-duty security).
- Gate status endpoints (if gates are modeled individually) or a simpler per-estate access-point list.
- Visitor analytics/export endpoints (counts by period, purpose breakdown, CSV/PDF export).
- Security role authorization.

Visitor statuses:

- Pending
- Approved
- Denied
- Checked In
- Checked Out
- Expired

Deliverables:

- Visitor management
- Security check-in workflow
- Visitor logs

Acceptance criteria:

- Security personnel can check visitors in and out.
- Visitor logs include timestamps and responsible staff.
- Visitors are linked to residents and estates.

### Phase 10: Maintenance Management

Goal: allow residents and managers to track estate maintenance requests, and let residents book maintenance service providers directly (a maintenance marketplace), not only file internal tickets.

Client clarification: residents should be able to request and book actual service providers (e.g., a plumber) through the app, not just log a request that only an estate manager sees. This implies a lightweight provider/vendor directory (service category, provider name/contact, availability) in addition to the ticket-style request flow below.

Mobile tasks:

- Create maintenance request screen.
- Maintenance list screen.
- Maintenance detail screen.
- Status update screen for managers.
- Comment/update thread.
- Image attachment upload.
- Maintenance marketplace: browse service providers by category (plumbing, electrical, cleaning, etc.), view provider profile, and book/request a provider directly, tied to the resident's unit and estate.

Backend tasks:

- Maintenance request endpoints.
- Maintenance update endpoints.
- Attachment endpoints.
- Status transition rules.
- Notification triggers.
- Service provider directory endpoints (list/filter by category, provider detail).
- Booking endpoint linking a resident's maintenance request to a specific provider.

Maintenance statuses:

- Open
- Assigned
- In Progress
- Resolved
- Closed

Priorities:

- Low
- Medium
- High
- Urgent

Deliverables:

- Maintenance request workflow
- Updates and comments
- Status tracking

Acceptance criteria:

- Residents can submit maintenance requests.
- Managers can update statuses.
- Request history is visible and retained.

### Phase 11: Communication And Notifications

Goal: notify users about workflow changes and support platform communication.

UI reference note: the client shared a Figma "Communication Hub" reference (pinned announcements, quick actions, direct chats, community groups, announcement feed, live issue ticker). Build to that feature depth using our dark theme and component library, not the reference's light/teal visuals.

Mobile tasks:

- Notification permission flow.
- Notification center.
- Announcement list.
- Announcement detail.
- Communication hub screen:
  - Search across messages, groups, and announcements.
  - Quick actions row (new chat, broadcast announcement, report issue, emergency alert).
  - Pinned announcement card (e.g., scheduled maintenance/utility shutdown) with an acknowledge/RSVP action.
  - Direct chat list (recent conversations with residents, estate managers, or security), each showing last message and unread state.
  - Community groups list (e.g., "All Residents", "Estate Managers", "Security Team", "Maintenance"), each opening a group thread.
  - Announcements feed (scheduled events, road/utility work, general notices) with attachments and an RSVP or acknowledgment count where relevant.
  - Live issues ticker for the estate manager/security view (open maintenance tickets, security notes) as a compact summary linking into Phase 10 maintenance records.
- Basic one-to-one and group messaging (send/receive within a group or direct thread).
- Announcement detail.

Backend tasks:

- Store push tokens.
- Notification creation endpoint.
- Notification read/unread endpoint.
- Announcement endpoints.
- Push notification service.
- Notification event triggers.
- Messaging endpoints: create/list conversations (direct and group), send/list messages, mark read.
- Community group endpoints: list groups a user belongs to, list group members, post to a group.

Notification triggers:

- Verification approved
- Verification rejected
- Additional information requested
- Property reserved
- Property sold
- Property allocated
- Visitor approved
- Visitor checked in
- Maintenance updated
- Payment successful
- Subscription expiring
- Estate report reviewed

Deliverables:

- In-app notifications
- Push notification support
- Announcements

Acceptance criteria:

- Users receive role-relevant notifications.
- Notifications can be marked as read.
- Notification records are stored.

### Phase 12: Public Estate Reporting

Goal: allow users to report suspicious estate listings or documents.

Mobile tasks:

- Report Estate button on approved estate profile.
- Report category selection.
- Report description form.
- Optional attachment upload.
- Report submission confirmation.

Backend tasks:

- Estate report endpoint.
- Report attachment endpoint.
- Admin report review endpoints.
- Estate suspension endpoint.
- Estate removal endpoint.
- Audit logging.

Report categories:

- False Estate Information
- Suspicious Documents
- Fraud Concern
- Misrepresentation
- Other Violation

Admin actions:

- Request additional information
- Temporarily suspend estate
- Permanently remove estate listing
- Dismiss report
- Escalate report

Deliverables:

- Public estate reporting
- Admin report review
- Suspension and removal workflow

Acceptance criteria:

- Submitted reports appear in admin review.
- Suspended estates no longer appear as active public listings.
- Admin report actions are logged.

### Phase 13: Admin Dashboard

Goal: provide web-based management of the full platform.

Admin dashboard modules:

- Login and admin auth
- Overview dashboard
- User management
- Estate manager verification
- Document review
- Estate management
- Property management
- Sales and allocation records
- Resident management
- Visitor/security logs
- Maintenance overview
- Reported estates
- Suspensions and removals
- Payment and subscription monitoring
- Notification and announcement management
- Audit logs
- Basic analytics

Backend tasks:

- Admin-specific endpoints.
- Admin authorization policies.
- Search and filtering endpoints.
- Export endpoints where needed.
- Audit log visibility.

Deliverables:

- Admin web dashboard
- Review workflows
- Operational management tools

Acceptance criteria:

- Admin can review estate manager applications.
- Admin can approve, reject, or request more information.
- Admin can review reports and suspend estates.
- Admin can view key operational records.

### Phase 14: Reporting And Analytics

Goal: provide useful operational and business metrics.

Metrics:

- Total users
- Total estate managers
- Pending verifications
- Approved estates
- Rejected applications
- Available properties
- Reserved properties
- Sold properties
- Allocated properties
- Sales volume
- Active residents
- Visitor check-ins
- Maintenance requests by status
- Subscription revenue
- Reported estates
- Suspended estates

Mobile reporting:

- Role-specific dashboard summaries.
- Estate manager property and sales summaries.
- Resident maintenance and visitor summaries.

Admin reporting:

- Full analytics dashboard.
- Date filters.
- Estate filters.
- Status filters.
- Exportable tables where required.

Deliverables:

- Dashboard metrics
- Analytics views
- Filterable reports

Acceptance criteria:

- Metrics match database records.
- Admin can filter reports.
- Role dashboards show relevant summaries.

### Phase 15: Testing And Quality Assurance

Goal: verify core flows and prepare a stable client build.

Testing areas:

- Registration
- Login
- Password reset
- Role-based routing
- Estate manager onboarding
- Document upload
- Verification review
- Estate creation
- Property creation
- Property status changes
- Search and filters
- Buyer creation
- Reservation flow
- Sale flow
- Allocation flow
- Digital forms
- Signature records
- Payment integration
- Subscription enforcement
- Resident management
- Visitor check-in/check-out
- Maintenance requests
- Notifications
- Estate reporting
- Admin review workflows
- Backend authorization
- File access authorization
- Slow network states
- Empty states
- Error states
- Android build behavior

Quality standards:

- No critical workflow crashes.
- No unauthorized data access.
- No overlapping mobile UI.
- No broken navigation paths.
- No unhandled payment states.
- No silent upload failures.
- All critical backend mutations audited.

Deliverables:

- QA checklist
- Bug list
- Fixed critical bugs
- Release candidate Android build

Acceptance criteria:

- Critical bugs are resolved.
- Client can install and test Android build.
- Core workflows are functional end to end.

### Phase 16: Deployment, Builds, And Handover

Goal: deliver the application and technical assets.

Mobile tasks:

- Configure app name, slug, icon, splash, and package IDs.
- Configure production API URL.
- Configure build profiles.
- Generate Android APK or AAB.
- Generate iOS build where account access and setup allow.
- Test production build.

Backend tasks:

- Deploy API.
- Deploy database.
- Configure object storage.
- Configure background jobs.
- Configure payment webhooks.
- Configure environment variables.
- Configure logging and monitoring.

Admin dashboard tasks:

- Deploy web dashboard.
- Configure admin domain or URL.
- Configure production API access.

Handover deliverables:

- Source code
- Android build
- iOS build where applicable
- Backend deployment details
- Database setup details
- Object storage setup details
- Payment integration notes
- Admin dashboard URL
- Environment variable documentation
- Basic technical documentation
- Launch guidance
- Known limitations

Acceptance criteria:

- Production or staging backend is reachable.
- Mobile build connects to the correct backend.
- Admin dashboard is accessible to authorized admins.
- Required documentation is provided.

## 8. Suggested Timeline

The contract estimates approximately 10 weeks. The recommended delivery sequence is:

### Weeks 1-2: Foundation

- UI/UX review
- Technical structure
- Mobile app setup
- Backend setup
- Database design
- Auth foundation
- Navigation foundation

### Weeks 3-4: Onboarding And Verification

- Estate manager registration
- Document upload
- Legal acceptance
- Verification statuses
- Admin review workflow
- Dashboard access restrictions

### Weeks 5-6: Estate And Property Operations

- Estate management
- Plot/property management
- Property statuses
- Search and filtering
- Buyer records
- Sales and allocation records
- Role permissions

### Weeks 7-8: Forms, Payments, Residents

- Digital forms
- Signature records
- Payment integration
- Subscription foundation
- Resident management
- Core notification events

### Week 9: Security, Reports, Maintenance, Integrations

- Visitor management
- Security workflows
- Maintenance management
- Estate reporting
- Admin report review
- Integration testing
- Bug fixing

### Week 10: Final QA And Delivery

- Final testing
- Android build
- iOS build where applicable
- Backend deployment
- Admin dashboard deployment
- Documentation
- Handover

## 9. Risk Notes

This is a large Phase 1 scope for a 10-week delivery window.

Main risks:

- Admin dashboard complexity
- Legal document and signature expectations
- Payment gateway credential delays
- Store submission delays
- Client delay in providing documents, credentials, and approvals
- Large number of role-specific workflows
- File storage and document access security
- Reporting and analytics scope creep

Recommended mitigation:

- Build in vertical workflow slices.
- Prioritize estate manager onboarding, verification, estate/property management, and sales/allocation first.
- Treat visitor, maintenance, communication, subscriptions, and analytics as scoped Phase 1 modules with simple but complete workflows.
- Keep advanced analytics, complex chat, QR visitor access, and third-party e-signature as enhancement candidates unless explicitly required.

## 10. MVP Priority Order

If time becomes tight, prioritize in this order:

1. Authentication and role-based access
2. Estate manager onboarding and verification
3. Document upload and admin review
4. Estate management
5. Plot/property management
6. Property status lifecycle
7. Buyer, sales, and allocation records
8. Digital forms and acceptance records
9. Payment integration
10. Resident management
11. Visitor and security management
12. Maintenance management
13. Notifications
14. Estate reporting
15. Subscription management
16. Analytics

## 11a. Addendum: Client Directives (2026-08-04 / 2026-08-05) — Outstanding Work

This addendum captures newer client decisions (payment model, camera-only capture, individual-landowner onboarding, document privacy/vault, and role/audit hierarchy) and states only the work **not yet implemented**. It supersedes conflicting statements in earlier sections (notably: the payment gateway decision in Section 2.2/Phase 0/Phase 7, which named Flutterwave, is replaced by Paystack Split Payments below). AI chatbot integration was also requested by the client but is explicitly out of scope for this addendum per current direction — do not build it yet.

### 11a.1 Payments: Switch To Paystack Split Payments

Current state: no payment provider is wired up yet (`payments.py` only lists/serializes existing sale/payment rows; there is no initialization, verification, webhook, or split logic, and no Paystack SDK/key usage anywhere in the repo).

Decision change: use **Paystack Split Payments** instead of Flutterwave and instead of building a custom escrow system for now. This replaces the Flutterwave references in Section 2.2, Phase 0, and Phase 7.

Not yet implemented — required:

- Store Paystack test keys as backend environment variables (`PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`), never in the mobile app or client-side code. Test keys received from the client:
  - `pk_test_768d5db0541db9fd7d088edfc9fc814a1ffc31c0`
  - `sk_test_317df983d821e300a6283f33df9404db999bb7c5`
  - These must be treated as secrets: kept out of git, out of logs, and out of the mobile bundle.
- Platform commission: **2% on every successful transaction**, configurable (not hardcoded) so the Master Owner can change it later (see 11a.4). Store the active rate in a settings table rather than in code.
- Paystack subaccount setup per payment recipient (estate manager / distributor payout account) so Paystack can auto-split each transaction between the platform (2%) and the recipient (98%) at settlement time.
- Backend endpoints:
  - Initialize transaction endpoint (creates a Paystack transaction with the correct subaccount + split config for the sale/installment being paid).
  - Paystack webhook endpoint with signature verification (`x-paystack-signature`) and idempotent payment-event storage — mirrors the Flutterwave webhook task in Phase 7 but for Paystack.
  - Transaction verification endpoint (server-side call to Paystack's verify-transaction API; never trust client-reported success alone).
- Mobile: payment initiation/checkout screens from Phase 7 should launch the Paystack checkout (webview or Paystack's React Native SDK) instead of Flutterwave's.
- The existing installment-plan design in Phase 7 stays valid; each installment payment goes through the same Paystack split flow.
- Full custom escrow (holding funds until conditions are met before releasing to the seller) is **not required now** but was acknowledged by the client as a reasonable future enhancement — do not build it in this pass, but don't design the payments schema in a way that would block adding it later.

### 11a.2 Buying Flow: Fully Online By Default, With A Documented Offline/In-Office Exception

Client direction: the entire plot-buying flow should be completable inside the app/platform end-to-end (browse → reserve/purchase → pay → receive deed of assignment), except for buyers who explicitly prefer to complete the purchase physically at the office.

Not yet implemented:

- An explicit "purchase channel" flag on a sale/reservation (`online` vs `in_office`), so admins/estate managers can record the few transactions that happen physically without breaking reporting.
- The online path must be genuinely completable without any office visit: document viewing (for the buyer-visible summary, not the private vault — see 11a.5), electronic form completion (already planned in Phase 6), and payment (11a.1) all need to be reachable from the buyer's flow in-app.
- Once a sale is confirmed and paid, the **Deed of Assignment must be generated/attached and made available to buyers who indicated interest and completed the purchase**, delivered digitally through the app (e.g., a document available in the buyer's "Purchases"/"Documents" tab). This is new — no deed-forwarding step currently exists in the sales flow.

### 11a.3 Camera-Only Capture For Property Photos/Videos And Verification Documents (Anti-Fraud)

Current state: uploads for verification documents and (implicitly) property media use `expo-document-picker` / `expo-image-picker`, which allow picking existing files from the gallery/filesystem (`src/api/upload.js`, verification upload screens). There is no enforcement anywhere that media must come from a live camera capture.

Client requirement: to prevent fraud (e.g., submitting stock photos, screenshots, or someone else's plot images as if they were the real, currently-existing plot), **all property photos and videos, for both estate-developer and individual-landowner onboarding/plot listing, must be captured live through the app's camera** — gallery/file picking must be disabled for this specific class of upload.

Not yet implemented — required:

- Replace `expo-image-picker`'s library-picking mode with `expo-camera` (already a dependency) for property photo/video capture screens, so the only option presented to the user is "take photo" / "record video" via an in-app camera view — no "choose from gallery" affordance.
- Backend-side mitigation, since a determined client can still be tampered with: capture and store EXIF/creation metadata where available, and record a server-side timestamp at upload time; reject uploads whose file type/metadata is inconsistent with a fresh camera capture where feasible. This is a defense-in-depth measure, not a full guarantee.
- Apply this rule specifically to: estate/plot photo and video uploads (Phase 4), and the property-condition evidence uploads used during onboarding/plot verification. It does **not** need to apply to document uploads (PDFs/scans of title documents), which legitimately come from existing paper documents — those keep document-picker support.
- Update the relevant screens: property image upload (Phase 4), any plot verification photo/video capture step.

### 11a.4 Individual Landowner Onboarding (Second Onboarding Category)

Current state: only the Estate Developer / Estate Manager onboarding and verification path exists (`verification.py`, `REQUIRED_DOCUMENTS` = government planning approval, land title, survey plan, estate development approval).

Not yet implemented — required:

- A second onboarding category: **Individual Landowner**, for sellers who don't have the full estate-developer document set (e.g., a single plot or a newly completed house without every standard title document).
- Minimum of **three** property documents required for verification under this category (vs. the estate-developer's mandatory set). Needs its own `REQUIRED_DOCUMENTS`-equivalent list and a `count >= 3` rule rather than a fixed named set, since acceptable documents vary by property type.
- Alternative/fallback documentation for properties that aren't land or lack standard title documents (e.g., a newly completed house): define an accepted-alternatives list (purchase receipt/contract of sale, sworn affidavit of ownership, tax receipt, building approval/permit, utility bill in owner's name, chieftaincy/community allocation letter, sworn declaration witnessed by community head) and require at least three from that list. This needs an explicit product decision on the exact accepted list — flagged here for confirmation, not fully specified yet.
- Every submission (either category) must capture, at minimum: village/community name, all individuals involved (seller, any co-owners, community/family head where relevant, witnesses), the price, and a location description precise enough that a verification staff member can physically visit and verify. These fields don't currently exist on the verification/estate application forms and need to be added.
- Document type clarifications to encode correctly in the data model and UI copy:
  - **Certificate of Occupancy (C of O):** the annual ground-rent payable to government for the land — its presence/status should be tracked, but it's a recurring government fee, not a one-time transfer document.
  - **Governor's Consent:** government's signed acknowledgment that land has been validly transferred to a person — effectively part of/attached to the Deed of Assignment step, not a separate community-to-person document.
  - **Deed of Assignment:** the document recording transfer from the community/family to the individual — this is the "government is now aware" record for the buyer's chain of title, and the document ultimately forwarded to buyers per 11a.2.
- Role/UI: an onboarding-category selector (Estate Developer vs. Individual Landowner) at the start of the onboarding wizard (Phase 3), branching into the right document checklist and form fields.

### 11a.5 Document Privacy, Verification Vault, and "Verified" Buyer-Facing Gating

Current state: verification documents are stored and access-gated only by the existing generic role checks (`require_roles`); there's no dedicated private-vault concept, no distinction between "estate/property exists in system" and "estate/property is publicly visible because verified," and no explicit rule that only verified listings become visible to interested public/buyer users.

Not yet implemented — required:

- **Verification-gated visibility:** properties/estates (or individual-landowner listings) must only become visible to public/buyer users once verification is approved. Unverified submissions exist in the system (for admin/staff review) but are not queryable/visible through any buyer-facing/public endpoint or screen. This needs an explicit `is_publicly_visible` (or equivalent) condition enforced server-side on every public/buyer listing endpoint, not just a client-side filter.
- **Verified badge:** once approved, the listing should visibly show buyers that it has been verified based on the documents held, so buyers get assurance from the badge without ever seeing the underlying documents.
- **Private document vault:** uploaded structural/title documents must be stored with strict access control such that:
  - The Master Owner (super_admin) and Authorized Verification Team (staff/admin reviewer role) can view them.
  - No one else — including public users, buyers, and buyers who have completed a purchase — can view, download, retrieve, or share them, ever. Buyers only interact with their own transaction forms and signatures, never the underlying title/structural documents.
  - This requires an explicit backend authorization check specifically for document retrieval endpoints (separate from general estate/property authorization), since today document access is only checked via the same role helpers used elsewhere — it needs to be audited to confirm no buyer/public code path can reach a document-serving endpoint or its Cloudinary URL directly. Cloudinary URLs backing these documents should not be exposed unsigned to any client role other than owner/verification-staff.
- **Document center in-app:** a dedicated place inside the app for estate managers / individual landowners to upload requested verification documents, and for admins to request/demand specific additional documents from a submitter (an explicit "request more documents" action distinct from the existing generic "Additional Information Required" status) — this is a small extension of the existing Phase 3 resubmission flow, not a new module, but needs its own request/response record so staff can track exactly which document was demanded and whether it was fulfilled.

### 11a.6 Role & Access Hierarchy: Master Owner vs. Staff Admin, With Mandatory Audit Trail

Current state: the role model has `super_admin` and `admin` as a flat pair (`ROLES` in `src/constants/roles.js`; `require_roles` checks in the backend), with no defined distinction in permissions between them, and audit logging exists as a generic helper (`record_audit_log`) used inconsistently rather than a mandated audit trail for verification decisions specifically.

Not yet implemented — required:

- **Master Owner account (single account, `super_admin`)** — full unrestricted access:
  - View all platform data including raw financial payout information.
  - Change the platform commission rate (ties to 11a.1's configurable rate).
  - Delete entire estates from the system (hard delete, distinct from the existing suspend/remove-listing flow in Phase 12, which should remain the default; true deletion should be a separate, more destructive, Master-Owner-only action).
  - Create, manage, and delete staff admin accounts.
  - Access all verification documents and platform records (vault access from 11a.5).
- **Staff Admin accounts (`admin`, restricted reviewer/auditor role)** — must be explicitly restricted, not just "admin minus nothing":
  - Can: review uploaded verification documents, validate authenticity, approve/reject verification submissions.
  - Cannot: download raw document files to personal devices (view-only access — e.g., in-app/streamed viewing rather than a downloadable file response), edit transaction/payment histories, access corporate bank/payout account details, modify the commission rate or other platform financial settings, perform any Master-Owner-only action listed above.
  - This means today's `require_roles("admin", "super_admin")` pattern used throughout the backend (seen in `payments.py` and elsewhere) is too coarse wherever it's applied to financial or destructive endpoints — those need to be re-scoped to `super_admin`-only, while document-review endpoints stay open to both.
- **Mandatory individual staff logins:** no shared staff credentials — every verification staff member needs their own account (already implied by existing auth, but should be explicitly enforced/documented as policy since accountability depends on it).
- **Mandatory audit log for every verification action**, recording at minimum: staff member identity, action performed, document reviewed, approval/rejection decision, and timestamp (e.g., "Staff Member A reviewed and approved Document X on 2026-08-05 at 14:00"). The generic `record_audit_log` helper already exists and is usable, but it is not currently called on every document-review/approve/reject action — this needs to become a mandatory, non-optional call on that exact code path, and the admin dashboard needs an audit log view filtered to verification actions (ties into the existing Phase 13 "Audit logs" module, which isn't built yet either).

### 11a.7 Onboarding Screen Imagery Replacement

Current state: `src/screens/onboarding/OnboardingScreen.js` and `assets/onboarding/` use imagery the client described as looking "too local."

Not yet implemented:

- Source replacement onboarding imagery (higher-production-value, less obviously local/stock-generic look) and swap the files in `assets/onboarding/`, updating any references in `OnboardingScreen.js` if filenames change. Needs client sign-off on the specific replacement images before finalizing, since "too local" is a subjective art-direction call.

### Priority Note

Given the client's emphasis, treat 11a.3 (camera-only capture — described as a required "security rule") and 11a.5/11a.6 (document privacy + role hierarchy + audit trail) as high priority alongside 11a.1 (Paystack). 11a.2's deed-of-assignment delivery depends on 11a.1 (a completed, verified payment) and 11a.4 (the landowner path existing) being done first. 11a.7 is low effort and can be done independently at any time.

## 11b. Full Remaining Work Plan (Consolidated, As Of 2026-08-07)

Section 11a covers only the delta from the client's most recent messages. This section is the complete list of everything from the original Phase 1 scope that is **not yet done**, verified directly against the current codebase (`backend/app/routes/*.py`, `src/screens/*`, `admin-dashboard/app/page.js`), plus the 11a items, organized as one build plan. Anything not mentioned below (auth, estate manager onboarding/verification, estate/property CRUD, sales/reservations/allocations, resident management, maintenance requests + basic provider directory, visitor passes with QR/PIN, digital forms/submissions, support tickets, estate reports, basic notifications) already has real backend routes and matching mobile screens and is treated as done for Phase 1 purposes, independent of the deeper polish any of them may still need.

AI chat integration is excluded from this plan per current direction — do not build it yet.

### 11b.1 Payments — Not Started (highest priority)

`backend/app/routes/payments.py` only lists and serializes sale/payment rows that already exist from the sales flow; there is no gateway integration of any kind. The Phase 7 "Payment Dashboard" UI concept is currently served entirely by hardcoded fixtures in `backend/app/routes/demo.py` (`FLOWS["payments"]`), not real data.

Work required:

- Build the full Paystack Split Payments integration described in 11a.1: env-var keys, subaccount-based 2%/98% split, transaction initialization endpoint, signature-verified webhook, server-side transaction verification, idempotent payment-event storage, configurable commission rate.
- Wire a real payment-dashboard endpoint (revenue summary, monthly trend, distribution breakdown, weekly collection, active installment plans, recent transactions) that reads from actual `payments`/`sales` data — replacing the `demo.py` fixture entirely for this flow.
- Build installment plan endpoints (create plan against a sale, record each installment payment, compute progress/overdue) — none exist yet; no `installment_plans`/`installments` tables or routes were found.
- Mobile: payment initiation, payment status, billing history, installment plan screens, and the payment dashboard screen — none of these exist in `src/screens` yet.
- Estate onboarding package purchases (Basic/Standard/Premium, one-time) and monthly subscription plans (recurring) — no tables, routes, or screens exist for either. Needs the Phase 0 commercial decisions (prices, limits, tiers) confirmed with the client before building.

### 11b.2 Admin Dashboard — Partial

`admin-dashboard/app/page.js` currently implements: admin/manager login, an overview panel, verification application listing/detail/approve, and a plot-creation form. Confirmed missing against the Phase 13 module list:

- User management (list/search/suspend/delete users across roles).
- Estate management and property management views (beyond the single plot-create form).
- Sales and allocation record views.
- Resident management view.
- Visitor/security log views.
- Maintenance overview.
- Reported-estate review, suspension, and removal actions (ties to 11b.4).
- Payment and subscription monitoring (ties to 11b.1).
- Notification/announcement management.
- **Audit log viewer** — required by 11a.6's mandatory audit trail; without a UI to view them, the audit records have no practical use for the Master Owner/staff oversight the client asked for.
- Full analytics view beyond the current basic overview (ties to 11b.6).
- The Master Owner vs. Staff Admin permission split from 11a.6 (currently the dashboard treats `admin` and `super_admin` as functionally the same persona with a role switcher, not a genuinely restricted staff view).

### 11b.3 Communication Hub / Messaging — Not Started

No chat, direct-message, group-thread, or announcement screens exist under `src/screens`, and no messaging/conversation/community-group tables or routes exist in the backend. The Phase 11 "Communication Hub" reference is currently served only by hardcoded fixtures in `demo.py` (`FLOWS["communication"]`).

Work required: conversations/messages tables and endpoints (direct + group), community group tables and endpoints, announcement endpoints (list/detail/RSVP-acknowledge), push token storage and a real push-notification trigger service (notifications today are in-app list/mark-read only — `notifications.py` has no push dispatch), and the mobile Communication Hub screen, chat screens, and announcement screens.

### 11b.4 Public Estate Reporting — Partial (backend only, no admin action)

`reports.py` has report creation, listing, and status updates, and a mobile "Report Issue" screen exists (`ReportIssueScreen.js`), but there is no estate-suspension or estate-removal endpoint, and no admin dashboard UI to act on reports (ties into 11b.2). Confirm whether "update status" alone satisfies Phase 12, or whether dedicated suspend/remove actions with their own audit trail are still needed — recommend building the latter given the audit-trail emphasis in 11a.6.

### 11b.5 Estate Manager Hard-Delete (Master Owner Only) — Not Started

No endpoint exists for permanently deleting an estate (only report-status updates and the existing suspend-via-status-change pattern elsewhere). Needed for 11a.6's "Master Owner can delete entire estates" requirement, as a separate, more destructive action from the existing suspend/reject flows, restricted to `super_admin` only.

### 11b.6 Analytics — Partial

`analytics.py` has three endpoints: a summary, visitor history, and a report export. This covers some of Phase 14's metrics but has not been checked field-by-field against the full metrics list in Section 14 (total users, pending verifications, sales volume, subscription revenue, suspended estates, etc.). Treat as needing a gap-check once payments/subscriptions (11b.1) exist, since several listed metrics depend on data that doesn't exist yet.

### 11b.7 11a Items (Cross-Referenced)

The following, detailed in Section 11a above, are also part of this full remaining-work list and are not repeated in full here: Paystack payments (11a.1, folded into 11b.1 above), fully-online buying flow + Deed of Assignment delivery (11a.2), camera-only capture for property/plot photos and videos (11a.3), Individual Landowner onboarding category (11a.4), private document vault + verification-gated public visibility + document-request center (11a.5), Master Owner vs. Staff Admin role split + mandatory audit trail (11a.6, cross-referenced into 11b.2's audit log viewer and 11b.5's hard-delete), and onboarding imagery replacement (11a.7).

### 11b.8 Testing, Build, And Deployment — Not Started

Phases 15 and 16 (QA pass, bug list, release-candidate Android build, backend/database/storage deployment, admin dashboard deployment, environment documentation, handover docs) have not begun. These are the last steps and depend on the above being functionally complete first.

### Suggested Build Order For A Testable Release

1. Paystack payments end-to-end (11b.1) — nothing involving money can be demoed without this, and 11a.2's deed delivery and several analytics metrics depend on it.
2. Camera-only capture (11a.3) and the individual-landowner onboarding path + document vault + verification-gated visibility (11a.4, 11a.5) — these are data-model and security-shape decisions that get harder to retrofit the longer other work builds on top of the current open upload/visibility behavior.
3. Role hierarchy and mandatory audit trail (11a.6), plus the admin dashboard audit log viewer and remaining Phase 13 modules (11b.2).
4. Estate hard-delete (11b.5) and public-reporting suspend/remove actions (11b.4), both Master-Owner-gated.
5. Communication hub (11b.3) — largest remaining net-new module; sequence after the above since it's additive rather than blocking.
6. Analytics gap-check (11b.6) once payments/subscriptions data exists.
7. Onboarding imagery swap (11a.7) — no dependencies, can happen in parallel with anything above.
8. QA, build, deployment (11b.8).

## 11. Definition Of Done

The project is considered ready for final client acceptance when:

- The agreed Phase 1 features are implemented.
- Android build is provided and installable.
- iOS build is provided where applicable and supported by account setup.
- Backend is deployed or prepared for deployment.
- Database is configured.
- Object storage is configured.
- Payment provider is integrated and tested.
- Admin dashboard is available where agreed.
- Critical bugs discovered during testing are fixed.
- Source code and project files are delivered.
- Basic documentation is delivered.
- Launch guidance is provided.
