const conversationList = document.getElementById('conversationList');
const messageViewer = document.getElementById('messageViewer');
const messageSearchInput = document.getElementById('messageSearchInput');
const composeBackdrop = document.getElementById('composeBackdrop');
const composeForm = document.getElementById('composeForm');
const recipientSelect = document.getElementById('recipientSelect');
const recipientInput = document.getElementById('recipientInput');
const recipientChips = document.getElementById('recipientChips');
const recipientOptions = document.getElementById('recipientOptions');
const ccRecipientInput = document.getElementById('ccRecipientInput');
const bccRecipientInput = document.getElementById('bccRecipientInput');
const ccChips = document.getElementById('ccChips');
const bccChips = document.getElementById('bccChips');
const ccOptions = document.getElementById('ccOptions');
const bccOptions = document.getElementById('bccOptions');
const ccField = document.getElementById('ccField');
const bccField = document.getElementById('bccField');
const showCcButton = document.getElementById('showCcButton');
const showBccButton = document.getElementById('showBccButton');
const messageToast = document.getElementById('messageToast');
const messageAttachments = document.getElementById('messageAttachments');
const messageAttachmentList = document.getElementById('messageAttachmentList');
const messageBody = document.getElementById('messageBody');
const navUnreadCount = document.getElementById('navUnreadCount');
let messages = [];
let accounts = [];
let activeView = 'inbox';
let activeMessageId = '';
let recipientChoices = [];
let selectedRecipients = [];
let selectedCcRecipients = [];
let selectedBccRecipients = [];
let toastTimer = null;
let selectedAttachments = [];
let savedEditorRange = null;

function setRecipientCopyVisibility(field, button, visible) {
  if (!field || !button) return;
  field.hidden = !visible;
  button.setAttribute('aria-expanded', String(visible));
  if (visible) {
    const input = field.querySelector('input');
    if (input) input.focus();
  }
}

function copyRecipientState(kind) {
  return kind === 'cc'
    ? { selected: selectedCcRecipients, input: ccRecipientInput, chips: ccChips, options: ccOptions }
    : { selected: selectedBccRecipients, input: bccRecipientInput, chips: bccChips, options: bccOptions };
}

function renderCopyRecipientPicker(kind) {
  const state = copyRecipientState(kind);
  if (!state.input || !state.chips || !state.options) return;

  const otherSelected = kind === 'cc' ? selectedBccRecipients : selectedCcRecipients;
  const selectedUsernames = [...selectedRecipients, ...state.selected, ...otherSelected].map((recipient) => recipient.username.toLowerCase());
  state.chips.innerHTML = state.selected.map((recipient) => `<span class="recipient-chip">${escapeMessageHtml(recipient.name)}<button type="button" data-remove-copy-recipient="${escapeMessageHtml(recipient.username)}" data-copy-kind="${kind}" aria-label="Remove ${escapeMessageHtml(recipient.name)}">×</button></span>`).join('');

  const query = String(state.input.value || '').trim().toLowerCase();
  const matches = recipientChoices.filter((choice) => !selectedUsernames.includes(choice.username.toLowerCase()) && (!query || choice.name.toLowerCase().includes(query) || choice.username.toLowerCase().includes(query)));
  state.options.innerHTML = matches.length ? matches.map((choice) => `<button type="button" class="recipient-option" data-copy-recipient="${escapeMessageHtml(choice.username)}" data-copy-kind="${kind}"><span>${escapeMessageHtml(choice.name)}</span></button>`).join('') : '<div class="recipient-empty">No matching recipients</div>';
  state.options.hidden = document.activeElement !== state.input || !matches.length;
}

function showMessageToast(message) {
  if (!messageToast) return;
  messageToast.textContent = message;
  messageToast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => messageToast.classList.remove('visible'), 4000);
}

function currentUsername() {
  return String(localStorage.getItem('unitflowUser') || '').trim();
}

function currentName() {
  return String(localStorage.getItem('unitflowFullName') || currentUsername()).trim();
}

function messageValue(message, ...keys) {
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(message, candidate));
  return key ? message[key] : '';
}

function escapeMessageHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function sanitizeMessageHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'FONT', 'BLOCKQUOTE']);

  const clean = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...Array.from(child.childNodes));
        } else {
          Array.from(child.attributes).forEach((attribute) => {
            if (child.tagName === 'FONT' && ['face', 'size'].includes(attribute.name.toLowerCase())) return;
            child.removeAttribute(attribute.name);
          });
          clean(child);
        }
      }
    });
  };

  clean(template.content);
  return template.innerHTML;
}

function getEditorHtml(editor) {
  return editor ? sanitizeMessageHtml(editor.innerHTML).trim() : '';
}

function getEditorText(editor) {
  return editor ? String(editor.textContent || '').replace(/\u00a0/g, ' ').trim() : '';
}

