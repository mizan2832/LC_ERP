# Standard Cost Setup Software Requirements Specification

Document ID: LCERP-SRS-SC-001
Version: 1.0
Date: 1 November 2026
Audience: Product owner, software developers, testers and internal auditors
Scope: Standard Cost Setup, individual entry, version management, bulk Excel entry and downstream standard snapshots

## 1 Purpose and implementation status

This specification defines how to build the Standard Cost Setup module. It establishes item costing in BDT per KG, LTR or PCS, calculates the corresponding pack cost, preserves historical versions and supplies a reproducible baseline to LC transactions.

Requirements marked **Baseline** describe the reviewed application behavior. Requirements marked **New audit requirement** or **Production requirement** specify additions for an auditable multi-user ERP. These additions are requirements for development; they are not a claim that the current browser application already implements them.

The reviewed application stores standards in browser localStorage under `lc-standards-v1`. It does not provide the server authentication, central database, immutable audit history or production authorization described below. Standard setup itself shall not create accounts payable, debit/credit entries or a GL posting. Accounting originates from the relevant transaction modules.

### 1.1 Governing decisions

| ID | Requirement | Classification |
|---|---|---|
| SC-001 | Individual entry and optional bulk Excel entry shall both remain available. | Baseline |
| SC-002 | All standard inputs shall use the selected item's stock unit: one KG, one LTR or one PCS. | Baseline |
| SC-003 | Pack cost shall multiply the complete stock-unit landed cost by the pack conversion factor exactly once. | Baseline |
| SC-004 | LC cash margin shall remain available for financing comparison but shall never increase standard landed cost. | Baseline |
| SC-005 | LC uses PI value; LC+TT uses PI plus TT; TT uses TT only. | Baseline |
| SC-006 | TT party shall be maintained in TT Opening, not Standard Cost Setup or its Excel template. | Baseline |
| SC-007 | Selecting an item shall load metadata and a blank costing form. Only an explicit previous-version selection shall load saved costs. | Baseline |
| SC-008 | A version referenced by an LC shall be protected from editing and cost deletion. Creating a copy shall remain possible. | Baseline |
| SC-009 | Every persisted change shall identify the authenticated actor, server timestamp, previous values and resulting values. | New audit requirement |

### 1.2 Terms

| Term | Meaning |
|---|---|
| Stock unit | KG for grease, LTR for liquid lubricants, PCS for vehicles and other piece items. |
| Order unit | The purchase unit, commonly PACK or PCS. |
| Conversion factor F | Stock units contained in one order unit. |
| Setup number | Unique record identifier, displayed as SC-000001. |
| Version | Per-item completed revision, displayed as STD-001. It is distinct from the setup number. |
| Effective date | Business date from which a completed standard may be selected for a transaction. |
| AV | Total assessable value entered in BDT per stock unit. |
| Snapshot | A complete frozen copy of the standard used by a transaction. |

## 2 Roles and access

The following role controls are production requirements. Enforce them at the API and UI; hiding a button is insufficient.

| Role | Allowed operations |
|---|---|
| Costing preparer | View standards; create and edit own/permitted drafts; copy standards; process Excel; complete standards if assigned completion permission. |
| Costing controller | All preparer operations; maintain authorized cost-head definitions; complete standards; authorize retirement and bulk undo where permitted. |
| Auditor | Read standards, versions, source snapshots and audit events; export audit reports; no monetary edits. |
| System administrator | Manage permissions and configuration; cannot bypass LC-reference locks or rewrite audit history. |
| Transaction user | View eligible completed standards through downstream modules; no standard modification without costing permissions. |

Separate permissions shall exist for draft editing, completion, bulk saving, bulk undo, head creation, audit viewing and audit export. A maker-checker approval stage is optional future scope and shall not be silently introduced into the present Draft/Completed workflow.

## 3 Screen layout and field dictionary

The page shall contain the action bar, setup status, Product selection, Previous setups, Valuation and exchange rates, cost groups, live preview and a new read-only Audit information panel. Maintain three input columns per desktop valuation row; stack them responsively on small screens.

### 3.1 Actions

