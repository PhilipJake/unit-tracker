const SPREADSHEET_ID = '1tmUvhVy490c2j6io2czia9cOenVZ-NkyncDEgudmuLA';

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').toLowerCase();

  if (action === 'permissions') {
    return readPermissionSettings(SpreadsheetApp.openById(SPREADSHEET_ID));
  }

  if (action === 'branchtypes') {
    return readBranchTypeSettings(SpreadsheetApp.openById(SPREADSHEET_ID));
  }

  if (action === 'userpreferences') {
    const result = readUserPreferences(SpreadsheetApp.openById(SPREADSHEET_ID), e.parameter.username);
    const callback = String(e.parameter.callback || '');
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return jsonResponse(result);
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

  if (action === 'savebranchtypes') {
    return saveBranchTypeSettings(spreadsheet, values);
  }

  if (action === 'saveuserpreferences') {
    return saveUserPreferences(spreadsheet, values);
  }

  if (action === 'contactadmin') {
    return createContactAdminMessage(spreadsheet, values);
  }

  if (action === 'changepassword') {
    return changeAccountPassword(spreadsheet, values);
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

  if (action === 'purgealltrash') {
    return purgeAllTrashRows(spreadsheet);
  }

  if (action === 'updateunit') {
    return updateUnitRow(spreadsheet, values);
  }

  if (action === 'releaseunit') {
    return releaseUnitRow(spreadsheet, values);
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
  if (action === 'units') ensureUnitDateColumns(sheet);
  if (action === 'accounts' && isAdministratorCreatingSuperAdmin(values)) {
    return jsonResponse({ ok: false, error: 'Administrator cannot create a Super Admin account' });
  }
  if (action === 'accounts') {
    if (!canManageAccountStatus(values.actorRole)) {
      values.status = 'Active';
    } else if (values.status && !isValidAccountStatus(values.status)) {
      return jsonResponse({ ok: false, error: 'Invalid account status' });
    }
  }
  const headers = getHeadersForAction(action);
  if (action === 'units' && !isValidContactInfo(values.contactInfo || '')) {
    return jsonResponse({ ok: false, error: 'Contact Info must use +63 followed by 10 digits' });
  }
  if (action === 'units' && String(values.status || '').trim() === 'For Diagnose' && !['Super Admin', 'Administrator', 'Technician'].includes(String(values.actorRole || '').trim())) {
    return jsonResponse({ ok: false, error: 'Only Super Admin, Administrator, and Technician roles can set For Diagnose' });
  }
  if (action === 'messages') {
    values.attachments = uploadMessageAttachments(values.attachments || '[]');
  }
  if (action === 'units' && !canEditTechnicianNotes(values.actorRole)) {
    values.technicianNotes = '';
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
  return ['Role', 'View', 'Create', 'Edit', 'Delete', 'Export', 'Release', 'Overview', 'Messages', 'Unit registry', 'Trash', 'Branches', 'Accounts', 'Warehouse', 'Pullout', 'For Replacement'];
}

function getDefaultPermissionRows() {
  return [
    ['Super Admin', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    ['Administrator', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    ['Office', true, false, false, false, true, false, true, true, true, false, true, true, false, false, false],
    ['Main Head Admin', true, true, true, true, true, false, true, true, true, false, true, true, true, true, true],
    ['Branch Head Admin', true, true, true, false, false, false, true, true, true, false, false, false, true, true, true],
    ['Technician', true, true, true, false, false, true, true, true, true, false, false, false, true, true, true]
  ];
}

function ensurePermissionSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName('Permissions');
  if (!sheet) sheet = spreadsheet.insertSheet('Permissions');

  const headers = getPermissionHeaders();
  const currentWidth = Math.max(sheet.getLastColumn(), headers.length - 1);
  const currentHeaders = sheet.getRange(1, 1, 1, currentWidth).getValues()[0];
  if (!currentHeaders.some((cell) => String(cell).trim().toLowerCase() === 'release')) {
    sheet.insertColumnAfter(6);
    sheet.getRange(1, 7).setValue('Release');
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const refreshedHeaders = headerRange.getValues()[0];
  if (refreshedHeaders.every((cell) => String(cell).trim() === '')) {
    headerRange.setValues([headers]);
  } else {
    headers.slice(13).forEach((header) => {
      const width = Math.max(sheet.getLastColumn(), headers.length - 3);
      const existingHeaders = sheet.getRange(1, 1, 1, width).getValues()[0];
      if (!existingHeaders.some((cell) => String(cell).trim().toLowerCase() === header.toLowerCase())) {
        sheet.getRange(1, width + 1).setValue(header);
      }
    });
  }

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, getDefaultPermissionRows().length, headers.length).setValues(getDefaultPermissionRows());
  }
  migrateTechnicianReleaseDefault(sheet);
  migrateUnitActionPermissionDefaults(sheet);

  sheet.setFrozenRows(1);
  sheet.setTabColor('#7fe2a7');
  return sheet;
}

function migrateUnitActionPermissionDefaults(sheet) {
  if (sheet.getLastRow() < 2) return;
  const defaultsByRole = getDefaultPermissionRows().reduce((defaults, row) => {
    defaults[row[0]] = row;
    return defaults;
  }, {});
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, getPermissionHeaders().length).getValues();
  rows.forEach((row, rowIndex) => {
    const roleDefaults = defaultsByRole[String(row[0] || '').trim()];
    if (!roleDefaults) return;
    sheet.getRange(rowIndex + 2, 2).setValue(true);
    [14, 15, 16].forEach((column) => {
      if (String(row[column - 1] == null ? '' : row[column - 1]).trim() === '') {
        sheet.getRange(rowIndex + 2, column).setValue(roleDefaults[column - 1]);
      }
    });
  });
}

function migrateTechnicianReleaseDefault(sheet) {
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, getPermissionHeaders().length).getValues();
  const oldTechnicianDefaults = ['Technician', true, true, true, false, false, false, true, true, true, false, false, false];
  const rowIndex = rows.findIndex((row) => oldTechnicianDefaults.every((value, index) => (
    index === 0 ? String(row[index] || '').trim() === value : toPermissionBoolean(row[index]) === value
  )));
  if (rowIndex !== -1) sheet.getRange(rowIndex + 2, 7).setValue(true);
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
    permissions[role] = { view: true, create: toPermissionBoolean(row[2]), edit: toPermissionBoolean(row[3]), delete: toPermissionBoolean(row[4]), export: toPermissionBoolean(row[5]), release: toPermissionBoolean(row[6]), warehouse: toPermissionBoolean(row[13]), pullOut: toPermissionBoolean(row[14]), forReplacement: toPermissionBoolean(row[15]) };
    pageAccess[role] = { Overview: toPermissionBoolean(row[7]), Messages: toPermissionBoolean(row[8]), 'Unit registry': toPermissionBoolean(row[9]), Trash: toPermissionBoolean(row[10]), Branches: toPermissionBoolean(row[11]), Accounts: toPermissionBoolean(row[12]) };
  });

  const defaults = getDefaultPermissionRows();
  const superAdminDefaults = defaults[0];
  permissions['Super Admin'] = { view: true, create: superAdminDefaults[2], edit: superAdminDefaults[3], delete: superAdminDefaults[4], export: superAdminDefaults[5], release: superAdminDefaults[6], warehouse: superAdminDefaults[13], pullOut: superAdminDefaults[14], forReplacement: superAdminDefaults[15] };
  pageAccess['Super Admin'] = pageAccess['Super Admin'] || { Overview: true, Messages: true, 'Unit registry': true, Trash: true, Branches: true, Accounts: true };
  return jsonResponse({ ok: true, permissions, pageAccess, userPermissions: readUserPermissionOverrides(spreadsheet), roleColors: readRoleColors() });
}

