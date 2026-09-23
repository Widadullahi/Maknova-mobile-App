# Code Review Findings

Review level: medium (3 correctness angles + 3 cleanup angles + altitude + conventions, 1-vote verify)
Scope: full working tree (`EVERYTHING CHECK`)

Findings are ranked most-severe first.

---

## 1. Demo accounts crash real backend writes

**File:** `backend/app/utils/authz.py:9`
**Category:** correctness — **CONFIRMED**

Demo accounts have non-integer string ids (e.g. `"demo-estate-manager"`) that get passed straight through as `current_user` to every write endpoint, which insert them into `BIGINT` foreign-key columns.

**Failure scenario:** Log in via the app's own "Demo: Estate Manager" button, open the real Verification wizard, fill in estate details, tap Continue. `VerificationWizardScreen.js` calls `saveVerificationApplication` → `POST /verification/applications`, which runs `INSERT INTO estate_verification_applications (user_id, ...) VALUES (%s, ...)` with `current_user["id"] = "demo-estate-manager"` against a `user_id BIGINT UNSIGNED` column with an FK to `users(id)` (`verification.py:148`). MySQL rejects the non-numeric string under strict mode, producing an unhandled 500 — the demo account, which the app itself promotes as a working walkthrough, cannot actually save or submit a verification application. The same pattern breaks `create_estate`, `update_property_status`, `create_resident`, and `list_my_purchases` (the last one compares the string against a `BIGINT` column in a `WHERE` clause instead of failing on `INSERT`).

---

## 2. Forms endpoint 403s residents/buyers/security with an estate

**File:** `backend/app/routes/forms.py:89`
**Category:** correctness — **CONFIRMED**

`list_submissions`/`create_submission` whitelist `resident`/`buyer`/`security` in their role decorator, but the estate-access gate they call can never return true for those roles.

**Failure scenario:** A resident calls `POST /forms/submissions` with `estateId` set to their own estate (a normal, expected use since `@require_roles` explicitly lists `"resident"` as allowed). `can_access_estate_or_admin` → `can_manage_estate` only returns `True` for `admin`/`super_admin` or an `estate_manager` who owns that estate (`estates.py:32-35`); role `resident`/`buyer`/`security` always falls through to `False`, so the request 403s. The only way these whitelisted roles can ever successfully submit or list a form is by omitting `estateId` entirely, defeating the purpose of estate-scoped forms for the roles the decorator says can use them.

---

## 3. Admin status revert leaves stale buyer on purchases list

**File:** `backend/app/routes/estates.py:301`
**Category:** correctness — **CONFIRMED**

Admin override lets a property move out of the terminal `allocated` status without clearing `buyer_user_id`/`owner_user_id`, and that stale id is later read by the buyer-facing purchases list.

**Failure scenario:** An admin reverts a property from `allocated` back to `available` without passing a new `buyerUserId` (`COALESCE` at line 315 keeps the old one). The former buyer's `GET /estates/my/purchases` (line 415) matches on `buyer_user_id = %s OR owner_user_id = %s` with no status filter, so the property still shows up in their purchase list — now displaying status `available` instead of `allocated`, i.e. a unit they no longer own, and that's back on the open market, still reads as one of their purchases. `IMPLEMENTATION_PLAN.md` documents the override itself as intentional but never addresses clearing the buyer/owner attribution on reversion.

---

## 4. Buyer/deal screens never call the real backend

**File:** `src/context/PropertyDealsContext.js:1`
**Category:** altitude — **CONFIRMED**

The real backend endpoints for property status/documents/purchases (`fetchMyPurchases`, `addPropertyDocument`, `updatePropertyStatus` in `src/api/estates.js`) are built and correct, but `ListingDetailScreen` and `MyPurchasesScreen` never call them — they run entirely against this local in-memory mock instead, with no comment anywhere marking the fork as intentional.

**Failure scenario:** A future maintainer fixes a bug in the real `update_property_status` (e.g. the buyer-required validation) and reasonably assumes it now applies wherever property status changes in the app. `src/screens/estates/PropertiesScreen.js` does call the real endpoint and gets the fix, but `ListingDetailScreen`'s "Manage sale" panel and `MyPurchasesScreen` keep working against `PropertyDealsContext`'s local `useState(MOCK_LISTINGS)`, so the same class of bug silently persists there with no code signal explaining why two screens showing the same domain data behave differently.

---

## 5. `salePrice: 0` is always overridden, never honored

**File:** `backend/app/routes/sales.py:277`
**Category:** correctness — **CONFIRMED**

Falsy-zero bug: `payload.get("salePrice") or property_row["price"] or 0` silently discards an explicit `salePrice` of `0`, and today's only caller (`SalesScreen.js`) already depends on that fallthrough as a "use listed price" sentinel instead of sending a real price.

**Failure scenario:** There is currently no way to record a genuinely free/₦0 sale through this endpoint — any attempt is silently replaced with `property_row["price"]`. The mobile Sales screen (`src/screens/sales/SalesScreen.js`, `handleSale`) actively hardcodes `salePrice: 0` intending "use the listed price," which happens to work today only because of this bug; if the endpoint is ever fixed to honor an explicit `0`, that caller's sale price recording silently breaks.

---

## 6. Backend accepts an empty drawn signature payload

**File:** `backend/app/routes/verification.py:233`
**Category:** correctness — **PLAUSIBLE**

`has_signature` only checks that `signature_data` is a non-empty string, never parsing it to confirm the drawn-signature path array actually contains a stroke — `bool("[]")` is `True`.

**Failure scenario:** A direct API call (bypassing the app's own `isSignatureFilled` client gate) sending `signatureMethod: 'drawn'`, `signatureData: '[]'` to `POST /applications` followed by the submit endpoint passes the `has_signature` check despite representing zero pen strokes. Not reachable through the shipped app UI today, but the backend — which is supposed to be the authority on data integrity, not the client — has no server-side validation of the signature content.

---

## 7. N+1 query in `list_my_purchases`

**File:** `backend/app/routes/estates.py:431`
**Category:** efficiency

`list_my_purchases` fires a separate `SELECT * FROM property_documents` per matching property inside a Python loop (N+1 query) instead of one batched query.

**Failure scenario:** A buyer/owner with many sold or allocated properties triggers 1 + N round-trip queries per request instead of 2. At scale this multiplies DB latency linearly with the buyer's portfolio size; a single `WHERE property_id IN (...)` query grouped in Python would collapse it to a constant number of round trips.

---

## 8. `getInitials()` duplicated across 4 screens

**File:** `src/screens/dashboard/DashboardScreen.js:19`
**Category:** reuse

`getInitials(name)` is copy-pasted verbatim into 4 separate screen files instead of living in one shared utility.

**Failure scenario:** The identical function is redefined in `src/screens/dashboard/DashboardScreen.js:19`, `src/screens/profile/ProfileScreen.js:18`, `src/screens/resident/ResidentHomeScreen.js:72`, and `src/screens/security/SecurityHomeScreen.js:19` (no `src/utils/` directory exists to hold a shared version). Any future change to the initials logic (e.g. single-word name handling) has to be applied in all 4 places or avatars render inconsistently across the dashboard, profile, resident home, and security home screens.

---

## Ruled out during verification

**Registering with a reserved demo email doesn't lock out the real account.** `auth.py`'s `login()` correctly falls through to the real DB row whenever the submitted password isn't the literal demo password (`demo1234`) — the only real edge case is a user who happens to choose `demo1234` as their own password on a reserved email, which is narrow enough not to warrant a top-8 slot.
