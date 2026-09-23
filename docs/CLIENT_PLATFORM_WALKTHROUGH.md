# EstateFlow Client Walkthrough and Test Guide

## Purpose of this document

Use this guide to explain and test the EstateFlow platform with the client. It is written as a speaking guide: explain the sentence in each section, then perform the test underneath it.

This guide covers the mobile application, the Estate Management workspace, property sales, documents, residents, security, communication, and account access.

The Super Admin panel is intentionally excluded.

---

## 1. The simple explanation of the platform

EstateFlow brings property sales and estate operations into one controlled system.

It connects:

- People looking to buy or sell property.
- Estate Management teams listing estates and plots.
- Residents requesting visitors, maintenance, and reporting issues.
- Security personnel checking visitors at the gate.
- Digital forms, signatures, documents, notifications, and communication.

The platform is role-based. Each person sees the tools relevant to their account. A buyer does not see security tools, and security personnel do not see estate sales controls.

The platform also keeps a record of important actions such as verification submissions, signatures, property status changes, payments, document uploads, and visitor checks.

---

## 2. The account types to explain

### Buyer

A buyer uses the mobile app to:

- Create an account and sign in with email and password.
- Browse published property listings.
- Search by estate, plot number, or location.
- Filter listings by all, verified, or available.
- Save listings for later.
- Open a listing to view the price, location, property type, size, description, and status.
- View completed purchases and available purchase documents.
- Complete eligible digital forms and sign electronically.
- Receive platform notifications and use communication tools where enabled.

The buyer must have an account because purchases, signatures, documents, and transaction records need to be tied to a verified user identity.

### Public User / Individual Landowner

This account is for an individual who wants to submit their own property for verification and sale. The user completes the individual-landowner verification route and submits supporting ownership documents.

After approval, the property can be onboarded for listing according to the platform's verification and publishing rules.

### Estate Management

Estate Management is the operational account for an estate company or estate manager. It is used to:

- Complete estate verification.
- Create and manage estates.
- Add plots and property details.
- Upload plot photos and supporting documents.
- Publish or hide an estate from public listings.
- Add buyer records.
- Reserve plots.
- Record sales.
- Start payment collection through the configured payment gateway.
- Monitor payment status.
- Manage residents.
- Review visitor activity.
- Respond to maintenance requests.
- Publish announcements.
- Review the document center.

The Estate Management workspace is the main operating area for the estate company.

### Resident

The Resident dashboard is for people who live in, rent in, or are linked to a managed estate. It is not the buyer dashboard.

A resident can:

- Request visitor entry.
- Generate a visitor pass with a code and PIN.
- See active visitor passes.
- Book maintenance services.
- Track maintenance requests and their statuses.
- Report an issue to management.
- Read estate notices and announcements.
- Use the communication hub.
- Use the visitor wallet where that feature is enabled.

### Security

The Security dashboard is for gate and access-control personnel. It is used to verify whether a visitor is permitted to enter.

Security can:

- Scan a visitor QR code.
- Enter a visitor pass code manually.
- Enter a visitor PIN.
- Check a visitor in.
- Check a visitor out.
- See whether a pass is pending, already used, expired, or denied.
- Search the visitor log.
- View visitor activity and analytics.
- Use the communication hub.

Security does not create visitor passes for residents. The resident creates the pass, then sends the code or QR pass to the visitor.

---

## 3. Registration and login walkthrough

### What to say

“A user begins by selecting the account type that matches how they will use the platform. The account is then connected to their personal details and secured with an email and password. This allows every transaction, document, signature, and request to be linked to the right person.”

### Live test

1. Open the app.
2. Complete or skip onboarding.
3. Tap **Create account** or **Register**.
4. Select one role:
   - Estate Management
   - Resident
   - Buyer
   - Security
   - Public User
5. Confirm that selecting the role automatically moves to the next registration step.
6. Enter full name, email, and phone number.
7. Enter a password of at least six characters.
8. Open and review the Terms of Service.
9. Accept the Terms of Service.
10. Tap **Create account**.
11. Confirm that the account enters the correct role-based experience.

### Expected result

- The selected role is saved to the account.
- The user can sign in again with email and password.
- The user sees only the navigation and features assigned to that role.

### Important demo note

Google sign-in is displayed as an option in the registration screen but is not connected to the backend in the current implementation. Demonstrate email/password registration unless Google authentication has separately been connected and tested.

---

## 4. Estate Management verification

### What to say

“Before an estate manager can operate an estate, the platform collects the estate or property information and the supporting ownership or development documents. This creates a reviewable record before the estate is published to buyers.”

### Live test

