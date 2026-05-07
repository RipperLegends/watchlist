(async () => {
  'use strict';

  const auth = window.WatchlistAuth;
  if (!auth) return;

  const session = auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const profileInitials = document.getElementById('profile-initials');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileCover = document.getElementById('profile-cover');
  const profileNameDisplay = document.getElementById('profile-name-display');
  const profileEmailDisplay = document.getElementById('profile-email-display');
  const profileBio = document.getElementById('profile-bio');
  const profileFavoriteGenres = document.getElementById('profile-favorite-genres');
  const profileRoleBadge = document.getElementById('profile-role-badge');
  const profileEyebrow = document.getElementById('profile-eyebrow');
  const profileTitle = document.getElementById('profile-title');
  const profileAdminLink = document.getElementById('profile-admin-link');
  const profileTopGenres = document.getElementById('profile-top-genres');
  const profileTopRated = document.getElementById('profile-top-rated');
  const profileRecentActivity = document.getElementById('profile-recent-activity');
  const profilePrivacy = document.getElementById('profile-privacy');

  function setAdminLinkVisible(isAdmin) {
    if (!profileAdminLink) return;

    profileAdminLink.hidden = !isAdmin;
    profileAdminLink.classList.toggle('hidden', !isAdmin);
    profileAdminLink.setAttribute('aria-hidden', isAdmin ? 'false' : 'true');

    if (isAdmin) {
      profileAdminLink.href = 'admin.html';
    } else {
      profileAdminLink.removeAttribute('href');
    }
  }

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  function getInitials(username) {
    return (username || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || '?';
  }

  function setRoleBadge(role) {
    profileRoleBadge.textContent = role;
    profileRoleBadge.className = `badge ${role === 'admin' ? 'badge-role-admin' : 'badge-role-user'}`;
  }

  function setAvatar(target, initialsTarget, imageUrl, initials) {
    if (!target) return;
    target.querySelector('img')?.remove();
    target.classList.toggle('has-image', !!imageUrl);
    if (initialsTarget) initialsTarget.textContent = initials;

    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      target.prepend(image);
    }
  }

  function setCover(imageUrl) {
    if (!profileCover) return;
    profileCover.classList.toggle('has-image', !!imageUrl);
    profileCover.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : '';
  }

  function renderFavoriteGenres(genres = []) {
    if (!profileFavoriteGenres) return;
    profileFavoriteGenres.innerHTML = genres.length
      ? genres.map(genre => `<span>${escapeHTML(genre)}</span>`).join('')
      : '<span>Жанри з’являться після заповнення профілю</span>';
  }

  function renderList(root, items, emptyText, renderItem) {
    if (!root) return;
    root.innerHTML = items?.length
      ? `<div class="profile-mini-list">${items.map(renderItem).join('')}</div>`
      : `<p class="profile-muted">${escapeHTML(emptyText)}</p>`;
  }

  function privacyLabel(value) {
    if (value === 'everyone') return 'Усі';
    if (value === 'friends') return 'Друзі';
    if (value === 'nobody') return 'Ніхто';
    if (value === 'online') return 'Онлайн';
    if (value === 'offline') return 'Офлайн';
    if (value === 'dnd') return 'Не турбувати';
    return value || 'Не вказано';
  }

  function renderInsights(data) {
    renderList(profileTopGenres, data.topGenres || [], 'Жанри з’являться після перших записів.', item => `
      <div class="profile-mini-row">
        <span>${escapeHTML(item.name)}</span>
        <strong>${item.count}</strong>
      </div>
    `);

    renderList(profileTopRated, data.topRated || [], 'Оцініть кілька записів, щоб побачити топ.', item => `
      <div class="profile-mini-row">
        <span>${escapeHTML(item.title)}</span>
        <strong>${item.rating}/5</strong>
      </div>
    `);

    renderList(profileRecentActivity, data.recentActivity || [], 'Активність з’явиться після додавання записів.', item => `
      <div class="profile-mini-row">
        <span>${escapeHTML(item.title)}</span>
        <strong>${escapeHTML(item.status || '')}</strong>
      </div>
    `);

    if (profilePrivacy) {
      const user = data.user || {};
      profilePrivacy.innerHTML = `
        <div class="profile-privacy-grid">
          <div><span>Статус</span><strong>${escapeHTML(privacyLabel(user.presenceStatus))}</strong></div>
          <div><span>Онлайн бачать</span><strong>${escapeHTML(privacyLabel(user.onlineVisibility))}</strong></div>
          <div><span>Профіль бачать</span><strong>${escapeHTML(privacyLabel(user.profileVisibility))}</strong></div>
          <div><span>Заявки можуть надсилати</span><strong>${escapeHTML(privacyLabel(user.friendRequestPolicy))}</strong></div>
        </div>
      `;
    }
  }

  async function loadProfile() {
    try {
      const data = await auth.apiRequest('/profile');
      const username = data.user.username || data.user.name;
      const { email, role, avatarUrl, coverUrl, bio } = data.user;
      const initials = getInitials(username);

      profileNameDisplay.textContent = username;
      profileEmailDisplay.textContent = email;
      setAvatar(profileAvatar, profileInitials, avatarUrl, initials);
      setCover(coverUrl);
      if (profileBio) profileBio.textContent = bio || 'Додайте короткий опис у налаштуваннях, щоб профіль виглядав живішим.';
      renderFavoriteGenres(data.user.favoriteGenres || []);
      profileEyebrow.textContent = role === 'admin' ? 'Акаунт адміністратора' : 'Акаунт користувача';
      profileTitle.textContent = role === 'admin' ? 'Профіль адміністратора' : 'Профіль користувача';
      setAdminLinkVisible(role === 'admin');
      setRoleBadge(role);
      renderInsights(data);
      auth.setSession({ ...auth.getSession(), ...data.user, username, name: username, email, role });
    } catch (error) {
      if (/401|403|Unauthorized|Forbidden/i.test(error.message || '')) {
        auth.clearSession();
        window.location.href = 'login.html';
        return;
      }
      auth.showToast(error.message || 'Не вдалося завантажити профіль');
    }
  }

  setAdminLinkVisible(false);
  loadProfile();
})();
