const SPREADSHEET_ID = '1tmUvhVy490c2j6io2czia9cOenVZ-NkyncDEgudmuLA';

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').toLowerCase();

  if (action === 'permissions') {
    return readPermissionSettings(SpreadsheetApp.openById(SPREADSHEET_ID));
  }

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

  if (action === 'trash') {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    return readTrashRows(spreadsheet);
  }

  return HtmlService.createHtmlOutput('Client Unit Tracker Apps Script is running.');
}

function doPost(e) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const values = e && e.parameter ? e.parameter : {};
  const action = String(values.action || 'units').toLowerCase();

  if (action === 'savepermissions') {
    return savePermissionSettings(spreadsheet, values);
  }

  if (action === 'deleteunit') {
    return deleteUnitRow(spreadsheet, values.unitCode || values.code || '', values);
  }

  if (action === 'restoreunit') {
    return restoreUnitRow(spreadsheet, values.unitCode || values.code || '');
  }

  if (action === 'purgeunit') {
    return purgeUnitRow(spreadsheet, values.unitCode || values.code || '');
  }

  if (action === 'updateunit') {
    return updateUnitRow(spreadsheet, values);
  }

  if (action === 'deletebranch') {
    return deleteBranchRow(spreadsheet, values.branchName || values.name || '');
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
  if (action === 'accounts' && isAdministratorCreatingSuperAdmin(values)) {
    return jsonResponse({ ok: false, error: 'Administrator cannot create a Super Admin account' });
  }
  const headers = getHeadersForAction(action);
  if (action === 'units' && !isValidContactInfo(values.contactInfo || '')) {
    return jsonResponse({ ok: false, error: 'Contact Info must use +63 followed by 10 digits' });
  }
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

  if (action === 'accounts') {
    syncBranchManagerFromAccount(spreadsheet, values.fullName || '', values.branch || values.accountBranch || values.branchName || '', values.originalBranch || '');
  }

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    action,
    sheetName,
    inserted: row
  })).setMimeType(ContentService.MimeType.JSON);
}

function getPermissionHeaders() {
  return ['Role', 'View', 'Create', 'Edit', 'Delete', 'Export', 'Overview', 'Messages', 'Unit registry', 'Trash', 'Branches', 'Accounts'];
}

function getDefaultPermissionRows() {
  return [
    ['Super Admin', true, true, true, true, true, true, true, true, true, true, true],
    ['Administrator', true, true, true, true, true, true, true, true, true, true, true],
    ['Office', true, false, false, false, false, true, true, true, false, true, true],
    ['Main Head Admin', true, true, true, false, true, true, true, true, false, true, true],
    ['Branch Head Admin', true, true, true, false, false, true, true, true, false, false, false],
    ['Technician', true, true, true, false, false, true, true, true, false, false, false]
  ];
}

function ensurePermissionSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Permissions');
  if (!sheet) sheet = spreadsheet.insertSheet('Permissions');

  const headers = getPermissionHeaders();
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  if (currentHeaders.every((cell) => String(cell).trim() === '')) {
    headerRange.setValues([headers]);
  }

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, getDefaultPermissionRows().length, headers.length).setValues(getDefaultPermissionRows());
  }

  sheet.setFrozenRows(1);
  sheet.setTabColor('#7fe2a7');
  return sheet;
}

function toPermissionBoolean(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase()) || value === true;
}