1. Sign in as an Estate Management account.
2. Open **Verification**.
3. Complete **Applicant and property details**.
4. For an estate company, use the estate-developer route.
5. For an individual seller, use the individual-landowner route.
6. Add the estate or property name, location, community information, parties involved, and proposed price where applicable.
7. Upload the required documents.
8. Add supporting documents if available.
9. Accept the terms.
10. Add a typed or drawn electronic signature.
11. Review the information.
12. Tap **Submit for review**.

### Expected result

- The application is saved.
- The status becomes pending review.
- The uploaded documents and signature are attached to the application.
- Estate-management tools remain restricted until the required approval is complete.

### Prepare before the client test

Use an already-approved Estate Management account if the purpose of the meeting is to test estates, plots, sales, or residents. Approval is a separate review step and should not interrupt the live product demonstration.

---

## 5. Creating and publishing an estate

### What to say

“Estate Management creates the estate record first. The estate can then be populated with plots and published when its details are ready. Buyers only see properties belonging to estates that are approved and publicly published.”

### Live test in the Estate Management workspace

1. Open **Estates**.
2. Tap or click **Add estate**.
3. Enter the estate name.
4. Enter its location.
5. Add a description and contact details where available.
6. Save the estate.
7. Open the estate details.
8. Review or edit the estate information.
9. Publish the estate.
10. Sign in as a buyer or refresh the buyer app.
11. Confirm that the estate's published available plots can appear in the buyer listing feed.

### Expected result

- A draft estate can be edited before publication.
- Publishing makes the estate eligible for public property listings.
- Hiding or unpublishing removes it from the public listing experience while preserving the estate record for management.

---

## 6. Creating a plot and uploading photos

### What to say

“Each plot is a structured property record. It has an identifier, plot number, type, size, price, description, status, and supporting evidence. The photos and documents are attached to the plot, so they are not lost in a general photo folder.”

### Live test

1. Open **Plots** or open an estate and choose **Properties**.
2. Tap **Add plot**.
3. Enter the property identifier.
4. Enter the plot number.
5. Select or enter the property type.
6. Add the plot size, price, and description.
7. Add plot photos.
8. Test **Take photo** if a new live image is required.
9. Test **Choose from gallery** if an existing image is being uploaded from the phone.
10. Review the photo thumbnails and remove any incorrect image.
11. Save the plot.
12. Open the plot details and confirm the data and images are attached.

### Photo explanation

“The platform supports taking a new camera photo and selecting an existing gallery photo. A gallery photo is still an ordinary image file selected from the device; selecting it does not create a new photograph. If the estate's policy requires proof that the image was captured on site, the live camera option should be used.”

Do not promise that the current system can reliably identify every screenshot or edited image unless a dedicated image-forensics service has been added and tested. Camera capture and screenshot detection are separate capabilities.

### Expected result

- The plot starts as **Available**.
- The plot appears under the selected estate.
- Photos and supporting documents are linked to that plot.
- Editing important listed details requires an explicit confirmation and is recorded in the audit trail.

---

## 7. Property status lifecycle

### What to say

“The status tells everyone where the property is in its sales lifecycle. Some steps are initiated by an authorised operator, while payment verification and allocation can be automated.”

### Statuses

| Status | Meaning |
| --- | --- |
| **Available** | The plot can be offered to a buyer. |
| **Reserved** | The plot has been held for a buyer but the sale is not fully completed. |
| **Sold / Allocated** | The sale has been paid or the allocation has been completed. The public-facing experience groups these final stages together. |
| **Unavailable** | The plot is temporarily not available for sale. |

### The automation flow

1. Estate Management adds a buyer record and selects a plot.
2. Estate Management starts a reservation.
3. The plot changes from **Available** to **Reserved**.
4. If the reservation is not completed according to the estate's process, it can be released back to **Available**.
5. Estate Management records the sale and the sale payment is initialized through Paystack.
6. The buyer completes the payment through the payment link.
7. Paystack confirms the payment through verification or webhook processing.
8. The backend marks the transaction and sale as paid.
9. The backend changes the plot to **Sold**.
10. The Plot Allocation Form is completed and signed with the plot and transaction context.
11. After the paid form is accepted, the backend creates the allocation record and changes the plot to **Allocated**.

### What is manual and what is automatic?

| Action | Current responsibility |
| --- | --- |
| Add buyer | Estate Management starts it. |
| Reserve plot | Estate Management starts it. |
| Record sale | Estate Management starts it. |
| Generate Paystack payment | Estate Management starts collection from the sale record. |
| Confirm successful payment | Payment gateway and backend verification handle it. |
| Change plot to Sold after verified payment | Automated by the backend. |
| Complete and sign allocation form | An authorised user completes it. |
| Create allocation after paid signed form | Automated by the backend when the required conditions are satisfied. |