| Action | Required behavior |
|---|---|
| New setup | Clear selected item and costing context; start unsaved; show zero preview until a valid item is selected. |
| Save draft | Create or update the item's editable draft without generating a new version on repeated clicks. |
| Save or Update Standard Cost | Validate and complete a draft, or create a new completed revision from an unlocked completed record. Never overwrite a prior completed revision. |
| Load previous setup | Searchable dropdown of versions of the selected item only; show setup number, version, status and effective date. |
| Copy selected setup | Copy into an unsaved new record; preserve source reference; source remains unchanged. |
| Copy standard cost from another item | Search and choose a source item/version; retain destination identity and conversion; copy monetary configuration for review. |
| Bulk Excel Standard Cost | Open item selection, download, upload, validation and preview workflow. |
| Add Row | Add a cost head within the selected cost group. |
| Delete row | Remove the head from the working costing; recalculate; retain deletion evidence upon save. |

Export JSON and the former Saved Emax standards panel shall not appear. Unsaved edits should trigger a discard warning before changing item, loading a version or leaving the page (**Production requirement**).

### 3.2 Product and version fields

| Field | Type and source | Rules |
|---|---|---|
| Brand | Searchable master dropdown | Required for item filtering. Use active brand master, including Goodyear, Vmoto, Eicher, Mahindra and Dongfeng. |
| Category | Dependent searchable dropdown | Filter by brand; required before item selection. |
| Item name and item code | Searchable item master dropdown | Required; display description and code. No manual duplicate identity entry. |
| HS code | Read-only from item master | Preserve in snapshot; missing mapping shall produce a warning. |
| Costing unit | Read-only normalized KG/LTR/PCS | Derived from item master. Do not infer from the typed price. |
| Pack conversion factor | Read-only master value | Positive; use 1 for PCS. Preserve its exact decimal value. |
| Effective date | Editable date | Required on completion; separate from creation timestamp. |
| Setup number | Generated read-only | Assigned on first persistence; unique and never reused. |
| Version number | Generated read-only | Independent sequence per item; repeated draft saves do not increment. |
| Status | Read-only | New, Draft, Completed; show LC-linked lock separately. |
| Load previous setup | Searchable version selector | No automatic selection or loading when the item changes. |

### 3.3 Valuation fields

| Field | Format | Rules |
|---|---|---|
| LC type | LC, LC+TT, TT | Required. Saved with version. |
| PI FOB value per stock unit | Decimal FC | Non-negative; used for LC and LC+TT; excluded from purchase component for TT. |
| Currency | Currency master dropdown | Current supported values include USD and CNY. Labels shall follow selected currency, rather than always saying USD. |
| Bank exchange rate | Decimal BDT per FC | Positive. Current item reset defaults to 124; editable. Do not treat a default as a live market rate. |
| TT value per stock unit | Decimal FC | Positive when LC+TT or TT applies; excluded from purchase component for LC. |
| TT exchange rate | Decimal BDT per FC | Positive when TT applies; default 124, editable. |
| PI FOB BDT | Read-only calculated | PI FOB FC multiplied by bank exchange rate. |
| Purchase value BDT | Read-only calculated | Apply LC-type rules in section 5. |

TT party is absent. TT inputs may be disabled when LC is selected; changing type shall immediately recalculate without retaining a hidden contribution. For TT, LC margin shall be disabled, excluded and zero in the calculation.

### 3.4 Cost-row fields

| Field | Rules |
|---|---|
| Cost code | Stable unique head ID; read-only. Never use display name as the database relationship. |
| Cost head | Searchable dropdown within group; prevent duplicate active use of the same head. |
| Method | Fixed BDT or Percentage where supported; customs processing is always Fixed BDT. |
| Standard input | Non-negative decimal in displayed method; percentage shall show its basis. |
| Calculated BDT | Read-only per stock unit. |
| Include | Controls contribution; excluded row contributes zero. Margin inclusion means financing tracking only. |
| Delete | Available on editable records only. Required default rows remain visible with zero/excluded state. |
| Margin bank | Bank master dropdown associated with LC Margin; required if positive margin is tracked. |
| Margin basis | Individual entry supports Margin percent of FOB or Fixed BDT per stock unit. Bulk supports percentage only. |

## 4 Cost-head catalogue and defaults