function readPermissionSettings(spreadsheet) {
  const sheet = ensurePermissionSheet(spreadsheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((row) => String(row[0] || '').trim());
  const permissions = {};
  const pageAccess = {};

  rows.forEach((row) => {
    const role = String(row[0]).trim();
    permissions[role] = { view: toPermissionBoolean(row[1]), create: toPermissionBoolean(row[2]), edit: toPermissionBoolean(row[3]), delete: toPermissionBoolean(row[4]), export: toPermissionBoolean(row[5]) };
    pageAccess[role] = { Overview: toPermissionBoolean(row[6]), Messages: toPermissionBoolean(row[7]), 'Unit registry': toPermissionBoolean(row[8]), Trash: toPermissionBoolean(row[9]), Branches: toPermissionBoolean(row[10]), Accounts: toPermissionBoolean(row[11]) };
  });

  const defaults = getDefaultPermissionRows();
  const superAdminDefaults = defaults[0];
  permissions['Super Admin'] = { view: superAdminDefaults[1], create: superAdminDefaults[2], edit: superAdminDefaults[3], delete: superAdminDefaults[4], export: superAdminDefaults[5] };
  pageAccess['Super Admin'] = pageAccess['Super Admin'] || { Overview: true, Messages: true, 'Unit registry': true, Trash: true, Branches: true, Accounts: true };
  return jsonResponse({ ok: true, permissions, pageAccess });
}

function savePermissionSettings(spreadsheet, values) {
  if (!['Super Admin', 'Administrator'].includes(String(values.actorRole || '').trim())) {
    return jsonResponse({ ok: false, error: 'Only Super Admin or Administrator can save permissions' });
  }

  let permissions;
  let pageAccess;
  try {
    permissions = JSON.parse(String(values.permissions || '{}'));
    pageAccess = JSON.parse(String(values.pageAccess || '{}'));
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Invalid permission data' });
  }

  const defaults = getDefaultPermissionRows();
  const rows = defaults.map((defaultRow) => {
    const role = defaultRow[0];
    const rolePermissions = role === 'Super Admin' ? {} : (permissions[role] || {});
    const roleAccess = pageAccess[role] || {};
    return [role, role === 'Super Admin' ? defaultRow[1] : Boolean(rolePermissions.view), role === 'Super Admin' ? defaultRow[2] : Boolean(rolePermissions.create), role === 'Super Admin' ? defaultRow[3] : Boolean(rolePermissions.edit), role === 'Super Admin' ? defaultRow[4] : Boolean(rolePermissions.delete), role === 'Super Admin' ? defaultRow[5] : Boolean(rolePermissions.export), Boolean(roleAccess.Overview), Boolean(roleAccess.Messages), Boolean(roleAccess['Unit registry']), Boolean(roleAccess.Trash), Boolean(roleAccess.Branches), Boolean(roleAccess.Accounts)];
  });

  const sheet = ensurePermissionSheet(spreadsheet);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, getPermissionHeaders().length).setValues([getPermissionHeaders()]);
  sheet.getRange(2, 1, rows.length, getPermissionHeaders().length).setValues(rows);
  return jsonResponse({ ok: true, action: 'savePermissions' });
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

function isAdministratorCreatingSuperAdmin(values) {
  return String(values.actorRole || '').trim() === 'Administrator'
    && String(values.accountType || '').trim() === 'Super Admin';
}

function isValidContactInfo(value) {
  const contactInfo = String(value || '').trim();
  return /^\+63[0-9]{10}$/.test(contactInfo);
}

function isProtectedSuperAdminRequest(actorRole, accountType) {
  return ['Administrator', 'Main Head Admin'].includes(String(actorRole || '').trim())
    && String(accountType || '').trim() === 'Super Admin';
}

function getAccountRoleRank(role) {
  const ranks = {
    'branch head admin': 1,
    office: 2,
    technician: 2,
    'main head admin': 3,
    administrator: 4,
    'super admin': 5
  };
  return ranks[String(role || '').trim().replace(/\s+/g, ' ').toLowerCase()] || 0;
}

function cannotEditHigherAccountRole(actorRole, targetRole) {
  return getAccountRoleRank(actorRole) < getAccountRoleRank(targetRole);
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

function getCodeColumnIndex(headerRow) {
  const normalizedHeaders = (headerRow || []).map((header) => String(header).trim().toLowerCase());
  const matchIndex = normalizedHeaders.findIndex((header) => ['code', 'unit code', 'unitcode'].includes(header));
  return matchIndex;
}

function getTrashHeaders(unitHeaders) {
  return unitHeaders.concat(['Deleted At', 'Deleted By', 'Expires At']);
}

function getUnitRecord(sheet, unitCode) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const codeIndex = getCodeColumnIndex(headers);
  if (codeIndex === -1) return null;
  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][codeIndex] || '').trim() === String(unitCode).trim()) {
      return { headers, values: data[rowIndex], rowIndex: rowIndex + 1 };
    }
  }
  return null;
}

