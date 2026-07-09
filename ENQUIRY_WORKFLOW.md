# Enquiry → Application → Approval Workflow

The end-to-end flow from a prospective client's first website click to an
approved registration in CertMS.

## Steps

| # | Actor | Action | Surface in CertMS |
|---|---|---|---|
| 1 | Client (public) | Clicks **Enquiry** on qmicscertification.com | (External site) |
| 2 | Client | Fills enquiry form (name, org, email, standard, message) | Public enquiry submission |
| 3 | System | Routes the enquiry to the Audit Coordinator | Stored in `cms_client_enquiries_v1` |
| 4 | Coordinator | Sees the enquiry pop into the inbox | Application → **Client Enquiry → Enquiries** |
| 5 | Coordinator | Reviews enquiry, qualifies it, hits **Convert** | Creates a Sent Application record |
| 6 | Coordinator | Composes the digital application form & emails it | Application → **Client Enquiry → Sent Application** |
| 7 | Client (Auditee) | Receives email, opens the digital form | Auditee → **Pending Applications** |
| 8 | Client | Fills out the form fields (name, org, contact, email, enquiry date, address, industry, employees, standards interested, preferred audit dates, attachments) | Auditee fills inline form, hits **Submit** |
| 9 | System | Flips the Sent Application status to **Received** | `cms_application_dispatch_v7` updated |
| 10 | Coordinator | Picks up the submission | Application → **Receive Application** |
| 11 | Coordinator | Opens **Review Application**, sees the contact, application review date, fills any notes | Application → **Review Application** |
| 12 | Coordinator | Hits **Approve** (or Hold / Rejected with note) | Status becomes **Approved** |
| 13 | Coordinator | Creates the Client Registration with the captured details | Client Registration → New entry, auto Code, Pending |
| 14 | Coordinator | **Submit-to-Email** the registration + Annexure-13 contract | mailto, stamps `submittedAt` |
| 15 | Client | Replies to the registration email | (External email reply) |
| 16 | Coordinator | Marks **Approved by Client** with optional reply note | Stamps `clientRespondedAt`, status = Approved |
| 17 | System | Client is now eligible for audit scheduling | Coordinator → Audit Schedules |

## What the Coordinator's "received emails / inbox" looks like

When a Client Enquiry arrives, it appears as a row in **Application → Client
Enquiry → Enquiries** with:

- Stat cards count the New / Contacted / Qualified counts.
- A **New** badge highlights freshly-arrived enquiries.
- The status dropdown lets the Coordinator change the lifecycle stage in one
  click.

## What the Sent Application form sent to the client looks like

The Coordinator's **+ Sent Application** form (in
Application → Client Enquiry → Sent Application) captures:

- Client Name
- Organisation
- Client Contact Number / Mobile
- Email
- Enquiry Date (= Application Date in the table)
- Application Status (Submitted / Pending toggle)
- Application Attachment (the digital form template — PDF / DOC)
- Agreement attachment

The Coordinator then clicks the row's **Send Email** action; this opens the
default email client with a prefilled mail to the client. The row is now in
the **Sent** state.

## What the Auditee sees

A new page **Pending Applications** in the Auditee sidebar lists every
Sent Application addressed to the logged-in client by email. Each row has
a **Fill Application** button that opens a digital form modal with all the
captured fields plus extra prompts for:

- Address
- Industry
- Number of employees
- Standards of interest (multi-select)
- Audit Type
- Preferred audit start / end dates
- Additional notes & attachments

Submitting:

- Updates the Sent Application record with the filled fields.
- Flips its status from `Sent` to `Received`.
- Stamps a `clientSubmittedAt` timestamp.
- The Coordinator now sees it on the **Receive Application** tab.

## Approval handoff

The Coordinator opens **Review Application**, sees the populated client
details, decides between **Approve / Hold / Rejected**, and on Approve the
flow continues to **Client Registration** where Submit-to-Email and
Mark-as-Approved-by-Client close the loop.
