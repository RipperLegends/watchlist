(async () => {
  'use strict';

  const auth = window.WatchlistAuth;
  if (!auth) return;

  const session = auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const state = {
    conversations: [],
    activeConversation: null,
    socket: null,
    sharePayload: null,
    messages: [],
    supportReports: [],
    supportMessages: [],
    activeSupportReportId: null
  };

  const $ = id => document.getElementById(id);
  const messagesList = $('messages-list');
  const panelHeader = $('messages-panel-header');
  const activeAvatar = $('messages-active-avatar');
  const activeName = $('messages-active-name');
  const activeStatus = $('messages-active-status');
  const thread = $('messages-thread');
  const form = $('messages-form');
  const input = $('messages-input');
  const sendButton = $('messages-send');
  const shareButton = $('messages-share-button');
  const sharePreview = $('messages-share-preview');

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  function initials(name) {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || '?';
  }

  function statusText(status) {
    if (status === 'online') return 'онлайн';
    if (status === 'dnd') return 'не турбувати';
    if (status === 'hidden') return 'приховано';
    return 'офлайн';
  }

  function formatMeta(conversation) {
    if (conversation.type === 'support') return conversation.lastMessage || 'Відповіді на звернення від адміністратора.';
    if (conversation.lastMessage) return conversation.lastMessage;
    return 'Ще немає повідомлень.';
  }

  function reportStatusLabel(status) {
    if (status === 'answered') return 'є відповідь';
    if (status === 'reviewing') return 'в роботі';
    if (status === 'closed') return 'закрито';
    return 'очікує відповіді';
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function api(path, options = {}) {
    return auth.apiRequest(path, options);
  }

  function renderEmptyList(message) {
    if (!messagesList) return;
    messagesList.innerHTML = `
      <div class="friends-empty compact">
        <strong>Поки порожньо.</strong>
        <span>${escapeHTML(message)}</span>
      </div>
    `;
  }

  function setActiveConversation(conversation) {
    state.activeConversation = conversation || null;
    const isActive = !!conversation;
    const isSupport = conversation?.type === 'support';

    if (panelHeader) panelHeader.classList.toggle('is-empty', !isActive);
    if (activeAvatar) activeAvatar.textContent = isActive ? (isSupport ? 'S' : initials(conversation.name)) : '?';
    if (activeName) activeName.textContent = isActive ? conversation.name : 'Оберіть діалог';
    if (activeStatus) {
      activeStatus.textContent = isActive && isSupport
        ? 'Оберіть тікет і ведіть переписку з підтримкою.'
        : isActive
          ? `Статус: ${statusText(conversation.status)}`
        : 'Повідомлення з друзями з’являться тут.';
    }
    if (input) {
      input.disabled = !isActive || (isSupport && !state.activeSupportReportId);
      input.placeholder = isSupport ? 'Напишіть відповідь у вибраний тікет...' : 'Напишіть повідомлення...';
    }
    if (sendButton) sendButton.disabled = !isActive || (isSupport && !state.activeSupportReportId);
    if (shareButton) shareButton.disabled = !isActive || isSupport || !state.sharePayload;
  }

  function renderConversations() {
    if (!messagesList) return;

    if (!state.conversations.length) {
      renderEmptyList('Додайте друзів або дочекайтеся першого повідомлення.');
      setActiveConversation(null);
      return;
    }

    messagesList.innerHTML = state.conversations.map(conversation => {
      const isSupport = conversation.type === 'support';
      return `
      <button
        type="button"
        class="messages-conversation ${isSupport ? 'support' : ''} ${String(state.activeConversation?.id) === String(conversation.id) ? 'active' : ''}"
        data-conversation-id="${conversation.id}">
        <div class="friend-avatar small">${isSupport ? 'S' : escapeHTML(initials(conversation.name))}</div>
        <div class="messages-conversation-body">
          <div class="messages-conversation-head">
            <strong>${escapeHTML(conversation.name)}</strong>
            <span class="friend-status ${isSupport ? 'status-support' : `status-${conversation.status}`}">${conversation.unread ? 'нове' : escapeHTML(isSupport ? 'підтримка' : statusText(conversation.status))}</span>
          </div>
          <p>${escapeHTML(formatMeta(conversation))}</p>
        </div>
      </button>
    `;
    }).join('');
  }

  function activeSupportReport() {
    return state.supportReports.find(report => Number(report.id) === Number(state.activeSupportReportId)) || null;
  }

  function renderSupportReports() {
    if (!thread) return;
    if (!state.supportReports.length) {
      state.messages = [];
      state.supportMessages = [];
      thread.innerHTML = `
        <div class="friends-empty">
          <strong>Звернень поки немає.</strong>
          <span>Якщо щось зламалось або потрібна допомога, створіть звернення у підтримку.</span>
          <a class="btn btn-primary support-empty-action" href="/contact-support.html">Створити звернення</a>
        </div>
      `;
      return;
    }

    if (!state.activeSupportReportId) {
      state.activeSupportReportId = state.supportReports[0]?.id || null;
    }

    const report = activeSupportReport();
    state.messages = state.supportMessages;
    thread.innerHTML = `
      <div class="support-ticket-switcher">
        ${state.supportReports.map(item => `
          <button
            type="button"
            class="${Number(item.id) === Number(state.activeSupportReportId) ? 'active' : ''}"
            data-support-report="${item.id}">
            <strong>${escapeHTML(item.subject)}</strong>
            <span>${escapeHTML(reportStatusLabel(item.status))}${item.lastMessage ? ` · ${escapeHTML(item.lastMessage)}` : ''}</span>
          </button>
        `).join('')}
      </div>

      <div class="support-thread-heading">
        <div>
          <strong>${escapeHTML(report?.subject || 'Звернення')}</strong>
          <span>${escapeHTML(reportStatusLabel(report?.status))}${report?.createdAt ? ` · ${escapeHTML(formatDate(report.createdAt))}` : ''}</span>
        </div>
        <a class="btn btn-sm btn-secondary" href="/contact-support.html">Новий тікет</a>
      </div>

      ${state.supportMessages.length ? state.supportMessages.map(message => `
        <div class="chat-message ${message.senderRole === 'user' ? 'mine' : ''}" data-message-id="${message.id}">
          <div class="message-content-preview">
            <strong>${message.senderRole === 'admin' ? 'Підтримка Watchlist' : 'Ви'}</strong>
            <small>${escapeHTML(formatDate(message.createdAt))}</small>
          </div>
          <span>${escapeHTML(message.body)}</span>
          <div class="message-meta-row">
            <small>${message.senderRole === 'user' ? 'надіслано' : ''}</small>
          </div>
        </div>
      `).join('') : `
        <div class="friends-empty">
          <strong>У цьому тікеті ще немає повідомлень.</strong>
          <span>Напишіть відповідь нижче.</span>
        </div>
      `}
    `;
    thread.scrollTop = thread.scrollHeight;
  }

  function renderMessages(messages) {
    if (!thread) return;
    state.messages = messages;
    thread.innerHTML = messages.length
      ? messages.map(message => `
          <div class="chat-message ${message.senderId === session.id ? 'mine' : ''}" data-message-id="${message.id}">
            ${message.contentTitle ? `
              <div class="message-content-preview">
                <strong>${escapeHTML(message.contentTitle)}</strong>
                <small>${escapeHTML(message.contentMeta || 'Рекомендація з Watchlist')}</small>
              </div>
            ` : ''}
            <span>${escapeHTML(message.body)}</span>
            <div class="message-meta-row">
              <small>${message.senderId === session.id ? (message.readAt ? 'прочитано' : 'надіслано') : ''}</small>
            </div>
          </div>
        `).join('')
      : `
        <div class="friends-empty">
          <strong>Ще немає повідомлень.</strong>
          <span>Почніть діалог першим повідомленням.</span>
        </div>
      `;
    thread.scrollTop = thread.scrollHeight;
  }

  function renderSharePreview() {
    if (!sharePreview) return;
    const item = state.sharePayload;
    sharePreview.hidden = !item;
    sharePreview.innerHTML = item ? `
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML([item.year, item.type === 'series' ? 'Серіал' : 'Фільм', item.rating ? `${item.rating}/5` : ''].filter(Boolean).join(' · '))}</span>
      </div>
      <button type="button" class="btn btn-sm btn-secondary" id="messages-share-clear">Прибрати</button>
    ` : '';
    if (shareButton) shareButton.disabled = !state.activeConversation || !item;
  }

  async function loadMessages(friendId) {
    if (friendId === null || friendId === undefined || friendId === '') return;
    try {
      renderMessages(await api(`/friends/${friendId}/messages`));
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося завантажити повідомлення', 'error');
    }
  }

  async function loadSupportReports() {
    if (session.role !== 'user') {
      state.supportReports = [];
      return;
    }
    try {
      state.supportReports = await api('/support/reports');
    } catch (error) {
      state.supportReports = [];
      auth.showToast(error.message || 'Не вдалося завантажити звернення', 'error');
    }
  }

  async function loadSupportMessages(reportId = state.activeSupportReportId) {
    if (!reportId) {
      state.supportMessages = [];
      return;
    }
    try {
      state.supportMessages = await api(`/reports/${reportId}/messages`);
      state.activeSupportReportId = reportId;
    } catch (error) {
      state.supportMessages = [];
      auth.showToast(error.message || 'Не вдалося завантажити переписку звернення', 'error');
    }
  }

  function getSupportConversation() {
    if (session.role !== 'user') return null;
    const latest = state.supportReports[0];
    const answeredCount = state.supportReports.filter(report => report.adminResponse).length;
    return {
      id: 'support',
      type: 'support',
      name: 'Підтримка Watchlist',
      status: 'support',
      lastMessage: latest
        ? `${reportStatusLabel(latest.status)}: ${latest.subject}`
        : 'Тут будуть відповіді адміністратора на звернення.',
      unread: false,
      answeredCount
    };
  }

  async function loadConversations(preferredFriendId = null) {
    try {
      const friendConversations = await api('/messages/conversations');
      await loadSupportReports();
      const supportConversation = getSupportConversation();
      state.conversations = supportConversation ? [...friendConversations, supportConversation] : friendConversations;
      if (!state.activeSupportReportId && state.supportReports.length) {
        state.activeSupportReportId = state.supportReports[0].id;
      }
      const preferredId = preferredFriendId !== null ? String(preferredFriendId) : null;
      const nextActive = preferredId
        ? state.conversations.find(conversation => String(conversation.id) === preferredId)
        : state.activeConversation
          ? state.conversations.find(conversation => String(conversation.id) === String(state.activeConversation.id))
          : state.conversations.find(conversation => conversation.type !== 'support') || state.conversations[0];

      renderConversations();
      setActiveConversation(nextActive || null);

      if (nextActive) {
        renderConversations();
        if (nextActive.type === 'support') {
          await loadSupportMessages(state.activeSupportReportId);
          renderSupportReports();
        } else {
          await loadMessages(nextActive.id);
        }
      } else {
        renderMessages([]);
      }
    } catch (error) {
      renderEmptyList('Не вдалося завантажити діалоги.');
      auth.showToast(error.message || 'Не вдалося завантажити повідомлення', 'error');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.activeConversation) return;

    const body = input.value.trim();
    if (!body) return;

    if (state.activeConversation.type === 'support') {
      if (!state.activeSupportReportId) return;
      try {
        await api(`/reports/${state.activeSupportReportId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body })
        });
        input.value = '';
        await loadSupportReports();
        await loadSupportMessages(state.activeSupportReportId);
        renderSupportReports();
        await loadConversations('support');
      } catch (error) {
        auth.showToast(error.message || 'Не вдалося надіслати відповідь у звернення', 'error');
      }
      return;
    }

    try {
      await api(`/friends/${state.activeConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });
      input.value = '';
      await loadMessages(state.activeConversation.id);
      await loadConversations(state.activeConversation.id);
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося надіслати повідомлення', 'error');
    }
  }

  async function sendSharedContent() {
    if (!state.activeConversation || state.activeConversation.type === 'support' || !state.sharePayload) return;
    const item = state.sharePayload;
    try {
      await api(`/friends/${state.activeConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: `Подивись це: ${item.title}`,
          contentTitle: item.title,
          contentMeta: [item.year, item.type === 'series' ? 'Серіал' : 'Фільм', item.rating ? `${item.rating}/5` : ''].filter(Boolean).join(' · '),
          contentUrl: '/watchlist'
        })
      });
      localStorage.removeItem('watchlist_share_payload');
      state.sharePayload = null;
      renderSharePreview();
      await loadMessages(state.activeConversation.id);
      await loadConversations(state.activeConversation.id);
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося надіслати рекомендацію', 'error');
    }
  }

  function connectRealtime() {
    const currentSession = auth.getSession();
    if (!currentSession?.token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(currentSession.token)}`);
    state.socket.addEventListener('message', async event => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'presence' || payload.type?.startsWith('friend-')) {
        await loadConversations(state.activeConversation?.id || null);
      }
      if (payload.type === 'chat-message') {
        if (state.activeConversation?.type !== 'support' && [payload.message.senderId, payload.message.receiverId].includes(state.activeConversation?.id)) {
          await loadMessages(state.activeConversation.id);
        }
        await loadConversations(state.activeConversation?.id || null);
      }
      if (payload.type === 'support-response') {
        await loadSupportReports();
        if (state.activeConversation?.type === 'support') {
          if (Number(payload.reportId) === Number(state.activeSupportReportId)) {
            await loadSupportMessages(state.activeSupportReportId);
          }
          renderSupportReports();
        }
        await loadConversations(state.activeConversation?.id || 'support');
      }
      if (payload.type === 'support-deleted') {
        await loadSupportReports();
        if (Number(payload.reportId) === Number(state.activeSupportReportId)) {
          state.activeSupportReportId = state.supportReports[0]?.id || null;
          await loadSupportMessages(state.activeSupportReportId);
        }
        if (state.activeConversation?.type === 'support') renderSupportReports();
      }
    });
  }

  messagesList?.addEventListener('click', async event => {
    const button = event.target.closest('[data-conversation-id]');
    if (!button) return;

    const conversation = state.conversations.find(item => String(item.id) === String(button.dataset.conversationId));
    if (!conversation) return;

    setActiveConversation(conversation);
    renderConversations();
    if (conversation.type === 'support') {
      await loadSupportMessages(state.activeSupportReportId);
      renderSupportReports();
    } else {
      await loadMessages(conversation.id);
    }
  });

  thread?.addEventListener('click', async event => {
    const supportButton = event.target.closest('[data-support-report]');
    if (supportButton) {
      state.activeSupportReportId = Number(supportButton.dataset.supportReport);
      await loadSupportMessages(state.activeSupportReportId);
      renderSupportReports();
    }
  });

  sharePreview?.addEventListener('click', event => {
    if (!event.target.closest('#messages-share-clear')) return;
    localStorage.removeItem('watchlist_share_payload');
    state.sharePayload = null;
    renderSharePreview();
  });

  shareButton?.addEventListener('click', sendSharedContent);
  form?.addEventListener('submit', sendMessage);

  try {
    state.sharePayload = JSON.parse(localStorage.getItem('watchlist_share_payload') || 'null');
  } catch {
    state.sharePayload = null;
  }
  renderSharePreview();
  setActiveConversation(null);
  renderMessages([]);
  await loadConversations();
  connectRealtime();
})();