Codes below reflect existing stable identifiers. Custom heads require a generated stable code, group, display name, supported method, basis, active status and audit metadata. Names shall be unique within a group after trimming and case normalization.

| Group | Codes and heads | Initial visibility |
|---|---|---|
| LC opening expenses | bank-0 Commission; bank-1 SWIFT charge; bank-2 Stamp charge; bank-3 Other bank charges; bank-4 Bank tax; bank-5 Bank VAT; bank-6 Stationery bill; bank-7 Additional charges; bank-8 Amendment cost; bank-9 LC Margin; insurance-0 Insurance premium cost | Add as required. Insurance appears in this group. |
| Government duties and taxes | duty-0 CD; duty-1 RD; duty-2 SD; duty-3 VAT; duty-4 AIT; duty-5 AT | All six always visible and selectable; zero/excluded permitted. No penalty here. |
| Customs processing expenses | global-0 Document processing fee; global-1 VAT on C&F commission; global-2 Income tax on C&F commission; global-3 Container scanning fee; global-4 Penalty fee | First three visible by default; scanning and penalty added through Add Row. All methods fixed BDT. |
| Port, C & F Expenses | port-0 Port charge and survey bill; port-1 Terminal handling; port-2 Scanning; port-3 Container handling; port-4 Lift on/off; port-5 Storage; port-6 Shipping line; port-7 Delivery order; port-8 Documentation; port-9 Refundable container deposit; port-10 Detention; port-11 Survey; port-12 Lab/testing; port-13 NOC/permit; port-14 Other clearance | Combined visible group; preserve port IDs. Add as required. |
| Port, C & F Expenses continued | cf-0 Customs handling; cf-1 Port charge; cf-2 C&F commission; cf-3 Port handling; cf-4 On-chassis permission; cf-5 Unstuffing; cf-6 Special delivery permission; cf-7 Delivery labour; cf-8 Documents correction; cf-9 Auction lock removal; cf-10 Red cancellation; cf-11 BL verification; cf-12 Examination/IRM; cf-13 Association; cf-14 Delay receipt interest; cf-15 Others; cf-freight Freight cost | Preserve cf IDs despite combined screen group. |
| Transport, testing and retirement | local-0 Carrying; local-1 Additional freight BDT; local-2 BSTI testing; local-3 BSTI sticker; local-4 Other charges; local-5 LC retirement/interest; local-6 Other retirement cost | Add as required. |

Assembly cost is excluded from this standard editor's calculation. The catalogue lists what the prototype supports; accounting classification is a separate production concern. Refundable deposits, recoverable taxes, penalties and financing interest shall carry an explicit policy classification for future accounting integration rather than being assumed capitalizable because they appear in a cost list. Changes to capitalization policy require a separately approved calculation version and shall not silently change existing standards.

## 5 Calculation specification

### 5.1 Units and purchase component

Let P be PI FOB per stock unit in FC; R be bank BDT/FC; T be TT per stock unit in FC; RT be TT BDT/FC; F be stock units per order unit; Q be order quantity.

| Result | Formula |
|---|---|
| PI component | P × R |
| TT component | T × RT |
| Purchase for LC | P × R |
| Purchase for LC+TT | P × R + T × RT |
| Purchase for TT | T × RT; PI contributes zero |
| Fixed cost head | Entered BDT per stock unit |
| Ordinary percentage expense | Purchase component × entered percent ÷ 100, where individual method supports percentage |
| Percentage LC margin | P × R × margin percent ÷ 100 |
| Fixed LC margin | Entered BDT per stock unit |
| Landed cost per stock unit L | Purchase component + sum of included non-margin cost heads |
| Landed cost per pack/piece | L × F; for PCS F = 1 |
| Total standard for ordered quantity | L × F × Q |
| Total margin for ordered quantity | Margin per stock unit × F × Q, reported separately |

Margin must never be added to L. AV is a calculation basis, not an additional cost head; never add AV itself to L. Bank and TT exchange rates apply only to their corresponding foreign components. Fixed BDT heads shall not be multiplied by FOB value or exchange rate.

### 5.2 Government duties

The user enters complete AV in BDT per stock unit. No freight, insurance, landing charge, PSI amount or currency conversion shall be automatically added to AV on this page.