function getTrashSheet(spreadsheet, unitHeaders) {
  const sheet = ensureSheet(spreadsheet, 'Trash');
  const trashHeaders = getTrashHeaders(unitHeaders);
  const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), trashHeaders.length));
  const firstRow = headerRange.getValues()[0];
  const isEmpty = firstRow.every((cell) => String(cell).trim() === '');

  if (isEmpty) {
    sheet.getRange(1, 1, 1, trashHeaders.length).setValues([trashHeaders]);
  } else {
    sheet.getRange(1, trashHeaders.length - 2, 1, 3).setValues([trashHeaders.slice(-3)]);
  }

  return sheet;
}

function serializeTrashDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return String(value || '');
}

function readTrashRows(spreadsheet) {
  const unitsSheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  const unitHeaders = unitsSheet.getDataRange().getValues()[0] || [];
  const trashSheet = getTrashSheet(spreadsheet, unitHeaders);
  const values = trashSheet.getDataRange().getValues();
  const headers = values[0] || [];
  const expectedDeletedAtIndex = unitHeaders.length;
  const expectedExpiresAtIndex = unitHeaders.length + 2;
  const deletedAtIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'deleted at') >= 0
    ? headers.findIndex((header) => String(header).trim().toLowerCase() === 'deleted at')
    : expectedDeletedAtIndex;
  const expiresAtIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'expires at') >= 0
    ? headers.findIndex((header) => String(header).trim().toLowerCase() === 'expires at')
    : expectedExpiresAtIndex;
  const codeIndex = getCodeColumnIndex(headers);
  const now = new Date();
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const expiresAt = new Date(values[rowIndex][expiresAtIndex]);
    if (expiresAtIndex !== -1 && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) trashSheet.deleteRow(rowIndex + 1);
  }
  const current = trashSheet.getDataRange().getValues();
  const currentHeaders = current[0] || [];
  const currentCodeIndex = getCodeColumnIndex(currentHeaders);
  const currentDeletedHeaderIndex = currentHeaders.findIndex((header) => String(header).trim().toLowerCase() === 'deleted at');
  const currentExpiresHeaderIndex = currentHeaders.findIndex((header) => String(header).trim().toLowerCase() === 'expires at');
  const currentDeletedIndex = currentDeletedHeaderIndex >= 0 ? currentDeletedHeaderIndex : expectedDeletedAtIndex;
  const currentExpiresIndex = currentExpiresHeaderIndex >= 0 ? currentExpiresHeaderIndex : expectedExpiresAtIndex;
  const currentClientIndex = currentHeaders.findIndex((header) => String(header).trim().toLowerCase().includes('client name'));
  const currentBranchIndex = currentHeaders.findIndex((header) => ['branch location', 'uploaded branch', 'current location'].includes(String(header).trim().toLowerCase()));
  const rows = current.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== '')).map((row) => ({ unitCode: row[currentCodeIndex] || '', clientName: currentClientIndex === -1 ? '' : row[currentClientIndex] || '', branchLocation: currentBranchIndex === -1 ? '' : row[currentBranchIndex] || '', deletedAt: currentDeletedIndex === -1 ? '' : serializeTrashDate(row[currentDeletedIndex]), expiresAt: currentExpiresIndex === -1 ? '' : serializeTrashDate(row[currentExpiresIndex]) }));
  return jsonResponse({ ok: true, rows });
}