function readRoleColors() {
  try {
    const colors = JSON.parse(PropertiesService.getScriptProperties().getProperty('ROLE_COLORS') || '{}');
    if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return {};
    return Object.keys(colors).reduce((result, role) => {
      const color = String(colors[role] || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(color)) result[role] = color.toUpperCase();
      return result;
    }, {});
  } catch (error) {
    return {};
  }
}

function readUserPermissionOverrides(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('User Permissions');
  if (!sheet || sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  return rows.reduce((overrides, row) => {
    const username = String(row[0] || '').trim().toLowerCase();
    const role = String(row[1] || '').trim();
    if (!username || role === 'Super Admin') return overrides;
    try {
      overrides[username] = {
        enabled: true,
        role,
        permissions: JSON.parse(String(row[2] || '{}')),
        pageAccess: JSON.parse(String(row[3] || '{}'))
      };
    } catch (error) {
      console.warn('Skipping invalid user permission override for ' + username);
    }
    return overrides;
  }, {});
}

function savePermissionSettings(spreadsheet, values) {
  if (!['Super Admin', 'Administrator'].includes(String(values.actorRole || '').trim())) {
    return jsonResponse({ ok: false, error: 'Only Super Admin or Administrator can save permissions' });
  }

  let permissions;
  let pageAccess;
  let userPermissions;
  let roleColors;
  try {
    permissions = JSON.parse(String(values.permissions || '{}'));
    pageAccess = JSON.parse(String(values.pageAccess || '{}'));
    userPermissions = JSON.parse(String(values.userPermissions || '{}'));
    roleColors = JSON.parse(String(values.roleColors || '{}'));
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Invalid permission data' });
  }
  if (!roleColors || typeof roleColors !== 'object' || Array.isArray(roleColors)) {
    return jsonResponse({ ok: false, error: 'Invalid role color data' });
  }
  const normalizedRoleColors = {};
  Object.keys(roleColors).forEach((role) => {
    const color = String(roleColors[role] || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) normalizedRoleColors[role] = color.toUpperCase();
  });

  const defaults = getDefaultPermissionRows();
  const defaultsByRole = defaults.reduce((roleDefaults, row) => {
    roleDefaults[row[0]] = row;
    return roleDefaults;
  }, {});
  const roleNames = [...defaults.map((row) => row[0]), ...Object.keys(permissions).filter((role) => !defaultsByRole[role])];
  const rows = roleNames.map((role) => {
    const defaultRow = defaultsByRole[role] || [role, true, false, false, false, false, false, true, true, true, false, false, false, false, false, false];
    const rolePermissions = role === 'Super Admin' ? {} : (permissions[role] || {});
    const roleAccess = role === 'Super Admin' ? {} : (pageAccess[role] || {});
    const isSuperAdmin = role === 'Super Admin';
    return [role, true, isSuperAdmin ? defaultRow[2] : Boolean(rolePermissions.create), isSuperAdmin ? defaultRow[3] : Boolean(rolePermissions.edit), isSuperAdmin ? defaultRow[4] : Boolean(rolePermissions.delete), isSuperAdmin ? defaultRow[5] : Boolean(rolePermissions.export), isSuperAdmin ? defaultRow[6] : Boolean(rolePermissions.release), isSuperAdmin ? defaultRow[7] : Boolean(roleAccess.Overview), isSuperAdmin ? defaultRow[8] : Boolean(roleAccess.Messages), isSuperAdmin ? defaultRow[9] : Boolean(roleAccess['Unit registry']), isSuperAdmin ? defaultRow[10] : Boolean(roleAccess.Trash), isSuperAdmin ? defaultRow[11] : Boolean(roleAccess.Branches), isSuperAdmin ? defaultRow[12] : Boolean(roleAccess.Accounts), isSuperAdmin ? defaultRow[13] : Boolean(rolePermissions.warehouse), isSuperAdmin ? defaultRow[14] : Boolean(rolePermissions.pullOut), isSuperAdmin ? defaultRow[15] : Boolean(rolePermissions.forReplacement)];
  });

  const sheet = ensurePermissionSheet(spreadsheet);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, getPermissionHeaders().length).setValues([getPermissionHeaders()]);
  sheet.getRange(2, 1, rows.length, getPermissionHeaders().length).setValues(rows);
  const userSheet = spreadsheet.getSheetByName('User Permissions') || spreadsheet.insertSheet('User Permissions');
  const userRows = Object.keys(userPermissions).reduce((result, username) => {
    const override = userPermissions[username] || {};
    const role = String(override.role || '').trim();
    if (!username.trim() || !override.enabled || !role || role === 'Super Admin') return result;
    result.push([username.trim().toLowerCase(), role, JSON.stringify(override.permissions || {}), JSON.stringify(override.pageAccess || {})]);
    return result;
  }, []);
  userSheet.clearContents();
  userSheet.getRange(1, 1, 1, 4).setValues([['Username', 'Role', 'Permissions', 'Page Access']]);
  if (userRows.length) userSheet.getRange(2, 1, userRows.length, 4).setValues(userRows);
  userSheet.setFrozenRows(1);
  PropertiesService.getScriptProperties().setProperty('ROLE_COLORS', JSON.stringify(normalizedRoleColors));
  return jsonResponse({ ok: true, action: 'savePermissions' });
}

function ensureBranchTypeSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Branch Types') || spreadsheet.insertSheet('Branch Types');
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, 3).setValues([['Shortcut', 'Full CodeName', 'Color']]);
  const headers = sheet.getRange(1, 1, 1, Math.max(3, sheet.getLastColumn())).getValues()[0];
  if (!headers.some((header) => String(header).trim().toLowerCase() === 'color')) sheet.getRange(1, 3).setValue('Color');
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('BRANCH_TYPES_INITIALIZED') !== 'true') {
    const hasTypes = sheet.getLastRow() > 1 && sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some((row) => String(row[0] || '').trim());
    if (!hasTypes) {
      sheet.getRange(2, 1, 3, 3).setValues([
        ['BNB', 'Bytes and Bots Gadget Center', '#21A675'],
        ['EZ', '', '#3388CC'],
        ['1LR', '', '#E3A83D']
      ]);
    }
    properties.setProperty('BRANCH_TYPES_INITIALIZED', 'true');
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function readBranchTypeSettings(spreadsheet) {
  const sheet = ensureBranchTypeSheet(spreadsheet);
  const rows = sheet.getDataRange().getValues().slice(1);
  const branchTypes = rows
    .filter((row) => String(row[0] || '').trim())
    .map((row) => ({ code: String(row[0]).trim().toUpperCase(), fullName: String(row[1] || '').trim(), color: String(row[2] || '').trim() }));
  return jsonResponse({ ok: true, branchTypes });
}

function saveBranchTypeSettings(spreadsheet, values) {
  if (!['Super Admin', 'Administrator'].includes(String(values.actorRole || '').trim())) {
    return jsonResponse({ ok: false, error: 'Only Super Admin or Administrator can manage branch types' });
  }

  let branchTypes;
  try {
    branchTypes = JSON.parse(String(values.branchTypes || '[]'));
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Invalid branch type data' });
  }
  if (!Array.isArray(branchTypes)) return jsonResponse({ ok: false, error: 'Invalid branch type data' });

  const seenCodes = new Set();
  const rows = [];
  for (const type of branchTypes) {
    const code = String(type && type.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,12}$/.test(code) || seenCodes.has(code)) throw new Error('Branch type shortcuts must be unique letters or numbers.');
    seenCodes.add(code);
    const color = String(type.color || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color)) return jsonResponse({ ok: false, error: 'Branch type colors must be six-digit hex values.' });
    rows.push([code, String(type.fullName || '').trim(), color]);
  }

  const sheet = ensureBranchTypeSheet(spreadsheet);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 3).setValues([['Shortcut', 'Full CodeName', 'Color']]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  PropertiesService.getScriptProperties().setProperty('BRANCH_TYPES_INITIALIZED', 'true');
  return jsonResponse({ ok: true, action: 'saveBranchTypes' });
}

function ensureUserPreferencesSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('User Preferences') || spreadsheet.insertSheet('User Preferences');
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, 2).setValues([['Username', 'Dark Mode']]);
  sheet.setFrozenRows(1);
  return sheet;
}

function readUserPreferences(spreadsheet, username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!normalizedUsername) return { ok: false, error: 'Missing username' };
  const sheet = ensureUserPreferencesSheet(spreadsheet);
  if (sheet.getLastRow() < 2) return { ok: true, darkMode: false };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const row = rows.find((item) => String(item[0] || '').trim().toLowerCase() === normalizedUsername);
  return { ok: true, darkMode: row ? toPermissionBoolean(row[1]) : false };
}

function saveUserPreferences(spreadsheet, values) {
  const username = String(values.username || '').trim().toLowerCase();
  if (!username) return jsonResponse({ ok: false, error: 'Missing username' });
  const darkMode = ['true', '1', 'yes', 'on'].includes(String(values.darkMode || '').trim().toLowerCase());
  const sheet = ensureUserPreferencesSheet(spreadsheet);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const rowIndex = rows.findIndex((row) => String(row[0] || '').trim().toLowerCase() === username);
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex + 2, 2).setValue(darkMode);
      return jsonResponse({ ok: true, action: 'saveUserPreferences' });
    }
  }
  sheet.appendRow([username, darkMode]);
  return jsonResponse({ ok: true, action: 'saveUserPreferences' });
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