| Head | Individual entry default percentage basis | Bulk Excel v2 percentage basis |
|---|---|---|
| CD | AV | AV |
| RD | AV | AV |
| SD | AV + calculated CD + calculated RD | AV |
| VAT | AV + CD + RD + SD | AV |
| AIT | AV | AV |
| AT | AV + CD + RD + SD | AV |

Amount equals basis × percent ÷ 100; a fixed-method duty uses its entered BDT value. Evaluate in CD, RD, SD, VAT, AIT, AT order. Excluded duties contribute zero to dependent bases.

**Important implementation distinction:** bulk v2 intentionally uses direct AV for all government percentages. Imported duty lines shall persist `percentageBase = assessable`. Individual default lines shall persist the compound basis explicitly in the production model. Loading, copying or downstream capture must preserve the line's actual basis; never silently convert an imported basis into the individual default. Display the basis beside every percentage field. These formulas implement the configured software costing model and are not a statutory tariff determination.

### 5.3 Precision and reconciliation

**Production requirement:** use decimal arithmetic, not binary floating point. Store monetary inputs with at least six decimal places, rates and percentages with at least eight, and calculated results with at least six. Display BDT to two decimals using half-up rounding. Sum unrounded line results and round the displayed total once. Pack and quantity totals shall derive from unrounded per-unit totals. Record calculation engine version and rounding policy in each snapshot. Any migration from existing rounding behavior requires before/after reconciliation.

### 5.4 Worked examples and acceptance values

| Example | Calculation and expected result |
|---|---|
| Grease conversion | 0.5 KG × 24 = 12 KG per PACK; 25 PACK = 300 KG. |
| Liquid conversion | 4 L × 4 = 16 LTR per PACK; 10 PACK = 160 LTR. |
| Purchase LC+TT | PI 3.35 × 124 = 415.40; TT 0.32 × 125 = 40.00; purchase = 455.40 per KG. |
| Complete bulk grease case | Purchase 455.40; opening expenses 5.11; duties on AV 500 at 15%, 5%, 10%, 15%, 5%, 7.5% = 287.50; processing 13; freight 5; transport 4. Landed = 770.01/KG; 12 KG pack = 9,240.12. Margin 10% = 41.54 separately. |
| Individual compound case | AV 100; CD 15% = 15; RD 5% = 5; SD 10% of 120 = 12; VAT 15% of 132 = 19.80. Bulk SD for the same AV/rate = 10. |
| TT only | PI 999 is ignored; TT 500 × 124 + fixed commission 5 = 62,005/PCS. Margin = 0. |
| No selected item | Entering PI 5 shall keep every calculation and preview at zero. No stale pack factor may be used. |

## 6 Individual workflow and validation

1. Open page in New state with no selected item and zero preview.
2. Select Brand, Category and Item. Load master identity, HS code, unit and conversion only; initialize blank monetary values.
3. Enter effective date, type, currency, purchase inputs, AV and cost heads.
4. Recalculate the preview on each relevant change; show stock-unit breakdown, pack total, stock-unit total and separately tracked margin.
5. Save draft or complete. On failure retain user input and identify the invalid field.
6. To use an existing version, explicitly choose it from Load previous setup. To create from another item, choose the source, review units and save a new destination version.

| Validation | Required response |
|---|---|
| Item missing, inactive or inconsistent with brand/category | Block save; focus item. |
| Invalid conversion, unsupported unit, zero/negative/non-finite exchange rate | Block completion. Do not calculate using guessed values. |
| Negative or non-finite input | Reject with field-specific message. |
| TT/LC+TT without positive TT value and TT rate | Block save; identify missing TT input. |
| TT with positive margin | Disable entry and reject manipulated requests. |
| Positive margin without bank | Block completion. |
| Margin percentage outside 0 to 100 | Reject. Fixed margin follows non-negative amount rule. |
| Customs processing percentage method | Reject; method must be fixed. |
| Duplicate cost head in one group | Prevent selection and reject API payload. |
| Percentage duty with zero AV | Warn that amount is zero; do not invent an AV or substitute PI value. |
| Referenced version edited or row deleted | Block; identify linked LC reference; offer Copy selected setup. |