function deleteUnitRow(spreadsheet, unitCode, values) {
  if (!unitCode) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing unit code' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  const record = getUnitRecord(sheet, unitCode);
  if (!record) {
    const codeIndex = getCodeColumnIndex(sheet.getDataRange().getValues()[0] || []);
    if (codeIndex === -1) {
      return jsonResponse({ ok: false, error: 'Code column not found' });
    }
    return jsonResponse({ ok: false, error: 'Unit not found' });
  }

  const trashSheet = getTrashSheet(spreadsheet, record.headers);
  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  trashSheet.appendRow(record.values.concat([deletedAt, values.actorName || values.actorRole || 'Unknown', expiresAt]));
  sheet.deleteRow(record.rowIndex);
  return jsonResponse({ ok: true, action: 'deleteUnit', deletedCode: unitCode });
}

function restoreUnitRow(spreadsheet, unitCode) {
  const trashSheet = spreadsheet.getSheetByName('Trash');
  const unitsSheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  if (!trashSheet) return jsonResponse({ ok: false, error: 'Trash is empty' });
  const record = getUnitRecord(trashSheet, unitCode);
  if (!record) return jsonResponse({ ok: false, error: 'Deleted unit not found' });
  const unitColumnCount = (unitsSheet.getDataRange().getValues()[0] || []).length;
  unitsSheet.appendRow(record.values.slice(0, unitColumnCount));
  trashSheet.deleteRow(record.rowIndex);
  return jsonResponse({ ok: true, action: 'restoreUnit', restoredCode: unitCode });
}

function purgeUnitRow(spreadsheet, unitCode) {
  const trashSheet = spreadsheet.getSheetByName('Trash');
  if (!trashSheet) return jsonResponse({ ok: false, error: 'Trash is empty' });
  const record = getUnitRecord(trashSheet, unitCode);
  if (!record) return jsonResponse({ ok: false, error: 'Deleted unit not found' });
  trashSheet.deleteRow(record.rowIndex);
  return jsonResponse({ ok: true, action: 'purgeUnit', purgedCode: unitCode });
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

function updateUnitRow(spreadsheet, values) {
  if (!isValidContactInfo(values.contactInfo || '')) {
    return jsonResponse({ ok: false, error: 'Contact Info must use +63 followed by 10 digits' });
  }

  const sheet = ensureSheet(spreadsheet, 'Units');
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0] || [];
  const codeIndex = getCodeColumnIndex(headerRow);
  const targetCode = String(values.originalUnitCode || values.unitCode || '').trim();

  if (codeIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Code column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  const rowToWrite = buildRowForAction('units', values);

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentCode = String(data[rowIndex][codeIndex] || '').trim();
    if (currentCode === targetCode) {
      const targetRange = sheet.getRange(rowIndex + 1, 1, 1, rowToWrite.length);
      targetRange.setValues([rowToWrite]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateUnit', updatedCode: targetCode })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unit not found for update' })).setMimeType(ContentService.MimeType.JSON);
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

function updateAccountRow(spreadsheet, values) {
  const sheet = spreadsheet.getSheetByName('Accounts') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  if (!data.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Accounts sheet is empty' })).setMimeType(ContentService.MimeType.JSON);
  }

  const headerRow = data[0] || [];
  const usernameIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase().includes('username'));
  const accountTypeIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase().includes('account type'));
  const targetUsername = String(values.originalUsername || values.username || '').trim();

  if (usernameIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Username column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentUsername = String(data[rowIndex][usernameIndex] || '').trim();
    if (currentUsername === targetUsername || (targetUsername === '' && currentUsername === String(values.username || '').trim())) {
      const currentAccountType = accountTypeIndex === -1 ? '' : data[rowIndex][accountTypeIndex];
      if (cannotEditHigherAccountRole(values.actorRole, currentAccountType) || cannotEditHigherAccountRole(values.actorRole, values.accountType)) {
        return jsonResponse({ ok: false, error: 'The current role cannot edit a higher-ranked account role' });
      }
      if (isProtectedSuperAdminRequest(values.actorRole, accountTypeIndex === -1 ? '' : data[rowIndex][accountTypeIndex])) {
        return jsonResponse({ ok: false, error: 'This account cannot be edited by the current role' });
      }
      const statusIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'status');
      const existingStatus = statusIndex === -1 ? 'Active' : String(data[rowIndex][statusIndex] || 'Active').trim();
      const requestedStatus = String(values.status || '').trim();
      if (String(values.actorRole || '').trim() !== 'Super Admin') {
        values.status = existingStatus;
      } else if (String(values.actorRole || '').trim() === 'Super Admin' && requestedStatus && !['active', 'inactive', 'disabled'].includes(requestedStatus.toLowerCase())) {
        return jsonResponse({ ok: false, error: 'Invalid account status' });
      }
      const rowToWrite = buildRowForAction('accounts', values);
      const targetRange = sheet.getRange(rowIndex + 1, 1, 1, rowToWrite.length);
      targetRange.setValues([rowToWrite]);
      syncBranchManagerFromAccount(spreadsheet, values.fullName || '', values.branch || values.accountBranch || values.branchName || '', values.originalBranch || '');
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateAccount', updatedUsername: values.username || targetUsername })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Account not found for update' })).setMimeType(ContentService.MimeType.JSON);
}