This is the clearest way to explain the automation: the operator initiates the commercial workflow, while the system verifies payment and performs the protected state changes.

---

## 8. Sales and buyer management

### What to say

“The Sales and Buyers area keeps the buyer record, plot selection, reservation, sale value, and payment status together. This gives Estate Management one place to see what has been reserved, sold, and paid.”

### Live test

1. Open **Sales & Buyers**.
2. Select the estate.
3. Add a buyer with full name, phone number, and email.
4. Confirm that the buyer appears in the buyer table.
5. Select a plot and the buyer.
6. Click **Reserve plot**.
7. Confirm the plot and reservation status.
8. Select the plot and buyer again.
9. Enter the agreed sale price.
10. Click **Record sale**.
11. Confirm that the sale appears with a pending payment status.
12. Click **Collect via Paystack**.
13. Complete a test payment or open the authorization link for the client demonstration.
14. Return to the sales page and click **Check status**.
15. Confirm the payment status and plot status.

### Expected result

- A buyer record is created once.
- The sale is connected to the correct buyer and plot.
- A successful payment is not recorded twice if the payment action is retried.
- The transaction uses one active Paystack reference for an initialized or successful payment.
- The property status moves to Sold after successful verification.

### Payment explanation for the client

“The buyer should receive one final amount to pay. The buyer-side platform charge is calculated in the background and included in the amount sent to the payment gateway. The buyer-facing screen should not present a separate processing-fee line or ask the buyer to pay a second document-generation fee.”

“The seller or estate company has a separate commission record. The configured seller commission is calculated from the successful sale price and should be shown in the estate company's transaction records when that dashboard view is enabled.”

For the client test, use a Paystack test transaction and confirm the exact displayed labels and totals against the currently approved fee policy before presenting them as final.

---

## 9. Plot Allocation Form and documents

### What to say

“The Plot Allocation Form is the formal document step after the property transaction. It is linked to the actual plot, estate, account, and successful sale instead of relying only on free-typed information.”

### Live test

1. Complete a successful property sale payment first.
2. Sign in to an account that is allowed to complete the allocation form.
3. Open **Profile**.
4. Open **Digital forms**.
5. Select **Plot Allocation Form**.
6. Enter or confirm the property ID.
7. Tap **Load plot details**.
8. Confirm that the plot number, estate, property type/size, and current account name appear.
9. Complete any remaining required fields.
10. Choose **Type** or **Draw** for the electronic signature.
11. Submit the form.
12. Confirm the success message.
13. Confirm that the PDF is generated and available to download or share.
14. Open the estate/property document area and confirm that the allocation PDF is attached to the plot.
15. Check the property lifecycle status for the final allocated state.

### Fee explanation

“Document generation is included in the successful property transaction. There is no separate document-processing fee and no second payment for the allocation document.”

The old **Pay processing fee first** button belongs to an older mobile build. It should not appear in the rebuilt application. If it appears during the client test, the old APK is still installed or the mobile source has not been rebuilt and installed correctly.

### Signature explanation

The signature is recorded with the form submission. The typed name or drawn signature is associated with the signed form, account, terms version, and submission activity. The user should use their legal name or normal authorised signature according to the estate's document policy.

---

## 10. Buyer browsing and purchase records

### What to say

“The buyer's home area is the property discovery experience. It shows only listings that are eligible for public viewing, and it keeps saved listings and completed purchases in separate tabs.”

### Live test

1. Sign in as a Buyer.
2. Open the **Home** tab.
3. Search by estate name, location, or plot number.
4. Test **All**, **Verified**, and **Available** filters.
5. Open a property listing.
6. Review the price, location, type, plot details, verification indicator, description, and status.
7. Tap the save icon.
8. Open the **Saved** tab and confirm the listing appears.
9. Return to the listing and test **Report this listing**.
10. Open **Purchases**.
11. Open a completed purchase.
12. Review the purchase price, payment progress, documents, and receipts where available.

### Expected result

- Unpublished or unapproved estates do not appear in the public listing feed.
- Only the buyer connected to a completed transaction should see that purchase in their Purchases area.
- Property documents are released according to their document category and access rules.

### Document access explanation

“Not every internal property document is automatically public. The document vault protects title and allocation records. Buyer access is granted to the documents that are intended for the buyer after the relevant sale stage, such as the Deed of Assignment where it has been uploaded and released.”

---

## 11. Resident dashboard walkthrough