LC and LC+TT do not currently require a positive margin on every item. This reflects the reviewed final implementation and supersedes the earlier request to make margin mandatory. A positive tracked margin still requires a bank. Any future mandatory-margin policy must be a controlled configuration change.

Drafts may be incomplete, but shall always have a valid item and syntactically valid finite inputs. TT-type rules apply to draft saving as in the current workflow. Production API validation shall enforce minimum draft integrity independently of completion validation.

## 7 Versions and transaction protection

| Event | Required result |
|---|---|
| First draft save | Assign SC number and proposed STD revision. |
| Repeated draft save | Update same draft ID, SC number and STD revision; update audit timestamp. |
| Complete current draft | Retain draft SC number, assign next completed item revision and preserve draft history. |
| Save unlocked completed setup again | Create a new SC record and next completed item revision; preserve source. |
| Same-item or other-item copy | Create unsaved copy with source setup ID; destination receives its own revision on save. |
| Ten-item bulk completion | Create ten records, one per item, each with that item's next revision. |
| Linked LC exists | Block direct edit, overwrite, deletion and bulk undo of that referenced version. |

Setup numbers are global within the company; STD revisions are per item across LC types in the current system. Do not change this to a separate type sequence without migration. Draft revision labels are provisional and shall be finalized under a database lock when completed. IDs and sequence values shall be generated transactionally; concurrent users cannot allocate the same number.

The baseline reference lock checks LC standard snapshots and LC opening expense snapshots, including historical LC references. A cancelled LC must not erase its historical reference. If references cannot be verified, fail closed and notify the user.

Completed versions are immutable historical records. An unlocked completed record may be used as an editing source, but saving produces a new record. There is no requirement for destructive deletion of completed standards. Retirement, if added, is a controlled soft status with reason and audit record; historical snapshots remain readable.

## 8 Downstream selection and snapshots

The Standard Cost Setup API shall expose completed eligible versions to LC and other costing modules. Drafts shall never be selected as a transaction's authoritative baseline.

**Production selection contract:** filter company, item, completed status, effective date on or before transaction date and matching LC type. Select greatest effective date, then greatest completed revision, then deterministic setup ID. If none matches, return a clear missing-standard error; a preview fallback shall be explicitly labelled and shall not authorize final saving. This contract must be verified against each downstream module during implementation rather than assuming all existing modules already apply it.

At final transaction save, copy item identity, unit, factor, purchase inputs, type, rates, every head and basis, include flags, margin bank/basis, calculated amounts, setup/revision references, effective date and engine version into the transaction snapshot. Later standard changes shall not alter saved transactions. LC's actual exchange rate shall not replace the saved standard exchange rate. Current actual LC, manifest or TT payment data shall not silently change the standard master.

## 9 Bulk Excel workflow

### 9.1 Selection and template

Require Brand and Category filters before listing products. Provide search and checkbox selection; retain selections across filter changes. Allow up to 100 mixed KG/LTR/PCS items per workbook. Display selected count and effective date. Download one XLSX with cost code and cost head at the left, followed by one two-column pair per selected item.

| Template element | Required content |
|---|---|
| Item header | Item code, item name, stock unit and pack factor. |
| Pair columns | Value/rate percent; BDT per stock unit. |
| Valuation | LC type, effective date, currency, PI FC, bank rate, TT FC, TT rate. |
| LC margin | Bank immediately beside/above margin context; percentage input and calculated BDT. |
| Government | Total AV BDT followed by all duty percentage inputs. |
| Other groups | Fixed BDT inputs for every available active head, including custom heads. |
| Totals | Group totals; landed cost per stock unit and per pack, margin excluded. |
| Reference sheet | Permitted margin bank names and concise instructions; no TT party. |

Use plain light headers, clear input cells, frozen identifying columns/rows and no worksheet protection. Preserve stable codes and a template schema marker. Current schema is LC_STANDARD_BULK_V2. Spreadsheet formula results are a convenience only; ERP shall recalculate from input values.

### 9.2 Processing and save

Upload shall accept XLSX up to 10 MB. Enforce limits of 100 items, 1,000 ZIP entries, 25 MB expanded data, 202 columns and 5,000 rows. Reject unknown template versions, malformed archives and files exceeding limits. Do not execute spreadsheet macros, external links or formulas supplied in input cells.

