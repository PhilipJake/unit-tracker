# Client Unit Tracker

A lightweight web app for tracking client units by branch using Google Sheets as the live database.

## Folder Structure

- `index.html` – main dashboard page
- `css/styles.css` – dashboard styles
- `js/app.js` – app logic and polling
- `js/data.js` – CSV parsing and live fetch logic
- `js/ui.js` – rendering summary and table UI
- `gs/config.js` – Google Sheets configuration

## How it works

This app reads data directly from a Google Sheet using the public CSV export URL.

- When the app loads, it fetches the spreadsheet data.
- It updates the dashboard automatically on a timed refresh.
- The table is populated from the Google Sheet, not static demo data.

## Required Google Sheet setup

1. Create a Google Sheet with a sheet name like `Units`.
2. Add the exact columns below as the header row:

   `Unit Code, Client Name, Unit Price, Specs, Uploaded Branch, Current Location, Date Received, Date Released, Status`

3. Put your data under those headers.
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

- The app polls the Google Sheet every 15 seconds by default.
- You can change the refresh interval in `gs/config.js`.
- The app expects the sheet to be exported as CSV and the first sheet/tab to be used by default.

## Messaging

The Messages page uses the Apps Script web app for both reads and writes. The deployed Apps Script entry file is `gs/code.gs`; redeploy the web app after updating that file. The script creates a `Messages` sheet automatically with these columns:

`Message ID, Sender, Sender Name, Recipient, Recipient Name, Subject, Body, Sent At, Read`

Users can send messages to other accounts, view inbox and sent messages, search message content, and mark inbox messages as read.

The login page's `Contact admin` form sends an in-app message to every active account whose role is `Super Admin` or `Administrator`. Redeploy the Apps Script web app after updating `gs/code.gs` for this form to work.

Attachments are uploaded by Apps Script to a Google Drive folder named `ClientUnitTracker Attachments`. The Messages sheet stores the attachment names and Drive links. The browser limits each send to 20 MB total attachment data, and the Apps Script deployment must be authorized to use Google Drive.

## Trash

Run `initializeClientUnitTrackerSheets()` in Apps Script to create the `Trash` sheet. Deleting a unit moves its original row to Trash with `Deleted At`, `Deleted By`, and `Expires At` metadata. The Trash page can restore or permanently delete units; expired rows are removed when Trash is loaded. Redeploy the Apps Script web app after updating `gs/code.gs`.

## Sample data

If you want the database to have live functionality, the sheet itself is the source of truth. There is no default demo dataset included in the app.