### What to say

“The Resident dashboard is the estate-living side of the platform. It helps a resident manage guests, maintenance, reports, and estate communication. It is separate from buying a plot.”

### Live test: visitor pass

1. Sign in as a Resident.
2. Open **Home**.
3. Tap **Request visitor entry**.
4. Enter the visitor's name and phone number.
5. Select the purpose of the visit.
6. Enter the expected date and time.
7. Tap **Generate visitor pass**.
8. Show the generated pass code and PIN.
9. Explain that the resident sends the code or QR pass to the visitor.

### Expected result

- A single-use visitor pass is created.
- The pass is tied to the resident and the expected visit details.
- The resident can see the pass in the home screen or visitor area.
- The security user can verify the same pass.

### Live test: maintenance

1. Tap **Book maintenance**.
2. Choose a category such as plumbing or electrical.
3. Select an available provider.
4. Add an optional note.
5. Tap **Book provider**.
6. Open **My requests**.
7. Open the request and review its status and updates.

### Live test: report an issue and notices

1. Tap **Report an issue**.
2. Add the issue details and submit.
3. Open the communication area.
4. Review chats, groups, and announcements.
5. Acknowledge an announcement if one is available.

### Wallet explanation

“Where the visitor-wallet feature is enabled, the resident tops up the wallet before generating visitor passes. The visitor-pass charge is a flat wallet deduction configured for that service. This is separate from property transaction fees.”

If a wallet or provider list is empty in the demo, explain that the estate must first have the corresponding service configuration and providers enabled.

---

## 12. Security dashboard walkthrough

### What to say

“Security uses the platform as a gate verification tool. The security officer does not need to trust a screenshot or a verbal claim from a visitor; they verify the active pass against the platform record.”

### Live test: verify a visitor

1. Sign in as Security.
2. Open **Verify visitor pass**.
3. Select **Check in**.
4. Test **Scan QR** using the resident's visitor pass, or select **Enter PIN**.
5. Alternatively, enter the pass code manually.
6. Tap **Verify code**.
7. Confirm the visitor's name, purpose, host, and pass details.
8. Confirm the success result and check-in status.
9. Repeat with the same pass to demonstrate that a used pass is not treated as a new valid entry.
10. Select **Check out** and verify the visitor's exit.

### Live test: visitor log and analytics

1. Open **Visitor log**.
2. Search by visitor name or pass code.
3. Open **Visitor analytics**.
4. Test the today, 7-day, and 30-day filters.
5. Review total passes, checked-in passes, and the status/purpose breakdown.

### What security does

Security verifies access credentials. It helps prevent:

- Entry using an invalid code.
- Reuse of a single-use pass.
- Entry with a pass that is not associated with the estate or resident.
- Manual uncertainty about whether a guest was authorised.

Security should still follow the estate's physical access policy and escalate unusual cases to Estate Management.

---

## 13. Communication and notifications

### What to say

“The Communication Hub gives each role a shared place for direct chats, estate groups, and announcements. The available actions depend on the user's role.”

### Live test

1. Open the **Communication Hub**.
2. Test the **Chats** tab.
3. Test the **Groups** tab if the account is linked to an estate.
4. Test the **Announcements** tab.
5. Open an announcement and acknowledge it.
6. As Estate Management, create an announcement.
7. Sign in as a Resident or Security user and confirm the announcement is visible.
8. Open **Notifications**.
9. Mark one notification as read.
10. Test **Mark all read**.

### Expected result

- Messages are restricted to the appropriate participants or estate group.
- Estate announcements can be seen by the intended estate audience.
- Read/unread state is visible to the signed-in user.

---

## 14. Profile, account status, and sign out

### What to say

“The Profile area is the user's control center. It shows the account identity, role, account status, and the tools available to that role.”

### Live test

1. Open the **Profile** tab.
2. Confirm the user's name and email.
3. Confirm the role label, such as Buyer, Resident, Security, or Estate Management.
4. Open **Profile details**.
5. Review the linked estate or verification information where available.
6. Open **Digital forms** if the role supports forms.
7. Open **Notifications**.
8. Tap **Sign out**.
9. Confirm the app returns to the unauthenticated experience.
10. Sign in again with the same email and password.

---

## 15. End-to-end demonstration order

If time is limited, use this order:

1. Register or sign in as a Buyer.
2. Browse and search for an available plot.
3. Sign in as Estate Management in a second browser/device.
4. Open the estate and plot records.
5. Add a buyer record.
6. Reserve a plot.
7. Record the sale price.
8. Start Paystack collection.
9. Complete or simulate successful payment.
10. Confirm the plot changes to Sold.
11. Open Digital Forms and load the property details.
12. Complete and sign the Plot Allocation Form.
13. Confirm the PDF is created and linked to the plot.
14. Confirm the plot reaches Sold / Allocated.
15. Sign in as a Resident and generate a visitor pass.
16. Sign in as Security and verify the pass.
17. Return to Estate Management and show the visitor log, maintenance, announcements, and document center.

This sequence demonstrates the platform's strongest value: the property, payment, document, resident, and gate workflows are connected rather than being isolated records.

---

## 16. Client questions and short answers

### Does the buyer need an account?

Yes. The buyer needs an email and password so the platform can identify them whenever they sign in, purchase a property, sign a document, or view their purchase records.

### Is reservation automatic?

The reservation is initiated by an authorised Estate Management user. Once it is created, the system records the Reserved status and prevents the plot from being treated as freely available.

### Is the plot marked Sold automatically?

After the successful payment is verified, the backend automatically marks the plot as Sold. The payment itself is initiated through the Estate Management sales workflow.

### Is allocation automatic?

The signed Plot Allocation Form is still completed by an authorised user. Once the form is tied to the correct property and a successful sale payment exists, the backend can create the allocation record and move the property to Allocated automatically.

### Is there a separate allocation-document fee?

No. Document generation is included in the successful property transaction. The old “Pay processing fee first” action must not be present in the rebuilt mobile application.

### Can a user download the completed form as a PDF?

Yes. The mobile form generates a PDF after submission and offers it for download or sharing. It is also uploaded to the property's document record when the property context is available.

### Can a photo come from the phone gallery?

Yes, the photo capture component provides a gallery option. A live camera capture and a gallery upload are different evidence types. Screenshot or manipulated-image detection is not the same as gallery selection and should not be promised unless a dedicated image-verification service is connected.

### What does Security do?

Security verifies a resident's visitor code, QR pass, or PIN, then checks the visitor in or out. It can also search the visitor log and review access activity.

### What happens if a payment is retried?

The payment flow is designed to reuse an existing active payment reference for the same sale rather than creating a second active transaction. Payment events are also processed idempotently, so the same successful gateway event should not mark the sale twice.

---

## 17. Pre-demo checklist

Complete these checks before the client joins:

- Install the latest rebuilt APK, not an older APK from a previous build.
- Confirm the old **Pay processing fee first** button is absent.
- Confirm the backend changes are deployed to the environment the app is using.
- Confirm the app is pointed at the correct backend URL.
- Confirm at least one approved and published estate exists.
- Confirm at least one available plot exists with a price and photo.
- Prepare test accounts for Buyer, Estate Management, Resident, and Security.
- Confirm the Estate Management account is approved.
- Prepare a buyer record with a valid email and phone number.
- Confirm Paystack test credentials and webhook/verification configuration.
- Prepare a visitor pass test using a resident account.
- Confirm the security device can access the camera, or prepare the manual code/PIN route.
- Confirm at least one maintenance provider exists if demonstrating maintenance booking.
- Confirm the latest payment labels and fee wording match the approved business decision.
- Confirm the Plot Allocation Form template is active in the backend.
- Confirm the property used for the allocation test has a successful paid sale.
- Keep a backup test property so the client demonstration is not blocked by a failed transaction.

---

## 18. Things to verify instead of promising

During the test, verify these items in the actual environment:

- The live backend has the latest form-fee removal deployed.
- The live mobile build no longer displays the old processing-fee button.
- The buyer sees one final payment amount and not a separate 2.2% line.
- The estate-company payment view shows the approved seller commission wording and amount.
- A successful payment changes the plot status to Sold.
- A paid signed allocation form changes the plot to Allocated.
- The generated PDF contains the correct property, estate, and signer details.
- The PDF is actually stored and retrievable from the document area.
- Retrying payment does not create a duplicate charge or duplicate successful sale.
- The buyer can see only documents intended for the buyer.
- A used visitor pass is rejected or shown as already used.
- The standard bottom tab bar stays in its own layout area and does not cover form fields, buttons, or other content.

If any of these checks fails, describe it to the client as an environment or configuration item to resolve, not as a completed feature.

---

## Closing explanation for the client

“EstateFlow gives each participant the right tools for their role. Buyers discover properties and keep their purchase records. Estate Management controls estates, plots, buyers, sales, and documents. Residents manage visitors and estate services. Security verifies access at the gate. The important automation begins after an authorised action: payment verification updates the sale and plot status, and the completed paid allocation form can create the final allocation record. This gives the platform both operational control and an auditable digital record.”