Validate all items before allowing Save all. Return item code, worksheet cell, cost code and reason for each error. Reject unknown/inactive/duplicate item codes, unknown/missing/duplicate cost rows, mismatched units or factors, invalid date/currency, invalid bank, wrong input column, percentage in a fixed amount cell, formulas/errors in input cells, negative values, non-finite values and values above 1,000,000,000,000. Accept `15` and `15%` as fifteen percent in percentage cells. Fixed BDT and AV belong in the BDT column.

Preview per-item unit cost, pack cost, group/head breakdown and proposed new version. Processing alone shall create no standard records. If standards changed since preview, require reprocessing. Save the entire batch in one database transaction, or save none. Existing drafts, completed versions and transaction snapshots shall remain unchanged.

Undo shall apply only to the last eligible bulk save, with no later standard changes and no LC reference to any imported version. Production undo shall be a compensating audited operation that marks batch records withdrawn, not deletion of audit events. Record actor, reason and affected setups. Current prototype restores its pre-import browser storage backup; production must retain the evidence.

## 10 Audit fields and audit interface

These are **new audit requirements**. Add a read-only Audit information section to the standard page. The user shall never type Created by, Updated by or system timestamps. Resolve actors from the authenticated login profile and timestamps from the server.

### 10.1 Record metadata

| Field | Data type and origin | Rule |
|---|---|---|
| Record ID | UUID, server | Immutable primary key. |
| Company ID | UUID, authenticated context | Required; enforce company isolation. |
| Created by ID | User ID, server session | Immutable; references user master. |
| Created by name | Name snapshot | Preserve historical display if user name later changes. |
| Created at | UTC timestamp with timezone | Immutable; display local date and time in Asia/Dhaka. |
| Updated by ID/name | Server session and name snapshot | Set on every persisted change. |
| Updated at | UTC timestamp with timezone | Display date and time separately if helpful; derive both from one timestamp. |
| Completed by ID/name | Server session | Set on completion. |
| Completed at | UTC timestamp | Distinct from effective date and created date. |
| Effective date | Business date, user input | Required for completed record; backdating does not modify system timestamps. |
| Change reason | User text, maximum 1,000 characters | Required for new revision from an existing standard, head removal, retirement, bulk undo and controlled correction. |
| Source method | Individual / Same-item copy / Other-item copy / Bulk / Migration | Server-validated enumeration. |
| Copied from setup ID | Foreign key | Required for copies; retain source version and source item. |
| Supersedes setup ID | Foreign key | Links preceding completed revision of destination item. |
| Bulk batch ID | Foreign key | Required for imported records. |
| Calculation engine version | String | Required; identifies exact formula implementation. |
| Catalogue and item master revision | IDs/version strings | Preserve the definitions used to calculate. |
| Row version | Monotonic integer | Optimistic concurrency token. |
| Linked transaction count | Calculated read-only | Show lock and link to references; do not accept client value. |
| Retired by/at/reason | User reference, UTC time, text | Only if retirement is implemented; never substitute for audit history. |

The display shall show user code and name, date, time and timezone, for example `USR-001 · Rahim Ahmed`, `01 Nov 2026`, `14:35:22 Asia/Dhaka`. Do not use demo identity as production audit evidence. If a legacy actor is unknown, display Unknown legacy user; never attribute old work to the current user.

### 10.2 Append-only event history

Maintain an immutable AuditEvent table with event ID, company ID, setup ID, event type, success/denied outcome, actor ID and name snapshot, server UTC time, request/correlation ID, source method, reason, old/new row version, changed field paths, before values, after values and linked batch/source references. Capture relevant session ID and client address where deployment policy permits; never store passwords, tokens or full authorization headers.

Events shall cover CREATE_DRAFT, UPDATE_DRAFT, COMPLETE, CREATE_REVISION, COPY, ADD_HEAD, REMOVE_HEAD, CHANGE_METHOD, CHANGE_BASIS, CHANGE_INCLUDE, CHANGE_VALUATION, BULK_PROCESS, BULK_COMPLETE, BULK_UNDO, RETIRE, EXPORT_AUDIT and denied edit/delete attempts against linked versions. A draft's multiple saves shall each remain visible in history despite the unchanged business version number.

