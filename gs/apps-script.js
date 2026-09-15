const SPREADSHEET_ID = '1tmUvhVy490c2j6io2czia9cOenVZ-NkyncDEgudmuLA';

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').toLowerCase();

  if (action === 'messages') {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ensureSheet(spreadsheet, 'Messages');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift() || [];
    const rows = data
      .filter((row) => row.some((cell) => String(cell).trim() !== ''))
      .map((row) => headers.reduce((record, header, index) => {
        record[String(header).trim()] = row[index] === undefined ? '' : row[index];
        return record;
      }, {}));

    return jsonResponse({ ok: true, rows });
  }

  return HtmlService.createHtmlOutput('Client Unit Tracker Apps Script is running.');
}

function doPost(e) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const values = e && e.parameter ? e.parameter : {};
  const action = String(values.action || 'units').toLowerCase();

  if (action === 'deletebranch') {
    return deleteBranchRow(spreadsheet, values.branchName || values.name || '');
  }

  if (action === 'deleteaccount') {
    return deleteAccountRow(spreadsheet, values.username || values.userName || values.accountUsername || '');
  }

  if (action === 'updatebranch') {
    return updateBranchRow(spreadsheet, values);
  }

  if (action === 'updateaccountbranch') {
    return updateAccountBranchRow(spreadsheet, values);
  }

  if (action === 'updateaccount') {
    return updateAccountRow(spreadsheet, values);
  }

  if (action === 'markmessageread') {
    return markMessageRead(spreadsheet, values.messageId || '');
  }

  let sheetName = 'Units';
  if (action === 'accounts') {
    sheetName = 'Accounts';
  } else if (action === 'branches') {
    sheetName = 'Branches';
  } else if (action === 'messages') {
    sheetName = 'Messages';
  }

  const sheet = ensureSheet(spreadsheet, sheetName);
  const headers = getHeadersForAction(action);
  if (action === 'messages') {
    values.attachments = uploadMessageAttachments(values.attachments || '[]');
  }
  const row = buildRowForAction(action, values);

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some((cell) => String(cell).trim() === headers[0]);

  if (!hasHeader) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    action,
    sheetName,
    inserted: row
  })).setMimeType(ContentService.MimeType.JSON);
}

function markMessageRead(spreadsheet, messageId) {
  if (!messageId) {
    return jsonResponse({ ok: false, error: 'Missing message ID' });
  }

  const sheet = ensureSheet(spreadsheet, 'Messages');
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'message id');
  const readIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'read');

  if (idIndex === -1 || readIndex === -1) {
    return jsonResponse({ ok: false, error: 'Message columns not found' });
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][idIndex] || '').trim() === String(messageId).trim()) {
      sheet.getRange(rowIndex + 1, readIndex + 1).setValue('TRUE');
      return jsonResponse({ ok: true, action: 'markMessageRead', messageId });
    }
  }

  return jsonResponse({ ok: false, error: 'Message not found' });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function uploadMessageAttachments(rawAttachments) {
  let attachments;
  try {
    attachments = JSON.parse(rawAttachments || '[]');
  } catch (error) {
    throw new Error('Invalid attachment data');
  }

  if (!Array.isArray(attachments) || !attachments.length) return '[]';
  if (attachments.length > 10) throw new Error('Too many attachments');

  const folders = DriveApp.getFoldersByName('ClientUnitTracker Attachments');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('ClientUnitTracker Attachments');
  const saved = attachments.map((attachment) => {
    const bytes = Utilities.base64Decode(String(attachment.data || ''));
    const file = folder.createFile(Utilities.newBlob(bytes, attachment.type || 'application/octet-stream', attachment.name || 'attachment'));
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (error) {
      console.warn(`Unable to make attachment public: ${error}`);
    }
    return { name: file.getName(), url: file.getUrl(), type: file.getMimeType(), size: file.getSize() };
  });
  return JSON.stringify(saved);
}