function syncBranchManagerFromAccount(spreadsheet, accountName, branchName, originalBranchName) {
  const managerName = String(accountName || '').trim();
  const targetBranch = String(branchName || '').trim();
  const previousBranch = String(originalBranchName || '').trim();
  if (!managerName) return;

  const sheet = spreadsheet.getSheetByName('Branches');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const branchNameIndex = headers.findIndex((header) => String(header).trim().toLowerCase().includes('branch name'));
  const managerIndex = headers.findIndex((header) => ['head admin', 'manager', 'branch manager'].includes(String(header).trim().toLowerCase()));
  if (branchNameIndex === -1 || managerIndex === -1) return;

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedPreviousBranch = normalize(previousBranch);
  const normalizedTargetBranch = normalize(targetBranch);

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const currentBranch = String(data[rowIndex][branchNameIndex] || '').trim();
    const currentManager = String(data[rowIndex][managerIndex] || '').trim();
    if (normalizedPreviousBranch && normalize(currentBranch) === normalizedPreviousBranch && normalize(currentManager) === normalize(managerName)) {
      sheet.getRange(rowIndex + 1, managerIndex + 1).setValue('');
    }
    if (normalizedTargetBranch && normalize(currentBranch) === normalizedTargetBranch) {
      sheet.getRange(rowIndex + 1, managerIndex + 1).setValue(managerName);
    }
  }
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
  if (sheetAction === 'units') {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), desiredHeaders.length)).getValues()[0];
    const hasContactInfo = existingHeaders.some((header) => String(header).trim().toLowerCase() === 'contact info');
    const clientNameIndex = existingHeaders.findIndex((header) => String(header).trim().toLowerCase() === 'client name');
    if (!hasContactInfo && clientNameIndex >= 0) {
      sheet.insertColumnAfter(clientNameIndex + 1);
    }
  }
  let headerRange = sheet.getRange(1, 1, 1, desiredHeaders.length);
  let firstRow = headerRange.getValues()[0];
  const isEmpty = firstRow.every((cell) => String(cell).trim() === '');

  if (isEmpty) {
    headerRange.setValues([desiredHeaders]);
  } else if (sheetAction === 'messages' && String(firstRow[0] || '').trim().toLowerCase() !== 'message id') {
    sheet.clearContents();
    headerRange.setValues([desiredHeaders]);
  } else if (sheetAction === 'messages') {
    normalizeMessagesSheet(sheet, desiredHeaders);
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

function normalizeMessagesSheet(sheet, desiredHeaders) {
  const range = sheet.getDataRange();
  const data = range.getValues();
  const sourceHeaders = data[0] || [];
  const normalizedHeaders = sourceHeaders.map((header) => String(header || '').trim().toLowerCase());
  const subjectIndex = normalizedHeaders.indexOf('subject');
  const threadIdIndexes = normalizedHeaders.reduce((indexes, header, index) => {
    if (header === 'thread id') indexes.push(index);
    return indexes;
  }, []);

  if (subjectIndex === -1 && threadIdIndexes.length > 1) {
    sourceHeaders[threadIdIndexes[0]] = 'Subject';
    normalizedHeaders[threadIdIndexes[0]] = 'subject';
  }

  const sourceIndexes = new Map();
  normalizedHeaders.forEach((header, index) => {
    if (header && !sourceIndexes.has(header)) sourceIndexes.set(header, index);
  });

  const normalizedRows = data.slice(1).map((row) => {
    if (isLegacyMessageRow(row, normalizedHeaders)) {
      return [row[0] || '', row[1] || '', row[2] || '', row[3] || '', row[4] || '', '', '', '', '', row[5] || '', row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '[]'];
    }

    return desiredHeaders.map((header) => {
      const sourceIndex = sourceIndexes.get(header.toLowerCase());
      return sourceIndex === undefined ? '' : row[sourceIndex] || '';
    });
  });
  const targetData = [desiredHeaders, ...normalizedRows];

  const currentWidth = sheet.getMaxColumns();
  if (currentWidth < desiredHeaders.length) {
    sheet.insertColumnsAfter(currentWidth, desiredHeaders.length - currentWidth);
  }
  if (currentWidth > desiredHeaders.length) {
    sheet.deleteColumns(desiredHeaders.length + 1, currentWidth - desiredHeaders.length);
  }

  sheet.getRange(1, 1, targetData.length, desiredHeaders.length).setValues(targetData);
}

function isLegacyMessageRow(row, normalizedHeaders) {
  const ccIndex = normalizedHeaders.indexOf('cc');
  const ccNameIndex = normalizedHeaders.indexOf('cc name');
  const subjectIndex = normalizedHeaders.indexOf('subject');
  const bodyIndex = normalizedHeaders.indexOf('body');
  const threadIdIndex = normalizedHeaders.indexOf('thread id');
  const attachmentsIndex = normalizedHeaders.indexOf('attachments');
  const subjectValue = String(row[subjectIndex] || '').trim();
  const bodyValue = String(row[bodyIndex] || '').trim();

  return ccIndex >= 0
    && ccNameIndex >= 0
    && subjectIndex >= 0
    && bodyIndex >= 0
    && threadIdIndex >= 0
    && attachmentsIndex >= 0
    && String(row[ccIndex] || '').trim() !== ''
    && String(row[ccNameIndex] || '').trim() !== ''
    && /^THREAD-/i.test(subjectValue)
    && (bodyValue === '[]' || bodyValue.startsWith('[{'));
}

function getHeadersForAction(action) {
  switch (String(action || 'units').toLowerCase()) {
    case 'accounts':
      return ['Username', 'Password', 'Account Type', 'Full Name', 'Email', 'Branch', 'Status', 'Created At'];
    case 'branches':
      return ['Branch Type', 'Location', 'Branch Name', 'Head Admin', 'Status'];
    case 'messages':
      return ['Message ID', 'Sender', 'Sender Name', 'Recipient', 'Recipient Name', 'Cc', 'Cc Name', 'Bcc', 'Bcc Name', 'Subject', 'Body', 'Sent At', 'Read', 'Thread ID', 'Attachments'];
    case 'units':
    default:
      return [
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
        values.cc || '',
        values.ccName || '',
        values.bcc || '',
        values.bccName || '',
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
        values.contactInfo || '',
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