function formatToolbarMarkup() {
  return '<select data-format-command="fontName" aria-label="Font"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Courier New">Courier New</option></select><select data-format-command="fontSize" aria-label="Text size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Huge</option></select><button type="button" data-format-command="bold" aria-label="Bold"><strong>B</strong></button><button type="button" data-format-command="italic" aria-label="Italic"><em>I</em></button><button type="button" data-format-command="underline" aria-label="Underline"><u>U</u></button><label class="format-color" aria-label="Text color">A<input type="color" data-format-command="foreColor" value="#121a16" /></label><button type="button" data-format-command="justifyLeft" aria-label="Align left">≡</button><button type="button" data-format-command="justifyCenter" aria-label="Align center">≡</button><button type="button" data-format-command="justifyRight" aria-label="Align right">≡</button><button type="button" data-format-command="insertUnorderedList" aria-label="Bulleted list">•</button><button type="button" data-format-command="insertOrderedList" aria-label="Numbered list">1.</button><button type="button" data-format-command="outdent" aria-label="Decrease indent">←</button><button type="button" data-format-command="indent" aria-label="Increase indent">→</button><button type="button" data-format-command="formatBlock" data-format-value="blockquote" aria-label="Quote">❝</button><button type="button" data-format-command="strikeThrough" aria-label="Strikethrough"><s>S</s></button><button type="button" data-format-command="removeFormat" aria-label="Clear formatting">Tx</button>';
}

function decorateFormatToolbarIcons(root = document) {
  const shortcuts = {
    Bold: 'Ctrl+B',
    Italic: 'Ctrl+I',
    Underline: 'Ctrl+U',
    'Bulleted list': 'Ctrl+Shift+8',
    'Numbered list': 'Ctrl+Shift+7'
  };
  const iconMap = {
    Bold: '<text x="3" y="15" font-size="15" font-weight="800">B</text>',
    Italic: '<text x="6" y="15" font-size="15" font-style="italic" font-weight="800">I</text>',
    Underline: '<text x="3" y="14" font-size="14" font-weight="800">U</text><path d="M3 17h12" />',
    'Align left': '<path d="M2 4h16M2 8h12M2 12h16M2 16h9" />',
    'Align center': '<path d="M2 4h16M5 8h10M2 12h16M5 16h10" />',
    'Align right': '<path d="M2 4h16M6 8h12M2 12h16M9 16h9" />',
    'Bulleted list': '<path d="M7 5h11M7 12h11M7 19h11" /><circle cx="3" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="3" cy="19" r="1" fill="currentColor" stroke="none" />',
    'Numbered list': '<text x="1" y="7" font-size="6">1</text><text x="1" y="14" font-size="6">2</text><text x="1" y="21" font-size="6">3</text><path d="M8 5h10M8 12h10M8 19h10" />',
    'Decrease indent': '<path d="M8 5h10M8 12h10M8 19h10M2 12h6M5 9l-3 3 3 3" />',
    'Increase indent': '<path d="M2 5h10M2 12h10M2 19h10M17 12h-6M14 9l3 3-3 3" />',
    Quote: '<path d="M4 5h6v6H6v4h4M14 5h6v6h-4v4h4" />',
    Strikethrough: '<text x="3" y="15" font-size="14" font-weight="800">S</text><path d="M2 10h16" />',
    'Clear formatting': '<text x="2" y="15" font-size="10" font-weight="800">Tx</text><path d="M15 3l3 3M18 3l-3 3" />'
  };

  root.querySelectorAll('.format-toolbar select[data-format-command="fontSize"]').forEach((select) => {
    if (select.parentElement.classList.contains('font-size-picker')) return;
    const parent = select.parentElement;
    const wrapper = document.createElement('span');
    wrapper.className = 'font-size-picker';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'font-size-trigger';
    button.setAttribute('aria-label', 'Text size');
    button.dataset.tooltip = 'Text size';
    button.innerHTML = '<svg viewBox="0 0 24 22" aria-hidden="true"><text x="1" y="15" font-size="14" font-weight="800">T</text><text x="12" y="17" font-size="11" font-weight="800">t</text><path d="M19 8l2 2 2-2" /></svg>';
    const menu = document.createElement('div');
    menu.className = 'font-size-menu';
    menu.hidden = true;
    Array.from(select.options).forEach((option) => {
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.textContent = option.textContent;
      menuItem.dataset.sizeValue = option.value;
      menuItem.classList.toggle('selected', option.selected);
      menuItem.addEventListener('click', () => {
        select.value = menuItem.dataset.sizeValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        menu.querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === menuItem));
        menu.hidden = true;
      });
      menu.appendChild(menuItem);
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    parent.replaceChild(wrapper, select);
    wrapper.append(button, select, menu);
    select.hidden = true;
    select.removeAttribute('aria-label');
  });

  root.querySelectorAll('.format-toolbar button[aria-label]').forEach((button) => {
    const label = button.getAttribute('aria-label');
    button.dataset.tooltip = shortcuts[label] ? `${label} (${shortcuts[label]})` : label;
    button.removeAttribute('title');
    const icon = iconMap[label];
    if (!icon) return;
    button.innerHTML = `<svg viewBox="0 0 20 22" aria-hidden="true" focusable="false">${icon}</svg>`;
  });
  root.querySelectorAll('.format-toolbar select[aria-label], .format-toolbar input[aria-label]').forEach((control) => {
    control.dataset.tooltip = control.getAttribute('aria-label');
    control.removeAttribute('title');
  });
}

function updateFormatToolbarState(editor) {
  if (!editor) return;
  const toolbar = editor.previousElementSibling;
  if (!toolbar || !toolbar.classList.contains('format-toolbar')) return;

  toolbar.querySelectorAll('button[data-format-command]').forEach((button) => {
    const command = button.dataset.formatCommand;
    const active = command === 'formatBlock'
      ? document.queryCommandValue(command).toLowerCase() === String(button.dataset.formatValue || '').toLowerCase()
      : document.queryCommandState(command);
    button.classList.toggle('is-active', Boolean(active));
    button.setAttribute('aria-pressed', String(Boolean(active)));
  });
}