Persist successful business updates and their audit events in the same database transaction. If audit persistence fails, do not report save success. Record denied operations separately without changing the standard. Audit changes at line level shall include cost code, old/new method, basis, value, inclusion and calculated amount. Store parent/child additions and removals, not merely a message saying Updated.

### 10.3 Audit history view

Add View audit history with filters for date range, actor, item, setup number, version, action, source and outcome. Show newest event first. Selecting an event opens a before/after table with changed fields highlighted. Provide reference navigation to source copy, bulk batch and linked LCs. Authorized auditors may export filtered history with filters, generated by/at and report identifier printed in the export.

Retention shall be configured to the organization's approved retention policy. No ordinary user or administrator UI shall delete audit events. Backups, restore testing, restricted database access and tamper detection shall support the history. Hashing may supplement access controls but shall not be represented as proof of immutability by itself.

## 11 Logical data model

| Entity | Key fields and relationships |
|---|---|
| StandardSetup | ID, company, item ID, setup number, item revision, status, effective date, LC type, currency, PI, bank FX, TT, TT FX, AV, unit/factor snapshots, calculated totals, source/supersedes IDs, audit metadata and row version. |
| StandardCostLine | ID, setup ID, head ID, head name/group snapshot, method, explicit basis code, value, include flag, calculated BDT, margin bank/mode, display order. |
| CostHead | ID/code, group, name, supported methods, default basis, active/retired status, classification and audit metadata. |
| BulkImportBatch | ID, company, original file name, file SHA-256, template version, uploader, upload/process/save timestamps, selected item codes, validation summary, outcome and undo references. Store the file in controlled storage if retention policy requires it. |
| AuditEvent | Fields in section 10; append-only. |
| TransactionStandardReference | Transaction type/ID, setup ID, snapshot hash, capture timestamp; supports locks and traceability. |

Database constraints shall enforce unique company/setup number, unique company/item/completed revision and unique setup/head. Keep item and cost-head foreign keys even if masters are later retired. Do not physically cascade-delete historical standard or audit data. Suggested monetary precision: DECIMAL(24,8), with documented range limits checked before calculation.

## 12 Service contracts and concurrency

Suggested endpoints are implementation contracts, not existing APIs:

| Endpoint | Purpose |
|---|---|
| GET /standard-costs/items | Filter active items by brand/category/query. |
| GET /standard-costs?itemId= | List permitted item versions. |
| GET /standard-costs/{id} | Load complete version with lock/reference state. |
| POST /standard-costs/calculate | Validate and calculate unsaved input using server engine. |
| POST /standard-costs/drafts | Create draft with idempotency key. |
| PATCH /standard-costs/{id}/draft | Update draft with expected row version. |
| POST /standard-costs/{id}/complete | Complete draft atomically. |
| POST /standard-costs/{id}/copy | Start source-linked copy for destination item. |
| POST /standard-costs/revisions | Create next completed revision without overwriting source. |
| POST /standard-costs/bulk/template | Generate selected-item workbook. |
| POST /standard-costs/bulk/process | Validate workbook and return expiring preview token. |
| POST /standard-costs/bulk/complete | Commit exact validated batch once using preview token and idempotency key. |
| POST /standard-costs/bulk/{id}/undo | Guarded, reason-required audited undo. |
| GET /standard-costs/{id}/audit | Paginated authorized event history. |

Never trust client calculated totals, actor identity, reference counts or role claims. Recalculate on server and check locks immediately before committing. Return structured errors with code, field/cell path and message. Use 409 for stale revision or linked-version conflicts; 422 for validation errors; 403 for permission failure. Repeated completion requests with the same idempotency key shall return the same result, preventing accidental duplicate versions. A deliberate new Save action with a new key may create a new revision.

## 13 Migration and operational requirements

Preserve source browser export/import evidence during migration to a database. Do not rewrite previous transaction snapshots. Retain legacy raw fields and original values alongside normalized values, migration batch ID, timestamp, engine version and reconciliation report.