function deleteBranchRow(spreadsheet, branchName) {
  if (!branchName) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing branch name' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName('Branches') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0] || [];
  const nameIndex = (headerRow || []).findIndex((header) => String(header).trim().toLowerCase().includes('branch name'));

  if (nameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Branch name column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][nameIndex] || '').trim() === String(branchName).trim()) {
      sheet.deleteRow(rowIndex + 1);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'deleteBranch', deletedName: branchName })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Branch not found' })).setMimeType(ContentService.MimeType.JSON);
}

function updateBranchRow(spreadsheet, values) {
  const sheet = spreadsheet.getSheetByName('Branches') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0] || [];
  const nameIndex = (headerRow || []).findIndex((header) => String(header).trim().toLowerCase().includes('branch name'));
  const targetName = String(values.originalBranchName || values.branchName || '').trim();

  if (nameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Branch name column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  const rowToWrite = buildRowForAction('branches', values);

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentName = String(data[rowIndex][nameIndex] || '').trim();
    if (currentName === targetName) {
      const targetRange = sheet.getRange(rowIndex + 1, 1, 1, rowToWrite.length);
      targetRange.setValues([rowToWrite]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateBranch', updatedName: targetName })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Branch not found for update' })).setMimeType(ContentService.MimeType.JSON);
}

function updateAccountBranchRow(spreadsheet, values) {
  const sheet = spreadsheet.getSheetByName('Accounts') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0] || [];
  const branchIndex = (headerRow || []).findIndex((header) => String(header).trim().toLowerCase().includes('branch'));
  const fullNameIndex = (headerRow || []).findIndex((header) => String(header).trim().toLowerCase().includes('full name'));
  const targetName = String(values.fullName || values.name || values.username || '').trim();

  if (branchIndex === -1 || fullNameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Accounts branch fields not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  const targetBranch = String(values.branch || values.branchName || values.accountBranch || '').trim();
  if (!targetName || !targetBranch) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing account name or branch' })).setMimeType(ContentService.MimeType.JSON);
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentName = String(data[rowIndex][fullNameIndex] || '').trim();
    if (currentName === targetName) {
      sheet.getRange(rowIndex + 1, branchIndex + 1).setValue(targetBranch);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateAccountBranch', fullName: targetName, branch: targetBranch })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Account not found for branch update' })).setMimeType(ContentService.MimeType.JSON);
}

function deleteAccountRow(spreadsheet, username) {
  if (!username) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing username' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName('Accounts') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  if (!data.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Accounts sheet is empty' })).setMimeType(ContentService.MimeType.JSON);
  }

  const headerRow = data[0] || [];
  const usernameIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase().includes('username'));

  if (usernameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Username column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][usernameIndex] || '').trim() === String(username).trim()) {
      sheet.deleteRow(rowIndex + 1);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'deleteAccount', deletedUsername: username })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Account not found' })).setMimeType(ContentService.MimeType.JSON);
}

