# CertiSphere: Application & Client Registration Workflows
## Complete Guide with Flowcharts & Mind Maps

---

## TABLE OF CONTENTS
1. [Quick Overview](#quick-overview)
2. [Application Workflow](#application-workflow)
3. [Client Registration Workflow](#client-registration-workflow)
4. [Mind Maps](#mind-maps)
5. [Detailed Flowcharts](#detailed-flowcharts)
6. [Decision Trees](#decision-trees)
7. [Data Models](#data-models)
8. [Common Scenarios](#common-scenarios)

---

# QUICK OVERVIEW

## Two Workflows in Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT JOURNEY IN CERTISPHERE                │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: APPLICATION WORKFLOW
  (Sending & Receiving Application Documents)
  
  ├─ Enquiry Qualification ──→ Send Application ──→ Receive Application ──→ Review Application
  
  Status: New → Contacted → Qualified → Converted
  Location in App: "Application" page → "Enquiries" & "Sent" & "Received" & "Review" tabs


PHASE 2: CLIENT REGISTRATION WORKFLOW
  (Registering Client & Getting Approval)
  
  ├─ Create Registration ──→ Verify Details ──→ Upload Docs ──→ Submit to Client ──→ Client Approves
  
  Status: Draft → Ready for Submission → Awaiting Approval → Active
  Location in App: "Client Registration" page


RESULT: Active certified client ready for audit scheduling
```

---

# APPLICATION WORKFLOW

## Step-by-Step Process

### **STEP 1: Enquiry & Qualification** 
**Who**: Prospect / Audit Coordinator  
**Where**: Application page → Enquiries tab

#### What happens:
```
Prospect submits enquiry
         ↓
Coordinator receives enquiry
         ↓
Coordinator evaluates:
  ✓ Can we certify their standard?
  ✓ Is their organization type within scope?
  ✓ Geographic feasibility?
         ↓
    TWO OUTCOMES:
    
    ✓ QUALIFIED           ✗ REJECTED
    (Good fit)            (Not suitable)
         ↓                     ↓
    Proceed to          Mark as Rejected
    Send Application    Archive enquiry
```

#### Data Collected:
- Company Name
- Contact Name & Email
- Certification Standard (ISO 9001, 14001, 45001, etc.)
- Message/Details
- Source (Website, Email, Phone, Referral)

#### Status Tracking:
```
NEW (Initial) → CONTACTED (Reached out) → QUALIFIED (Good fit) → CONVERTED (Becomes client)
                                      ↓
                                  REJECTED (Not suitable)
```

---

### **STEP 2: Send Application**
**Who**: Audit Coordinator  
**Where**: Application page → Sent Applications tab

#### What Coordinator Does:
```
1. Prepares application package:
   - Application Form (generic template)
   - Agreement / Terms & Conditions
   
2. Attaches documents to enquiry record
   
3. Clicks "Send Application"
   
4. System sends email to client
   
5. Records timestamp: sentAt
```

#### What Client Receives:
```
EMAIL SUBJECT: Application for ISO Certification

Dear [Client Name],

Please find attached:
1. Application Form - Complete and sign
2. Agreement - Terms & Conditions
3. Instructions - How to proceed

Please return signed documents to us.

Regards,
[Certification Body Name]
```

#### Behind the Scenes:
```
applicationStatus: "Submitted"  (document sent, awaiting return)
sentAt: 2024-01-15T10:30:00Z    (when email was sent)
attachment: {                   (application form)
  name: "Application Form.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-01-15T10:30:00Z"
}
agreement: {                    (terms & conditions)
  name: "Agreement.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-01-15T10:30:00Z"
}
deliveryHistory: [              (tracking)
  { at: "2024-01-15T10:30:00Z", via: "email" }
]
```

---

### **STEP 3: Receive Application**
**Who**: Audit Coordinator  
**Where**: Application page → Received Applications tab

#### What Happens:
```
1. Client returns signed application to Coordinator
   
2. Coordinator receives the email/documents
   
3. Coordinator uploads signed documents:
   - Signed Application Form
   - Signed Agreement
   
4. Marks status: "Received"
   
5. Records timestamp: receivedAt
```

#### Application Now Contains:
```
applicationStatus: "Received"       (signed docs in hand)
receivedAt: 2024-01-20T14:00:00Z    (when received)
signedApplication: {
  name: "Application Form - Signed.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-01-20T14:00:00Z"
}
signedAgreement: {
  name: "Agreement - Signed.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-01-20T14:00:00Z"
}
```

---

### **STEP 4: Review Application**
**Who**: Audit Coordinator + [AI Module]  
**Where**: Application page → Review Applications tab

#### What Coordinator Reviews:

```
COMPLETENESS CHECK:
  ✓ All required fields filled in?
  ✓ Agreement properly signed?
  ✓ Contact info is valid?
  ✓ Scope matches what was quoted?

CONSISTENCY CHECK:
  ✓ Company name consistent across docs?
  ✓ Contact person matches?
  ✓ Certification standard is what they asked for?

COMPLIANCE CHECK:
  ✓ No missing documents?
  ✓ All required signatures present?
  ✓ Email/Phone verified?

[WITH AI]:
  ✓ AI checks completeness %
  ✓ AI flags inconsistencies
  ✓ AI highlights missing info
  ✓ AI recommends: APPROVE / HOLD / REJECT
```

#### Review Interface Shows:
```
┌─────────────────────────────────────────────────────┐
│ APPLICATION REVIEW                                  │
├─────────────────────────────────────────────────────┤
│ Contact Name      │ Email               │ Review Date│
│ John Doe          │ john@company.com    │ 2024-01-20 │
├─────────────────────────────────────────────────────┤
│ Status:  [ Approve ] [ Hold ] [ Reject ]            │
│ Notes:   [Text field for reviewer comments]         │
│ AI Note: 95% complete, no major inconsistencies    │
└─────────────────────────────────────────────────────┘
```

#### Decision Points:

```
Decision 1: APPROVE ✓
  → All checks pass
  → Ready to move to Client Registration
  → Status: "Approved"

Decision 2: HOLD ⏸️
  → Missing some information
  → Request more documents from client
  → Status: "Hold"
  → Coordinator contacts client for clarification

Decision 3: REJECT ✗
  → Application doesn't meet requirements
  → Not suitable for certification
  → Status: "Rejected"
  → Archive record, notify client
```

---

## APPLICATION WORKFLOW SUMMARY TABLE

| Step | Activity | Owner | Input | Output | Status |
|------|----------|-------|-------|--------|--------|
| 1 | Receive Enquiry | Prospect/Coordinator | Company details, standards | Enquiry record | New |
| 2 | Qualify Enquiry | Coordinator | Enquiry review | Passed/Failed fit | Qualified/Rejected |
| 3 | Send Application | Coordinator | Enquiry | Email sent to client | Submitted |
| 4 | Receive Application | Coordinator | Signed docs from client | Docs uploaded | Received |
| 5 | Review Application | Coordinator + AI | Received docs | Approval decision | Approved/Hold/Rejected |

---

# CLIENT REGISTRATION WORKFLOW

## Step-by-Step Process

### **STEP 1: Create Registration Record**
**Who**: Audit Coordinator  
**When**: After Application is Approved

#### What Coordinator Does:
```
1. Approved application is ready
   
2. Coordinator clicks "Convert to Registration"
   
3. System creates new Client Registration record
   
4. Auto-generates Client Code: CMS-2024-0001
   
5. Pre-fills common data from application
```

#### Client Code Generation:
```
Format: CMS-YYYY-NNNN
Example: CMS-2024-0001, CMS-2024-0002, CMS-2024-0003

Scheme:
- CMS: Certification Management System prefix
- YYYY: Current year
- NNNN: Sequential number (padded with zeros)

Each client gets unique code throughout their lifecycle
```

---

### **STEP 2: Collect Full Client Details**
**Who**: Audit Coordinator  
**Where**: Client Registration page → Registration Details section

#### Data Collected (Comprehensive):

```
╔════════════════════════════════════════════════════════╗
║           CLIENT REGISTRATION FORM SECTIONS            ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  1. BASIC INFORMATION                                 ║
║  ├─ Client Code: CMS-2024-0001                       ║
║  ├─ Legal Company Name: *                            ║
║  ├─ Organization Type: Manufacturing / Service       ║
║  ├─ Website: (optional)                              ║
║  └─ Industry: (optional)                             ║
║                                                        ║
║  2. LOCATION DETAILS                                  ║
║  ├─ Head Office Address: *                           ║
║  ├─ City: *                                          ║
║  ├─ State: *                                         ║
║  ├─ Country: *                                       ║
║  ├─ Postal Code: *                                   ║
║  └─ Multiple Sites: (if applicable)                  ║
║                                                        ║
║  3. REGISTRATION IDENTIFIERS (India-specific)        ║
║  ├─ GSTIN: *  (Goods & Services Tax ID)             ║
║  ├─ CIN: *   (Corporate Identification Number)      ║
║  ├─ PAN: *   (Permanent Account Number)             ║
║  └─ Email Domain: (for verification)                ║
║                                                        ║
║  4. PRIMARY CONTACT                                   ║
║  ├─ Contact Name: *                                  ║
║  ├─ Title/Designation: *                            ║
║  ├─ Email: * (verified)                             ║
║  ├─ Phone: *                                         ║
║  └─ Mobile: *                                        ║
║                                                        ║
║  5. SECONDARY CONTACT (optional)                      ║
║  ├─ Name:                                            ║
║  ├─ Email:                                           ║
║  └─ Phone:                                           ║
║                                                        ║
║  6. ORGANIZATION LOGO                                 ║
║  ├─ Logo Upload: (file, max 3MB)                    ║
║  └─ Logo Preview: (shows uploaded logo)             ║
║                                                        ║
║  7. CERTIFICATION SCOPE                              ║
║  ├─ Primary Standard: * (ISO 9001, 14001, etc.)     ║
║  ├─ Secondary Standards: (optional)                  ║
║  ├─ Audit Type: * (Initial/Surveillance/Renewal)   ║
║  └─ Scope of Certification: * (detailed)            ║
║     (What activities/products will be certified)     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

* = Required field
```

#### Example Filled Form:
```
Client Code:        CMS-2024-0001
Company Name:       Green Energy Solutions Ltd.
Org Type:           Manufacturing
Address:            Block-A, Industrial Area
City:               Bangalore
State:              Karnataka
Country:            India
Postal Code:        560001
GSTIN:              18AABCC1234A1Z5
CIN:                U29145KA2010PTC123456
PAN:                AABCC1234A
Primary Contact:    Mr. Rajesh Kumar
Title:              Quality Manager
Email:              rajesh@greenenergy.com
Phone:              +91-80-12345678
Mobile:             +91-98765-43210
Logo:               [Green Energy Logo Image]
Standard:           ISO 14001:2015
Audit Type:         Initial
Scope:              Manufacturing of solar panels and accessories
```

---

### **STEP 3: Duplicate Detection & Validation**
**Who**: System (Automated) + [AI Module]  
**When**: When registration details are saved

#### Automated Checks:

```
DUPLICATE DETECTION:
┌─────────────────────────────────────────────┐
│ Check 1: By GSTIN                           │
│ ─────────────────────────────────────────── │
│ IF GSTIN already exists in system           │
│   → FLAG: "Possible duplicate found"        │
│   → SHOW existing client                    │
│   → ASK Coordinator: Link or Create New?    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Check 2: By CIN                             │
│ ─────────────────────────────────────────── │
│ IF CIN already exists                       │
│   → FLAG: "CIN already registered"          │
│   → SHOW: Client who has this CIN          │
│   → ASK: Confirm duplicate?                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Check 3: By Email Domain                    │
│ ─────────────────────────────────────────── │
│ IF email domain (e.g., @greenenergy.com)   │
│   exists with similar company name          │
│   → FLAG: "Similar organization exists"     │
│   → SHOW: Existing record                   │
│   → ASK: Same company or different?         │
└─────────────────────────────────────────────┘

VALIDATION CHECKS:
┌─────────────────────────────────────────────┐
│ Validate GSTIN Format                       │
│ ─────────────────────────────────────────── │
│ Pattern: 18AABCC1234A1Z5 (15 digits)       │
│ IF invalid → ERROR: Invalid GSTIN format   │
│ IF valid   → PASS                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Validate CIN Format                         │
│ ─────────────────────────────────────────── │
│ Pattern: U29145KA2010PTC123456 (21 chars)   │
│ IF invalid → ERROR: Invalid CIN format     │
│ IF valid   → PASS                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Validate PAN Format                         │
│ ─────────────────────────────────────────── │
│ Pattern: AABCC1234A (10 chars)              │
│ IF invalid → ERROR: Invalid PAN format     │
│ IF valid   → PASS                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Validate Email & Phone                      │
│ ─────────────────────────────────────────── │
│ Email: abc@xyz.com format check             │
│ Phone: +91-XXXXXXXXXX format check          │
│ IF invalid → ERROR: Invalid format         │
│ IF valid   → PASS                          │
└─────────────────────────────────────────────┘
```

#### Outcomes:

```
SCENARIO 1: All Checks Pass ✓
  → Status: READY FOR DOCUMENT UPLOAD
  → Proceed to Step 4

SCENARIO 2: Duplicate Found ⚠️
  → Show existing client record
  → Ask Coordinator to confirm:
    Option A: Link to existing client
    Option B: Create new registration anyway
  → If Option A: Merge records
  → If Option B: Continue with new registration

SCENARIO 3: Validation Error ✗
  → Highlight fields with errors
  → Show error messages
  → Ask Coordinator to correct data
  → Cannot proceed until all valid
```

---

### **STEP 4: Upload Registration Documents**
**Who**: Audit Coordinator  
**Where**: Client Registration page → Documents section

#### Documents Required:

```
╔════════════════════════════════════════════════════════╗
║         REQUIRED REGISTRATION DOCUMENTS                ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  📄 MANDATORY:                                         ║
║  ├─ Annexure-13 Certification Contract               ║
║  │  (Standard contract from certification body)      ║
║  │  - Can be uploaded as PDF or generated from form ║
║  │  - Must be signed by authorized person           ║
║  │  - Contains: Scope, standards, terms, fees       ║
║  │                                                    ║
║  └─ Agreement/Terms & Conditions                     ║
║     (Already from application phase)                 ║
║     - Client has already signed                      ║
║     - Just confirm/upload finalized version          ║
║                                                        ║
║  📎 OPTIONAL (Supporting Documents):                 ║
║  ├─ Certificate of Incorporation                    ║
║  ├─ Business License/Registration                   ║
║  ├─ Proof of GSTIN                                 ║
║  ├─ Proof of CIN                                   ║
║  ├─ Proof of PAN                                   ║
║  ├─ Bank Details/Address Proof                     ║
║  └─ Any other supporting docs                      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

#### What Coordinator Can Do:

```
For Each Document:
├─ UPLOAD
│  └─ Select file from computer
│     Max size: 3 MB per document
│     Stored as: Base64 dataURL in browser

├─ REPLACE
│  └─ Remove old version
│     Upload new version
│     Timestamp updated

├─ CLEAR
│  └─ Delete document
│     Cannot be undone
│     Coordinator must re-upload

├─ DOWNLOAD
│  └─ Save to computer
│     Download as .pdf or original format

└─ VIEW
   └─ Preview document in browser
      Check contents before finalizing
```

#### AI Document Verification (if enabled):
```
AI scans uploaded documents for:

✓ Document Completeness
  - Is the document fully visible?
  - Are all pages included?
  - No corruption or missing sections?

✓ Signature Validation
  - Is the document signed?
  - Is signature in proper place?
  - Multiple signatures if required?

✓ Expiry Date Check
  - Does document have expiry date?
  - Is it still valid?
  - Flag if expiring soon (30/60/90 days)

✓ Content Consistency
  - Does company name match registration?
  - Do signatories match contact person?
  - Are standards consistent across docs?

AI Output: ✓ PASS or ⚠️ NEEDS ATTENTION
  If NEEDS ATTENTION: Show what needs fixing
```

---

### **STEP 5: Review & Finalize Registration**
**Who**: Audit Coordinator  
**Where**: Client Registration page → Review section

#### What Coordinator Checks:

```
PRE-SUBMISSION CHECKLIST:

□ BASIC INFO
  □ Client code generated? (CMS-2024-XXXX)
  □ Company name filled?
  □ Organization type selected?
  □ Address complete?

□ IDENTIFIERS
  □ GSTIN valid and verified?
  □ CIN valid and verified?
  □ PAN valid and verified?
  □ No duplicates flagged?

□ CONTACTS
  □ Primary contact name filled?
  □ Email verified and valid?
  □ Phone number filled?
  □ Can we reach them?

□ CERTIFICATION SCOPE
  □ Standard selected? (ISO 9001, etc.)
  □ Audit type selected? (Initial/Surveillance)
  □ Scope description detailed?
  □ Realistic and feasible?

□ DOCUMENTS
  □ Annexure-13 uploaded?
  □ Agreement uploaded?
  □ All documents signed?
  □ AI verification passed?

□ LOGO
  □ Logo uploaded and displays correctly?
  □ High quality and professional?
  □ No copyright issues?

When all items checked: Status → "Ready for Client Approval"
```

---

### **STEP 6: Submit Registration to Client**
**Who**: Audit Coordinator  
**Where**: Client Registration page → Submit button

#### What Happens:

```
1. Coordinator Reviews All Details
   └─ Final check everything is correct

2. Coordinator Clicks "Submit to Email"
   └─ Opens pre-filled email template

3. Email Template Contains:
   ├─ Client registration summary
   ├─ Certification contract (Annexure-13)
   ├─ Agreement terms
   ├─ Scope of certification
   ├─ Standards applied
   ├─ Fee structure
   └─ Request for signature

4. Email Sent to Client Contact
   └─ Registration summary for review

5. Client Reviews & Signs
   ├─ Reads all details
   ├─ Verifies information is correct
   ├─ Signs Annexure-13 Contract
   ├─ Signs Agreement if needed
   └─ Returns to Coordinator

6. Coordinator Receives Signed Docs
   ├─ Gets email with signed contracts
   ├─ Downloads signed files
   ├─ Uploads to registration record
   └─ Marks "Approved by Client"
```

#### Email Template Example:

```
═════════════════════════════════════════════════════════
TO: rajesh@greenenergy.com
SUBJECT: Client Registration Approval - CMS-2024-0001

═════════════════════════════════════════════════════════

Dear Rajesh Kumar,

Please find below your certification registration details.
Review carefully and confirm by signing the documents below.

CLIENT REGISTRATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━
Client Code:        CMS-2024-0001
Company:            Green Energy Solutions Ltd.
Contact:            Mr. Rajesh Kumar
Email:              rajesh@greenenergy.com
Mobile:             +91-98765-43210
Address:            Block-A, Industrial Area, Bangalore

CERTIFICATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━
Standard:           ISO 14001:2015 (Environmental)
Audit Type:         Initial Certification Audit
Scope:              Manufacturing of solar panels and accessories
Number of Sites:    1 (Head Office)

ATTACHED DOCUMENTS - PLEASE SIGN & RETURN
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Annexure-13-Certification-Contract.pdf
   → Certification contract and terms
   → MUST BE SIGNED by authorized person
   
2. Agreement-Terms-Conditions.pdf
   → General terms and conditions
   → MUST BE SIGNED

NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Review all details carefully
2. Print documents
3. Sign with authorized signature
4. Scan signed documents
5. Reply to this email with:
   - Signed Annexure-13
   - Signed Agreement
   - Any questions

QUESTIONS?
━━━━━━━━━━━━━━━━━━━━━━━━━━
Contact: coordinator@certisphere.com
Phone: +91-80-98765432

Thank you,
Certification Team

═════════════════════════════════════════════════════════
```

---

### **STEP 7: Client Approval**
**Who**: Client / Audit Coordinator  
**When**: After client signs and returns documents

#### What Happens:

```
CLIENT SIDE:
1. Receives email with registration details
2. Reviews all information carefully
3. Verifies accuracy of:
   - Company details
   - Contact information
   - Certification scope
   - Standards and fees
4. Prints documents
5. Authorized person signs both documents
6. Scans signed documents
7. Replies to email with signed docs

COORDINATOR SIDE:
1. Receives email from client with attachments
2. Downloads signed documents
3. Uploads to registration record:
   ├─ signedAnnexure13
   ├─ signedAgreement
   └─ clientApprovalDate
4. Verifies signatures are valid
5. Marks status: "Approved by Client" ✓
6. Registration becomes ACTIVE

SYSTEM SIDE:
Status Changes: "Awaiting Client Approval" → "ACTIVE CLIENT"
Client is now ready for:
├─ Audit Scheduling
├─ Auditor Assignment
├─ Audit Execution
└─ Certificate Delivery
```

#### Data Updated:

```
clientRegistrationStatus: "ACTIVE"
approvedByClientAt: 2024-02-15T10:30:00Z
signedAnnexure13: {
  name: "Annexure-13-Signed.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-02-15T10:30:00Z"
}
signedAgreement: {
  name: "Agreement-Signed.pdf",
  dataUrl: "base64...",
  uploadedAt: "2024-02-15T10:30:00Z"
}
registrationActive: true
activeStartDate: 2024-02-15
```

---

## CLIENT REGISTRATION WORKFLOW SUMMARY TABLE

| Step | Activity | Owner | Input | Output | Status |
|------|----------|-------|-------|--------|--------|
| 1 | Create Registration | Coordinator | Approved Application | Registration Record | Draft |
| 2 | Collect Details | Coordinator | Form input | Detailed client info | Incomplete |
| 3 | Verify Details | System + AI | Client data | Validation result | Validated |
| 4 | Upload Docs | Coordinator | PDF files | Stored docs | Documents Ready |
| 5 | Review Registration | Coordinator | All details | Ready for approval | Review Complete |
| 6 | Submit to Client | Coordinator | Registration summary | Email sent to client | Awaiting Approval |
| 7 | Get Approval | Client | Signed documents | Active registration | ACTIVE |

---

# MIND MAPS

## 1. Application Workflow Mind Map

```
                              APPLICATION WORKFLOW
                                      |
                    ____________________|____________________
                   |                   |                    |
              ENQUIRY PHASE        APPLICATION PHASE    REVIEW PHASE
                   |                   |                    |
          ┌────────┴────────┐     ┌────┴────┐         ┌────┴────┐
          |                 |     |          |         |         |
      NEW ENQUIRY      QUALIFICATION  SEND    RECEIVE  REVIEW  DECISION
          |                 |        APP      APP      APP      |
      • Website         • Fit Check   |        |        |      ┌─┴─┐
      • Email          • Standards   • Email  • Upload • Check ├─┼─┤
      • Phone          • Geography   • Docs   • Verify • AI   ✓ Approve
      • Referral       • Industry    • Track  • Status • Flag ⏸ Hold
                                     • Template         • Status ✗ Reject
```

## 2. Client Registration Workflow Mind Map

```
                          CLIENT REGISTRATION WORKFLOW
                                    |
                    __________________|__________________
                   |                |                   |
            CREATE STAGE       POPULATE STAGE      APPROVAL STAGE
                   |                |                   |
            ┌──────┴──────┐   ┌──────┴───────┐   ┌──────┴────────┐
            |             |   |              |   |               |
        NEW RECORD    AUTO-CODE   BASIC INFO  IDENTIFIERS  DOCUMENTS
            |             |       |           |              |
        • From App    • Generate  • Company   • GSTIN        • Contracts
        • Coordinator    YYYY-NNNN • Address  • CIN          • Agreement
        • Initiate       Code      • Contact  • PAN          • Support Docs
                                   • Logo     • Validation   • Sign & Upload
                                   • Scope    • Duplicates   
                                              • AI Verify
                                              
                                    |
                                SUBMIT TO CLIENT
                                    |
                          CLIENT REVIEWS & SIGNS
                                    |
                              ACTIVE CLIENT ✓
```

## 3. Complete Journey Mind Map

```
                           COMPLETE CLIENT JOURNEY
                                  |
                    ______________|______________
                   |                            |
              PHASE 1              PHASE 2           PHASE 3
              APPLICANT         REGISTRANT        CERTIFIED CLIENT
                |                  |                    |
        ┌───────┴────────┐  ┌──────┴──────┐  ┌────────┴──────┐
        |                |  |             |  |               |
    ENQUIRY        APPLICATION    REGISTRATION   AUDIT         CERTIFICATE
    STAGE          STAGE          STAGE          STAGE         STAGE
        |                |             |          |               |
    Prospect         Send Docs    Register Info   Schedule    Issue Cert
    Qualifies        Receive      Upload Docs     Conduct     Surveillance
    Converted        Review       Verify          Report      Renew
                     Approved     Client OK       Approve     Withdraw
                                  ACTIVE
```

---

# DETAILED FLOWCHARTS

## 1. Complete Application & Registration Flow

```
START: Client Enquiry
  │
  ├─→ ENQUIRY QUALIFICATION
  │   ├─ Fit check: Standard, Industry, Geography
  │   ├─ Decision: Qualified or Rejected?
  │   │   ├─ REJECTED → END (Archive)
  │   │   └─ QUALIFIED ↓
  │   │
  │   └─→ SEND APPLICATION
  │       ├─ Coordinator prepares application package
  │       ├─ Attaches form + agreement
  │       ├─ Sends email to client
  │       └─ Status: "Submitted" ↓
  │
  └─→ RECEIVE APPLICATION
      ├─ Client returns signed documents
      ├─ Coordinator uploads documents
      ├─ Status: "Received" ↓
      │
      └─→ REVIEW APPLICATION
          ├─ Check completeness
          ├─ Verify signatures
          ├─ AI scans for issues
          ├─ Decision: Approve / Hold / Reject?
          │   ├─ REJECTED → END (Notify client)
          │   ├─ HOLD → Request info (loop back)
          │   └─ APPROVED ↓ (Move to Registration)
          │
          └─→ CREATE REGISTRATION
              ├─ Generate Client Code (CMS-2024-XXXX)
              ├─ Create registration record
              ├─ Pre-fill from application data
              ├─ Status: "Draft" ↓
              │
              └─→ COLLECT CLIENT DETAILS
                  ├─ Fill all registration fields
                  ├─ Upload logo
                  ├─ Define scope
                  ├─ Status: "Incomplete" ↓
                  │
                  └─→ VERIFY & VALIDATE
                      ├─ Duplicate detection:
                      │  ├─ By GSTIN
                      │  ├─ By CIN
                      │  └─ By Email domain
                      ├─ Format validation:
                      │  ├─ GSTIN format
                      │  ├─ CIN format
                      │  ├─ PAN format
                      │  └─ Email/Phone format
                      ├─ All valid?
                      │   ├─ NO → Error messages (fix & retry)
                      │   └─ YES ↓
                      │
                      └─→ UPLOAD DOCUMENTS
                          ├─ Upload Annexure-13
                          ├─ Upload Agreement
                          ├─ Upload support docs
                          ├─ AI scans documents:
                          │  ├─ Completeness
                          │  ├─ Signatures
                          │  └─ Expiry dates
                          ├─ Status: "Documents Ready" ↓
                          │
                          └─→ REVIEW REGISTRATION
                              ├─ Final completeness check
                              ├─ Verify all details
                              ├─ Check all documents
                              ├─ Status: "Ready for Approval" ↓
                              │
                              └─→ SUBMIT TO CLIENT
                                  ├─ Send registration summary email
                                  ├─ Client receives and reviews
                                  ├─ Client signs documents
                                  ├─ Status: "Awaiting Client Approval" ↓
                                  │
                                  └─→ RECEIVE CLIENT APPROVAL
                                      ├─ Client returns signed docs
                                      ├─ Coordinator uploads signatures
                                      ├─ Verify signatures valid
                                      ├─ Status: "Approved by Client" ↓
                                      │
                                      └─→ ✓✓✓ ACTIVE CLIENT ✓✓✓
                                          │
                                          Ready for:
                                          ├─ Audit Scheduling
                                          ├─ Auditor Assignment
                                          ├─ Audit Execution
                                          └─ Certificate Issuance

```

## 2. Application Workflow Detailed Flow

```
                    ╔════════════════════════════════════╗
                    ║   APPLICATION WORKFLOW FLOWCHART   ║
                    ╚════════════════════════════════════╝


                            START: ENQUIRY
                                 │
                    ┌────────────┴──────────┐
                    │                       │
              WEBSITE FORM          MANUAL ENTRY
                    │                       │
                    └────────────┬──────────┘
                                 ▼
                    ┌──────────────────────┐
                    │  ENQUIRY RECEIVED    │
                    │  Status: NEW         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────────────┐
                    │   QUALIFICATION STAGE        │
                    │   (Coordinator Reviews)      │
                    └────────┬────────┬────────────┘
                            /│\
                           / │ \
                    Fit Check │ Geography
                             Scope
                    
                    ┌─────────────┬────────────┐
                    │ QUALIFIED ✓ │ REJECTED ✗ │
                    └──────┬──────┴────────────┘
                           │                 │
                     Status: QUALIFIED   END (Archive)
                           │
                           ▼
         ╔════════════════════════════════════════╗
         ║   SEND APPLICATION STAGE              ║
         ║   (Coordinator Action)                ║
         ║                                       ║
         ║  1. Prepare application package      ║
         ║  2. Attach: Form + Agreement         ║
         ║  3. Click "Send Application"         ║
         ║  4. Email sent to client             ║
         ║  5. Status: SUBMITTED                ║
         ║  6. Record: sentAt timestamp         ║
         ╚═════────┬───────────────────────────╝
                   │
                   ▼
     Client Receives Email with Documents
                   │
          (Client fills & signs documents)
                   │
          Client Returns Application
                   │
                   ▼
         ╔════════════════════════════════════════╗
         ║   RECEIVE APPLICATION STAGE           ║
         ║   (Coordinator Action)                ║
         ║                                       ║
         ║  1. Coordinator gets signed docs     ║
         ║  2. Upload to registration           ║
         ║  3. Mark Status: RECEIVED            ║
         ║  4. Record: receivedAt timestamp     ║
         ╚═────────┬────────────────────────────╝
                   │
                   ▼
       ╔═════════════════════════════════════════╗
       ║   REVIEW APPLICATION STAGE             ║
       ║   (Coordinator + AI)                   ║
       ║                                       ║
       ║   Checks:                            ║
       ║   ✓ Completeness (all fields filled) ║
       ║   ✓ Signatures (properly signed)     ║
       ║   ✓ Consistency (data matches)       ║
       ║   ✓ Compliance (no missing docs)     ║
       ║   ✓ AI scans for issues             ║
       ╚═────┬────────────────────────────────╝
             │
        ┌────┼────┐
        ▼    ▼    ▼
      PASS HOLD FAIL
        │    │    │
    ✓ Approve │  ✗ Reject
        │    │    │
     Status: │  END
     APPROVED │  (Notify
             │   Client)
             │
             ▼
    Request More Info
    (Contact Client)
             │
             └─→ (Loop back to RECEIVE)

    APPROVED Status
             │
             ▼
    MOVE TO CLIENT REGISTRATION
```

## 3. Client Registration Workflow Detailed Flow

```
                ╔═════════════════════════════════════╗
                ║  CLIENT REGISTRATION FLOWCHART      ║
                ╚═════════════════════════════════════╝

    START: Application APPROVED
             │
             ▼
    ╔════════════════════════════════════╗
    ║  CREATE REGISTRATION               ║
    ║  - Generate Code: CMS-2024-XXXX   ║
    ║  - Create record                   ║
    ║  - Pre-fill from application       ║
    ║  - Status: DRAFT                   ║
    ╚═────────┬────────────────────────╝
             │
             ▼
    ╔════════════════════════════════════╗
    ║  COLLECT CLIENT DETAILS            ║
    ║  (Coordinator fills form)          ║
    ║                                   ║
    ║  ✓ Basic Info (Company, Address)  ║
    ║  ✓ Identifiers (GSTIN, CIN, PAN) ║
    ║  ✓ Contacts (Name, Email, Phone) ║
    ║  ✓ Scope (Standard, Audit Type)  ║
    ║  ✓ Logo (Upload)                 ║
    ║  Status: INCOMPLETE               ║
    ╚═────────┬────────────────────────╝
             │
             ▼
    ╔════════════════════════════════════╗
    ║  VALIDATE & VERIFY                 ║
    ║  (System + AI)                     ║
    ║                                   ║
    ║  Duplicate Detection:              ║
    ║  ├─ Check GSTIN already exists? │
    ║  ├─ Check CIN already exists?   │
    ║  └─ Check Email domain match?   │
    ║                                   ║
    ║  Format Validation:                ║
    ║  ├─ GSTIN format valid?          │
    ║  ├─ CIN format valid?            │
    ║  ├─ PAN format valid?            │
    ║  ├─ Email valid?                 │
    ║  └─ Phone valid?                 │
    ║                                   ║
    ║  Decision: All Valid?             ║
    ╚═────┬────────────┬────────────────╝
         /             \
       YES              NO (Error)
        │                   │
        ▼                   ▼
    PASS         Show Error Messages
        │         Fix Data & Retry
        ▼
    Status: VALIDATED
        │
        ▼
    ╔════════════════════════════════════╗
    ║  UPLOAD DOCUMENTS                  ║
    ║  (Coordinator uploads)             ║
    ║                                   ║
    ║  Required:                         ║
    ║  • Annexure-13 (Contract)         ║
    ║  • Agreement (Terms)              ║
    ║                                   ║
    ║  Optional:                         ║
    ║  • Certificates of Incorporation  ║
    ║  • Business License               ║
    ║  • ID Proofs                      ║
    ║                                   ║
    ║  AI Document Verification:        ║
    ║  ✓ Completeness scan             ║
    ║  ✓ Signature verification        ║
    ║  ✓ Expiry date check             ║
    ║  ✓ Content consistency           ║
    ║                                   ║
    ║  Status: DOCUMENTS READY          ║
    ╚═────────┬────────────────────────╝
             │
             ▼
    ╔════════════════════════════════════╗
    ║  REVIEW REGISTRATION               ║
    ║  (Coordinator final check)         ║
    ║                                   ║
    ║  Checklist:                        ║
    ║  ✓ All required fields filled     ║
    ║  ✓ All documents uploaded         ║
    ║  ✓ All data validated             ║
    ║  ✓ No errors or warnings          ║
    ║  ✓ Ready for client approval      ║
    ║                                   ║
    ║  Status: READY FOR APPROVAL       ║
    ╚═────────┬────────────────────────╝
             │
             ▼
    ╔════════════════════════════════════╗
    ║  SUBMIT TO CLIENT                  ║
    ║  (Email registration summary)      ║
    ║                                   ║
    ║  Email Contains:                   ║
    ║  • Registration summary            ║
    ║  • Client details verification    ║
    ║  • Annexure-13 (to sign)          ║
    ║  • Agreement (to sign)            ║
    ║  • Request for approval           ║
    ║                                   ║
    ║  Status: AWAITING CLIENT APPROVAL ║
    ╚─────────┬──────────────────────────╝
             │
    (Client receives email)
             │
    (Client reviews registration)
             │
    (Client signs documents)
             │
    (Client sends back signed docs)
             │
             ▼
    ╔════════════════════════════════════╗
    ║  RECEIVE CLIENT APPROVAL           ║
    ║  (Coordinator uploads signatures) ║
    ║                                   ║
    ║  Actions:                          ║
    ║  • Receive signed documents       ║
    ║  • Upload to registration         ║
    ║  • Verify signatures              ║
    ║  • Confirm approval date          ║
    ║                                   ║
    ║  Status: APPROVED BY CLIENT ✓     ║
    ╚─────────┬──────────────────────────╝
             │
             ▼
    ╔════════════════════════════════════╗
    ║  ✓✓✓ ACTIVE CLIENT ✓✓✓           ║
    ║                                   ║
    ║  Client is now ready for:         ║
    ║  • Audit Scheduling               ║
    ║  • Auditor Assignment             ║
    ║  • Audit Execution                ║
    ║  • Certificate Issuance           ║
    ║  • Surveillance & Renewal         ║
    ╚════════════════════════════════════╝
```

---

# DECISION TREES

## 1. Application Review Decision Tree

```
                APPLICATION REVIEW DECISION TREE

                    START: Review Application
                            │
                    ┌───────┴────────┐
                    │                │
            CHECK COMPLETENESS   CHECK CONSISTENCY
                    │                │
        All fields filled?    Data matches across
                 │                   docs?
            ┌────┴────┐          ┌────┴────┐
           YES        NO         YES       NO
            │         │          │         │
            ▼         ▼          ▼         ▼
         PASS      FLAG       PASS      FLAG
           │       (Issue)      │      (Issue)
           └────┬──────────────┘
                │
                ▼
        CHECK SIGNATURES
                │
        Are documents
        properly signed?
                │
            ┌───┴───┐
           YES     NO
            │       │
           PASS   FLAG
            │     (Issue)
            └─────┬────────
                  │
                  ▼
        ANY ISSUES FOUND?
                │
            ┌───┴──────┬──────┐
           NO    YES    AI     └─→ Check AI
                       FLAG?      Recommendations
                       │
                   ┌───┴─────────┐
                  MANY         MINOR
                 ISSUES        ISSUES
                  │               │
                  ▼               ▼
              REJECT         HOLD/REQUEST
                │            MORE INFO
                │               │
                └───────┬───────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
        APPROVE      HOLD        REJECT
            │         │            │
        Move to    Ask Client   Notify
        Reg.       for More      Client
        Phase      Info          END

```

## 2. Registration Validation Decision Tree

```
            REGISTRATION VALIDATION DECISION TREE

                    START: Validate Registration
                            │
                    ┌───────┴─────────┐
                    │                 │
            DUPLICATE CHECK    FORMAT VALIDATION
                    │                 │
        Check if    Check if         Check if
        GSTIN/CIN   Email Domain     GSTIN format
        exists?     matches?         valid?
                    │                 │
            ┌───────┴────────┐       │
           YES              NO    ┌──┴──┐
            │               │    YES   NO
            ▼               ▼     │    │
        FLAG AS        PASS     PASS  ERROR
        DUPLICATE            │    │
            │                │    └─→ Fix & Retry
            │                │
        Show             CHECK CIN FORMAT
        Existing         Valid?
        Record       ┌──┴──┐
            │       YES   NO
            │        │    │
        ┌───┴────────┼────┴─→ ERROR
        │            │
        │        PASS
        │            │
        ▼            ▼
    LINK or      CHECK PAN FORMAT
    CREATE       Valid?
    NEW      ┌──┴──┐
    │       YES   NO
    │        │    │
    │        │    └─→ ERROR
    │        │
    │        PASS
    │        │
    └────┬───┤
         │   ▼
         │ CHECK EMAIL & PHONE
         │ Valid format?
         │ ┌──┴──┐
         │YES   NO
         │ │    │
         │ │    └─→ ERROR: Fix
         │ │        │
         │ │        └─→ Retry Validation
         │ │
         │ PASS
         │ │
         └─┴─→ ✓ ALL VALIDATION PASSED
             │
             ▼
         Move to Document
         Upload Stage

```

---

# DATA MODELS

## 1. Application Record Structure

```
┌────────────────────────────────────────────────────────────┐
│            APPLICATION DISPATCH RECORD (CMS)               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  IDENTIFICATION:                                           │
│  ├─ id: 1 (unique number)                                │
│  ├─ clientName: "John Doe"                              │
│  ├─ organization: "Green Energy Solutions"              │
│  └─ email: "info@greenenergy.com"                       │
│                                                            │
│  ENQUIRY DETAILS:                                         │
│  ├─ standard: "ISO 14001:2015"                          │
│  ├─ applicationType: "Audit Application Form"           │
│  ├─ source: "Website / Email / Phone"                  │
│  └─ enquiryStatus: "New / Contacted / Qualified"       │
│                                                            │
│  APPLICATION DETAILS:                                     │
│  ├─ dispatchedDate: "2024-01-15"                        │
│  ├─ status: "Submitted / Received / Approved"           │
│  └─ reviewDate: "2024-01-20"                            │
│                                                            │
│  DOCUMENTS:                                               │
│  ├─ attachment: {                                         │
│  │   name: "Application_Form.pdf",                      │
│  │   dataUrl: "data:application/pdf;base64,...",       │
│  │   size: 2048000,                                     │
│  │   uploadedAt: "2024-01-15T10:30:00Z"                │
│  │ }                                                     │
│  │                                                        │
│  └─ agreement: {                                          │
│      name: "Agreement.pdf",                             │
│      dataUrl: "data:application/pdf;base64,...",       │
│      size: 1024000,                                     │
│      uploadedAt: "2024-01-15T10:30:00Z"                │
│    }                                                     │
│                                                            │
│  DELIVERY TRACKING:                                       │
│  ├─ sentAt: "2024-01-15T10:30:00Z"                     │
│  ├─ deliveredAt: "2024-01-15T10:32:00Z"               │
│  ├─ readAt: "2024-01-15T14:00:00Z"                     │
│  └─ deliveryHistory: [                                  │
│      { at: "2024-01-15T10:30:00Z", via: "email" }    │
│    ]                                                     │
│                                                            │
│  REVIEW:                                                  │
│  ├─ reviewStatus: "Approved / Hold / Rejected"         │
│  ├─ reviewerName: "Rajesh Kumar"                       │
│  ├─ reviewerNotes: "Text notes"                        │
│  └─ reviewDate: "2024-01-20"                           │
│                                                            │
│  AI ANALYSIS (Optional):                                  │
│  ├─ aiCompleteness: 95                                  │
│  ├─ aiIssuesFound: ["Missing expiry date", ...]       │
│  ├─ aiRecommendation: "Approve"                        │
│  └─ aiConfidence: 92                                    │
│                                                            │
│  AUDIT SCOPE (Optional):                                  │
│  ├─ auditType: "Initial / Surveillance / Renewal"     │
│  ├─ preferredStartDate: "2024-02-01"                  │
│  ├─ preferredEndDate: "2024-02-03"                    │
│  ├─ auditorsCount: 2                                   │
│  └─ auditScope: "Detailed description..."             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 2. Client Registration Record Structure

```
┌────────────────────────────────────────────────────────────┐
│         CLIENT REGISTRATION RECORD (CMS)                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  IDENTIFICATION:                                           │
│  ├─ id: 1                                                │
│  ├─ clientCode: "CMS-2024-0001"                         │
│  ├─ status: "Draft / Active / Inactive / Suspended"    │
│  └─ createdAt: "2024-01-20T10:00:00Z"                 │
│                                                            │
│  BASIC INFORMATION:                                       │
│  ├─ companyName: "Green Energy Solutions Ltd."        │
│  ├─ organizationType: "Manufacturing / Service"        │
│  ├─ website: "www.greenenergy.com"                    │
│  ├─ industry: "Renewable Energy"                       │
│  └─ description: "Solar panel manufacturer"            │
│                                                            │
│  ADDRESS DETAILS:                                         │
│  ├─ headOfficeAddress: "Block-A, Industrial Area"     │
│  ├─ city: "Bangalore"                                  │
│  ├─ state: "Karnataka"                                 │
│  ├─ country: "India"                                   │
│  ├─ postalCode: "560001"                              │
│  └─ multipleSites: false                              │
│      (if true: array of branch addresses)             │
│                                                            │
│  REGISTRATION IDENTIFIERS:                                │
│  ├─ gstin: "18AABCC1234A1Z5"                          │
│  ├─ cin: "U29145KA2010PTC123456"                      │
│  ├─ pan: "AABCC1234A"                                 │
│  ├─ emailDomain: "greenenergy.com"                    │
│  └─ verificationStatus: "Verified / Pending"          │
│                                                            │
│  PRIMARY CONTACT:                                         │
│  ├─ contactName: "Rajesh Kumar"                       │
│  ├─ designation: "Quality Manager"                    │
│  ├─ email: "rajesh@greenenergy.com"                  │
│  ├─ phone: "+91-80-12345678"                         │
│  ├─ mobile: "+91-98765-43210"                        │
│  └─ emailVerified: true                              │
│                                                            │
│  SECONDARY CONTACT:                                       │
│  ├─ contactName: "Priya Singh"                        │
│  ├─ designation: "Compliance Officer"                │
│  ├─ email: "priya@greenenergy.com"                   │
│  └─ phone: "+91-80-98765432"                         │
│                                                            │
│  BRANDING:                                                │
│  ├─ logo: {                                             │
│  │   dataUrl: "data:image/png;base64,...",            │
│  │   uploadedAt: "2024-01-20T14:00:00Z",             │
│  │   fileSize: 256000                                 │
│  │ }                                                   │
│  └─ logoUrl: "/logos/cms-2024-0001.png"             │
│                                                            │
│  CERTIFICATION SCOPE:                                     │
│  ├─ standard: "ISO 14001:2015"                        │
│  ├─ secondaryStandards: ["ISO 9001:2015"]            │
│  ├─ auditType: "Initial / Surveillance / Renewal"   │
│  ├─ scopeDescription: "Manufacturing of solar panels..."
│  └─ scopeVersion: 1                                    │
│                                                            │
│  DOCUMENTS:                                               │
│  ├─ annexure13: {                                        │
│  │   name: "Annexure-13-Contract.pdf",               │
│  │   dataUrl: "data:application/pdf;base64,...",    │
│  │   uploadedAt: "2024-01-20T14:30:00Z",            │
│  │   signed: false,                                  │
│  │   signedAt: null                                  │
│  │ }                                                  │
│  │                                                    │
│  ├─ agreement: {                                        │
│  │   name: "Agreement-Terms.pdf",                   │
│  │   dataUrl: "data:application/pdf;base64,...",    │
│  │   uploadedAt: "2024-01-20T14:30:00Z",            │
│  │   signed: false,                                  │
│  │   signedAt: null                                  │
│  │ }                                                  │
│  │                                                    │
│  └─ supportDocuments: [                                 │
│      { name: "Certificate_of_Incorporation.pdf",     │
│        uploadedAt: "2024-01-20T14:35:00Z" },        │
│      { name: "Business_License.pdf",                 │
│        uploadedAt: "2024-01-20T14:35:00Z" }         │
│    ]                                                   │
│                                                            │
│  CLIENT APPROVAL:                                         │
│  ├─ approvalStatus: "Awaiting / Approved"             │
│  ├─ submittedToClientAt: "2024-01-20T15:00:00Z"     │
│  ├─ approvedByClientAt: "2024-01-25T10:30:00Z"      │
│  ├─ clientApprovalSignature: "signed base64 data"   │
│  └─ clientApprovalNotes: "Any notes from client"    │
│                                                            │
│  AUDIT ASSIGNMENT:                                        │
│  ├─ auditScheduleId: 5                                │
│  ├─ leadAuditorId: 12                                │
│  ├─ auditDate: "2024-02-15"                         │
│  └─ auditStatus: "Scheduled / In Progress / Done"   │
│                                                            │
│  CERTIFICATION STATUS:                                    │
│  ├─ certificateStatus: "None / Active / Expired"     │
│  ├─ certificateNumber: "CERT-2024-001"              │
│  ├─ issueDate: "2024-02-28"                         │
│  ├─ expiryDate: "2027-02-27"                        │
│  └─ certificateUrl: "/certs/CERT-2024-001.pdf"     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

# COMMON SCENARIOS

## Scenario 1: Happy Path (Everything Smooth)

```
Timeline: Day 1-5

DAY 1 - Monday:
  10:00 AM → Prospect submits enquiry via website
            "ISO 14001 certification for solar panel manufacturing"
            
  11:00 AM → Coordinator receives enquiry
            ✓ Checks: Standard (ISO 14001) - YES
            ✓ Checks: Organization type (Manufacturing) - YES
            ✓ Checks: Geography (Bangalore) - YES
            ✓ Qualifies enquiry
            
  02:00 PM → Coordinator prepares application package
            → Attaches: Application Form + Agreement
            → Sends email to client
            → Status: "Submitted"

DAY 3 - Wednesday:
  09:00 AM → Client receives email, reviews documents
  
  04:00 PM → Client fills application, signs both documents
            → Returns to Coordinator via email
            
  05:00 PM → Coordinator receives signed documents
            → Uploads to system
            → Status: "Received"

DAY 4 - Thursday:
  10:00 AM → Coordinator reviews application
            ✓ All fields filled
            ✓ Both documents signed
            ✓ No inconsistencies
            ✓ AI scan: 98% complete, no issues
            → Decision: APPROVE
            → Status: "Approved"
            
  11:00 AM → Creates Client Registration
            → Auto-generates: CMS-2024-0001
            → Fills registration details from application
            → Uploads GSTIN, CIN, PAN details
            → Validates all formats: ALL PASS
            → No duplicates found
            
  03:00 PM → Uploads Annexure-13 contract
            → AI verifies: Completeness OK, Signature space OK
            → Status: "Documents Ready"
            
  04:00 PM → Reviews entire registration
            → All checks pass
            → Submits to client via email
            → Status: "Awaiting Client Approval"

DAY 5 - Friday:
  10:00 AM → Client receives registration email
            → Reviews all details: ALL CORRECT
            → Prints, signs Annexure-13 and Agreement
            → Scans and returns to Coordinator
            
  02:00 PM → Coordinator receives signed documents
            → Uploads signatures to registration
            → Verifies: Signatures valid
            → Marks: "Approved by Client"
            
  03:00 PM → STATUS: ✓ ACTIVE CLIENT
            → Ready for audit scheduling
            → Ready for auditor assignment
            → Ready for certification process

Result: From enquiry to active client in 5 days!
```

## Scenario 2: Issue During Application Review

```
Timeline: Day 1-8 (with hold and correction)

DAY 1-3: Same as Scenario 1 (Enquiry → Application Received)

DAY 4 - Thursday:
  10:00 AM → Coordinator reviews application
            ✓ All fields filled
            ⚠️ Agreement is signed but signature looks unclear
            ✓ No inconsistencies in data
            ⚠️ AI scan: 92% complete, flagged unclear signature
            
            Decision: HOLD (Request clarification)
            → Status: "Hold"
            → Coordinator notes: "Signature on agreement is unclear"

  11:00 AM → Coordinator sends email to client:
            "Please provide clearer scans of signed agreement"
            
  (Client receives on Day 4 afternoon)

DAY 5 - Friday:
  10:00 AM → Client replies with better quality scan of agreement
            → Coordinator uploads new document
            → Status: "Received" (re-submitted)

DAY 6 - Monday:
  09:00 AM → Coordinator re-reviews application
            ✓ Signature now clear
            ✓ All documents valid
            ✓ No issues
            → Decision: APPROVE
            → Status: "Approved"

DAY 6-7: Client Registration proceeds normally
         (Same as Scenario 1, Steps 3-5)

Result: Additional 3 days due to document quality issue
        Total time: 8 days (vs 5 days ideal)
```

## Scenario 3: Rejection & Follow-up

```
Timeline: Day 1-10+ (with rejection and new opportunity)

DAY 1-3: Enquiry → Application sent & received

DAY 4:
  10:00 AM → Coordinator reviews application
            ✗ Signature missing on agreement
            ✗ Missing PAN number in application
            ✗ Contact email doesn't respond to verification
            ✗ AI scan: 75% complete, multiple major issues
            
            Decision: REJECT
            → Status: "Rejected"
            → Reason: "Missing critical information"

  11:00 AM → Coordinator sends email to client:
            "Your application cannot be approved due to:
            1. Missing authorized signature on agreement
            2. PAN number not provided
            3. Email address not verified
            
            To reapply:
            1. Provide proper signatures
            2. Include valid PAN
            3. Verify your contact email
            4. Resubmit within 30 days"

DAY 5-9: Client goes silent (doesn't respond)

DAY 10:
  Client suddenly responds with corrected documents:
  → New application form with all signatures
  → PAN number provided and verified
  → Email verified
  
  Coordinator treats as NEW APPLICATION
  → Status: "Submitted" (restart from Step 3)
  → Sends acknowledgment email

DAY 12-14: 
  Normal review process for new application
  → Result: APPROVED
  
DAY 15-20:
  Client Registration process
  → Result: ACTIVE CLIENT

Note: Client lost 10+ days due to rejection
      But eventually became active customer
```

---

## Key Takeaways

### Application Workflow
1. **Enquiry Phase**: Prospect → Qualification → Qualified/Rejected
2. **Application Phase**: Send → Receive → Review → Approve/Hold/Reject
3. **Duration**: Typically 5-7 days if all smooth
4. **Decision Points**: 2 (Qualification, Review)
5. **Retry Points**: Hold status allows requests for more info

### Client Registration Workflow
1. **Creation**: Auto-generated client code (CMS-2024-XXXX)
2. **Details Collection**: All organization and contact information
3. **Validation**: Duplicate checking, format validation
4. **Document Upload**: Contracts and agreements
5. **Client Approval**: Submit to client for final signature
6. **Activation**: "ACTIVE CLIENT" status
7. **Duration**: Typically 5-10 days from approved application

### Success Factors
- ✓ Complete and accurate information from start
- ✓ Quick client response to requests
- ✓ Proper document signatures
- ✓ Clear communication
- ✓ Prompt coordinator follow-up

### Common Delays
- ✗ Missing information requiring follow-up
- ✗ Duplicate records in system
- ✗ Invalid document formats/signatures
- ✗ Client slow to respond
- ✗ Data validation failures

