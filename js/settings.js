(async () => {
  'use strict';

  const auth = window.WatchlistAuth;
  if (!auth) return;

  const session = auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const settingsRoleBadge = document.getElementById('settings-role-badge');
  const settingsAvatar = document.getElementById('settings-avatar');
  const settingsInitials = document.getElementById('settings-initials');
  const settingsTitle = document.getElementById('settings-title');
  const settingsDescription = document.getElementById('settings-description');
  const settingsNameDisplay = document.getElementById('settings-name-display');
  const settingsEmailDisplay = document.getElementById('settings-email-display');
  const settingsPanelText = document.getElementById('settings-panel-text');
  const settingsUsernameGroup = document.getElementById('settings-username-group');
  const settingsForm = document.getElementById('settings-form');
  const settingsUsername = document.getElementById('settings-username');
  const settingsEmail = document.getElementById('settings-email');
  const settingsPassword = document.getElementById('settings-password');
  const settingsMessage = document.getElementById('settings-message');
  const blockedUsersList = document.getElementById('blocked-users-list');
  const privacyForm = document.getElementById('privacy-form');
  const presenceStatus = document.getElementById('presence-status');
  const onlineVisibility = document.getElementById('online-visibility');
  const profileVisibility = document.getElementById('profile-visibility');
  const requestPolicy = document.getElementById('request-policy');
  const languageForm = document.getElementById('language-form');
  const preferredLanguage = document.getElementById('preferred-language');
  const languageProviderNote = document.getElementById('language-provider-note');
  const profilePresentationForm = document.getElementById('profile-presentation-form');
  const settingsAvatarUrl = document.getElementById('settings-avatar-url');
  const settingsCoverUrl = document.getElementById('settings-cover-url');
  const settingsBio = document.getElementById('settings-bio');
  const settingsFavoriteGenres = document.getElementById('settings-favorite-genres');
  const profilePreviewCover = document.getElementById('profile-preview-cover');
  const profilePreviewAvatar = document.getElementById('profile-preview-avatar');
  const profilePreviewInitials = document.getElementById('profile-preview-initials');
  const profilePreviewName = document.getElementById('profile-preview-name');
  const profilePreviewBio = document.getElementById('profile-preview-bio');

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  function getInitials(value) {
    return (value || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || '?';
  }

  function showSettingsMessage(text, status = 'success') {
    settingsMessage.textContent = text;
    settingsMessage.className = `profile-message ${status}`;
  }

  function setRoleBadge(role) {
    settingsRoleBadge.textContent = role;
    settingsRoleBadge.className = `badge ${role === 'admin' ? 'badge-role-admin' : 'badge-role-user'}`;
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

  function setCover(target, imageUrl) {
    if (!target) return;
    target.classList.toggle('has-image', !!imageUrl);
    target.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : '';
  }

  function normalizeGenresInput(value) {
    return (value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  function updateProfilePreview() {
    const username = settingsUsername.value || settingsNameDisplay.textContent || 'Watchlist';
    const initials = getInitials(username);
    const avatarUrl = settingsAvatarUrl?.value.trim() || '';
    const coverUrl = settingsCoverUrl?.value.trim() || '';
    const bio = settingsBio?.value.trim() || 'Короткий опис з’явиться тут.';

    setAvatar(settingsAvatar, settingsInitials, avatarUrl, initials);
    setAvatar(profilePreviewAvatar, profilePreviewInitials, avatarUrl, initials);
    setCover(profilePreviewCover, coverUrl);
    if (profilePreviewName) profilePreviewName.textContent = username;
    if (profilePreviewBio) profilePreviewBio.textContent = bio;
  }

  function renderBlockedUsers(blocked = []) {
    if (!blockedUsersList) return;
    blockedUsersList.innerHTML = blocked.length
      ? blocked.map(user => {
        const blockedByMe = !!user.blockedByMe;
        const blockedMe = !!user.blockedMe;
        const status = blockedByMe && blockedMe
          ? 'Взаємне блокування'
          : blockedByMe
            ? 'Ви заблокували'
            : 'Вас заблокував цей користувач';

        return `
          <div class="friend-request-row">
            <span>
              ${escapeHTML(user.name)}
              <small>${escapeHTML(status)}</small>
            </span>
            ${blockedByMe
              ? `<button class="btn btn-sm btn-edit" data-unblock="${user.id}">Розблокувати</button>`
              : '<small>Недоступно</small>'}
          </div>
        `;
      }).join('')
      : '<div class="friends-empty compact">Заблокованих користувачів немає.</div>';
  }

  function applyPrivacySettings(settings = {}) {
    if (presenceStatus) presenceStatus.value = settings.presenceStatus || 'online';
    if (onlineVisibility) onlineVisibility.value = settings.onlineVisibility || 'everyone';
    if (profileVisibility) profileVisibility.value = settings.profileVisibility || 'everyone';
    if (requestPolicy) requestPolicy.value = settings.friendRequestPolicy || 'everyone';
  }

  function applyLanguageSettings(user = {}, languageData = {}) {
    const language = languageData.preferredLanguage || user.preferredLanguage || 'UK';
    if (preferredLanguage) preferredLanguage.value = language;
    if (languageProviderNote) {
      languageProviderNote.textContent = `Поточна мова сайту: ${languageData.preferredLanguageLabel || language}.`;
    }
  }

  function applyRoleSettingsMode(role) {
    const isAdmin = role === 'admin';
    if (settingsUsernameGroup) settingsUsernameGroup.hidden = !isAdmin;
    if (settingsUsername) settingsUsername.disabled = !isAdmin;
    if (settingsPanelText) {
      settingsPanelText.textContent = isAdmin
        ? 'Адміністратор може змінювати логін, email і пароль.'
        : 'Для звичайного користувача тут доступні лише email і пароль.';
    }
    if (settingsTitle) {
      settingsTitle.textContent = isAdmin ? 'Адмінські налаштування доступу' : 'Налаштування доступу';
    }
    if (settingsDescription) {
      settingsDescription.textContent = isAdmin
        ? 'Тут зібрані параметри ідентифікації адміністратора. Логін теж можна редагувати саме тут.'
        : 'Тут можна змінити email і пароль, не перевантажуючи основний профіль.';
    }
  }

  async function loadSettings() {
    try {
      const [data, friendsData] = await Promise.all([
        auth.apiRequest('/profile'),
        auth.apiRequest('/friends')
      ]);
      let languageData = null;
      try {
        languageData = await auth.apiRequest('/languages');
      } catch (error) {
        languageData = { preferredLanguage: data.user?.preferredLanguage || 'UK' };
      }
      const username = data.user?.username || data.user?.name || session.username || session.name || '';
      const email = data.user?.email || session.email || '';
      const role = data.user?.role || session.role || 'user';

      setRoleBadge(role);
      applyRoleSettingsMode(role);
      settingsInitials.textContent = getInitials(username);
      settingsNameDisplay.textContent = username;
      settingsEmailDisplay.textContent = email;
      settingsUsername.value = username;
      settingsEmail.value = email;
      if (settingsAvatarUrl) settingsAvatarUrl.value = data.user?.avatarUrl || '';
      if (settingsCoverUrl) settingsCoverUrl.value = data.user?.coverUrl || '';
      if (settingsBio) settingsBio.value = data.user?.bio || '';
      if (settingsFavoriteGenres) settingsFavoriteGenres.value = (data.user?.favoriteGenres || []).join(', ');
      updateProfilePreview();
      renderBlockedUsers(friendsData.blocked || []);
      applyPrivacySettings(friendsData.settings || {});
      applyLanguageSettings(data.user || {}, languageData || {});
      auth.setSession({ ...auth.getSession(), ...data.user, username, name: username, email, role, preferredLanguage: languageData?.preferredLanguage || data.user?.preferredLanguage || 'UK' });
    } catch (error) {
      if (/401|403|Unauthorized|Forbidden/i.test(error.message || '')) {
        auth.clearSession();
        window.location.href = 'login.html';
        return;
      }
      const currentSession = auth.getSession() || {};
      const username = currentSession.username || currentSession.name || '';
      const email = currentSession.email || '';
      const role = currentSession.role || 'user';
      setRoleBadge(role);
      applyRoleSettingsMode(role);
      settingsInitials.textContent = getInitials(username);
      settingsNameDisplay.textContent = username || '...';
      settingsEmailDisplay.textContent = email || '...';
      settingsUsername.value = username;
      settingsEmail.value = email;
      updateProfilePreview();
      renderBlockedUsers([]);
      applyLanguageSettings(currentSession, { preferredLanguage: currentSession.preferredLanguage || 'UK' });
      auth.showToast(error.message || 'Не вдалося завантажити налаштування');
    }
  }

  settingsForm.addEventListener('submit', async event => {
    event.preventDefault();
    showSettingsMessage('');

    const currentSession = auth.getSession();
    const username = settingsUsername.disabled
      ? (currentSession?.username || currentSession?.name || '').trim()
      : settingsUsername.value.trim();
    const email = settingsEmail.value.trim().toLowerCase();
    const password = settingsPassword.value;

    if (!email) {
      showSettingsMessage('Email обов’язковий.', 'error');
      return;
    }

    if (!settingsUsername.disabled && username.length < 3) {
      showSettingsMessage('Логін має бути мінімум 3 символи.', 'error');
      return;
    }

    try {
      await auth.apiRequest('/profile', {
        method: 'PUT',
        body: JSON.stringify({ username, email, password })
      });
      auth.setSession({ ...auth.getSession(), name: username, username, email });
      settingsPassword.value = '';
      showSettingsMessage('Налаштування оновлено.', 'success');
      await loadSettings();
    } catch (error) {
      showSettingsMessage(error.message || 'Помилка оновлення', 'error');
    }
  });

  profilePresentationForm?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const result = await auth.apiRequest('/profile/presentation', {
        method: 'PUT',
        body: JSON.stringify({
          avatarUrl: settingsAvatarUrl.value.trim(),
          coverUrl: settingsCoverUrl.value.trim(),
          bio: settingsBio.value.trim(),
          favoriteGenres: normalizeGenresInput(settingsFavoriteGenres.value)
        })
      });
      auth.setSession({ ...auth.getSession(), ...result.user });
      updateProfilePreview();
      auth.showToast('Вигляд профілю оновлено', 'success');
      await loadSettings();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося оновити вигляд профілю', 'error');
    }
  });

  [settingsAvatarUrl, settingsCoverUrl, settingsBio, settingsUsername].forEach(input => {
    input?.addEventListener('input', updateProfilePreview);
  });

  blockedUsersList?.addEventListener('click', async event => {
    const unblock = event.target.closest('[data-unblock]');
    if (!unblock) return;

    try {
      await auth.apiRequest(`/friends/${unblock.dataset.unblock}/unblock`, { method: 'POST' });
      auth.showToast('Користувача розблоковано', 'success');
      await loadSettings();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося розблокувати користувача', 'error');
    }
  });

  privacyForm?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      await auth.apiRequest('/friends/privacy', {
        method: 'PUT',
        body: JSON.stringify({
          presenceStatus: presenceStatus.value,
          onlineVisibility: onlineVisibility.value,
          profileVisibility: profileVisibility.value,
          friendRequestPolicy: requestPolicy.value
        })
      });
      auth.showToast('Приватність оновлено', 'success');
      await loadSettings();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося зберегти приватність', 'error');
    }
  });

  languageForm?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const result = await auth.apiRequest('/profile/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferredLanguage: preferredLanguage.value
        })
      });
      auth.setSession({ ...auth.getSession(), preferredLanguage: result.preferredLanguage });
      applyLanguageSettings({ preferredLanguage: result.preferredLanguage }, {
        preferredLanguage: result.preferredLanguage,
        preferredLanguageLabel: result.preferredLanguageLabel
      });
      auth.scheduleInterfaceLanguage?.(document.body, true);
      auth.showToast('Мову сайту оновлено', 'success');
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося зберегти мову', 'error');
    }
  });

  loadSettings();
})();
