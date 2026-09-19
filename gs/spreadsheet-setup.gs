function initializeClientUnitTrackerSheets() {
  const spreadsheetId = '1tmUvhVy490c2j6io2czia9cOenVZ-NkyncDEgudmuLA';
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  const unitsHeaders = [
    'Code',
    'Client Name',
    'Contact Info',
    'Unit Brand',
    'Unit Specs',
    'Unit Price',
    'Status',
    'Branch Location',
    'Current Location',
    'Date Received',
    'Return Date',
    'Warranty',
    'Unit Problem',
    'Inclusion',
    'Uploaded Branch'
  ];

  const accountsHeaders = [
    'Username',
    'Password',
    'Account Type',
    'Full Name',
    'Email',
    'Branch',
    'Status'
  ];

  const branchesHeaders = [
    'Branch Name',
    'Branch Code',
    'Location',
    'Manager',
    'Status'
  ];

  const unitsSheet = ensureSheet(spreadsheet, 'Units', unitsHeaders);
  const accountsSheet = ensureSheet(spreadsheet, 'Accounts', accountsHeaders);
  const branchesSheet = ensureSheet(spreadsheet, 'Branches', branchesHeaders);
  seedDemoAccounts(accountsSheet);
  seedDemoBranches(branchesSheet);

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    unitsSheet: unitsSheet.getName(),
    unitsGid: unitsSheet.getSheetId(),
    accountsSheet: accountsSheet.getName(),
    accountsGid: accountsSheet.getSheetId(),
    branchesSheet: branchesSheet.getName(),
    branchesGid: branchesSheet.getSheetId(),
    config: {
      sheetId: spreadsheet.getId(),
      gid: unitsSheet.getSheetId(),
      accountsGid: accountsSheet.getSheetId(),
      branchesGid: branchesSheet.getSheetId()
    }
  };
}

function createClientUnitTrackerSheets() {
  return initializeClientUnitTrackerSheets();
}

function ensureSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const firstRow = headerRange.getValues()[0];
  const isEmpty = firstRow.every((cell) => String(cell).trim() === '');

  if (isEmpty) {
    headerRange.setValues([headers]);
  }

  sheet.setFrozenRows(1);
  sheet.setTabColor(getTabColor(sheetName));

  return sheet;
}

function seedDemoAccounts(sheet) {
  const rows = [
    ['superadmin', 'admin123', 'Super Admin', 'Rogelio Santos', 'admin@unitflow.com', 'Main Office', 'Active'],
    ['mainheadadmin', 'admin123', 'Main Head Admin', 'Maria Cruz', 'head@unitflow.com', 'Main Office', 'Active'],
    ['branchheadadmin', 'branch123', 'Branch Head Admin', 'Aldrin Dela Cruz', 'bnbrosales@unitflow.com', 'BNB Rosales', 'Active'],
    ['office', 'office123', 'Office', 'Rina Soriano', 'office@unitflow.com', 'BNB Urdaneta', 'Active'],
    ['technician', 'tech123', 'Technician', 'Jhon Paul Rivera', 'tech@unitflow.com', 'BNB Tayo', 'Active']
  ];

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function seedDemoBranches(sheet) {
  const rows = [
    ['BNB Rosales', 'BNB', 'Rosales, Pangasinan', 'Rogelio Santos', 'Active'],
    ['BNB Urdaneta', 'BNB', 'Urdaneta, Pangasinan', 'Maria Cruz', 'Active'],
    ['BNB Tayo', 'BNB', 'Tayo, Pangasinan', 'Aldrin Dela Cruz', 'Active'],
    ['EZ Mall', 'EZ', 'San Carlos, Pangasinan', 'Jhon Paul Rivera', 'Active'],
    ['1LR Baguio', '1LR', 'Baguio City', 'Rina Soriano', 'Active']
  ];

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function getTabColor(sheetName) {
  switch (sheetName) {
    case 'Units':
      return '#1a73e8';
    case 'Accounts':
      return '#34a853';
    case 'Branches':
      return '#f7b500';
    default:
      return '#5f6368';
  }
}
