(() => {
  'use strict';

  const auth = window.WatchlistAuth;
  if (!auth) return;

  document.documentElement.classList.add('admin-guard-pending');

  const session = auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }

  const state = {
    activeView: 'overview',
    activeDrawerUserId: null,
    users: [],
    entries: [],
    reports: [],
    audits: [],
    maintenance: null,
    summary: {},
    filters: {
      userSearch: '',
      userRole: 'all',
      entrySearch: '',
      entryType: 'all',
      entryRating: 'all',
      reportStatus: 'all'
    }
  };

  const $ = id => document.getElementById(id);

  const editOverlay = $('edit-user-overlay');
  const editForm = $('edit-user-form');
  const addEntryOverlay = $('add-entry-overlay');
  const addEntryForm = $('add-entry-form');
  const confirmOverlay = $('confirm-overlay');
  const confirmMessage = $('confirm-message');
  const confirmYes = $('confirm-yes');
  const confirmCancel = $('confirm-cancel');
  const usersTbody = $('users-tbody');
  const entriesTbody = $('entries-tbody');
  const userSearchInput = $('user-search');
  const userRoleFilter = $('user-role-filter');
  const entrySearchInput = $('entry-search');
  const entryTypeFilter = $('entry-type-filter');
  const entryRatingFilter = $('entry-rating-filter');
  const reportStatusFilter = $('report-status-filter');
  const adminMetricsGrid = $('admin-metrics-grid');
  const adminReportsList = $('admin-reports-list');
  const adminAuditList = $('admin-audit-list');
  const adminMaintenanceSummary = $('admin-maintenance-summary');
  const adminOverviewReports = $('admin-overview-reports');
  const adminOverviewBlocked = $('admin-overview-blocked');
  const adminOverviewMaintenance = $('admin-overview-maintenance');
  const adminModerationBlocked = $('admin-moderation-blocked');
  const adminModerationReports = $('admin-moderation-reports');
  const adminMaintenanceDetails = $('admin-maintenance-details');
  const adminSidebarDbStatus = $('admin-sidebar-db-status');
  const userDrawerOverlay = $('user-drawer-overlay');
  const userDrawer = $('user-drawer');
  const userDrawerBody = $('user-drawer-body');
  const drawerUserName = $('drawer-user-name');
  const drawerEditUser = $('drawer-edit-user');
  const drawerBlockUser = $('drawer-block-user');
  const drawerDeleteUser = $('drawer-delete-user');
  const drawerClose = $('user-drawer-close');
  const LAST_CLEANUP_KEY = 'watchlist_admin_last_cleanup';

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  async function apiRequest(path, options = {}) {
    return auth.apiRequest(path, options);
  }

  async function ensureAdminAccess() {
    try {
      const data = await apiRequest('/profile');
      if (data.user?.role !== 'admin') {
        throw new Error('Forbidden');
      }

      auth.setSession({ ...auth.getSession(), ...data.user });
      document.documentElement.classList.remove('admin-guard-pending');
      return true;
    } catch (error) {
      auth.showToast(error.message || 'Доступ лише для адміністратора');
      window.location.replace('index.html');
      return false;
    }
  }

  function statusLabel(status) {
    if (status === 'completed') return 'Переглянуто';
    if (status === 'watching') return 'Дивлюся';
    if (status === 'planned') return 'В планах';
    return status || '—';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function setAdminView(view) {
    state.activeView = view || 'overview';
    document.querySelectorAll('[data-admin-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.adminView === state.activeView);
    });
    document.querySelectorAll('[data-admin-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.adminPanel === state.activeView);
    });
  }

  function getUserStats(userId) {
    const userEntries = state.entries.filter(entry => entry.userId === userId);
    const movies = userEntries.filter(entry => entry.type === 'movie').length;
    const series = userEntries.filter(entry => entry.type === 'series').length;
    const favorites = userEntries.filter(entry => entry.isFavorite).length;
    const avg = userEntries.length
      ? (userEntries.reduce((sum, entry) => sum + (entry.rating || 0), 0) / userEntries.length).toFixed(1)
      : '0.0';

    return {
      total: userEntries.length,
      movies,
      series,
      favorites,
      average: avg
    };
  }

  function getFilteredUsers() {
    const { userSearch, userRole } = state.filters;
    return state.users.filter(user => {
      const roleMatches = userRole === 'all' ||
        (userRole === 'blocked' ? user.accountStatus === 'blocked' : user.role === userRole);

      return roleMatches &&
      (!userSearch ||
        user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase()));
    });
  }

  function getFilteredEntries() {
    const { entrySearch, entryType, entryRating } = state.filters;
    return state.entries.filter(entry => {
      if (entryType !== 'all' && entry.type !== entryType) return false;
      if (entryRating !== 'all' && (entry.rating || 0) < +entryRating) return false;
      if (!entrySearch) return true;
      const query = entrySearch.toLowerCase();
      return entry.title.toLowerCase().includes(query) ||
        (entry.userName || '').toLowerCase().includes(query) ||
        (entry.director || '').toLowerCase().includes(query);
    });
  }

  function getFilteredReports() {
    const { reportStatus } = state.filters;
    return state.reports.filter(report => reportStatus === 'all' || report.status === reportStatus);
  }

  function reportStatusLabel(status) {
    if (status === 'new') return 'нове';
    if (status === 'reviewing') return 'в роботі';
    if (status === 'answered') return 'з відповіддю';
    if (status === 'closed') return 'закрите';
    return status || 'нове';
  }

  function accountStatusLabel(status) {
    return status === 'blocked' ? 'заблоковано' : 'активний';
  }

  function renderUsers() {
    const filteredUsers = getFilteredUsers();
    usersTbody.innerHTML = filteredUsers.length ? filteredUsers.map(user => {
      const stats = getUserStats(user.id);
      return `
        <tr>
          <td>
            <div class="admin-primary-cell">
              <strong>${escapeHTML(user.name)}</strong>
              <span>ID: ${user.id}</span>
            </div>
          </td>
          <td>${escapeHTML(user.email)}</td>
          <td><span class="badge ${user.role === 'admin' ? 'badge-role-admin' : 'badge-role-user'}">${user.role}</span></td>
          <td><span class="badge ${user.accountStatus === 'blocked' ? 'badge-status badge-status-planned' : 'badge-status badge-status-completed'}">${accountStatusLabel(user.accountStatus)}</span></td>
          <td>
            <div class="admin-metric-stack">
              <span>${stats.total} записів</span>
              <span>${stats.movies} фільмів · ${stats.series} серіалів</span>
              <span>${stats.favorites} улюблених · ${stats.average} рейтинг</span>
            </div>
          </td>
          <td class="admin-actions-cell">
            <button class="btn btn-sm btn-secondary" data-view-user="${user.id}" title="Деталі">Деталі</button>
            <button class="btn btn-sm btn-edit" data-edit-user="${user.id}" title="Редагувати">✏️</button>
            ${user.id !== session.id ? `<button class="btn btn-sm" data-block-user="${user.id}">${user.accountStatus === 'blocked' ? 'Розблокувати' : 'Блок'}</button>` : ''}
            ${user.id !== session.id ? `<button class="btn btn-sm btn-danger" data-delete-user="${user.id}" title="Видалити">🗑️</button>` : ''}
          </td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="admin-empty-row">Нічого не знайдено за вашим запитом</td></tr>';
  }

  function renderEntries() {
    const filteredEntries = getFilteredEntries();
    entriesTbody.innerHTML = filteredEntries.length ? filteredEntries.map(entry => `
      <tr>
        <td class="entry-title-cell">
          <div class="entry-thumb">${entry.posterUrl ? `<img src="${escapeHTML(entry.posterUrl)}" alt="">` : '<div class="thumb-placeholder">🎞️</div>'}</div>
          <div class="admin-primary-cell">
            <strong>${escapeHTML(entry.title)}</strong>
            <span>${entry.year ? escapeHTML(String(entry.year)) : 'Рік не вказано'}${entry.director ? ` · ${escapeHTML(entry.director)}` : ''}</span>
          </div>
        </td>
        <td>${entry.type === 'movie' ? 'Фільм' : 'Серіал'}</td>
        <td>${escapeHTML(entry.userName || '')}</td>
        <td><span class="badge badge-status badge-status-${entry.status}">${escapeHTML(statusLabel(entry.status))}</span></td>
        <td>${entry.rating || 0}/5</td>
        <td class="admin-actions-cell">
          <button class="btn btn-sm btn-edit" data-edit-entry="${entry.id}" title="Редагувати">✏️</button>
          <button class="btn btn-sm btn-danger" data-delete-entry="${entry.id}" title="Видалити">🗑️</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="admin-empty-row">Нічого не знайдено за вашим запитом</td></tr>';
  }

  function render() {
    renderUsers();
    renderEntries();
  }

  function renderReports() {
    if (!adminReportsList) return;
    const reports = getFilteredReports();
    const columns = [
      ['new', 'Нові'],
      ['reviewing', 'В роботі'],
      ['answered', 'З відповіддю'],
      ['closed', 'Закриті']
    ];

    const renderCard = report => `
      <article class="admin-report-card">
        <div class="admin-report-card-head">
          <strong>${escapeHTML(report.subject)}</strong>
          <span>${escapeHTML(reportStatusLabel(report.status))}</span>
        </div>
        <p>${escapeHTML(report.body)}</p>
        <div class="admin-report-history">
          <span>Створено: ${escapeHTML(formatDate(report.createdAt))}</span>
          ${report.respondedAt ? `<span>Відповідь: ${escapeHTML(formatDate(report.respondedAt))}</span>` : '<span>Відповіді ще немає</span>'}
        </div>
        <div class="admin-report-thread">
          ${(report.messages || []).length ? report.messages.map(message => `
            <div class="admin-report-message ${message.senderRole === 'admin' ? 'admin' : 'user'}">
              <strong>${message.senderRole === 'admin' ? 'Адмін' : escapeHTML(report.userName || report.email || 'Користувач')}</strong>
              <span>${escapeHTML(formatDate(message.createdAt))}</span>
              <p>${escapeHTML(message.body)}</p>
            </div>
          `).join('') : '<p class="admin-empty-row">Історія переписки порожня.</p>'}
        </div>
        <form class="admin-report-reply" data-report-reply="${report.id}">
          <textarea name="adminResponse" rows="3" placeholder="Напишіть нове повідомлення користувачу..."></textarea>
          <div class="admin-report-actions">
            <select name="status" class="admin-inline-filter">
              ${columns.map(([value, label]) => `<option value="${value}" ${report.status === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            <button type="submit" class="btn btn-sm btn-primary">Надіслати</button>
            <button type="button" class="btn btn-sm btn-danger" data-delete-report="${report.id}">Видалити</button>
          </div>
        </form>
      </article>
    `;

    if (!reports.length) {
      adminReportsList.innerHTML = '<p class="admin-empty-row">Звернень з таким статусом немає.</p>';
      return;
    }

    adminReportsList.innerHTML = `
      <div class="admin-report-board">
        ${columns.map(([status, label]) => {
          const items = reports.filter(report => report.status === status);
          if (state.filters.reportStatus !== 'all' && state.filters.reportStatus !== status) return '';
          return `
            <section class="admin-report-column">
              <div class="admin-report-column-head">
                <h3>${label}</h3>
                <span>${items.length}</span>
              </div>
              <div class="admin-report-column-list">
                ${items.length ? items.map(renderCard).join('') : '<p class="admin-empty-row">Порожньо</p>'}
              </div>
            </section>
          `;
        }).join('')}
      </div>
    `;
  }

  function maintenanceMarkup(compact = false) {
    const maintenance = state.maintenance || { total: 0, tables: [] };
    const nonEmpty = (maintenance.tables || []).filter(table => table.count > 0);
    const pills = nonEmpty.length
      ? nonEmpty.map(table => `<span class="admin-maintenance-pill">${escapeHTML(table.label)}: ${table.count}</span>`).join('')
      : '<span class="admin-maintenance-pill">База чиста</span>';
    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY);

    return `
      <div>
        <span>Сироти БД</span>
        <strong>${maintenance.total || 0}</strong>
        <p>${maintenance.total ? 'Можна безпечно прибрати записи без існуючих зв’язків.' : 'Зв’язки виглядають коректно.'}</p>
        ${compact ? '' : `<p>Остання очистка: ${escapeHTML(lastCleanup ? formatDate(lastCleanup) : 'ще не запускалась')}</p>`}
      </div>
      <div class="admin-maintenance-list">${pills}</div>
    `;
  }

  function renderMaintenance() {
    if (adminMaintenanceSummary) adminMaintenanceSummary.innerHTML = maintenanceMarkup(false);
    if (adminOverviewMaintenance) adminOverviewMaintenance.innerHTML = maintenanceMarkup(true);
    if (adminSidebarDbStatus) {
      const total = state.maintenance?.total || 0;
      adminSidebarDbStatus.textContent = total ? `${total} проблем` : 'База чиста';
    }
    if (adminMaintenanceDetails) {
      const tables = state.maintenance?.tables || [];
      adminMaintenanceDetails.innerHTML = `
        <div class="admin-maintenance-detail-grid">
          ${tables.map(table => `
            <article class="admin-maintenance-detail ${table.count ? 'has-issues' : ''}">
              <span>${escapeHTML(table.label)}</span>
              <strong>${table.count || 0}</strong>
            </article>
          `).join('')}
        </div>
      `;
    }
  }

  function renderMiniReports(target, reports) {
    if (!target) return;
    target.innerHTML = reports.length
      ? reports.slice(0, 5).map(report => `
          <button class="admin-mini-row" type="button" data-jump-view="reports">
            <strong>${escapeHTML(report.subject)}</strong>
            <span>${escapeHTML(reportStatusLabel(report.status))} · ${escapeHTML(report.email || report.userName || 'користувач')}</span>
          </button>
        `).join('')
      : '<p class="admin-empty-row">Немає тікетів для відповіді.</p>';
  }

  function renderMiniUsers(target, users) {
    if (!target) return;
    target.innerHTML = users.length
      ? users.slice(0, 6).map(user => `
          <button class="admin-mini-row" type="button" data-view-user="${user.id}">
            <strong>${escapeHTML(user.name)}</strong>
            <span>${escapeHTML(user.email)} · ${escapeHTML(user.role)}</span>
          </button>
        `).join('')
      : '<p class="admin-empty-row">Заблокованих акаунтів немає.</p>';
  }

  function renderOverview() {
    const openReports = state.reports.filter(report => ['new', 'reviewing'].includes(report.status));
    const blockedUsers = state.users.filter(user => user.accountStatus === 'blocked');
    renderMiniReports(adminOverviewReports, openReports);
    renderMiniReports(adminModerationReports, openReports);
    renderMiniUsers(adminOverviewBlocked, blockedUsers);
    renderMiniUsers(adminModerationBlocked, blockedUsers);
  }

  function renderAdminStats(data) {
    state.reports = data?.reports || [];
    state.maintenance = data?.maintenance || null;
    state.audits = data?.audits || [];
    state.summary = data?.summary || {};

    if (adminMetricsGrid) {
      const summary = state.summary;
      const cards = [
        ['Користувачі', summary.users || 0],
        ['Заблоковані', summary.blockedUsers || 0],
        ['Записи', summary.entries || 0],
        ['Повідомлення', summary.messages || 0],
        ['Дружби', summary.friendRelations || 0],
        ['Публічні записи', summary.publicEntries || 0]
      ];
      adminMetricsGrid.innerHTML = cards.map(([label, value]) => `
        <article class="admin-metric-card">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(String(value))}</strong>
        </article>
      `).join('');
    }

    renderReports();
    renderMaintenance();
    renderOverview();

    if (adminAuditList) {
      adminAuditList.innerHTML = state.audits.length
        ? state.audits.map(audit => `
            <div class="admin-log-row">
              <strong>${escapeHTML(audit.action)}</strong>
              <span>${escapeHTML(audit.userName || 'Система')} · ${escapeHTML(audit.createdAt || '')}</span>
              <p>${escapeHTML(audit.details || '')}</p>
            </div>
          `).join('')
        : '<p class="admin-empty-row">Аудит поки порожній.</p>';
    }
  }

  async function refreshData() {
    const [users, entries, stats] = await Promise.all([
      apiRequest('/admin/users'),
      apiRequest('/admin/entries'),
      apiRequest('/admin/stats')
    ]);
    state.users = users;
    state.entries = entries;
    renderAdminStats(stats);
    render();
  }

  function openConfirm(message) {
    return new Promise(resolve => {
      confirmMessage.textContent = message;
      confirmOverlay.classList.add('active');

      const cleanup = () => {
        confirmOverlay.classList.remove('active');
        confirmYes.removeEventListener('click', onYes);
        confirmCancel.removeEventListener('click', onCancel);
        confirmOverlay.removeEventListener('click', onBackdrop);
      };

      const onYes = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onBackdrop = e => { if (e.target === confirmOverlay) { cleanup(); resolve(false); } };

      confirmYes.addEventListener('click', onYes);
      confirmCancel.addEventListener('click', onCancel);
      confirmOverlay.addEventListener('click', onBackdrop);
    });
  }

  function openEditUser(userId) {
    const user = state.users.find(item => item.id === userId);
    if (!user) return;

    $('edit-user-id').value = user.id;
    $('edit-user-name').value = user.name;
    $('edit-user-email').value = user.email;
    $('edit-user-password').value = '';
    $('edit-user-role').value = user.role;
    editOverlay.classList.add('active');
  }

  function closeEditUser() {
    editOverlay.classList.remove('active');
  }

  function fillEntryForm(entry = null) {
    $('entry-id').value = entry?.id || '';
    $('entry-title').value = entry?.title || '';
    $('entry-type').value = entry?.type || 'movie';
    $('entry-status').value = entry?.status || 'completed';
    $('entry-rating').value = entry?.rating || 3;
    $('entry-year').value = entry?.year || '';
    $('entry-genre').value = Array.isArray(entry?.genre) ? entry.genre.join(', ') : '';
    $('entry-tags').value = Array.isArray(entry?.tags) ? entry.tags.join(', ') : '';
    $('entry-mood').value = entry?.mood || '';
    $('entry-director').value = entry?.director || '';
    $('entry-runtime').value = entry?.runtime || '';
    $('entry-poster').value = entry?.posterUrl || '';
    $('entry-favorite').checked = !!entry?.isFavorite;
    $('entry-comment').value = entry?.comment || '';
  }

  async function openAddEntry() {
    fillEntryForm();
    const modalTitle = addEntryOverlay.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = '➕ Додати новий запис';
    addEntryOverlay.classList.add('active');
  }

  function openEditEntry(entryId) {
    const entry = state.entries.find(item => item.id === entryId);
    if (!entry) return;
    fillEntryForm(entry);
    const modalTitle = addEntryOverlay.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = '✏️ Редагувати запис';
    addEntryOverlay.classList.add('active');
  }

  function closeAddEntry() {
    addEntryOverlay.classList.remove('active');
    addEntryForm.reset();
  }

  function renderUserDrawer(user) {
    if (!userDrawerBody || !drawerUserName) return;
    const stats = getUserStats(user.id);
    const entries = state.entries.filter(entry => entry.userId === user.id).slice(0, 5);
    drawerUserName.textContent = user.name;
    userDrawerBody.innerHTML = `
      <div class="admin-drawer-identity">
        <div class="profile-avatar small">${escapeHTML(user.name?.[0]?.toUpperCase() || '?')}</div>
        <div>
          <strong>${escapeHTML(user.name)}</strong>
          <span>${escapeHTML(user.email)}</span>
        </div>
      </div>
      <div class="admin-drawer-stats">
        <div><span>Роль</span><strong>${escapeHTML(user.role)}</strong></div>
        <div><span>Статус</span><strong>${accountStatusLabel(user.accountStatus)}</strong></div>
        <div><span>Записи</span><strong>${stats.total}</strong></div>
        <div><span>Оцінка</span><strong>${stats.average}/5</strong></div>
      </div>
      <div class="admin-drawer-section">
        <h3>Останній контент</h3>
        ${entries.length ? entries.map(entry => `
          <div class="admin-drawer-row">
            <strong>${escapeHTML(entry.title)}</strong>
            <span>${escapeHTML(statusLabel(entry.status))} · ${entry.rating || 0}/5</span>
          </div>
        `).join('') : '<p class="admin-empty-row">Записів поки немає.</p>'}
      </div>
    `;

    if (drawerBlockUser) {
      drawerBlockUser.textContent = user.accountStatus === 'blocked' ? 'Розблокувати' : 'Блок';
      drawerBlockUser.hidden = Number(user.id) === Number(session.id);
    }
    if (drawerDeleteUser) drawerDeleteUser.hidden = Number(user.id) === Number(session.id);
  }

  function openUserDrawer(userId) {
    const user = state.users.find(item => Number(item.id) === Number(userId));
    if (!user || !userDrawerOverlay || !userDrawer) return;
    state.activeDrawerUserId = user.id;
    renderUserDrawer(user);
    userDrawerOverlay.classList.add('active');
    userDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeUserDrawer() {
    state.activeDrawerUserId = null;
    userDrawerOverlay?.classList.remove('active');
    userDrawer?.setAttribute('aria-hidden', 'true');
  }

  async function toggleUserBlock(userId) {
    const user = state.users.find(item => Number(item.id) === Number(userId));
    if (!user) return;
    const shouldBlock = user.accountStatus !== 'blocked';
    await apiRequest(`/admin/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ blocked: shouldBlock })
    });
    await refreshData();
    if (state.activeDrawerUserId) {
      const updated = state.users.find(item => Number(item.id) === Number(state.activeDrawerUserId));
      if (updated) renderUserDrawer(updated);
    }
    auth.showToast(shouldBlock ? 'Користувача заблоковано' : 'Користувача розблоковано');
  }

  async function deleteUser(userId) {
    const confirmed = await openConfirm('Ви впевнені, що хочете видалити цього користувача? Це видалить і всі його записи.');
    if (!confirmed) return;
    await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
    closeUserDrawer();
    await refreshData();
    auth.showToast('Користувача видалено');
  }

  function resetUserFilters() {
    state.filters.userSearch = '';
    state.filters.userRole = 'all';
    userSearchInput.value = '';
    userRoleFilter.value = 'all';
    renderUsers();
  }

  function resetEntryFilters() {
    state.filters.entrySearch = '';
    state.filters.entryType = 'all';
    state.filters.entryRating = 'all';
    entrySearchInput.value = '';
    entryTypeFilter.value = 'all';
    entryRatingFilter.value = 'all';
    renderEntries();
  }

  addEntryOverlay.addEventListener('click', event => {
    if (event.target === addEntryOverlay) closeAddEntry();
  });
  $('add-entry-close').addEventListener('click', closeAddEntry);
  $('add-entry-cancel').addEventListener('click', closeAddEntry);

  editOverlay.addEventListener('click', event => {
    if (event.target === editOverlay) closeEditUser();
  });
  $('edit-user-close').addEventListener('click', closeEditUser);
  $('edit-user-cancel').addEventListener('click', closeEditUser);

  editForm.addEventListener('submit', async event => {
    event.preventDefault();

    const id = +$('edit-user-id').value;
    const name = $('edit-user-name').value.trim();
    const email = $('edit-user-email').value.trim().toLowerCase();
    const password = $('edit-user-password').value;
    const role = $('edit-user-role').value;

    if (!name || !email) {
      auth.showToast("Ім'я та email обов'язкові");
      return;
    }

    try {
      await apiRequest(`/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, password, role })
      });
      closeEditUser();
      await refreshData();
      auth.showToast('Користувача оновлено');
    } catch (error) {
      auth.showToast(error.message);
    }
  });

  addEntryForm.addEventListener('submit', async event => {
    event.preventDefault();

    const entryId = +$('entry-id').value || null;
    const payload = {
      title: $('entry-title').value.trim(),
      type: $('entry-type').value,
      status: $('entry-status').value,
      rating: +$('entry-rating').value || 0,
      year: +$('entry-year').value || null,
      genre: $('entry-genre').value.split(',').map(item => item.trim()).filter(Boolean),
      tags: $('entry-tags').value.split(',').map(item => item.trim()).filter(Boolean),
      mood: $('entry-mood').value.trim(),
      posterUrl: $('entry-poster').value.trim(),
      director: $('entry-director').value.trim(),
      runtime: +$('entry-runtime').value || 0,
      comment: $('entry-comment').value.trim(),
      isFavorite: $('entry-favorite').checked
    };

    if (!payload.title) {
      auth.showToast('Введіть назву запису');
      return;
    }

    try {
      if (entryId) {
        await apiRequest(`/entries/${entryId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/admin/entries', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      closeAddEntry();
      await refreshData();
      auth.showToast(entryId ? 'Запис оновлено' : 'Запис додано');
    } catch (error) {
      auth.showToast(error.message);
    }
  });

  document.addEventListener('submit', async event => {
    const replyForm = event.target.closest('[data-report-reply]');
    if (!replyForm) return;
    event.preventDefault();

    const reportId = Number(replyForm.dataset.reportReply);
    const adminResponse = replyForm.elements.adminResponse?.value.trim() || '';
    const status = replyForm.elements.status?.value || 'answered';

    try {
      if (adminResponse) {
        await apiRequest(`/reports/${reportId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body: adminResponse, status })
        });
      } else {
        await apiRequest(`/admin/reports/${reportId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        });
      }
      await refreshData();
      auth.showToast(adminResponse ? 'Повідомлення у звернення надіслано' : 'Статус звернення оновлено', 'success');
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося оновити звернення', 'error');
    }
  });

  document.addEventListener('click', async event => {
    const navBtn = event.target.closest('[data-admin-view], [data-jump-view]');
    if (navBtn) {
      setAdminView(navBtn.dataset.adminView || navBtn.dataset.jumpView);
      return;
    }

    const viewUserBtn = event.target.closest('[data-view-user]');
    if (viewUserBtn) {
      openUserDrawer(+viewUserBtn.dataset.viewUser);
      return;
    }

    const deleteReportBtn = event.target.closest('[data-delete-report]');
    if (deleteReportBtn) {
      const reportId = Number(deleteReportBtn.dataset.deleteReport);
      const confirmed = await openConfirm('Видалити це звернення разом з усією перепискою?');
      if (!confirmed) return;
      try {
        await apiRequest(`/admin/reports/${reportId}`, { method: 'DELETE' });
        await refreshData();
        auth.showToast('Звернення видалено', 'success');
      } catch (error) {
        auth.showToast(error.message || 'Не вдалося видалити звернення', 'error');
      }
      return;
    }

    const editUserBtn = event.target.closest('[data-edit-user]');
    if (editUserBtn) {
      openEditUser(+editUserBtn.dataset.editUser);
      return;
    }

    const deleteUserBtn = event.target.closest('[data-delete-user]');
    if (deleteUserBtn) {
      const userId = +deleteUserBtn.dataset.deleteUser;
      try {
        await deleteUser(userId);
      } catch (error) {
        auth.showToast(error.message);
      }
      return;
    }

    const blockUserBtn = event.target.closest('[data-block-user]');
    if (blockUserBtn) {
      const userId = +blockUserBtn.dataset.blockUser;
      try {
        await toggleUserBlock(userId);
      } catch (error) {
        auth.showToast(error.message);
      }
      return;
    }

    const deleteEntryBtn = event.target.closest('[data-delete-entry]');
    const editEntryBtn = event.target.closest('[data-edit-entry]');
    if (editEntryBtn) {
      openEditEntry(+editEntryBtn.dataset.editEntry);
      return;
    }

    if (deleteEntryBtn) {
      const entryId = +deleteEntryBtn.dataset.deleteEntry;
      const confirmed = await openConfirm('Ви впевнені, що хочете видалити цей запис?');
      if (!confirmed) return;

      try {
        await apiRequest(`/admin/entries/${entryId}`, { method: 'DELETE' });
        await refreshData();
        auth.showToast('Запис видалено');
      } catch (error) {
        auth.showToast(error.message);
      }
    }
  });

  userSearchInput.addEventListener('input', event => {
    state.filters.userSearch = event.target.value;
    renderUsers();
  });

  userRoleFilter.addEventListener('change', event => {
    state.filters.userRole = event.target.value;
    renderUsers();
  });

  entrySearchInput.addEventListener('input', event => {
    state.filters.entrySearch = event.target.value;
    renderEntries();
  });

  entryTypeFilter.addEventListener('change', event => {
    state.filters.entryType = event.target.value;
    renderEntries();
  });

  entryRatingFilter.addEventListener('change', event => {
    state.filters.entryRating = event.target.value;
    renderEntries();
  });

  reportStatusFilter?.addEventListener('change', event => {
    state.filters.reportStatus = event.target.value;
    renderReports();
  });

  $('btn-reset-users').addEventListener('click', resetUserFilters);
  $('btn-reset-entries').addEventListener('click', resetEntryFilters);
  $('btn-add-admin-entry').addEventListener('click', openAddEntry);
  $('btn-clean-orphans')?.addEventListener('click', async () => {
    const confirmed = await openConfirm('Очистити сироти БД? Будуть прибрані лише записи без існуючих зв’язків.');
    if (!confirmed) return;

    try {
      const result = await apiRequest('/admin/maintenance/cleanup-orphans', { method: 'POST' });
      localStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());
      await refreshData();
      auth.showToast(`Очищено записів: ${result?.removed?.total || 0}`);
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося очистити сироти БД');
    }
  });

  drawerClose?.addEventListener('click', closeUserDrawer);
  userDrawerOverlay?.addEventListener('click', event => {
    if (event.target === userDrawerOverlay) closeUserDrawer();
  });
  drawerEditUser?.addEventListener('click', () => {
    if (!state.activeDrawerUserId) return;
    openEditUser(state.activeDrawerUserId);
  });
  drawerBlockUser?.addEventListener('click', async () => {
    if (!state.activeDrawerUserId) return;
    try {
      await toggleUserBlock(state.activeDrawerUserId);
    } catch (error) {
      auth.showToast(error.message);
    }
  });
  drawerDeleteUser?.addEventListener('click', async () => {
    if (!state.activeDrawerUserId) return;
    try {
      await deleteUser(state.activeDrawerUserId);
    } catch (error) {
      auth.showToast(error.message);
    }
  });

  async function startAdminPanel() {
    if (!await ensureAdminAccess()) return;

    try {
      await refreshData();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося завантажити адмін панель');
      window.location.replace('index.html');
    }
  }

  startAdminPanel();
})();
