# Maknova Platform — Change Log

All fixes and features delivered for the Maknova real-estate platform (Expo SDK 57
mobile app + Flask backend). Commit: `dc9dc52` (initial Commit).

## Authentication & on-boarding

- **OTP email verification (new feature).** Registration now requires a verified
  email before an account can be used.
  - Backend: `018_email_verification.sql`, `backend/app/utils/emailer.py`,
    `backend/app/routes/email_verification.py` (`POST /auth/email-verification/request`
    and `POST /auth/email-verification/verify`), SMTP/OTP settings in
    `backend/app/config.py`, enforcement in `backend/app/routes/auth.py` (account
    blocked with `EMAIL_NOT_VERIFIED` until a valid code is verified).
  - Mobile: RegisterScreen gains a 4th "email verify" step (send code -> enter
    code -> verified); the **Create account button moved to the top** of the
    security step so it is always reachable. API client in `src/api/emailVerification.js`.
- **Login invalid-credentials fix.** Wrong email/password now shows a popup
  ("Your email or password is incorrect") instead of silently failing.
- **Email field validation on login.** Empty / obviously-invalid email shows a
  popup before a request is made.
- **Nigerian phone validation** on the register step (format styling, plus-code
  input).
- **Text field eye-toggle fix.** Password show/hide no longer overflows the field.

## Web / platform fixes

- **Alert on web.** `Alert.alert` is a no-op on react-native-web; added
  `src/components/AlertPopup.js` and patched the app so errors/success messages
  render as styled popups on web while staying native on device.
- **Document upload on web.** `expo-file-system` `File` is unsupported on web —
  uploads now pass the real DOM `File` (or a fetch-decoded data-URI ) straight to
  `FormData`. See `src/api/upload.js`.
- **Social login logos** made real (proper brand marks) in `src/components/SocialLogos.js`.
- **Estate manager routing** now lands on the Dashboard instead of a blank screen
  (`RoleNavigator.js`).

## Property media — camera-only capture (client directive)

- **Gallery/library uploads are rejected.** Property photos/videos must be
  captured live through the app camera.
  - Mobile: `src/components/PlotPhotoCapture.js` rewritten — camera-only with a
    Photo/**Video** toggle (`CameraView mode`, `recordAsync({ maxDuration: 60,
    mute: true })`, `stopRecording()`). Video capture hidden on web. Every asset
    is stamped `source: 'camera'`, `capturedAt` (ISO), `mediaKind`.
  - Upload: `src/api/upload.js` sends per-file camera metadata
    (`sources[i]`, `capturedAts[i]`, `mediaKinds[i]`) and maps video mime types;
    web data-URIs become typed DOM `File`s.
  - Backend (`backend/app/routes/estates.py`): `validate_camera_media` enforces
    `source=camera`, a fresh capture time (≤ 15 min), and a real camera mime
    whitelist (`image/jpeg`, `image/png`, `video/mp4`, `video/quicktime`,
    `video/webm`, `video/x-m4v`, `video/3gpp`). `property_documents` gained
    `capture_source`, `captured_at`, `media_kind` and a `video` category
    (migration `019`). Non-media documents (PDFs, deeds) are unaffected.

## Installments (new feature)

- **Real installment plans replace the hardcoded preview.**
  - Backend: `019_installments_channel_camera_media.sql` adds `installment_plans`
    and `installments`; new blueprint `backend/app/routes/installments.py`
    registered under `/api/v1/installments`:
    - `POST /plans` — create plan (count/amount/due dates, audit logged).
    - `GET /sales/<sale_id>` — current plan for a purchase (staff or owning buyer).
    - `GET ""` — list plans within the manager's estate scope.
    - `POST /<installment_id>/initialize` — Paystack checkout for one installment
      (buyer fee + seller commission applied correctly).
    - `apply_successful_installment_payment` — webhook handler (idempotent)
      marks the installment paid, rolls the plan to `completed`.
  - Webhook: `payments.py` treats `INS-` references (already covered `RE-`,
    `WAL-`, `DOC-`).
  - Mobile: `src/api/payments.js` adds `fetchInstallmentPlan`, `listInstallmentPlans`,
    `initializeInstallmentPayment`. `PurchaseDetailScreen` now fetches the real
    plan, shows the schedule with per-installment status + progress bar, and
    "Pay due installment" opens the **Paystack** checkout — the previous
    "Flutterwave will be connected" placeholder is gone.
  - Purchases: `list_my_purchases` now returns `saleId` so buyers can load their
    plan.

## Payments — Paystack subaccount/commission split

- `backend/app/utils/paystack.py` `initialize_transaction` accepts `subaccount`
  and `split`.
- `backend/app/config.py`: `PAYSTACK_SUBACCOUNT_CODE` / `PAYSTACK_SPLIT_CODE`
  (empty = legacy charge-on-top). Sale and installment initializations pass
  them. Wallet top-ups and document fees intentionally stay on the main account.
- Fixed a commission bug in the installment initialize path that had filled the
  seller-commission fields with the buyer-fee percent.

## Purchase channel flag

- `sales.channel` (`online` | `in_office`, default `online`) via migration `019`;
  `create_sale` validates/accepts `channel` and `serialize_sale` exposes it.

## Analytics gaps

- `backend/app/routes/analytics.py` `/summary` now reports:
  - `pendingVerifications` (pending_review estate-verification applications,
    scoped to the manager for non-admins),
  - `suspendedEstates`,
  - `subscriptionRevenue`.

## Backend quality

- Fixed closed-cursor usage in `installments.py` (payloads now built inside the
  `db_cursor` block), removed a dead placeholder query, tightened the buyer
  ownership check on plans and installment payment authorization.
- All new/changed backend modules pass `py_compile`; the Flask app imports with
  the installments blueprint registered.

## Verification

- Web bundle compiles (`index.bundle?platform=web&dev=true` -> HTTP 200) and
  contains the new code (camera metadata fields, no Flutterwave placeholder).
- Backend endpoints dispatch/auth/validate correctly under a stubbed DB during
  local testing (live MySQL is not reachable from this machine).

## Notes

- Backend migrations run automatically on server start. To go live, redeploy the
  backend so OTP verification, installments, splits, channel, and the new
  analytics exist on the server.
- `expo-video` is not installed, so captured videos are uploaded but not played
  back in-app yet.