function updateAccountRow(spreadsheet, values) {
  const sheet = spreadsheet.getSheetByName('Accounts') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  if (!data.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Accounts sheet is empty' })).setMimeType(ContentService.MimeType.JSON);
  }

  const headerRow = data[0] || [];
  const usernameIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase().includes('username'));
  const targetUsername = String(values.originalUsername || values.username || '').trim();

  if (usernameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Username column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  const rowToWrite = buildRowForAction('accounts', values);

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentUsername = String(data[rowIndex][usernameIndex] || '').trim();
    if (currentUsername === targetUsername || (targetUsername === '' && currentUsername === String(values.username || '').trim())) {
      const targetRange = sheet.getRange(rowIndex + 1, 1, 1, rowToWrite.length);
      targetRange.setValues([rowToWrite]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateAccount', updatedUsername: values.username || targetUsername })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Account not found for update' })).setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const normalizedSheetName = String(sheetName || '').trim().toLowerCase();
  const sheetAction = normalizedSheetName === 'accounts'
    ? 'accounts'
    : normalizedSheetName === 'branches'
      ? 'branches'
      : normalizedSheetName === 'messages'
        ? 'messages'
        : 'units';
  const desiredHeaders = getHeadersForAction(sheetAction);
  const headerRange = sheet.getRange(1, 1, 1, desiredHeaders.length);
  const firstRow = headerRange.getValues()[0];
  const isEmpty = firstRow.every((cell) => String(cell).trim() === '');

  if (isEmpty) {
    headerRange.setValues([desiredHeaders]);
  } else if (sheetAction === 'messages' && String(firstRow[0] || '').trim().toLowerCase() !== 'message id') {
    sheet.clearContents();
    headerRange.setValues([desiredHeaders]);
  } else if (sheetAction === 'messages') {
    if (!firstRow.some((cell) => String(cell).trim().toLowerCase() === 'thread id')) {
      sheet.getRange(1, desiredHeaders.indexOf('Thread ID') + 1).setValue('Thread ID');
    }
    if (!firstRow.some((cell) => String(cell).trim().toLowerCase() === 'attachments')) {
      sheet.getRange(1, desiredHeaders.indexOf('Attachments') + 1).setValue('Attachments');
    }
  }

  if (sheetAction === 'messages') {
    const messageData = sheet.getDataRange().getValues();
    for (let rowIndex = messageData.length - 1; rowIndex > 0; rowIndex -= 1) {
      const firstCell = String(messageData[rowIndex][0] || '').trim().toLowerCase();
      const secondCell = String(messageData[rowIndex][1] || '').trim().toLowerCase();
      if (firstCell === 'code' && secondCell === 'client name') {
        sheet.deleteRow(rowIndex + 1);
      }
    }
  }

  sheet.setFrozenRows(1);
  sheet.setTabColor(getTabColor(sheetName));

  return sheet;
}

function getHeadersForAction(action) {
  switch (String(action || 'units').toLowerCase()) {
    case 'accounts':
      return ['Username', 'Password', 'Account Type', 'Full Name', 'Email', 'Branch', 'Status', 'Created At'];
    case 'branches':
      return ['Branch Type', 'Location', 'Branch Name', 'Head Admin', 'Status'];
    case 'messages':
      return ['Message ID', 'Sender', 'Sender Name', 'Recipient', 'Recipient Name', 'Subject', 'Body', 'Sent At', 'Read', 'Thread ID', 'Attachments'];
    case 'units':
    default:
      return [
        'Code',
        'Client Name',
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
  }
}

function buildRowForAction(action, values) {
  switch (String(action || 'units').toLowerCase()) {
    case 'accounts':
      return [
        values.username || '',
        values.password || '',
        values.accountType || '',
        values.fullName || '',
        values.email || '',
        values.branch || values.accountBranch || values.branchName || values.branchLocation || '',
        values.status || 'Active',
        values.createdAt || new Date().toISOString()
      ];
    case 'branches':
      return [
        values.branchType || values.branchCode || '',
        values.location || '',
        values.branchName || '',
        values.manager || values.headAdmin || '',
        values.status || 'Active'
      ];
    case 'messages':
      return [
        values.messageId || '',
        values.sender || '',
        values.senderName || '',
        values.recipient || '',
        values.recipientName || '',
        values.subject || '',
        values.body || '',
        values.sentAt || new Date().toISOString(),
        values.read || 'FALSE',
        values.threadId || values.messageId || '',
        values.attachments || '[]'
      ];
    case 'units':
    default:
      return [
        values.unitCode || '',
        values.clientName || '',
        values.unitBrand || '',
        values.unitSpecs || '',
        values.unitPrice || '',
        values.status || '',
        values.branchLocation || '',
        values.currentLocation || values.branchLocation || '',
        values.dateReceived || values.datePurchase || '',
        values.dateReleased || values.dateReturn || values.returnDate || '',
        values.warranty || '',
        values.unitProblem || '',
        values.inclusion || '',
        values.uploadedBranch || values.branchLocation || ''
      ];
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
