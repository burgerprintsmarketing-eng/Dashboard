# Setup CRM V2 (simple flow)

## Goal
1. Main dashboard shows all customers.
2. Click customer name opens a separate customer dashboard.
3. Paste real data into Google Sheet and dashboard auto-updates.

## Files
- Script: `burgerprints_crm_sync_v2.gs`
- Main dashboard: `burgerprints-crm-lifecycle-dashboard.html`
- Customer dashboard: `burgerprints-crm-customer-dashboard.html`
- Raw template: `CRM_RAW_TEMPLATE.csv`

## Data flow
`CRM_RAW` -> `dashboard_data` -> Dashboard

## Step 1: Google Sheet tabs
Create tabs:
1. `CRM_RAW`
2. `dashboard_data`

Import `CRM_RAW_TEMPLATE.csv` into `CRM_RAW` so header is correct.

## Step 2: Install script
1. Open `Extensions -> Apps Script`.
2. Paste code from `burgerprints_crm_sync_v2.gs`.
3. Save.
4. Run once: `setupDashboardSheetCRM()`.
5. Run once: `syncRawSheetToDashboard()`.

## Step 3: Auto sync when paste data
Add trigger:
1. Function: `onEditSyncCRMRaw`
2. Event source: `From spreadsheet`
3. Event type: `On edit`

Now every paste into `CRM_RAW` auto-syncs to `dashboard_data`.

## Step 4A: (Old way) Publish CSV
1. `File -> Share -> Publish to web`
2. Select tab `dashboard_data`
3. Format `CSV`
4. Copy URL `...output=csv`

## Step 4B: (Recommended) Apps Script Web App (avoid Failed to fetch)
1. In Apps Script click `Deploy -> New deployment`
2. Type: `Web app`
3. Execute as: `Me`
4. Who has access: `Anyone`
5. Deploy and copy URL ending with `/exec`

Dashboard supports both URL types:
- `.../exec` (recommended)
- `...output=csv`

## Step 5: Open dashboard
1. Open `burgerprints-crm-lifecycle-dashboard.html`
2. Paste Data URL
3. Click `Tải dữ liệu`
4. Click customer name to open detail dashboard

## Optional: still use Google Form
Keep trigger:
- `onFormSubmitCRM` (On form submit)

Then you have 2 input channels:
1. Form submit -> `dashboard_data`
2. Paste raw rows in `CRM_RAW` -> `dashboard_data`