function editorFromSelection() {
  const selection = window.getSelection();
  const node = selection && selection.anchorNode;
  return node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('.rich-text-editor');
}

function saveEditorSelection(editor) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) return;
  savedEditorRange = selection.getRangeAt(0).cloneRange();
}

function restoreEditorSelection(editor) {
  if (!savedEditorRange || !editor.contains(savedEditorRange.commonAncestorContainer)) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}

function messageDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isRead(message) {
  return ['true', 'yes', '1'].includes(String(messageValue(message, 'Read', 'read')).toLowerCase());
}

function messageId(message) {
  return String(messageValue(message, 'Message ID', 'messageId', 'message id') || '').trim();
}

function messageRecipients(message) {
  return [messageValue(message, 'Recipient', 'recipient'), messageValue(message, 'Cc', 'cc'), messageValue(message, 'Bcc', 'bcc')]
    .join(',')
    .split(',')
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean);
}

function messageCcRecipients(message) {
  return String(messageValue(message, 'Cc', 'cc') || '')
    .split(',')
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean);
}

function messageBccRecipients(message) {
  return String(messageValue(message, 'Bcc', 'bcc') || '')
    .split(',')
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean);
}

function messageRecipientNames(message) {
  return String(messageValue(message, 'Recipient Name', 'recipientName') || '')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function messageCcNames(message) {
  return String(messageValue(message, 'Cc Name', 'ccName') || '')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function messageRecipientDisplay(message) {
  const toNames = messageRecipientNames(message);
  const ccNames = messageCcNames(message);
  return [
    toNames.join(', ') || messageValue(message, 'Recipient', 'recipient'),
    ccNames.length ? `Cc ${ccNames.join(', ')}` : ''
  ].filter(Boolean).join(', ');
}

function includesMessageRecipient(message, username) {
  return messageRecipients(message).includes(String(username || '').trim().toLowerCase());
}

function messageParticipantChoices(thread) {
  const currentUser = currentUsername().toLowerCase();
  const participants = new Map();

  thread.forEach((message) => {
    const sender = String(messageValue(message, 'Sender', 'sender') || '').trim();
    const senderName = String(messageValue(message, 'Sender Name', 'senderName') || sender).trim();
    if (sender && sender.toLowerCase() !== currentUser) participants.set(sender.toLowerCase(), { username: sender, name: senderName });

    const recipients = [
      ...String(messageValue(message, 'Recipient', 'recipient') || '').split(','),
      ...messageCcRecipients(message)
    ].map((recipient) => recipient.trim().toLowerCase()).filter(Boolean);
    const recipientNames = [...messageRecipientNames(message), ...messageCcNames(message)];
    recipients.forEach((recipient, index) => {
      if (recipient !== currentUser && !participants.has(recipient)) {
        participants.set(recipient, { username: recipient, name: recipientNames[index] || recipient });
      }
    });
  });

  return Array.from(participants.values());
}

function messageReplyAllFields(thread) {
  const participants = messageParticipantChoices(thread);
  const latestMessage = thread[thread.length - 1];
  const currentUser = currentUsername().toLowerCase();
  const latestSender = String(messageValue(latestMessage, 'Sender', 'sender') || '').trim();
  const toRecipient = participants.find((participant) => participant.username.toLowerCase() === latestSender.toLowerCase())
    || participants[0];
  const ccRecipients = participants.filter((participant) => participant !== toRecipient);

  if (toRecipient && toRecipient.username.toLowerCase() === currentUser) return { to: '', cc: ccRecipients };
  return { to: toRecipient ? [toRecipient] : [], cc: ccRecipients };
}

function messageReplyChoices(thread) {
  const currentUser = currentUsername().toLowerCase();
  const latestMessage = thread[thread.length - 1];
  if (!latestMessage) return [];

  const sender = String(messageValue(latestMessage, 'Sender', 'sender') || '').trim();
  if (sender && sender.toLowerCase() !== currentUser) {
    return [{
      username: sender,
      name: String(messageValue(latestMessage, 'Sender Name', 'senderName') || sender).trim()
    }];
  }

  const recipientNames = messageRecipientNames(latestMessage);
  return messageRecipients(latestMessage)
    .map((recipient, index) => ({ username: recipient, name: recipientNames[index] || recipient }))
    .filter((recipient) => recipient.username !== currentUser);
}

function threadId(message) {
  return String(messageValue(message, 'Thread ID', 'threadId', 'thread id') || messageId(message)).trim();
}

function canViewMessage(message) {
  const username = currentUsername().toLowerCase();
  const sender = String(messageValue(message, 'Sender', 'sender') || '').trim().toLowerCase();
  return sender === username || includesMessageRecipient(message, username);
}

function getThreadMessages(id) {
  return messages
    .filter((message) => threadId(message) === id && canViewMessage(message))
    .sort((first, second) => new Date(messageValue(first, 'Sent At', 'sentAt')) - new Date(messageValue(second, 'Sent At', 'sentAt')));
}

function filteredMessages() {
  const username = currentUsername().toLowerCase();
  const search = String(messageSearchInput ? messageSearchInput.value : '').trim().toLowerCase();
  const receivedThreadIds = new Set(messages
    .filter((message) => includesMessageRecipient(message, username))
    .map((message) => threadId(message)));
  const visibleMessages = messages
    .filter((message) => {
      const sender = String(messageValue(message, 'Sender', 'sender')).toLowerCase();
      return activeView === 'inbox'
        ? includesMessageRecipient(message, username) || (sender === username && receivedThreadIds.has(threadId(message)))
        : sender === username;
    })
    .filter((message) => !search || [messageValue(message, 'Subject', 'subject'), messageValue(message, 'Body', 'body'), messageValue(message, 'Sender Name', 'senderName'), messageValue(message, 'Recipient Name', 'recipientName')].join(' ').toLowerCase().includes(search));

  const threadMap = new Map();
  visibleMessages.forEach((message) => {
    const id = threadId(message);
    const existing = threadMap.get(id) || [];
    existing.push(message);
    threadMap.set(id, existing);
  });

  return Array.from(threadMap.values())
    .map((thread) => thread.sort((first, second) => new Date(messageValue(second, 'Sent At', 'sentAt')) - new Date(messageValue(first, 'Sent At', 'sentAt')))[0])
    .sort((first, second) => new Date(messageValue(second, 'Sent At', 'sentAt')) - new Date(messageValue(first, 'Sent At', 'sentAt')));
}

function renderList() {
  const rows = filteredMessages();
  if (!rows.length) {
    conversationList.innerHTML = `<div class="empty-state">${activeView === 'inbox' ? 'Your inbox is clear.' : 'No sent messages yet.'}</div>`;
    return;
  }

  conversationList.innerHTML = rows.map((message) => {
    const id = messageId(message);
    const thread = getThreadMessages(threadId(message));
    const sender = messageValue(message, 'Sender Name', 'senderName') || messageValue(message, 'Sender', 'sender');
    const recipient = messageRecipientDisplay(message);
    const person = activeView === 'inbox' ? sender : `To ${recipient}`;
    const subject = messageValue(message, 'Subject', 'subject') || '(No subject)';
    const unread = thread.some((item) => includesMessageRecipient(item, currentUsername()) && !isRead(item));
    return `<button class="conversation-item ${id === activeMessageId ? 'selected' : ''} ${unread && activeView === 'inbox' ? 'unread' : ''}" data-message-id="${escapeMessageHtml(id)}" type="button"><span class="conversation-person">${escapeMessageHtml(person)}${thread.length > 1 ? ` <span class="thread-count">${thread.length}</span>` : ''}</span><span class="conversation-subject">${escapeMessageHtml(subject)}</span><span class="conversation-date">${escapeMessageHtml(messageDate(messageValue(message, 'Sent At', 'sentAt')))}</span></button>`;
  }).join('');
}

function renderViewer(message) {
  if (!message) {
    messageViewer.innerHTML = '<div class="message-placeholder"><span class="message-placeholder-icon">✉</span><h2>Select a message</h2><p>Choose a conversation to read the full update.</p></div>';
    return;
  }

  const thread = getThreadMessages(threadId(message));
  const subject = messageValue(thread[0], 'Subject', 'subject') || '(No subject)';
  const replyTarget = thread[thread.length - 1];
  const messageCards = thread.map((item, index) => {
    const sender = messageValue(item, 'Sender Name', 'senderName') || messageValue(item, 'Sender', 'sender');
    const recipient = messageRecipientDisplay(item);
    let attachments = [];
    try { attachments = JSON.parse(messageValue(item, 'Attachments', 'attachments') || '[]'); } catch (error) { attachments = []; }
    const attachmentLinks = Array.isArray(attachments) && attachments.length ? `<div class="message-attachments">${attachments.map((attachment) => `<a href="${escapeMessageHtml(attachment.url || '#')}" target="_blank" rel="noopener">${escapeMessageHtml(attachment.name || 'Attachment')}</a>`).join('')}</div>` : '';
    const isLatest = index === thread.length - 1;
    return `<div class="thread-message ${isLatest ? 'expanded' : 'collapsed'}" data-thread-message-id="${escapeMessageHtml(messageId(item))}"><button class="thread-message-header" type="button" data-toggle-thread-message="${escapeMessageHtml(messageId(item))}"><span class="user-avatar">${escapeMessageHtml(String(sender).slice(0, 2).toUpperCase())}</span><span class="thread-message-sender">${escapeMessageHtml(sender)}</span><span class="message-arrow">→</span><span class="thread-message-recipient">${escapeMessageHtml(recipient)}</span><time>${escapeMessageHtml(messageDate(messageValue(item, 'Sent At', 'sentAt')))}</time><span class="thread-chevron" aria-hidden="true">⌄</span></button><div class="thread-message-content"><div class="message-body">${sanitizeMessageHtml(messageValue(item, 'Body', 'body'))}</div>${attachmentLinks}</div></div>`;
  }).join('');
  const replyRecipients = messageParticipantChoices(thread);
  const replyButton = `<button class="action-btn reply-message-btn" type="button" data-reply-mode="reply" data-reply-message-id="${escapeMessageHtml(messageId(replyTarget))}">↩ Reply</button>`;
  const replyAllButton = replyRecipients.length > 1 ? `<button class="action-btn reply-message-btn" type="button" data-reply-mode="reply-all" data-reply-message-id="${escapeMessageHtml(messageId(replyTarget))}">↩↩ Reply all</button>` : '';
  const defaultReplyRecipients = messageReplyChoices(thread);
  const defaultReplyLabel = defaultReplyRecipients.map((recipient) => recipient.name).join(', ') || messageValue(replyTarget, 'Sender Name', 'senderName') || messageValue(replyTarget, 'Sender', 'sender');
  messageViewer.innerHTML = `<div class="message-detail"><div class="message-detail-top"><div><div class="eyebrow">Conversation</div><h2>${escapeMessageHtml(subject)}</h2></div><div class="message-reply-actions">${replyButton}${replyAllButton}</div></div><div class="thread-messages">${messageCards}</div><form class="inline-reply-form" data-inline-reply-id="${escapeMessageHtml(messageId(replyTarget))}" data-reply-mode="reply" hidden><label for="inlineReplyBody">Reply to ${escapeMessageHtml(defaultReplyLabel)}</label><div class="format-toolbar" role="toolbar" aria-label="Text formatting"><button type="button" data-format-command="bold" aria-label="Bold"><strong>B</strong></button><button type="button" data-format-command="italic" aria-label="Italic"><em>I</em></button><button type="button" data-format-command="underline" aria-label="Underline"><u>U</u></button><button type="button" data-format-command="insertUnorderedList" aria-label="Bulleted list">•</button><button type="button" data-format-command="insertOrderedList" aria-label="Numbered list">1.</button><button type="button" data-format-command="removeFormat" aria-label="Clear formatting">Tx</button></div><div id="inlineReplyBody" class="rich-text-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write your reply…"></div><label class="attachment-button" for="inlineReplyAttachments">Attach files</label><input id="inlineReplyAttachments" type="file" multiple hidden /><div class="attachment-list" id="inlineReplyAttachmentList"></div><div class="inline-reply-actions"><button class="action-btn" type="button" data-cancel-reply>Cancel</button><button class="action-btn primary" type="submit">Send reply</button></div></form></div>`;
  const replyToolbar = messageViewer.querySelector('.inline-reply-form .format-toolbar');
  if (replyToolbar) {
    replyToolbar.innerHTML = formatToolbarMarkup();
    decorateFormatToolbarIcons(replyToolbar);
  }
  window.requestAnimationFrame(() => {
    const latestMessage = messageViewer.querySelector('.thread-message.expanded:last-child');
    if (latestMessage) latestMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

async function selectMessage(id) {
  const message = messages.find((item) => messageId(item) === id);
  if (!message) return;
  activeMessageId = id;
  renderList();
  renderViewer(message);
  const currentUser = currentUsername().toLowerCase();
  const unreadThreadMessages = getThreadMessages(threadId(message)).filter((item) => {
    return includesMessageRecipient(item, currentUser) && !isRead(item);
  });

  if (activeView === 'inbox' && unreadThreadMessages.length) {
    unreadThreadMessages.forEach((item) => { item.Read = 'TRUE'; });
    renderList();
    updateUnreadCount();

    const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
    if (appScriptUrl) {
      await Promise.all(unreadThreadMessages.map((item) => fetch(appScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'markMessageRead', messageId: messageId(item) }).toString()
      }).catch((error) => console.warn(`Unable to mark message ${messageId(item)} read:`, error))));
    }
    if (typeof updateMessageNavCount === 'function') await updateMessageNavCount();
  }
}

function updateUnreadCount() {
  const unread = messages.filter((message) => includesMessageRecipient(message, currentUsername()) && !isRead(message)).length;
  if (!navUnreadCount) return;
  navUnreadCount.hidden = unread === 0;
  navUnreadCount.textContent = unread > 9 ? '9+' : String(unread);
}

async function loadMessages() {
  try {
    messages = await DATA.fetchMessages();
    renderList();
    updateUnreadCount();
    renderViewer(null);
  } catch (error) {
    console.error(error);
    conversationList.innerHTML = '<div class="empty-state">Unable to load messages. Check the Apps Script deployment.</div>';
  }
}

async function loadRecipients() {
  try {
    accounts = await DATA.fetchAccounts();
    const username = currentUsername().toLowerCase();
    recipientChoices = accounts.filter((account) => String(account.username || account.userName || '').toLowerCase() !== username).map((account) => {
      const accountUsername = account.username || account.userName || account.accountUsername || '';
      const name = account.fullName || account.fullname || account.name || accountUsername;
      return { username: String(accountUsername).trim(), name: String(name).trim() };
    });
    renderRecipientPicker();
  } catch (error) {
    recipientChoices = [];
    renderRecipientPicker();
  }
}

async function openCompose(replyToMessage = null) {
  composeForm.reset();
  messageBody.innerHTML = '';
  selectedRecipients = [];
  selectedCcRecipients = [];
  selectedBccRecipients = [];
  if (ccRecipientInput) ccRecipientInput.value = '';
  if (bccRecipientInput) bccRecipientInput.value = '';
  setRecipientCopyVisibility(ccField, showCcButton, false);
  setRecipientCopyVisibility(bccField, showBccButton, false);
  selectedAttachments = [];
  renderAttachmentList(messageAttachmentList, selectedAttachments);
  document.getElementById('messageSubject').value = '';
  renderRecipientPicker();
  composeBackdrop.classList.add('visible');
  composeBackdrop.setAttribute('aria-hidden', 'false');
  await loadRecipients();
  if (!replyToMessage) {
    document.getElementById('messageSubject').value = '';
  }

  if (replyToMessage) {
    const replyRecipients = messageParticipantChoices(getThreadMessages(threadId(replyToMessage)));
    const originalSubject = String(messageValue(replyToMessage, 'Subject', 'subject') || '').trim();
    selectedRecipients = replyRecipients
      .map((replyRecipient) => recipientChoices.find((choice) => choice.username.toLowerCase() === replyRecipient.username.toLowerCase()))
      .filter(Boolean);
    renderRecipientPicker();
    document.getElementById('messageSubject').value = originalSubject.toLowerCase().startsWith('re:') ? originalSubject : `Re: ${originalSubject}`;
  }
}

function closeCompose() {
  composeBackdrop.classList.remove('visible');
  composeBackdrop.setAttribute('aria-hidden', 'true');
}

async function sendMessage(event) {
  event.preventDefault();
  const formData = new FormData(composeForm);
  const recipients = selectedRecipients.filter((recipient) => recipient.username);
  const ccRecipients = selectedCcRecipients.filter((recipient) => recipient.username);
  const bccRecipients = selectedBccRecipients.filter((recipient) => recipient.username);
  const subject = String(formData.get('subject') || '').trim();
  const body = getEditorHtml(messageBody);
  const bodyText = getEditorText(messageBody);
  if ((!recipients.length && !ccRecipients.length && !bccRecipients.length) || !subject || !bodyText) return;

  try {
    await postMessage({
      recipient: recipients.map((recipient) => recipient.username).join(','),
      recipientName: recipients.map((recipient) => recipient.name).join(','),
      cc: ccRecipients.map((recipient) => recipient.username).join(','),
      ccName: ccRecipients.map((recipient) => recipient.name).join(','),
      bcc: bccRecipients.map((recipient) => recipient.username).join(','),
      bccName: bccRecipients.map((recipient) => recipient.name).join(','),
      subject,
      body,
      attachments: selectedAttachments
    });
    closeCompose();
    showMessageToast('Message sent successfully');
    activeView = 'sent';
    document.querySelectorAll('.message-tab').forEach((tab) => { tab.classList.toggle('active', tab.dataset.view === activeView); tab.setAttribute('aria-selected', String(tab.dataset.view === activeView)); });
    await loadMessages();
  } catch (error) {
    console.error(error);
    showAppPopup('Message could not be sent. Please confirm the Apps Script deployment.');
  }
}

function renderRecipientPicker() {
  if (!recipientChips || !recipientOptions || !recipientSelect) return;

  recipientChips.innerHTML = selectedRecipients.map((recipient) => `<span class="recipient-chip">${escapeMessageHtml(recipient.name)}<button type="button" data-remove-recipient="${escapeMessageHtml(recipient.username)}" aria-label="Remove ${escapeMessageHtml(recipient.name)}">×</button></span>`).join('');
  recipientSelect.innerHTML = selectedRecipients.map((recipient) => `<option value="${escapeMessageHtml(recipient.username)}" selected>${escapeMessageHtml(recipient.name)}</option>`).join('');

  const query = String(recipientInput ? recipientInput.value : '').trim().toLowerCase();
  const selectedCopyRecipients = [...selectedCcRecipients, ...selectedBccRecipients];
  const matches = recipientChoices.filter((choice) => ![...selectedRecipients, ...selectedCopyRecipients].some((selected) => selected.username.toLowerCase() === choice.username.toLowerCase()) && (!query || choice.name.toLowerCase().includes(query) || choice.username.toLowerCase().includes(query)));
  recipientOptions.innerHTML = matches.length ? matches.map((choice) => `<button type="button" class="recipient-option" data-recipient="${escapeMessageHtml(choice.username)}"><span>${escapeMessageHtml(choice.name)}</span></button>`).join('') : '<div class="recipient-empty">No matching recipients</div>';
  recipientOptions.hidden = !recipientInput || !document.activeElement.isSameNode(recipientInput) || !matches.length;
  renderCopyRecipientPicker('cc');
  renderCopyRecipientPicker('bcc');
}

function renderAttachmentList(container, attachments) {
  if (!container) return;
  container.innerHTML = attachments.map((file, index) => `<span class="attachment-chip">${escapeMessageHtml(file.name)}<button type="button" data-remove-attachment="${index}" aria-label="Remove ${escapeMessageHtml(file.name)}">×</button></span>`).join('');
}

function readFiles(fileList) {
  const files = Array.from(fileList || []);
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > 20 * 1024 * 1024) {
    return Promise.reject(new Error('Attachments cannot exceed 20 MB total'));
  }
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result).split(',')[1] || '' });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

