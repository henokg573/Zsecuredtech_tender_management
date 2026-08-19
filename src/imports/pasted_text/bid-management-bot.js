// ============================================================
// BID MANAGEMENT TELEGRAM BOT — FULL FIXED VERSION
// Deploy Web App (Anyone) → Update WEBAPP_URL → completeBotSetup()
// ============================================================
const CONFIG = {
  SHEET_ID: '10mBLQAy2hlUQjzeCiDDemNlEtHQr8thShQ_PDNLFUtw',
  SHEET_NAME: 'Sheet1',
  TELEGRAM_BOT_TOKEN: '7880598262:AAHNjeJTod9zU4wrcmNYPeZj8ygfGoDMx80',
  TELEGRAM_CHAT_ID: '793034140',
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycby2oklQ7kiTyZ-kALVPp8bKaabTPtbY4HOOXP0WEhm4hb7dRzLeAHUHUTv5v7LlIONS/exec',
  ADMIN_EMAILS: ['henokgirma@zsecuredtech.com', 'info@zsecuredtech.com'],
  REMINDER_DAYS_BEFORE: [7, 3, 1],
  DOCUMENT_FOLDER_ID: '1hXrVpISzuEUlbtxBQejLWNtTKA3Emzw5',
  ADMIN_TELEGRAM_USERNAMES: ['henok_girmaa', 'yadetagonfa', 'NotAnymore404']
};
const TEAM_MEMBERS = {
  'Henok G': { email: 'henokgirma@zsecuredtech.com', telegram: '@NotAnymore404', role: 'admin' },
  'Yadeta G': { email: 'yadetagonfa@zsecuredtech.com', telegram: '@Yaa_Yeroo2026', role: 'manager' },
  'Gelassa A': { email: 'gelassaamsalu@zsecuredtech.com', telegram: '@JesuGi', role: 'staff' },
  'Faris M': { email: 'fmubarek@zsecuredtech.com', telegram: '@fmubarek', role: 'staff' }
};
// ============================================================
// WEB APP
// ============================================================
function doGet(e) {
  return ContentService.createTextOutput('Bid Bot is online ✅');
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('OK');
    }
    const update = JSON.parse(e.postData.contents);
    if (isDuplicateUpdate(update)) {
      return ContentService.createTextOutput('OK');
    }
    handleTelegramUpdate(update);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService.createTextOutput('OK');
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
function handleTelegramUpdate(update) {
  try {
    if (update.callback_query) handleCallbackQuery(update.callback_query);
    else if (update.message) handleIncomingMessage(update.message);
  } catch (err) {
    Logger.log('handleTelegramUpdate error: ' + err);
  }
}
// ============================================================
// UPDATE DEDUP + MENU MATCHING
// ============================================================
function getLastUpdateId() {
  return parseInt(PropertiesService.getScriptProperties().getProperty('LAST_UPDATE_ID') || '0', 10);
}
function setLastUpdateId(id) {
  PropertiesService.getScriptProperties().setProperty('LAST_UPDATE_ID', String(id));
}
function isDuplicateUpdate(update) {
  if (!update || update.update_id === undefined) return false;
  if (update.update_id <= getLastUpdateId()) return true;
  setLastUpdateId(update.update_id);
  return false;
}
function normalizeMenuText(text) {
  return String(text || '')
    .replace(/[\uFE0E\uFE0F\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function getMenuAction(text) {
  const t = normalizeMenuText(text);
  if (t.includes('All Bids')) return 'ALL_BIDS';
  if (t.includes('My Bids')) return 'MY_BIDS';
  if (t.includes('Closing Soon')) return 'CLOSING';
  if (t.includes('Pending Approvals')) return 'PENDING';
  if (t.includes('Dashboard')) return 'DASHBOARD';
  if (t.includes('Reminders')) return 'REMINDERS';
  if (t.includes('Admin Panel')) return 'ADMIN_PANEL';
  if (t.includes('Team Members')) return 'TEAM';
  if (t.includes('Unassigned')) return 'UNASSIGNED';
  if (t === 'Users' || t.endsWith('Users')) return 'USERS';
  if (t.includes('Broadcast')) return 'BROADCAST';
  if (t.includes('Add Bid')) return 'ADD_BID';
  if (t.includes('Edit Bid')) return 'EDIT_BID';
  if (t.includes('Help')) return 'HELP';
  if (t.includes('Menu')) return 'MENU';
  return null;
}
// ============================================================
// INCOMING MESSAGES
// ============================================================
function handleIncomingMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const from = msg.from || {};
  const username = from.username || '';
  const firstName = from.first_name || 'User';
  saveTelegramUser(from);
  const isAdmin = isAdminUser(username);
  const kb = menuKeyboard(isAdmin);
  if (text.startsWith('/start')) {
    sendWelcome(chatId, firstName, isAdmin);
    return;
  }
  if (text === '/menu') { sendMainMenu(chatId, username, isAdmin); return; }
  if (text === '/help') { sendHelp(chatId, isAdmin); return; }
  if (text === '/dashboard') { sendStatistics(chatId, isAdmin); return; }
  if (text === '/mybids') { sendMyAssignedBids(chatId, username, isAdmin); return; }
  if (text === '/closing') { sendClosingSoon(chatId, isAdmin); return; }
  if (text === '/pending') { sendPendingApprovals(chatId, isAdmin); return; }
  if (text === '/users') { if (!isAdmin) { denyAdmin(chatId); return; } listRegisteredUsers(chatId, isAdmin); return; }
  if (text === '/register') {
    sendTelegram(chatId, '✅ Registered!\nChat ID: ' + chatId + '\nTeam: ' + (getTeamNameByUsername(username) || 'Not linked'), kb);
    return;
  }
  if (text.startsWith('/view_')) { sendBidDetails(parseInt(text.split('_')[1], 10), chatId); return; }
  if (text.startsWith('/approve_')) { processApproval(parseInt(text.split('_')[1], 10), chatId, username, 'approve'); return; }
  if (text.startsWith('/reject_')) { processApproval(parseInt(text.split('_')[1], 10), chatId, username, 'reject'); return; }
  if (text.startsWith('/assign_')) { sendAssignmentMenu(chatId, parseInt(text.split('_')[1], 10)); return; }
  if (text.startsWith('/note_')) { sendNotePrompt(chatId, parseInt(text.split('_')[1], 10)); return; }
  if (text.startsWith('/addnote_')) {
    const parts = text.split('_');
    addNote(parseInt(parts[1], 10), chatId, username, parts.slice(2).join('_'));
    return;
  }
  if (text.startsWith('/edit_')) {
    if (!isAdmin) { denyAdmin(chatId); return; }
    processEditBid(text, chatId, isAdmin);
    return;
  }
  if (text.startsWith('/broadcast ')) {
    if (!isAdmin) { denyAdmin(chatId); return; }
    const count = broadcastToAll(text.substring('/broadcast '.length), isAdmin);
    sendTelegram(chatId, '✅ Broadcast sent to ' + count + ' user(s).', kb);
    return;
  }
  const action = getMenuAction(text);
  if (action) {
    switch (action) {
      case 'ALL_BIDS': sendAllBids(chatId, isAdmin); return;
      case 'MY_BIDS': sendMyAssignedBids(chatId, username, isAdmin); return;
      case 'CLOSING': sendClosingSoon(chatId, isAdmin); return;
      case 'PENDING': sendPendingApprovals(chatId, isAdmin); return;
      case 'DASHBOARD': sendStatistics(chatId, isAdmin); return;
      case 'REMINDERS': sendManualReminders(chatId, isAdmin); return;
      case 'ADMIN_PANEL': sendAdminPanel(chatId, isAdmin); return;
      case 'TEAM':
        if (!isAdmin) { denyAdmin(chatId); return; }
        sendTeamList(chatId, isAdmin); return;
      case 'USERS':
        if (!isAdmin) { denyAdmin(chatId); return; }
        listRegisteredUsers(chatId, isAdmin); return;
      case 'UNASSIGNED':
        if (!isAdmin) { denyAdmin(chatId); return; }
        sendUnassignedBids(chatId, isAdmin); return;
      case 'BROADCAST':
        if (!isAdmin) { denyAdmin(chatId); return; }
        sendTelegram(chatId, '📢 Send:\n/broadcast Your message here', kb); return;
      case 'ADD_BID':
        if (!isAdmin) { denyAdmin(chatId); return; }
        sendTelegram(chatId, '➕ Add bids in the Google Sheet.\nBot detects new rows every 5 min.', kb); return;
      case 'EDIT_BID':
        if (!isAdmin) { denyAdmin(chatId); return; }
        sendTelegram(chatId, '✏️ Example:\n/edit_5 Status In Progress\n/edit_5 priority high', kb); return;
      case 'HELP': sendHelp(chatId, isAdmin); return;
      case 'MENU': sendMainMenu(chatId, username, isAdmin); return;
    }
  }
  sendTelegram(chatId, 'Tap a button below or type /menu', kb);
}
function handleCallbackQuery(cq) {
  const chatId = cq.message.chat.id;
  const data = cq.data;
  const username = (cq.from && cq.from.username) ? cq.from.username : '';
  const isAdmin = isAdminUser(username);
  answerCallback(cq.id, 'Processing...');
  if (data.startsWith('view_')) {
    sendBidDetails(parseInt(data.split('_')[1], 10), chatId);
  } else if (data.startsWith('approve_')) {
    processApproval(parseInt(data.split('_')[1], 10), chatId, username, 'approve');
  } else if (data.startsWith('reject_')) {
    processApproval(parseInt(data.split('_')[1], 10), chatId, username, 'reject');
  } else if (data.startsWith('note_')) {
    const row = parseInt(data.split('_')[1], 10);
    sendTelegram(chatId, '📝 Use:\n/addnote_' + row + '_Your note here', menuKeyboard(isAdmin));
  } else if (data.startsWith('assign_')) {
    const parts = data.split('_');
    reassignBid(parseInt(parts[1], 10), chatId, parts.slice(2).join('_'));
    sendTelegram(chatId, '✅ Assignment updated.', menuKeyboard(isAdmin));
  }
}
// ============================================================
// KEYBOARDS
// ============================================================
function menuKeyboard(isAdmin) {
  if (isAdmin) {
    return {
      keyboard: [
        [{ text: '📋 All Bids' }, { text: '👤 My Bids' }, { text: '⏰ Closing Soon' }],
        [{ text: '📝 Pending Approvals' }, { text: '📊 Dashboard' }, { text: '📧 Reminders' }],
        [{ text: '👥 Team Members' }, { text: '📋 Unassigned' }, { text: '👥 Users' }],
        [{ text: '🔔 Broadcast' }, { text: '➕ Add Bid' }, { text: '✏️ Edit Bid' }],
        [{ text: '👥 Admin Panel' }, { text: 'ℹ️ Help' }, { text: '📋 Menu' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: true
    };
  }
  return {
    keyboard: [
      [{ text: '📋 All Bids' }, { text: '👤 My Bids' }, { text: '⏰ Closing Soon' }],
      [{ text: '📝 Pending Approvals' }, { text: '📊 Dashboard' }, { text: '📧 Reminders' }],
      [{ text: '👥 Admin Panel' }, { text: 'ℹ️ Help' }, { text: '📋 Menu' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true
  };
}
function bidActionKeyboard(rowIndex) {
  return {
    inline_keyboard: [[
      { text: '📄 View', callback_data: 'view_' + rowIndex },
      { text: '✅ Approve', callback_data: 'approve_' + rowIndex },
      { text: '❌ Reject', callback_data: 'reject_' + rowIndex }
    ], [
      { text: '📝 Note', callback_data: 'note_' + rowIndex }
    ]]
  };
}
// ============================================================
// USER REGISTRATION
// ============================================================
function getUsersSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName('BotUsers');
  if (!sheet) {
    sheet = ss.insertSheet('BotUsers');
    sheet.appendRow(['Telegram ID', 'Username', 'First Name', 'Last Name', 'Team Member', 'Registered At']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function saveTelegramUser(user) {
  if (!user || !user.id) return false;
  const userId = String(user.id);
  const teamName = getTeamNameByUsername(user.username || '');
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId) { rowNum = i + 1; break; }
  }
  const row = [userId, user.username || '', user.first_name || '', user.last_name || '', teamName, new Date().toISOString()];
  if (rowNum > 0) sheet.getRange(rowNum, 1, 1, 6).setValues([row]);
  else sheet.appendRow(row);
  if (teamName) PropertiesService.getScriptProperties().setProperty(teamKey(teamName), userId);
  return true;
}
function getRegisteredUsers() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    users.push({ id: String(data[i][0]), username: data[i][1], first_name: data[i][2], team_member: data[i][4] });
  }
  return users;
}
function teamKey(name) { return 'TEAM_' + name.replace(/\s/g, '_'); }
function getTeamNameByUsername(username) {
  if (!username) return '';
  const u = username.toLowerCase();
  for (const [name, info] of Object.entries(TEAM_MEMBERS)) {
    if (info.telegram.replace('@', '').toLowerCase() === u) return name;
  }
  return '';
}
function getTeamInfo(memberName) {
  const info = TEAM_MEMBERS[memberName] || {};
  let telegramId = '';
  const found = getRegisteredUsers().find(u => u.team_member === memberName);
  if (found) telegramId = found.id;
  if (!telegramId) telegramId = PropertiesService.getScriptProperties().getProperty(teamKey(memberName)) || '';
  return { email: info.email || '', telegram: info.telegram || memberName, role: info.role || 'staff', telegramId: telegramId };
}
function isAdminUser(username) {
  if (!username) return false;
  if (CONFIG.ADMIN_TELEGRAM_USERNAMES.map(u => u.toLowerCase()).includes(username.toLowerCase())) return true;
  for (const info of Object.values(TEAM_MEMBERS)) {
    if (info.telegram.replace('@', '').toLowerCase() === username.toLowerCase() && info.role === 'admin') return true;
  }
  return false;
}
function broadcastToAll(message, isAdmin) {
  const users = getRegisteredUsers();
  let sent = 0;
  users.forEach(u => {
    const r = sendTelegram(u.id, message, menuKeyboard(isAdmin));
    if (r && r.ok) sent++;
    Utilities.sleep(150);
  });
  return sent;
}
// ============================================================
// TELEGRAM API
// ============================================================
function sendTelegram(chatId, text, keyboard) {
  let result = sendTelegramApi('sendMessage', {
    chat_id: String(chatId),
    text: text,
    disable_web_page_preview: true,
    reply_markup: keyboard || undefined
  });
  if (!result || !result.ok) {
    result = sendTelegramApi('sendMessage', {
      chat_id: String(chatId),
      text: String(text).substring(0, 4000),
      reply_markup: keyboard || undefined
    });
  }
  return result;
}
function sendToGroup(text, keyboard) {
  return sendTelegram(CONFIG.TELEGRAM_CHAT_ID, text, keyboard);
}
function sendTelegramApi(method, payload) {
  const url = 'https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/' + method;
  const body = {};
  for (const k in payload) {
    if (payload[k] !== undefined) body[k] = payload[k];
  }
  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    const result = JSON.parse(res.getContentText());
    if (!result.ok) Logger.log('Telegram error: ' + res.getContentText());
    return result;
  } catch (e) {
    Logger.log('sendTelegramApi error: ' + e);
    return null;
  }
}
function answerCallback(queryId, text) {
  sendTelegramApi('answerCallbackQuery', { callback_query_id: queryId, text: text });
}
// ============================================================
// UI MESSAGES
// ============================================================
function sendWelcome(chatId, firstName, isAdmin) {
  sendTelegram(chatId,
    '🎉 Welcome ' + firstName + '!\n\nBid Management Bot is ready.\n\nUse the buttons below.\nType /help for commands.',
    menuKeyboard(isAdmin)
  );
}
function sendMainMenu(chatId, username, isAdmin) {
  sendTelegram(chatId, '🤖 Bid Management System\n\nHello @' + (username || 'user') + '\n\nSelect an option:', menuKeyboard(isAdmin));
}
function denyAdmin(chatId) {
  sendTelegram(chatId, '❌ Admin only.', menuKeyboard(false));
}
function sendAdminPanel(chatId, isAdmin) {
  if (!isAdmin) { denyAdmin(chatId); return; }
  sendTelegram(chatId, '👥 ADMIN PANEL\n\n/users\n/broadcast msg\n/edit_# field value', menuKeyboard(true));
}
function sendHelp(chatId, isAdmin) {
  sendTelegram(chatId,
    'ℹ️ HELP\n\n/menu /view_[#] /approve_[#] /reject_[#]\n/addnote_[#]_text\n/broadcast msg (admin)\n/register\n\nSupport: ' + CONFIG.ADMIN_EMAILS[0],
    menuKeyboard(isAdmin)
  );
}
function sendNotePrompt(chatId, row) {
  sendTelegram(chatId, '📝 Use:\n/addnote_' + row + '_Your note here');
}
function sendManualReminders(chatId, isAdmin) {
  sendTelegram(chatId, '📧 Sending reminders...', menuKeyboard(isAdmin));
  const count = sendDeadlineReminder();
  sendTelegram(chatId, '✅ Sent ' + count + ' reminder(s).', menuKeyboard(isAdmin));
}
// ============================================================
// SHEET DATA (CACHED)
// ============================================================
function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}
function getSheetDataCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('SHEET_DATA');
  if (cached) return JSON.parse(cached);
  const data = getSheet().getDataRange().getValues();
  cache.put('SHEET_DATA', JSON.stringify(data), 60);
  return data;
}
function clearSheetCache() {
  CacheService.getScriptCache().remove('SHEET_DATA');
}
function getBidRow(rowIndex) {
  const data = getSheetDataCached();
  if (rowIndex < 1 || rowIndex >= data.length) return null;
  const h = data[0], r = data[rowIndex];
  const g = (name) => { const i = h.indexOf(name); return i >= 0 ? r[i] : ''; };
  return {
    rowIndex: rowIndex,
    tenderName: g('Tender Name'),
    description: g('description of Tender'),
    bidType: g('Bid Type'),
    closingDate: g('closing date'),
    openingDate: g('bid opening date'),
    approvalReq: g('Approval'),
    requiredDocs: g('Required Documents'),
    status: g('Status'),
    assignedPerson: g('Assigned person') || 'Unassigned',
    submissionMode: g('Submission Mode'),
    notes: g('Notes'),
    priority: g('priority') || 'Medium',
    approvalStatus: g('Approval Status') || 'Pending',
    responseBy: g('Response By'),
    responseTime: g('Response Time'),
    aiSuggestion: g('AI Suggestion'),
    registeredData: g('Registered Data'),
    registeredBy: g('Registered by'),
    documentLink: g('Document Link'),
    bidLink: g('Bid Link')
  };
}
function buildBidMessage(bid, type) {
  const team = getTeamInfo(bid.assignedPerson);
  const titles = { new: '🆕 NEW BID', reminder: '⏰ DEADLINE REMINDER', approved: '✅ APPROVED', rejected: '❌ REJECTED' };
  let m = (titles[type] || '📋 BID UPDATE') + '\n━━━━━━━━━━━━━━━━━━━━━\n\n';
  m += '📌 ' + bid.tenderName + '\n';
  if (bid.description) m += '📝 ' + String(bid.description).substring(0, 200) + '\n';
  if (bid.bidType) m += '📂 ' + bid.bidType + '\n';
  m += '👤 ' + team.telegram + '\n';
  m += '📅 Closing: ' + fmtDate(bid.closingDate) + '\n';
  if (bid.openingDate) m += '📅 Opening: ' + fmtDate(bid.openingDate) + '\n';
  if (bid.requiredDocs) m += '📄 Docs: ' + String(bid.requiredDocs).substring(0, 100) + '\n';
  m += '📊 Status: ' + (bid.status || 'N/A') + '\n';
  m += '⭐ Priority: ' + bid.priority + '\n';
  m += '🔖 Approval: ' + bid.approvalStatus + '\n';
  if (bid.daysLeft !== undefined) m += '⏰ Days left: ' + bid.daysLeft + '\n';
  if (bid.notes) m += '📝 Notes: ' + String(bid.notes).substring(0, 100) + '\n';
  if (bid.bidLink) m += '🔗 ' + bid.bidLink + '\n';
  if (bid.documentLink) m += '📁 ' + bid.documentLink + '\n';
  m += '\n/view_' + bid.rowIndex + ' — View details';
  return m;
}
function notifyTeam(memberName, bid, type) {
  const team = getTeamInfo(memberName);
  const msg = buildBidMessage(bid, type);
  const subjects = { new: '🆕 New Bid: ', reminder: '⏰ Closing Soon: ', approved: '✅ Approved: ', rejected: '❌ Rejected: ' };
  sendToGroup(msg);
  if (team.telegramId) sendTelegram(team.telegramId, msg, menuKeyboard(false));
  if (team.email) sendEmail(team.email, (subjects[type] || 'Bid: ') + bid.tenderName, msg);
  if (type === 'new') {
    CONFIG.ADMIN_EMAILS.forEach(e => {
      if (e !== team.email) sendEmail(e, '🆕 New Bid: ' + bid.tenderName, msg);
    });
  }
}
function sendEmail(to, subject, bodyText) {
  try {
    const html = '<div style="font-family:Arial;max-width:600px;margin:auto">' +
      '<div style="background:#667eea;color:#fff;padding:20px;text-align:center;border-radius:8px"><h2>Bid Management System</h2></div>' +
      '<div style="padding:20px;background:#f5f5f5;margin-top:10px;border-radius:8px;white-space:pre-wrap">' + bodyText + '</div></div>';
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
  } catch (e) {
    Logger.log('Email FAILED ' + to + ': ' + e);
  }
}
// ============================================================
// BID DISPLAY
// ============================================================
function sendAllBids(chatId, isAdmin) {
  const data = getSheetDataCached();
  const h = data[0];
  const tc = h.indexOf('Tender Name'), cc = h.indexOf('closing date'), ac = h.indexOf('Assigned person');
  const sc = h.indexOf('Status'), ap = h.indexOf('Approval Status');
  let msg = '📋 ALL BIDS\n\n', count = 0;
  for (let i = 1; i < data.length; i++) {
    const name = tc >= 0 ? data[i][tc] : '';
    if (!name || !String(name).trim()) continue;
    count++;
    const team = getTeamInfo(ac >= 0 ? data[i][ac] : '');
    msg += count + '. ' + name + '\n👤 ' + team.telegram + ' | 📅 ' + fmtDate(cc >= 0 ? data[i][cc] : '') +
      '\n' + (sc >= 0 ? data[i][sc] : '') + ' | ' + (ap >= 0 ? data[i][ap] : '') + '\n/view_' + i + '\n\n';
    if (msg.length > 3500) { sendTelegram(chatId, msg); msg = ''; }
  }
  if (count === 0) msg = '📋 No bids found.';
  else msg += '✅ Total: ' + count;
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function sendBidDetails(rowIndex, chatId) {
  const bid = getBidRow(rowIndex);
  if (!bid) { sendTelegram(chatId, '❌ Bid not found'); return; }
  const team = getTeamInfo(bid.assignedPerson);
  let m = '📋 BID DETAILS\n━━━━━━━━━━━━━━━━━━━━━\n\n';
  m += '📌 ' + bid.tenderName + '\n';
  if (bid.description) m += '📝 ' + String(bid.description).substring(0, 500) + '\n';
  if (bid.bidType) m += '📂 ' + bid.bidType + '\n';
  m += '📅 Closing: ' + fmtDate(bid.closingDate) + '\n';
  if (bid.openingDate) m += '📅 Opening: ' + fmtDate(bid.openingDate) + '\n';
  if (bid.approvalReq) m += '✅ Approval req: ' + bid.approvalReq + '\n';
  if (bid.requiredDocs) m += '📄 Docs: ' + String(bid.requiredDocs).substring(0, 200) + '\n';
  m += '📊 Status: ' + bid.status + '\n👤 ' + team.telegram + '\n';
  if (bid.submissionMode) m += '📎 Mode: ' + bid.submissionMode + '\n';
  m += '⭐ Priority: ' + bid.priority + '\n🔖 Approval: ' + bid.approvalStatus + '\n';
  if (bid.responseBy) m += '✍️ By: ' + bid.responseBy + '\n';
  if (bid.responseTime) m += '⏰ Time: ' + bid.responseTime + '\n';
  if (bid.aiSuggestion) m += '🤖 AI: ' + String(bid.aiSuggestion).substring(0, 200) + '\n';
  if (bid.registeredData) m += '📅 Registered: ' + bid.registeredData + '\n';
  if (bid.registeredBy) m += '👤 By: ' + bid.registeredBy + '\n';
  if (bid.notes) m += '📝 Notes: ' + String(bid.notes).substring(0, 200) + '\n';
  if (bid.bidLink) m += '🔗 ' + bid.bidLink + '\n';
  if (bid.documentLink) m += '📁 ' + bid.documentLink + '\n';
  sendTelegram(chatId, m, bidActionKeyboard(rowIndex));
}
function sendMyAssignedBids(chatId, username, isAdmin) {
  const teamName = getTeamNameByUsername(username);
  if (!teamName) {
    sendTelegram(chatId, '👤 Not linked to a team member.\nYour @username must match TEAM_MEMBERS.', menuKeyboard(isAdmin));
    return;
  }
  const data = getSheetDataCached();
  const h = data[0], tc = h.indexOf('Tender Name'), cc = h.indexOf('closing date'), ac = h.indexOf('Assigned person'), sc = h.indexOf('Status');
  let msg = '👤 YOUR BIDS\n\n', count = 0;
  for (let i = 1; i < data.length; i++) {
    if (ac >= 0 && data[i][ac] === teamName) {
      count++;
      msg += '📌 ' + data[i][tc] + '\n📅 ' + fmtDate(cc >= 0 ? data[i][cc] : '') + ' | ' + (sc >= 0 ? data[i][sc] : '') + '\n/view_' + i + '\n\n';
    }
  }
  if (!count) msg = '👤 No assigned bids.';
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function sendClosingSoon(chatId, isAdmin) {
  const data = getSheetDataCached();
  const h = data[0], tc = h.indexOf('Tender Name'), cc = h.indexOf('closing date'), ac = h.indexOf('Assigned person');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let msg = '⏰ CLOSING SOON (7 days)\n\n', count = 0;
  for (let i = 1; i < data.length; i++) {
    if (cc < 0 || !data[i][cc]) continue;
    const cd = new Date(data[i][cc]); if (isNaN(cd.getTime())) continue;
    cd.setHours(0, 0, 0, 0);
    const days = Math.ceil((cd - now) / 86400000);
    if (days >= 0 && days <= 7) {
      count++;
      const team = getTeamInfo(ac >= 0 ? data[i][ac] : '');
      msg += '🔔 ' + days + 'd — ' + data[i][tc] + '\n👤 ' + team.telegram + '\n/view_' + i + '\n\n';
    }
  }
  if (!count) msg = '✅ Nothing closing in 7 days.';
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function sendPendingApprovals(chatId, isAdmin) {
  const data = getSheetDataCached();
  const h = data[0], tc = h.indexOf('Tender Name'), ap = h.indexOf('Approval Status'), ac = h.indexOf('Assigned person');
  let msg = '📝 PENDING APPROVALS\n\n', count = 0;
  for (let i = 1; i < data.length; i++) {
    const status = ap >= 0 ? String(data[i][ap] || '') : '';
    if (status === 'Approved' || status === 'REJECTED') continue;
    count++;
    const team = getTeamInfo(ac >= 0 ? data[i][ac] : '');
    msg += '⏳ ' + data[i][tc] + '\n👤 ' + team.telegram + '\n/approve_' + i + ' | /reject_' + i + '\n\n';
  }
  if (!count) msg = '✅ No pending approvals.';
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function sendUnassignedBids(chatId, isAdmin) {
  const data = getSheetDataCached();
  const h = data[0], tc = h.indexOf('Tender Name'), ac = h.indexOf('Assigned person'), cc = h.indexOf('closing date');
  let msg = '📋 UNASSIGNED\n\n', count = 0;
  for (let i = 1; i < data.length; i++) {
    const a = ac >= 0 ? data[i][ac] : '';
    if (a && String(a).trim()) continue;
    count++;
    msg += '📌 ' + data[i][tc] + '\n📅 ' + fmtDate(cc >= 0 ? data[i][cc] : '') + '\n/assign_' + i + '\n\n';
  }
  if (!count) msg = '✅ All assigned.';
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function sendStatistics(chatId, isAdmin) {
  const data = getSheetDataCached();
  const h = data[0], tc = h.indexOf('Tender Name'), ap = h.indexOf('Approval Status'), ac = h.indexOf('Assigned person'), sc = h.indexOf('Status');
  let total = 0, pending = 0, approved = 0, rejected = 0, unassigned = 0;
  for (let i = 1; i < data.length; i++) {
    const name = tc >= 0 ? data[i][tc] : '';
    if (!name || !String(name).trim()) continue;
    total++;
    const a = ap >= 0 ? data[i][ap] : '';
    if (a === 'Approved') approved++; else if (a === 'REJECTED') rejected++; else pending++;
    const asg = ac >= 0 ? data[i][ac] : '';
    if (!asg || !String(asg).trim()) unassigned++;
  }
  sendTelegram(chatId,
    '📊 DASHBOARD\n\nTotal: ' + total + '\nUnassigned: ' + unassigned +
    '\nPending: ' + pending + '\nApproved: ' + approved + '\nRejected: ' + rejected +
    '\nBot users: ' + getRegisteredUsers().length,
    menuKeyboard(isAdmin)
  );
}
function sendTeamList(chatId, isAdmin) {
  let msg = '👥 TEAM\n\n';
  for (const [name, info] of Object.entries(TEAM_MEMBERS)) {
    const tid = getTeamInfo(name).telegramId;
    msg += name + '\n📧 ' + info.email + '\n📱 ' + info.telegram + '\n';
    msg += tid ? '✅ Linked (ID: ' + tid + ')\n' : '⚠️ Must /start bot privately\n';
    msg += 'Role: ' + info.role + '\n\n';
  }
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
function listRegisteredUsers(chatId, isAdmin) {
  const users = getRegisteredUsers();
  if (!users.length) {
    sendTelegram(chatId, '📋 No registered users yet.\nEach person must /start the bot privately.', menuKeyboard(isAdmin));
    return;
  }
  let msg = '👥 REGISTERED (' + users.length + ')\n\n';
  users.forEach((u, i) => {
    msg += (i + 1) + '. ' + (u.username ? '@' + u.username : u.first_name) + ' (ID: ' + u.id + ')\n';
    if (u.team_member) msg += '   Team: ' + u.team_member + '\n';
  });
  sendTelegram(chatId, msg, menuKeyboard(isAdmin));
}
// ============================================================
// BID ACTIONS
// ============================================================
function processApproval(rowIndex, chatId, username, action) {
  clearSheetCache();
  const sheet = getSheet();
  const h = sheet.getDataRange().getValues()[0];
  const apCol = h.indexOf('Approval Status'), rbCol = h.indexOf('Response By'), rtCol = h.indexOf('Response Time');
  const statusVal = action === 'approve' ? 'Approved' : 'REJECTED';
  if (apCol >= 0) sheet.getRange(rowIndex + 1, apCol + 1).setValue(statusVal);
  if (rbCol >= 0) sheet.getRange(rowIndex + 1, rbCol + 1).setValue('@' + username);
  if (rtCol >= 0) sheet.getRange(rowIndex + 1, rtCol + 1).setValue(new Date().toLocaleString());
  clearSheetCache();
  const bid = getBidRow(rowIndex);
  bid.approvalStatus = statusVal;
  sendTelegram(chatId, (action === 'approve' ? '✅' : '❌') + ' ' + statusVal + '\n\n📌 ' + bid.tenderName, menuKeyboard(isAdminUser(username)));
  notifyTeam(bid.assignedPerson, bid, action === 'approve' ? 'approved' : 'rejected');
}
function addNote(rowIndex, chatId, username, note) {
  clearSheetCache();
  const sheet = getSheet();
  const h = sheet.getDataRange().getValues()[0];
  const nc = h.indexOf('Notes'), tc = h.indexOf('Tender Name');
  if (nc < 0) { sendTelegram(chatId, '❌ Notes column missing'); return; }
  const cur = sheet.getRange(rowIndex + 1, nc + 1).getValue() || '';
  sheet.getRange(rowIndex + 1, nc + 1).setValue((cur ? cur + '\n' : '') + '[' + new Date().toLocaleString() + '] @' + username + ': ' + note);
  clearSheetCache();
  const name = tc >= 0 ? sheet.getRange(rowIndex + 1, tc + 1).getValue() : 'Bid';
  sendTelegram(chatId, '✅ Note added to ' + name, menuKeyboard(isAdminUser(username)));
}
function sendAssignmentMenu(chatId, rowIndex) {
  const kb = { inline_keyboard: [] };
  for (const name of Object.keys(TEAM_MEMBERS)) {
    kb.inline_keyboard.push([{ text: name, callback_data: 'assign_' + rowIndex + '_' + name }]);
  }
  sendTelegram(chatId, '👥 Assign bid #' + rowIndex + ':', kb);
}
function reassignBid(rowIndex, chatId, memberName) {
  clearSheetCache();
  const sheet = getSheet();
  const ac = sheet.getDataRange().getValues()[0].indexOf('Assigned person');
  if (ac < 0) return;
  sheet.getRange(rowIndex + 1, ac + 1).setValue(memberName);
  clearSheetCache();
  const bid = getBidRow(rowIndex);
  bid.assignedPerson = memberName;
  notifyTeam(memberName, bid, 'new');
}
function processEditBid(text, chatId, isAdmin) {
  const match = text.match(/^\/edit_(\d+)\s+(\S+)\s+(.+)$/i);
  if (!match) { sendTelegram(chatId, '❌ Format: /edit_[row] [column] [value]', menuKeyboard(isAdmin)); return; }
  clearSheetCache();
  const row = parseInt(match[1], 10), field = match[2], val = match[3];
  const sheet = getSheet();
  const h = sheet.getDataRange().getValues()[0];
  const col = h.findIndex(c => String(c).toLowerCase() === field.toLowerCase());
  if (col < 0) { sendTelegram(chatId, '❌ Column not found: ' + field, menuKeyboard(isAdmin)); return; }
  sheet.getRange(row + 1, col + 1).setValue(val);
  clearSheetCache();
  sendTelegram(chatId, '✅ Updated row ' + row + ': ' + h[col] + ' = ' + val, menuKeyboard(isAdmin));
}
// ============================================================
// AUTOMATION
// ============================================================
function checkForNewBids() {
  clearSheetCache();
  const data = getSheetDataCached();
  if (data.length < 2) return 0;
  const h = data[0], tc = h.indexOf('Tender Name');
  const props = PropertiesService.getScriptProperties();
  let lastRow = parseInt(props.getProperty('lastProcessedRow') || '1', 10);
  let found = 0;
  for (let i = lastRow + 1; i < data.length; i++) {
    const name = tc >= 0 ? data[i][tc] : '';
    if (!name || !String(name).trim()) continue;
    found++;
    notifyTeam(getBidRow(i).assignedPerson, getBidRow(i), 'new');
    Utilities.sleep(500);
  }
  if (data.length - 1 > lastRow) props.setProperty('lastProcessedRow', String(data.length - 1));
  return found;
}
function sendDeadlineReminder() {
  clearSheetCache();
  const data = getSheetDataCached();
  const h = data[0], cc = h.indexOf('closing date'), sc = h.indexOf('Status');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let sent = 0;
  for (let i = 1; i < data.length; i++) {
    if (cc < 0 || !data[i][cc]) continue;
    const cd = new Date(data[i][cc]); if (isNaN(cd.getTime())) continue;
    cd.setHours(0, 0, 0, 0);
    const days = Math.round((cd - now) / 86400000);
    if (!CONFIG.REMINDER_DAYS_BEFORE.includes(days) || days < 0) continue;
    if (sc >= 0 && data[i][sc] === 'Completed') continue;
    const bid = getBidRow(i);
    bid.daysLeft = days;
    notifyTeam(bid.assignedPerson, bid, 'reminder');
    sent++;
    Utilities.sleep(500);
  }
  return sent;
}
// ============================================================
// SETUP & TESTS
// ============================================================
function setupAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkForNewBids').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sendDeadlineReminder').timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger('sendDeadlineReminder').timeBased().everyDays(1).atHour(14).create();
}
function setBotCommands() {
  sendTelegramApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'Start bot' },
      { command: 'menu', description: 'Open menu' },
      { command: 'register', description: 'Check registration' },
      { command: 'dashboard', description: 'Dashboard' },
      { command: 'mybids', description: 'My bids' },
      { command: 'help', description: 'Help' }
    ]
  });
}
function setupTelegramWebhook() {
  const webhookUrl = CONFIG.WEBAPP_URL;
  PropertiesService.getScriptProperties().deleteProperty('LAST_UPDATE_ID');
  UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/deleteWebhook?drop_pending_updates=true',
    { muteHttpExceptions: true }
  );
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/setWebhook',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      }),
      muteHttpExceptions: true
    }
  );
  const result = JSON.parse(res.getContentText());
  if (result.ok) {
    SpreadsheetApp.getUi().alert('✅ Webhook set + queue cleared!\n\n' + webhookUrl);
    sendToGroup('✅ Bot ready! Send /start privately.');
  } else {
    SpreadsheetApp.getUi().alert('❌ Failed: ' + result.description);
  }
  return result;
}
function fixWebhookNow() { setupTelegramWebhook(); }
function checkWebhookStatus() {
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/getWebhookInfo',
    { muteHttpExceptions: true }
  );
  const info = JSON.parse(res.getContentText());
  SpreadsheetApp.getUi().alert(JSON.stringify(info.result, null, 2));
  return info;
}
function completeBotSetup() {
  setupAllTriggers();
  setBotCommands();
  setupTelegramWebhook();
  SpreadsheetApp.getUi().alert('✅ Setup complete!\n\nSend /start privately, then tap one button at a time.');
}
function simulateStart() {
  handleTelegramUpdate({
    update_id: Date.now(),
    message: {
      message_id: 1,
      from: { id: 793034140, username: 'NotAnymore404', first_name: 'Henok' },
      chat: { id: 793034140, type: 'private' },
      text: '/start'
    }
  });
  SpreadsheetApp.getUi().alert('Done — check Telegram + BotUsers sheet.');
}
function testGroupMessage() {
  const r = sendToGroup('✅ Group test OK!');
  SpreadsheetApp.getUi().alert(r && r.ok ? '✅ Sent!' : '❌ Failed');
}
function testPrivateMessages() {
  const users = getRegisteredUsers();
  if (!users.length) {
    SpreadsheetApp.getUi().alert('❌ 0 users — send /start to bot privately first.');
    return;
  }
  let sent = 0;
  users.forEach(u => {
    if (sendTelegram(u.id, '✅ Private test OK!', menuKeyboard(false)).ok) sent++;
  });
  SpreadsheetApp.getUi().alert('Registered: ' + users.length + ' | Sent: ' + sent);
}
function testEmail() {
  sendEmail(CONFIG.ADMIN_EMAILS[0], '✅ Bid Bot Email Test', 'Email is working!');
  SpreadsheetApp.getUi().alert('Email sent to ' + CONFIG.ADMIN_EMAILS[0]);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🤖 Bid Bot')
    .addItem('🚀 Complete Setup', 'completeBotSetup')
    .addItem('🔧 Fix Webhook + Clear Queue', 'fixWebhookNow')
    .addItem('🔍 Check Webhook Status', 'checkWebhookStatus')
    .addItem('🧪 Simulate /start', 'simulateStart')
    .addItem('📱 Test Group', 'testGroupMessage')
    .addItem('📱 Test Private', 'testPrivateMessages')
    .addItem('📧 Test Email', 'testEmail')
    .addToUi();
}
// ============================================================
// UTILITIES
// ============================================================
function fmtDate(v) {
  if (!v) return 'Not set';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/dd/yyyy');
}