Existing compatibility behavior converts old freight FC to a BDT C&F head, derives missing AV from legacy inputs, moves government penalty to processing and converts old percentage processing amounts to equivalent fixed BDT. Apply such transformations through an explicit, repeat-safe migration with before/after totals. Never silently attribute migration to the original creator. Missing user/time evidence remains unknown.

Production requirements include transactional backups, restore tests, TLS, company-level access isolation, accessible keyboard operation, readable validation, decimal-safe calculations and server-side file size/decompression limits. Target ordinary item recalculation within 500 ms in the browser and 100-item validation within 10 seconds on the agreed test environment; measure against a documented dataset and infrastructure. Financial save integrity takes precedence over a timing target.

## 14 Acceptance test matrix

| Test ID | Scenario | Expected result |
|---|---|---|
| AT-01 | Enter PI before selecting item | Zero preview, save blocked. |
| AT-02 | Select item with old standards | Metadata only; no old monetary values loaded. |
| AT-03 | Explicitly load previous version | Correct item/version, costs, basis and metadata appear. |
| AT-04 | Calculate 4L × 4 pack | Factor 16; per-LTR total ×16 equals pack total. |
| AT-05 | Calculate 0.5KG ×24 grease | Factor 12; 25 packs =300KG; no duplicate conversion. |
| AT-06 | LC / LC+TT / TT switch | Purchase follows section 5; TT ignores PI. |
| AT-07 | Add 10% margin | Margin separately reported; landed total unchanged. |
| AT-08 | TT margin or positive margin without bank | Save rejected with clear reason. |
| AT-09 | Individual and bulk duty examples | Exact section 5 results; basis retained after reload and LC snapshot. |
| AT-10 | Processing head method | Fixed BDT only, including imported and normalized legacy rows. |
| AT-11 | Repeat Save draft three times | Same SC/revision; three persisted audit events. |
| AT-12 | Complete then deliberately save revision | New immutable completed revision; predecessor unchanged. |
| AT-13 | Copy between KG and PCS items | Destination identity/factor retained; source unchanged; costs require review. |
| AT-14 | Edit/delete LC-linked version | UI and API block; linked LC identified; denied audit event recorded. |
| AT-15 | Change LC actual exchange rate | Saved standard rate and standard BDT remain unchanged. |
| AT-16 | Bulk mixed selection/filter switch | Selections retained; template contains selected items only. |
| AT-17 | Ten valid items bulk saved | Ten new item versions in one atomic commit. |
| AT-18 | One invalid workbook cell | Item/cell reason displayed; entire batch save blocked. |
| AT-19 | Formula in input/ZIP expansion violation | File or cell rejected safely. |
| AT-20 | Save stale preview or stale row version | Conflict returned; no lost update. |
| AT-21 | Bulk undo after LC reference | Blocked; transaction/history preserved. |
| AT-22 | Audit user/time manipulation | Server ignores forged actor/time; correct login and server time stored. |
| AT-23 | Audit storage failure | Business update rolled back; no false success. |
| AT-24 | Double-click completion/retry request | One result for same idempotency key. |
| AT-25 | Change master after transaction save | Historical version/snapshot unchanged. |
| AT-26 | Auditor access | Can inspect/export history; cannot change monetary inputs. |
| AT-27 | Legacy migration | Counts and totals reconcile; unknown creators remain explicitly unknown. |

## 15 Developer handover and completion criteria

Deliver database migrations, authenticated APIs, page UI, shared calculation engine, bulk template/parser, role checks, audit history, reference locks, automated calculation/lifecycle tests and migration reconciliation. Document the supported currency master, cost catalogue and engine version.

The module is complete when all acceptance tests pass, the business owner verifies KG/LTR/PCS examples and both entry paths, and the audit reviewer can reproduce a completed version from its saved inputs and engine version. Audit fields shall be implemented as server-controlled records, not editable text boxes added only to the page.

### Implementation references reviewed

Current source references: app.js; setups.js; standard-cost-math.js; standard-versions.js; standard-valuation.js; standard-update.js; standard-initial-state.js; standard-cost-rows.js; standard-margin-rules.js; standard-lc-lock.js; bulk-standard-core.js; docs/bulk-standard-entry-review.md. These support the Baseline requirements. Production API, database, authorization, precision, selection contract and expanded audit requirements in this document are specified additions.
