# API Contract Draft

Base path:

```txt
/api/v1
```

Response shape:

```json
{
  "data": {},
  "message": "Request successful"
}
```

Error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A readable error message",
    "details": {}
  }
}
```

## Phase 1-2 Endpoints

### Health

```txt
GET /health
```

### Auth

```txt
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/password-reset/request
POST /api/v1/auth/password-reset/confirm
```

### Users

```txt
GET   /api/v1/users/me
PATCH /api/v1/users/me
```

### Estate Manager Verification

```txt
GET  /api/v1/verification/me
POST /api/v1/verification/applications
POST /api/v1/verification/applications/:id/documents
POST /api/v1/verification/applications/:id/submit
```

Required verification document categories:

```txt
government_planning_approval
land_title
survey_plan
```

Additional supported categories:

```txt
certificate_of_occupancy
deed_of_assignment
estate_development_approval
other_title_document
```

### Admin Verification Review

```txt
GET   /api/v1/admin/verification/applications
GET   /api/v1/admin/verification/applications/:id
PATCH /api/v1/admin/verification/applications/:id/status
```

### Estates

```txt
GET   /api/v1/estates
POST  /api/v1/estates
GET   /api/v1/estates/:id
PATCH /api/v1/estates/:id
```

### Properties

```txt
GET   /api/v1/estates/:id/properties
POST  /api/v1/estates/:id/properties
PATCH /api/v1/estates/:id/properties/:propertyId/status
```

Property statuses:

```txt
available
reserved
under_offer
sold
allocated
unavailable
```

### Buyers

```txt
GET  /api/v1/estates/:id/buyers
POST /api/v1/estates/:id/buyers
```

### Sales, Reservations, And Allocations

```txt
GET  /api/v1/estates/:id/sales
POST /api/v1/estates/:id/reservations
POST /api/v1/estates/:id/sales
POST /api/v1/estates/:id/allocations
```

Reservation creation marks a property as `reserved`.
Sale creation marks a property as `sold`.
Allocation creation marks a property as `allocated`.

### Digital Forms

```txt
GET  /api/v1/forms/templates
GET  /api/v1/forms/submissions
POST /api/v1/forms/submissions
```

Seeded form template codes:

```txt
plot_allocation_form
ownership_transfer_form
noc_issuance_form
resident_entry_approval_form
resident_verification_form
```

## Auth Notes

- Access tokens are short-lived JWTs.
- Refresh tokens are stored server-side as hashed tokens.
- The mobile app stores tokens in Expo SecureStore.
- All protected endpoints must enforce backend role checks.
- Every sensitive mutation should write an audit log row.

## Phase 7 Payment Contract

Flutterwave is the selected payment gateway. The mobile client receives only a checkout link or payment reference from Flask; Flutterwave secret keys and webhook secrets remain server-side.

### One-Time Estate Onboarding Packages

These packages are separate from recurring subscriptions. Standard includes Basic; Premium includes Standard and Basic.

```txt
GET  /api/v1/onboarding-packages
POST /api/v1/onboarding-package-purchases
GET  /api/v1/onboarding-package-purchases/me
POST /api/v1/onboarding-package-purchases/:id/payments/initialize
```

The purchase record includes `package_id`, `amount_ngn`, `payment_status`, `fulfilment_status`, `flutterwave_tx_ref`, and `paid_at`. It must never activate, extend, or be represented as a monthly subscription.

### Recurring Monthly Subscriptions

```txt
GET  /api/v1/subscription-plans
POST /api/v1/subscriptions
GET  /api/v1/subscriptions/me
POST /api/v1/subscriptions/:id/payments/initialize
```

### Flutterwave Verification

```txt
POST /api/v1/payments/flutterwave/webhook
GET  /api/v1/payments/:transactionReference/verify
```

The webhook validates the Flutterwave signature, resolves the expected transaction by its server-created reference, and writes an idempotent payment event before changing any package-purchase, subscription, sale, or installment state.