async function postMessage({ recipient, recipientName, cc = '', ccName = '', bcc = '', bccName = '', subject, body, threadId: existingThreadId = '', attachments = [] }) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl) throw new Error('Apps Script URL is not configured');

  const payload = new URLSearchParams({
    action: 'messages',
    messageId: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: currentUsername(),
    senderName: currentName(),
    recipient,
    recipientName: recipientName || recipient,
    cc,
    ccName,
    bcc,
    bccName,
    subject,
    body,
    sentAt: new Date().toISOString(),
    read: 'FALSE',
    threadId: existingThreadId || `THREAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attachments: JSON.stringify(attachments)
  });
  const response = await fetch(appScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.ok === false || result.sheetName !== 'Messages' || result.action !== 'messages') {
    throw new Error('The deployed Apps Script did not confirm a Messages sheet write');
  }
}

messageAttachments.addEventListener('change', async () => {
  try {
    selectedAttachments = await readFiles(messageAttachments.files);
    renderAttachmentList(messageAttachmentList, selectedAttachments);
  } catch (error) {
    console.error(error);
    showMessageToast('Unable to read attachment');
  }
});
messageAttachmentList.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-attachment]');
  if (!removeButton) return;
  selectedAttachments.splice(Number(removeButton.dataset.removeAttachment), 1);
  renderAttachmentList(messageAttachmentList, selectedAttachments);
});

recipientInput.addEventListener('focus', renderRecipientPicker);
recipientInput.addEventListener('input', renderRecipientPicker);
recipientOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[data-recipient]');
  if (!option) return;
  const choice = recipientChoices.find((item) => item.username === option.dataset.recipient);
  if (choice) {
    selectedRecipients.push(choice);
    recipientInput.value = '';
    renderRecipientPicker();
    recipientInput.focus();
  }
});
recipientChips.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-recipient]');
  if (!removeButton) return;
  selectedRecipients = selectedRecipients.filter((recipient) => recipient.username !== removeButton.dataset.removeRecipient);
  renderRecipientPicker();
  recipientInput.focus();
});
[ccRecipientInput, bccRecipientInput].forEach((input) => {
  if (!input) return;
  input.addEventListener('focus', () => renderCopyRecipientPicker(input === ccRecipientInput ? 'cc' : 'bcc'));
  input.addEventListener('input', () => renderCopyRecipientPicker(input === ccRecipientInput ? 'cc' : 'bcc'));
});
[ccOptions, bccOptions].forEach((options) => {
  if (!options) return;
  options.addEventListener('click', (event) => {
    const option = event.target.closest('[data-copy-recipient]');
    if (!option) return;
    const kind = option.dataset.copyKind;
    const choice = recipientChoices.find((item) => item.username === option.dataset.copyRecipient);
    if (!choice) return;
    if (kind === 'cc') selectedCcRecipients.push(choice);
    else selectedBccRecipients.push(choice);
    const state = copyRecipientState(kind);
    state.input.value = '';
    renderRecipientPicker();
    state.input.focus();
  });
  options.addEventListener('click', (event) => event.stopPropagation());
});
document.addEventListener('click', (event) => {
  const copyPicker = event.target.closest('#ccPicker, #bccPicker');
  if (!copyPicker) {
    if (ccOptions) ccOptions.hidden = true;
    if (bccOptions) bccOptions.hidden = true;
  }
});
document.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-copy-recipient]');
  if (!removeButton) return;
  const kind = removeButton.dataset.copyKind;
  if (kind === 'cc') selectedCcRecipients = selectedCcRecipients.filter((recipient) => recipient.username !== removeButton.dataset.removeCopyRecipient);
  else selectedBccRecipients = selectedBccRecipients.filter((recipient) => recipient.username !== removeButton.dataset.removeCopyRecipient);
  renderRecipientPicker();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#recipientPicker')) {
    recipientOptions.hidden = true;
  }
});
showCcButton.addEventListener('click', () => setRecipientCopyVisibility(ccField, showCcButton, true));
showBccButton.addEventListener('click', () => setRecipientCopyVisibility(bccField, showBccButton, true));
document.querySelectorAll('.message-tab').forEach((tab) => tab.addEventListener('click', () => { activeView = tab.dataset.view; activeMessageId = ''; document.querySelectorAll('.message-tab').forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); }); renderList(); renderViewer(null); }));
conversationList.addEventListener('click', (event) => { const item = event.target.closest('[data-message-id]'); if (item) selectMessage(item.dataset.messageId); });
messageViewer.addEventListener('click', (event) => {
  const threadToggle = event.target.closest('[data-toggle-thread-message]');
  if (threadToggle) {
    const threadMessage = threadToggle.closest('.thread-message');
    if (threadMessage) threadMessage.classList.toggle('expanded');
    return;
  }

  const replyButton = event.target.closest('[data-reply-message-id]');
  if (replyButton) {
    const replyForm = messageViewer.querySelector(`[data-inline-reply-id="${CSS.escape(replyButton.dataset.replyMessageId)}"]`);
    if (replyForm) {
      const threadMessage = messages.find((item) => messageId(item) === replyButton.dataset.replyMessageId);
      const replyThread = threadMessage ? getThreadMessages(threadId(threadMessage)) : [];
      const replyMode = replyButton.dataset.replyMode || 'reply';
      const replyChoices = replyMode === 'reply-all' ? messageParticipantChoices(replyThread) : messageReplyChoices(replyThread);
      replyForm.dataset.replyMode = replyMode;
      const replyLabel = replyForm.querySelector('label[for="inlineReplyBody"]');
      if (replyLabel) replyLabel.textContent = `Reply to ${replyChoices.map((recipient) => recipient.name).join(', ')}`;
      renderAttachmentList(replyForm.querySelector('#inlineReplyAttachmentList'), []);
      replyForm.hidden = false;
      messageViewer.querySelectorAll('[data-reply-message-id]').forEach((button) => { button.hidden = true; });
      const replyEditor = replyForm.querySelector('.rich-text-editor');
      if (replyEditor) replyEditor.focus();
      window.requestAnimationFrame(() => replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    return;
  }

  const cancelButton = event.target.closest('[data-cancel-reply]');
  if (cancelButton) {
    const replyForm = cancelButton.closest('.inline-reply-form');
    if (replyForm) {
      replyForm.hidden = true;
      messageViewer.querySelectorAll(`[data-reply-message-id="${CSS.escape(replyForm.dataset.inlineReplyId)}"]`).forEach((button) => { button.hidden = false; });
    }
  }
});

messageViewer.addEventListener('submit', async (event) => {
  const replyForm = event.target.closest('.inline-reply-form');
  if (!replyForm) return;
  event.preventDefault();
  const original = messages.find((item) => messageId(item) === replyForm.dataset.inlineReplyId);
  if (!original) return;

  const replyEditor = replyForm.querySelector('#inlineReplyBody');
  const body = getEditorHtml(replyEditor);
  const bodyText = getEditorText(replyEditor);
  const replyFileInput = replyForm.querySelector('#inlineReplyAttachments');
  const replyAttachments = await readFiles(replyFileInput ? replyFileInput.files : []);
  const replyThread = getThreadMessages(threadId(original));
  const replyAllFields = replyForm.dataset.replyMode === 'reply-all' ? messageReplyAllFields(replyThread) : null;
  const replyRecipients = replyAllFields ? replyAllFields.to : messageReplyChoices(replyThread);
  const replyCcRecipients = replyAllFields ? replyAllFields.cc : [];
  const originalSubject = String(messageValue(original, 'Subject', 'subject') || '').trim();
  if (!bodyText || (!replyRecipients.length && !replyCcRecipients.length)) return;

  try {
    await postMessage({
      recipient: replyRecipients.map((recipient) => recipient.username).join(','),
      recipientName: replyRecipients.map((recipient) => recipient.name).join(','),
      cc: replyCcRecipients.map((recipient) => recipient.username).join(','),
      ccName: replyCcRecipients.map((recipient) => recipient.name).join(','),
      bcc: '',
      bccName: '',
      subject: originalSubject.toLowerCase().startsWith('re:') ? originalSubject : `Re: ${originalSubject}`,
      body,
      threadId: threadId(original),
      attachments: replyAttachments
    });
    replyForm.reset();
    replyEditor.innerHTML = '';
    replyForm.hidden = true;
    messageViewer.querySelectorAll(`[data-reply-message-id="${CSS.escape(replyForm.dataset.inlineReplyId)}"]`).forEach((button) => { button.hidden = false; });
    showMessageToast('Reply sent successfully');
    await loadMessages();
  } catch (error) {
    console.error(error);
    showAppPopup('Reply could not be sent. Please confirm the Apps Script deployment.');
  }
});
messageViewer.addEventListener('change', (event) => {
  if (!event.target.matches('#inlineReplyAttachments')) return;
  readFiles(event.target.files)
    .then((files) => renderAttachmentList(messageViewer.querySelector('#inlineReplyAttachmentList'), files))
    .catch((error) => { console.error(error); showMessageToast('Unable to read attachment'); });
});
document.addEventListener('mousedown', (event) => {
  const formatButton = event.target.closest('[data-format-command]');
  if (!formatButton || formatButton.tagName !== 'BUTTON') return;
  event.preventDefault();
  const editor = formatButton.closest('.field-group, .inline-reply-form')?.querySelector('.rich-text-editor');
  if (!editor) return;
  document.execCommand(formatButton.dataset.formatCommand, false, formatButton.dataset.formatValue || formatButton.value || undefined);
  updateFormatToolbarState(editor);
});
document.addEventListener('change', (event) => {
  const formatControl = event.target.closest('select[data-format-command], input[data-format-command]');
  if (!formatControl) return;
  const editor = formatControl.closest('.field-group, .inline-reply-form')?.querySelector('.rich-text-editor');
  if (!editor) return;
  restoreEditorSelection(editor);
  editor.focus();
  document.execCommand(formatControl.dataset.formatCommand, false, formatControl.value);
  updateFormatToolbarState(editor);
});
document.addEventListener('input', (event) => {
  const editor = event.target.closest('.rich-text-editor');
  if (editor) updateFormatToolbarState(editor);
});
document.addEventListener('keyup', (event) => {
  const editor = event.target.closest('.rich-text-editor');
  if (editor) updateFormatToolbarState(editor);
});
document.addEventListener('mouseup', (event) => {
  const editor = event.target.closest('.rich-text-editor');
  if (editor) updateFormatToolbarState(editor);
});
document.addEventListener('selectionchange', () => updateFormatToolbarState(editorFromSelection()));
document.addEventListener('selectionchange', () => {
  const editor = editorFromSelection();
  if (editor) saveEditorSelection(editor);
});
messageSearchInput.addEventListener('input', () => { activeMessageId = ''; renderList(); renderViewer(null); });
document.getElementById('composeMessageBtn').addEventListener('click', () => openCompose());
document.getElementById('closeComposeBtn').addEventListener('click', closeCompose);
document.getElementById('cancelComposeBtn').addEventListener('click', closeCompose);
composeBackdrop.addEventListener('click', (event) => { if (event.target === composeBackdrop) closeCompose(); });
composeForm.addEventListener('submit', sendMessage);
decorateFormatToolbarIcons();
loadMessages();
