(() => {
  'use strict';

  const auth = window.WatchlistAuth;
  const state = {
    friends: [],
    incoming: [],
    outgoing: [],
    ranking: [],
    activeChatFriend: null,
    socket: null
  };

  const $ = id => document.getElementById(id);
  const friendsList = $('friends-list');
  const friendSearch = $('friend-search');
  const userSearch = $('user-search');
  const sendRequestBtn = $('btn-send-request');
  const incomingRequests = $('incoming-requests');
  const outgoingRequests = $('outgoing-requests');
  const friendsRanking = $('friends-ranking');
  const onlineCount = $('friends-online-count');
  const bestStreak = $('friends-best-streak');
  const bestLevel = $('friends-best-level');
  const chatOverlay = $('chat-overlay');
  const chatTitle = $('chat-title');
  const chatClose = $('chat-close');
  const chatLog = $('chat-log');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  function initials(name) {
    return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
  }

  function statusText(status) {
    if (status === 'online') return 'онлайн';
    if (status === 'dnd') return 'не турбувати';
    if (status === 'hidden') return 'приховано';
    return 'офлайн';
  }

  function showLockedState() {
    const locked = `
      <div class="friends-empty">
        <strong>Увійдіть, щоб працювати з друзями.</strong>
        <span>Після входу тут з’являться список друзів, заявки, чат і налаштування приватності.</span>
        <a href="login.html" class="btn btn-primary">Увійти</a>
      </div>
    `;
    if (friendsList) friendsList.innerHTML = locked;
    if (incomingRequests) incomingRequests.innerHTML = '';
    if (outgoingRequests) outgoingRequests.innerHTML = '';
    if (friendsRanking) friendsRanking.innerHTML = '';
    [friendSearch, userSearch, sendRequestBtn]
      .filter(Boolean)
      .forEach(node => { node.disabled = true; });
  }

  async function api(path, options = {}) {
    if (!auth) throw new Error('Auth not available');
    return auth.apiRequest(path, options);
  }

  function renderHeroStats() {
    const online = state.friends.filter(friend => friend.status === 'online' || friend.status === 'dnd').length;
    const streak = state.friends.reduce((max, friend) => Math.max(max, friend.streakDays || 0), 0);
    const level = state.friends.reduce((max, friend) => Math.max(max, friend.friendshipLevel || 1), 1);
    if (onlineCount) onlineCount.textContent = String(online);
    if (bestStreak) bestStreak.textContent = `${streak} днів`;
    if (bestLevel) bestLevel.textContent = `Lv. ${level}`;
  }

  function achievementHTML(friend) {
    if (!friend.achievements?.length) {
      return '<span class="friend-achievement muted">Ачівки ще попереду</span>';
    }
    return friend.achievements.map(item => `<span class="friend-achievement">${escapeHTML(item.title)}</span>`).join('');
  }

  function renderFriends() {
    if (!friendsList) return;
    const query = friendSearch?.value.trim().toLowerCase() || '';
    const list = state.friends.filter(friend => !query || friend.name.toLowerCase().includes(query));

    if (!list.length) {
      friendsList.innerHTML = `
        <div class="friends-empty">
          <strong>Друзів поки немає.</strong>
          <span>Знайдіть користувача за нікнеймом і надішліть заявку.</span>
        </div>
      `;
      renderHeroStats();
      return;
    }

    friendsList.innerHTML = list.map(friend => `
      <article class="friend-card ${friend.blocked ? 'is-blocked' : ''}" data-friend-id="${friend.id}">
        <div class="friend-avatar">${escapeHTML(initials(friend.name))}</div>
        <div class="friend-body">
          <div class="friend-head">
            <div>
              <h3>${escapeHTML(friend.name)}</h3>
              <p>${escapeHTML(friend.activity || 'активність ще не зафіксована')}</p>
            </div>
            <span class="friend-status status-${friend.status}">${escapeHTML(statusText(friend.status))}</span>
          </div>
          <div class="friend-progress">
            <span>Рівень дружби: ${friend.friendshipLevel}</span>
            <div class="friend-progress-track">
              <span style="width:${Math.min(100, (friend.interactions || 0) % 5 * 20 + 20)}%"></span>
            </div>
          </div>
          <div class="friend-meta-row">
            <span>${friend.messagesCount || 0} повідомлень</span>
            <span>${friend.gamesCount || 0} ігор</span>
            <span>${friend.streakDays || 0} днів стріку</span>
          </div>
          <div class="friend-achievements">${achievementHTML(friend)}</div>
          <div class="friend-actions">
            <button class="btn btn-sm btn-provider" data-chat="${friend.id}">Чат</button>
            <button class="btn btn-sm" data-mute="${friend.id}">${friend.muted ? 'Увімкнути звук' : 'Мут'}</button>
            <button class="btn btn-sm btn-danger" data-block="${friend.id}">Блок</button>
            <button class="btn btn-sm btn-delete" data-remove="${friend.id}">Видалити</button>
          </div>
        </div>
      </article>
    `).join('');
    renderHeroStats();
  }

  function renderRequests() {
    if (incomingRequests) {
      incomingRequests.innerHTML = state.incoming.length
        ? `<h3 class="friends-list-title">Вхідні</h3>${state.incoming.map(request => `
            <div class="friend-request-row">
              <span>${escapeHTML(request.name)}</span>
              <div>
                <button class="btn btn-sm btn-edit" data-accept="${request.relationId}">Прийняти</button>
                <button class="btn btn-sm btn-danger" data-reject="${request.relationId}">Відхилити</button>
              </div>
            </div>
          `).join('')}`
        : '<div class="friends-empty compact">Нових заявок немає.</div>';
    }

    if (outgoingRequests) {
      outgoingRequests.innerHTML = state.outgoing.length
        ? `<h3 class="friends-list-title">Надіслані</h3>${state.outgoing.map(request => `
            <div class="friend-request-row">
              <span>${escapeHTML(request.name)}</span>
              <div>
                <small>очікує відповіді</small>
                <button class="btn btn-sm btn-danger" data-cancel="${request.relationId}">Скасувати</button>
              </div>
            </div>
          `).join('')}`
        : '';
    }
  }

  function renderRanking() {
    if (!friendsRanking) return;
    friendsRanking.innerHTML = state.ranking.length
      ? state.ranking.map((friend, index) => `
          <div class="friend-rank-row">
            <span class="friend-rank-num">${index + 1}</span>
            <span>${escapeHTML(friend.name)}</span>
            <strong>${friend.interactions || 0}</strong>
          </div>
        `).join('')
      : '<div class="friends-empty compact">Рейтинг з’явиться після перших взаємодій.</div>';
  }

  function renderAll() {
    renderFriends();
    renderRequests();
    renderRanking();
  }

  async function loadFriends() {
    const search = friendSearch?.value.trim() || '';
    const data = await api(`/friends?search=${encodeURIComponent(search)}`);
    state.friends = data.friends || [];
    state.incoming = data.incoming || [];
    state.outgoing = data.outgoing || [];
    state.ranking = data.ranking || [];
    renderAll();
  }

  async function sendRequest(username) {
    const nickname = username || userSearch?.value.trim();
    if (!nickname) {
      auth.showToast('Введіть нікнейм користувача', 'error');
      return;
    }

    try {
      await api('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ username: nickname })
      });
      auth.showToast('Заявку надіслано', 'success');
      await loadFriends();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося надіслати заявку', 'error');
    }
  }

  async function updateRequest(id, action) {
    try {
      await api(`/friends/requests/${id}/${action}`, { method: 'POST' });
      const message = action === 'accept'
        ? 'Заявку прийнято'
        : action === 'cancel'
          ? 'Заявку скасовано'
          : 'Заявку відхилено';
      auth.showToast(message, 'success');
      await loadFriends();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося оновити заявку', 'error');
    }
  }

  async function friendAction(friendId, action) {
    const friend = state.friends.find(item => item.id === Number(friendId));
    try {
      if (action === 'remove') {
        await api(`/friends/${friendId}`, { method: 'DELETE' });
        auth.showToast('Друга видалено', 'success');
      }
      if (action === 'mute') {
        await api(`/friends/${friendId}/mute`, {
          method: 'POST',
          body: JSON.stringify({ muted: !friend?.muted })
        });
        auth.showToast(friend?.muted ? 'Повідомлення увімкнено' : 'Повідомлення вимкнено', 'success');
      }
      if (action === 'block') {
        await api(`/friends/${friendId}/block`, { method: 'POST' });
        auth.showToast('Користувача заблоковано', 'success');
      }
      if (action === 'unblock') {
        await api(`/friends/${friendId}/unblock`, { method: 'POST' });
        auth.showToast('Користувача розблоковано', 'success');
      }
      await loadFriends();
    } catch (error) {
      auth.showToast(error.message || 'Дію не виконано', 'error');
    }
  }

  function renderMessages(messages) {
    if (!chatLog) return;
    const session = auth.getSession();
    chatLog.innerHTML = messages.length
      ? messages.map(message => `
          <div class="chat-message ${message.senderId === session.id ? 'mine' : ''}">
            <span>${escapeHTML(message.body)}</span>
          </div>
        `).join('')
      : '<div class="friends-empty compact">Повідомлень ще немає.</div>';
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function openChat(friendId) {
    const friend = state.friends.find(item => item.id === Number(friendId));
    if (!friend) return;
    state.activeChatFriend = friend;
    chatTitle.textContent = `Чат з ${friend.name}`;
    chatOverlay.classList.add('active');
    await loadChatMessages();
  }

  async function loadChatMessages() {
    if (!state.activeChatFriend) return;
    try {
      renderMessages(await api(`/friends/${state.activeChatFriend.id}/messages`));
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося відкрити чат', 'error');
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!state.activeChatFriend) return;
    const body = chatInput.value.trim();
    if (!body) return;

    try {
      const message = await api(`/friends/${state.activeChatFriend.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });
      chatInput.value = '';
      await loadChatMessages();
      await loadFriends();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося надіслати повідомлення', 'error');
    }
  }

  function connectRealtime() {
    const session = auth?.getSession();
    if (!session?.token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(session.token)}`);
    state.socket.addEventListener('message', async event => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'presence') {
        const friend = state.friends.find(item => item.id === payload.userId);
        if (friend) {
          friend.status = payload.status;
          friend.lastSeen = payload.lastSeen || friend.lastSeen;
          renderFriends();
        }
      }
      if (payload.type === 'chat-message') {
        if (state.activeChatFriend?.id === payload.message.senderId) {
          await loadChatMessages();
        }
        await loadFriends();
      }
      if (payload.type?.startsWith('friend-')) {
        await loadFriends();
      }
    });
    outgoingRequests?.addEventListener('click', event => {
      const cancel = event.target.closest('[data-cancel]');
      if (cancel) updateRequest(cancel.dataset.cancel, 'cancel');
    });
  }

  function bindEvents() {
    friendSearch?.addEventListener('input', renderFriends);
    sendRequestBtn?.addEventListener('click', () => sendRequest());
    incomingRequests?.addEventListener('click', event => {
      const accept = event.target.closest('[data-accept]');
      const reject = event.target.closest('[data-reject]');
      if (accept) updateRequest(accept.dataset.accept, 'accept');
      if (reject) updateRequest(reject.dataset.reject, 'reject');
    });
    friendsList?.addEventListener('click', event => {
      const chat = event.target.closest('[data-chat]');
      const mute = event.target.closest('[data-mute]');
      const block = event.target.closest('[data-block]');
      const remove = event.target.closest('[data-remove]');
      if (chat) openChat(chat.dataset.chat);
      if (mute) friendAction(mute.dataset.mute, 'mute');
      if (block) friendAction(block.dataset.block, 'block');
      if (remove) friendAction(remove.dataset.remove, 'remove');
    });
    chatClose?.addEventListener('click', () => chatOverlay.classList.remove('active'));
    chatOverlay?.addEventListener('click', event => {
      if (event.target === chatOverlay) chatOverlay.classList.remove('active');
    });
    chatForm?.addEventListener('submit', sendChatMessage);
  }

  async function init() {
    if (!auth?.getSession()) {
      showLockedState();
      return;
    }
    bindEvents();
    await loadFriends();
    connectRealtime();
  }

  init();
})();
