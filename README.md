# Client Unit Tracker

A lightweight web app for tracking client units by branch using Google Sheets as the live database.

## Folder Structure

- `index.html` – main dashboard page
- `css/styles.css` – dashboard styles
- `js/app.js` – app logic and polling
- `js/data.js` – CSV parsing and live fetch logic
- `js/ui.js` – rendering summary and table UI
- `pages/phone-dashboard.html` and `js/phone-dashboard.js` – phone overview for Apple Product branch accounts
- `pages/phones.html` and `js/apple-products.js` – Phones registry and entry form for Apple Product branches
- `gs/config.js` – Google Sheets configuration

## How it works

This app reads data directly from a Google Sheet using the public CSV export URL.

- When the app loads, it fetches the spreadsheet data.
- It updates the dashboard automatically on a timed refresh.
- The table is populated from the Google Sheet, not static demo data.

## Required Google Sheet setup

1. Create a Google Sheet with a sheet name like `Units`.
2. Add the exact columns below as the header row:

   `Code, Client Name, Contact Info, Unit Brand, Unit Specs, Unit Price, Status, Branch Location, Current Location, Date Purchased, Date of Return, Date Released, Released By, Date Sent to Warehouse, Date Left Warehouse, Warranty, Unit Problem, Inclusion, Uploaded Branch, Technician Notes, Urgent, Deleted At, Deleted By, Previous Status, Client Pays, Payment Amount`

3. Put your data under those headers.
   The Apps Script migrates existing unit sheets to this schema automatically. Client payment fields are updated when a unit status action is used and can also be edited on the unit form.
   Redeploy the Apps Script web app after updating `gs/code.gs`.
4. In the Google Sheet, make sure the sheet is shared publicly or available through the CSV export endpoint.
5. Copy the spreadsheet ID from the URL and paste it into `gs/config.js`.

Example Sheet URL:

`https://docs.google.com/spreadsheets/d/1ABC123XYZ/edit#gid=0`

Spreadsheet ID:

`1ABC123XYZ`

## Update config

Open `gs/config.js` and replace:

```js
sheetId: 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE'
```

with your real Google Sheet ID.

## Run locally

You can open `index.html` directly in the browser, or serve the folder with a local web server.

Example:

```bash
cd ClientUnitTracker
python -m http.server 8000
```

Then visit:

`http://localhost:8000`

## Notes

- The overview and unit registry automatically poll the Google Sheet every 15 seconds by default, so added or changed units appear without refreshing the page. Each CSV request uses a unique cache-busting query parameter, and the overview refreshes when you return to its tab. The interval can be changed in `gs/config.js`.
- The app expects the sheet to be exported as CSV and the first sheet/tab to be used by default.

## Messaging

The Messages page uses the Apps Script web app for both reads and writes. The deployed Apps Script entry file is `gs/code.gs`; redeploy the web app after updating that file. The script creates a `Messages` sheet automatically with these columns:

`Message ID, Sender, Sender Name, Recipient, Recipient Name, Subject, Body, Sent At, Read`

Users can send messages to other accounts, view inbox and sent messages, search message content, and mark inbox messages as read.

The login page's `Contact admin` form sends an in-app message to every active account whose role is `Super Admin` or `Administrator`. Redeploy the Apps Script web app after updating `gs/code.gs` for this form to work.

Attachments are uploaded by Apps Script to a Google Drive folder named `ClientUnitTracker Attachments`. The Messages sheet stores the attachment names and Drive links. The browser limits each send to 20 MB total attachment data, and the Apps Script deployment must be authorized to use Google Drive.

## Access control

Super Admins and Administrators can configure page and action permissions by role in Settings and create custom roles. New roles start with View and basic pages allowed, with all other permissions off; they can be assigned when creating accounts. The Laptop Dashboard and Phone Dashboard appear next to each other in navigation when enabled for the role; the Phones registry and Phone Dashboard have separate access options, and Apple Product branch eligibility is also required for phone pages. Account type options refresh from saved database roles. View is always allowed and locked; release, warehouse, pullout, replacement, and repair permissions control their matching unit views and workflows. Member overrides customize an individual account without changing role defaults. Super Admin access is locked. Saving settings creates or updates the `User Permissions` sheet automatically. Redeploy the Apps Script web app after changing `gs/code.gs`.

Super Admins and Administrators can enable Apple Products for a branch type using the checkbox in Settings → Branch Types. Every branch using an enabled shortcut can use the Phones registry. Accounts assigned to those branches land on a phone-specific dashboard with phone totals, release and warehouse counts, recent purchases, and branch totals; the Phones navigation opens the full registry. The registry stores records in `AppleProducts` with `Status` immediately after `Contact Info` and `Branch` after `IMEI`, so records remain associated with the selected branch. Run `initializeClientUnitTrackerSheets()` to create the sheet, or let the Apps Script create it when the registry is first opened. Redeploy the Apps Script web app after updating `gs/code.gs`.

Super Admins and Administrators can also enable Unit Registry per branch type in Settings → Branch Types. The Units navigation and submenu are hidden for branches whose type does not have Unit Registry enabled. Existing branch types are migrated with Unit Registry enabled to preserve current access; disable it for Apple Products-only types as needed. Redeploy the Apps Script web app after updating `gs/code.gs`.

Changing a shortcut in Settings → Branch Types automatically reassigns all branches using it, updates their names, and migrates matching references in Units, Trash, Accounts, and AppleProducts. You can also change an individual branch's type from the Branches page. Redeploy the Apps Script web app after updating `gs/code.gs`.

The Phones registry displays Apple Product records in responsive cards. Users with Create/Edit permissions can register phones or use a card's Edit action to update a record.

## Trash

Run `initializeClientUnitTrackerSheets()` in Apps Script to create or migrate the unit and `Trash` sheets. `Previous Status` preserves the status to restore when a unit returns from the warehouse or is recovered from Trash. Delete marks a unit as `Deleted`, records `Deleted By`, and keeps its row in `Units`. Trash lets users restore it to its previous status or archive it: Delete Permanently copies the complete row to the `Trash` sheet before removing it from `Units`. Archived rows remain recoverable. Releasing a unit records the user's name in `Released By`.

## Sample data

If you want the database to have live functionality, the sheet itself is the source of truth. There is no default demo dataset included in the app.