function createContactAdminMessage(spreadsheet, values) {
  const requesterName = String(values.requesterName || '').trim();
  const requesterContact = String(values.requesterContact || '').trim();
  const message = String(values.message || '').trim();
  if (!requesterName || !requesterContact || !message) {
    return jsonResponse({ ok: false, error: 'Name, email, and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterContact)) {
    return jsonResponse({ ok: false, error: 'A valid email address is required' });
  }

  const accountsSheet = spreadsheet.getSheetByName('Accounts');
  if (!accountsSheet) return jsonResponse({ ok: false, error: 'Accounts sheet not found' });
  const accountData = accountsSheet.getDataRange().getValues();
  const headers = accountData[0] || [];
  const usernameIndex = headers.findIndex((header) => ['username', 'user name'].includes(String(header).trim().toLowerCase()));
  const roleIndex = headers.findIndex((header) => ['account type', 'role', 'user type'].includes(String(header).trim().toLowerCase()));
  const nameIndex = headers.findIndex((header) => ['full name', 'fullname', 'name'].includes(String(header).trim().toLowerCase()));
  const statusIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'status');
  if (usernameIndex === -1 || roleIndex === -1) return jsonResponse({ ok: false, error: 'Admin account fields not found' });

  const admins = accountData.slice(1).filter((row) => {
    const roleMatches = ['super admin', 'administrator'].includes(String(row[roleIndex] || '').trim().toLowerCase());
    const status = statusIndex === -1 ? 'active' : String(row[statusIndex] || 'active').trim().toLowerCase();
    return roleMatches && !['inactive', 'disabled', 'deactivated'].includes(status);
  });
  if (!admins.length) return jsonResponse({ ok: false, error: 'No administrator accounts found' });

  const recipient = admins.map((row) => String(row[usernameIndex] || '').trim()).filter(Boolean).join(',');
  const recipientName = admins.map((row) => String(nameIndex === -1 ? '' : row[nameIndex] || '').trim() || String(row[usernameIndex] || '').trim()).filter(Boolean).join(',');
  const messagesSheet = ensureSheet(spreadsheet, 'Messages');
  const messageId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = buildRowForAction('messages', {
    messageId,
    sender: 'contact-form',
    senderName: `${requesterName} (${requesterContact})`,
    recipient,
    recipientName,
    subject: 'Login assistance request',
    body: message,
    sentAt: new Date().toISOString(),
    read: 'FALSE',
    threadId: `THREAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attachments: '[]'
  });
  messagesSheet.appendRow(row);
  return jsonResponse({ ok: true, action: 'contactAdmin', recipientCount: admins.length });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function isAdministratorCreatingSuperAdmin(values) {
  return String(values.actorRole || '').trim() === 'Administrator'
    && String(values.accountType || '').trim() === 'Super Admin';
}

function canManageAccountStatus(role) {
  return ['Super Admin', 'Administrator', 'Main Head Admin'].includes(String(role || '').trim());
}

function isValidAccountStatus(status) {
  return ['active', 'inactive', 'disabled'].includes(String(status || '').trim().toLowerCase());
}

function changeAccountPassword(spreadsheet, values) {
  const sheet = spreadsheet.getSheetByName('Accounts') || spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const usernameIndex = headers.findIndex((header) => String(header).trim().toLowerCase().includes('username'));
  const passwordIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'password');
  const username = String(values.username || '').trim();
  const currentPassword = String(values.currentPassword || '');
  const newPassword = String(values.newPassword || '');

  if (!username || !currentPassword || newPassword.length < 6) {
    return jsonResponse({ ok: false, error: 'Please provide valid password details' });
  }
  if (newPassword === currentPassword) {
    return jsonResponse({ ok: false, error: 'The new password must be different from the current password' });
  }
  if (usernameIndex === -1 || passwordIndex === -1) {
    return jsonResponse({ ok: false, error: 'Account credentials columns not found' });
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][usernameIndex] || '').trim().toLowerCase() !== username.toLowerCase()) continue;
    if (String(data[rowIndex][passwordIndex] || '') !== currentPassword) {
      return jsonResponse({ ok: false, error: 'Current password is incorrect' });
    }
    sheet.getRange(rowIndex + 1, passwordIndex + 1).setValue(newPassword);
    return jsonResponse({ ok: true, action: 'changePassword' });
  }

  return jsonResponse({ ok: false, error: 'Account not found' });
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
  sheet.getRange(1, 1, 1, trashHeaders.length).setValues([trashHeaders]);

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

function getManilaDateKey(date) {
  return Utilities.formatDate(date, 'Asia/Manila', 'yyyy-MM-dd');
}

function getManilaMidnightAfterDays(date, days) {
  const dateKey = getManilaDateKey(date);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0) - (8 * 60 * 60 * 1000));
}

function isValidTrashDate(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return !Number.isNaN(new Date(value).getTime());
  const text = String(value || '').trim();
  return Boolean(text) && !Number.isNaN(new Date(text).getTime());
}

function getTrashArchiveDateIndexes(row, fallbackDeletedIndex, fallbackExpiresIndex) {
  const dateIndexes = row.reduce((indexes, value, index) => {
    if (isValidTrashDate(value)) indexes.push(index);
    return indexes;
  }, []);
  if (dateIndexes.length >= 2) {
    return {
      deletedAtIndex: dateIndexes[dateIndexes.length - 2],
      expiresAtIndex: dateIndexes[dateIndexes.length - 1]
    };
  }
  return { deletedAtIndex: fallbackDeletedIndex, expiresAtIndex: fallbackExpiresIndex };
}

function readTrashRows(spreadsheet) {
  const unitsSheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  ensureUnitDateColumns(unitsSheet);
  const unitHeaders = unitsSheet.getDataRange().getValues()[0] || [];
  const trashSheet = getTrashSheet(spreadsheet, unitHeaders);
  const values = trashSheet.getDataRange().getValues();
  const headers = values[0] || [];
  const expectedDeletedAtIndex = unitHeaders.length;
  const expectedExpiresAtIndex = unitHeaders.length + 2;
  const now = new Date();
  const todayManilaDateKey = getManilaDateKey(now);
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const archiveIndexes = getTrashArchiveDateIndexes(values[rowIndex], expectedDeletedAtIndex, expectedExpiresAtIndex);
    const expiresAt = new Date(values[rowIndex][archiveIndexes.expiresAtIndex]);
    if (!Number.isNaN(expiresAt.getTime()) && getManilaDateKey(expiresAt) <= todayManilaDateKey) trashSheet.deleteRow(rowIndex + 1);
  }
  const current = trashSheet.getDataRange().getValues();
  const unitClientIndex = unitHeaders.findIndex((header) => String(header).trim().toLowerCase().includes('client name'));
  const unitBranchIndex = unitHeaders.findIndex((header) => ['branch location', 'uploaded branch', 'current location'].includes(String(header).trim().toLowerCase()));
  const rows = current.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== '')).map((row) => {
    const archiveIndexes = getTrashArchiveDateIndexes(row, expectedDeletedAtIndex, expectedExpiresAtIndex);
    return {
      unitCode: unitCodeIndex(unitHeaders, row),
      clientName: unitClientIndex === -1 ? '' : row[unitClientIndex] || '',
      branchLocation: unitBranchIndex === -1 ? '' : row[unitBranchIndex] || '',
      deletedAt: archiveIndexes.deletedAtIndex === -1 ? '' : serializeTrashDate(row[archiveIndexes.deletedAtIndex]),
      expiresAt: archiveIndexes.expiresAtIndex === -1 ? '' : serializeTrashDate(row[archiveIndexes.expiresAtIndex])
    };
  });
  return jsonResponse({ ok: true, rows });
}

function unitCodeIndex(unitHeaders, row) {
  const codeIndex = getCodeColumnIndex(unitHeaders);
  return codeIndex === -1 ? '' : row[codeIndex] || '';
}

function deleteUnitRow(spreadsheet, unitCode, values) {
  if (!unitCode) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing unit code' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  ensureUnitDateColumns(sheet);
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
  const expiresAt = getManilaMidnightAfterDays(deletedAt, 30);
  trashSheet.appendRow(record.values.concat([deletedAt, values.actorName || values.actorRole || 'Unknown', expiresAt]));
  sheet.deleteRow(record.rowIndex);
  return jsonResponse({ ok: true, action: 'deleteUnit', deletedCode: unitCode });
}

function restoreUnitRow(spreadsheet, unitCode) {
  const trashSheet = spreadsheet.getSheetByName('Trash');
  const unitsSheet = spreadsheet.getSheetByName('Units') || spreadsheet.getSheets()[0];
  if (!trashSheet) return jsonResponse({ ok: false, error: 'Trash is empty' });
  ensureUnitDateColumns(unitsSheet);
  const record = getUnitRecord(trashSheet, unitCode);
  if (!record) return jsonResponse({ ok: false, error: 'Deleted unit not found' });
  const unitHeaders = unitsSheet.getDataRange().getValues()[0] || [];
  const archiveIndexes = getTrashArchiveDateIndexes(record.values, unitHeaders.length, unitHeaders.length + 2);
  const archiveValueIndexes = new Set([archiveIndexes.deletedAtIndex, archiveIndexes.deletedAtIndex + 1, archiveIndexes.expiresAtIndex]);
  const sourceHeaderIndexes = new Map(record.headers.map((header, index) => [String(header).trim().toLowerCase(), index]));
  const restoredValues = unitHeaders.map((header) => {
    const sourceIndex = sourceHeaderIndexes.get(String(header).trim().toLowerCase());
    return sourceIndex === undefined || archiveValueIndexes.has(sourceIndex) ? '' : record.values[sourceIndex] || '';
  });
  unitsSheet.appendRow(restoredValues);
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

function purgeAllTrashRows(spreadsheet) {
  const trashSheet = spreadsheet.getSheetByName('Trash');
  if (!trashSheet) return jsonResponse({ ok: true, action: 'purgeAllTrash', purgedCount: 0 });

  const purgedCount = Math.max(0, trashSheet.getLastRow() - 1);
  if (purgedCount) trashSheet.deleteRows(2, purgedCount);
  return jsonResponse({ ok: true, action: 'purgeAllTrash', purgedCount });
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
  if (String(values.status || '').trim() === 'For Diagnose' && !['Super Admin', 'Administrator', 'Technician'].includes(String(values.actorRole || '').trim())) {
    return jsonResponse({ ok: false, error: 'Only Super Admin, Administrator, and Technician roles can set For Diagnose' });
  }

  const sheet = ensureSheet(spreadsheet, 'Units');
  ensureUnitDateColumns(sheet);
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0] || [];
  const codeIndex = getCodeColumnIndex(headerRow);
  const targetCode = String(values.originalUnitCode || values.unitCode || '').trim();

  if (codeIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Code column not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  const requestedRowIndex = Number(values.originalRowIndex);
  const rowIndexes = Number.isInteger(requestedRowIndex) && requestedRowIndex >= 0 && requestedRowIndex < data.length - 1
    ? [requestedRowIndex + 1]
    : Array.from({ length: Math.max(0, data.length - 1) }, (_, index) => index + 1);

  for (const rowIndex of rowIndexes) {
    const currentCode = String(data[rowIndex][codeIndex] || '').trim();
    if (currentCode === targetCode) {
      const contactInfoIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'contact info');
      const technicianNotesIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'technician notes');
      const unitPriceIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'unit price');
      const urgentIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'urgent');
      const currentLocationIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'current location');
      const warehouseDateInIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'date sent to warehouse');
      const warehouseDateOutIndex = headerRow.findIndex((header) => String(header).trim().toLowerCase() === 'date left warehouse');
      const requestedContactInfo = String(values.contactInfo || '').trim();
      if (requestedContactInfo && !isValidContactInfo(requestedContactInfo)) {
        return jsonResponse({ ok: false, error: 'Contact Info must use +63 followed by 10 digits' });
      }
      if (!requestedContactInfo && contactInfoIndex >= 0) values.contactInfo = data[rowIndex][contactInfoIndex] || '';
      if (!String(values.unitPrice || '').trim() && unitPriceIndex >= 0) {
        values.unitPrice = data[rowIndex][unitPriceIndex] || '';
      }
      if (!canEditTechnicianNotes(values.actorRole) && technicianNotesIndex >= 0) {
        values.technicianNotes = data[rowIndex][technicianNotesIndex] || '';
      }
      if (urgentIndex >= 0 && ['true', '1', 'yes', 'urgent'].includes(String(data[rowIndex][urgentIndex] || '').trim().toLowerCase())) {
        values.isUrgent = 'TRUE';
      }
      const previousLocation = String(currentLocationIndex >= 0 ? data[rowIndex][currentLocationIndex] : '').trim().toLowerCase();
      const nextLocation = String(values.currentLocation || values.branchLocation || '').trim().toLowerCase();
      const wasInWarehouse = previousLocation === 'warehouse';
      const isInWarehouse = nextLocation === 'warehouse';
      const existingDateIn = warehouseDateInIndex >= 0 ? data[rowIndex][warehouseDateInIndex] || '' : '';
      const existingDateOut = warehouseDateOutIndex >= 0 ? data[rowIndex][warehouseDateOutIndex] || '' : '';
      const warehouseDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Manila', 'yyyy-MM-dd');
      values.warehouseDateIn = isInWarehouse ? (wasInWarehouse ? existingDateIn || warehouseDate : warehouseDate) : existingDateIn;
      values.warehouseDateOut = isInWarehouse ? '' : (wasInWarehouse ? warehouseDate : existingDateOut);
      const rowToWrite = buildRowForAction('units', values);
      const targetRange = sheet.getRange(rowIndex + 1, 1, 1, rowToWrite.length);
      targetRange.setValues([rowToWrite]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'updateUnit', updatedCode: targetCode })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unit not found for update' })).setMimeType(ContentService.MimeType.JSON);
}

function canEditTechnicianNotes(role) {
  return ['Technician', 'Administrator', 'Super Admin'].includes(String(role || '').trim());
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
      if (!canManageAccountStatus(values.actorRole)) {
        values.status = existingStatus;
      } else if (requestedStatus && !isValidAccountStatus(requestedStatus)) {
        return jsonResponse({ ok: false, error: 'Invalid account status' });
      } else {
        values.status = requestedStatus || existingStatus;
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
    if (!hasContactInfo) {
      sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
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
        'Date Purchased',
        'Date of Return',
        'Date Released',
        'Date Sent to Warehouse',
        'Date Left Warehouse',
        'Warranty',
        'Unit Problem',
        'Inclusion',
        'Uploaded Branch',
        'Technician Notes',
        'Urgent'
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
        values.dateReturn || values.returnDate || '',
        values.dateReleased || '',
        values.warehouseDateIn || '',
        values.warehouseDateOut || '',
        values.warranty || '',
        values.unitProblem || '',
        values.inclusion || '',
        values.uploadedBranch || values.branchLocation || '',
        values.technicianNotes || '',
        values.isUrgent || ''
      ];
  }
}

function ensureUnitDateColumns(sheet) {
  migrateUnitSheetSchema(sheet);
}

function migrateUnitSheetSchema(sheet) {
  const desiredHeaders = getHeadersForAction('units');
  const sourceWidth = Math.max(sheet.getLastColumn(), desiredHeaders.length);
  const sourceHeaders = sheet.getRange(1, 1, 1, sourceWidth).getValues()[0] || [];
  const hasCanonicalHeaders = desiredHeaders.every((header, index) => {
    return String(sourceHeaders[index] || '').trim().toLowerCase() === String(header).trim().toLowerCase();
  });
  if (hasCanonicalHeaders) {
    return;
  }
  const sourceData = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), sourceWidth).getValues();
  const aliases = {
    'date purchased': ['date purchased', 'date received', 'date of purchase'],
    'date of return': ['date of return', 'return date'],
    'date released': ['date released'],
    urgent: ['urgent', 'is urgent', 'urgent flag']
  };
  const normalizedHeaders = sourceHeaders.map((header) => String(header || '').trim().toLowerCase());
  const indexesFor = (header) => {
    const accepted = aliases[header.toLowerCase()] || [header.toLowerCase()];
    return normalizedHeaders.reduce((indexes, value, index) => {
      if (accepted.includes(value)) indexes.push(index);
      return indexes;
    }, []);
  };
  const canonicalData = [desiredHeaders];

  sourceData.slice(1).forEach((sourceRow) => {
    canonicalData.push(desiredHeaders.map((header) => {
      const indexes = indexesFor(header);
      if (header === 'Urgent') {
        return indexes.some((index) => ['true', '1', 'yes', 'urgent'].includes(String(sourceRow[index] || '').trim().toLowerCase())) ? 'TRUE' : '';
      }
      const index = indexes[0];
      return index === undefined ? '' : sourceRow[index] || '';
    }));
  });

  const width = Math.max(sheet.getMaxColumns(), desiredHeaders.length);
  if (width > desiredHeaders.length) {
    sheet.getRange(1, desiredHeaders.length + 1, sheet.getMaxRows(), width - desiredHeaders.length).clearContent();
  }
  sheet.getRange(1, 1, canonicalData.length, desiredHeaders.length).setValues(canonicalData);
}

function releaseUnitRow(spreadsheet, values) {
  const sheet = ensureSheet(spreadsheet, 'Units');
  ensureUnitDateColumns(sheet);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const codeIndex = headers.findIndex((header) => ['code', 'unit code'].includes(String(header).trim().toLowerCase()));
  const statusIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'status');
  let releasedIndex = headers.findIndex((header) => String(header).trim().toLowerCase() === 'date released');

  if (codeIndex < 0 || statusIndex < 0) return jsonResponse({ ok: false, error: 'Unit columns not found' });
  if (releasedIndex < 0) {
    releasedIndex = headers.length;
    sheet.getRange(1, releasedIndex + 1).setValue('Date Released');
  }

  const targetCode = String(values.unitCode || values.code || '').trim();
  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][codeIndex] || '').trim() !== targetCode) continue;

    const releaseDate = String(values.dateReleased || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Manila', 'yyyy-MM-dd')).trim();
    sheet.getRange(rowIndex + 1, statusIndex + 1).setValue('Released');
    sheet.getRange(rowIndex + 1, releasedIndex + 1).setValue(releaseDate);
    return jsonResponse({ ok: true, action: 'releaseUnit', unitCode: targetCode, dateReleased: releaseDate });
  }

  return jsonResponse({ ok: false, error: 'Unit not found for release' });
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
