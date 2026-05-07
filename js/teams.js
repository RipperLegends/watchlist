(() => {
  'use strict';

  const auth = window.WatchlistAuth;
  if (!auth) return;

  const session = auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const state = {
    teams: [],
    activeTeamId: null
  };

  const $ = id => document.getElementById(id);
  const createForm = $('team-create-form');
  const teamsList = $('teams-list');
  const workspace = $('teams-workspace');

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  function api(path, options = {}) {
    return auth.apiRequest(path, options);
  }

  function activeTeam() {
    return state.teams.find(team => team.id === state.activeTeamId) || state.teams[0] || null;
  }

  function renderTeamsList() {
    if (!teamsList) return;
    teamsList.innerHTML = state.teams.length
      ? state.teams.map(team => `
          <button type="button" class="team-list-item ${activeTeam()?.id === team.id ? 'active' : ''}" data-team-id="${team.id}">
            <strong>${escapeHTML(team.name)}</strong>
            <span>${team.members.length} учасників · ${team.items.length} пунктів</span>
          </button>
        `).join('')
      : `<div class="friends-empty compact">Команд ще немає.</div>`;
  }

  function renderWorkspace() {
    const team = activeTeam();
    if (!workspace) return;
    if (!team) {
      workspace.innerHTML = `
        <div class="friends-empty">
          <strong>Оберіть або створіть команду.</strong>
          <span>Після цього тут з’являться учасники, спільний список, голосування і розклад.</span>
        </div>
      `;
      return;
    }

    const isAdmin = team.role === 'admin';
    workspace.innerHTML = `
      <div class="teams-workspace-head">
        <div>
          <p class="eyebrow">Команда</p>
          <h2>${escapeHTML(team.name)}</h2>
          <p>${escapeHTML(team.description || 'Спільний простір для планування перегляду.')}</p>
        </div>
        <span class="badge ${isAdmin ? 'badge-role-admin' : 'badge-role-user'}">${escapeHTML(team.role)}</span>
      </div>

      <div class="teams-dashboard-grid">
        <article><span>Учасники</span><strong>${team.members.length}</strong></article>
        <article><span>Спільний список</span><strong>${team.items.length}</strong></article>
        <article><span>Голосів</span><strong>${team.items.reduce((sum, item) => sum + (item.votes || 0), 0)}</strong></article>
        <article><span>Розклад</span><strong>${team.items.filter(item => item.scheduledAt).length}</strong></article>
      </div>

      <div class="teams-panels">
        <section class="teams-panel">
          <div class="section-header section-header-compact">
            <h3>Учасники</h3>
            <p>Ролі admin/member і швидке запрошення.</p>
          </div>
          <div class="team-members-list">
            ${team.members.map(member => `
              <div class="team-member-row">
                <span>${escapeHTML(member.name)}</span>
                <strong>${escapeHTML(member.role)}</strong>
              </div>
            `).join('')}
          </div>
          ${isAdmin ? `
            <form class="teams-mini-form" data-team-invite="${team.id}">
              <input type="text" name="username" placeholder="Логін користувача" required>
              <button class="btn btn-secondary" type="submit">Запросити</button>
            </form>
          ` : ''}
        </section>

        <section class="teams-panel">
          <div class="section-header section-header-compact">
            <h3>Спільний Watchlist</h3>
            <p>Пункти для перегляду, гри або командної активності.</p>
          </div>
          <form class="teams-mini-form teams-item-form" data-team-item="${team.id}">
            <input type="text" name="title" placeholder="Назва фільму, серіалу або гри" required>
            <select name="type" aria-label="Тип">
              <option value="movie">Фільм</option>
              <option value="series">Серіал</option>
              <option value="game">Гра</option>
            </select>
            <input type="text" name="scheduledAt" placeholder="Коли дивимось">
            <button class="btn btn-primary" type="submit">Додати</button>
          </form>
          <div class="team-items-list">
            ${team.items.length ? team.items.map(item => `
              <article class="team-item-row">
                <div>
                  <strong>${escapeHTML(item.title)}</strong>
                  <span>${escapeHTML(item.type)}${item.scheduledAt ? ` · ${escapeHTML(item.scheduledAt)}` : ''}</span>
                </div>
                <div>
                  <strong>${item.votes || 0}</strong>
                  <button class="btn btn-sm ${item.votedByMe ? 'btn-secondary' : 'btn-primary'}" data-team-vote="${team.id}" data-item-id="${item.id}">
                    ${item.votedByMe ? 'Голос є' : 'Голос'}
                  </button>
                </div>
              </article>
            `).join('') : '<div class="friends-empty compact">Додайте перший пункт у спільний список.</div>'}
          </div>
        </section>
      </div>
    `;
  }

  function render() {
    if (!state.activeTeamId && state.teams[0]) state.activeTeamId = state.teams[0].id;
    renderTeamsList();
    renderWorkspace();
  }

  async function refreshTeams() {
    state.teams = await api('/teams');
    render();
  }

  createForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('team-name').value.trim();
    const description = $('team-description').value.trim();
    if (!name) return;
    try {
      const team = await api('/teams', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      state.activeTeamId = team.id;
      createForm.reset();
      await refreshTeams();
      auth.showToast('Команду створено', 'success');
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося створити команду', 'error');
    }
  });

  teamsList?.addEventListener('click', event => {
    const button = event.target.closest('[data-team-id]');
    if (!button) return;
    state.activeTeamId = Number(button.dataset.teamId);
    render();
  });

  workspace?.addEventListener('submit', async event => {
    const inviteForm = event.target.closest('[data-team-invite]');
    const itemForm = event.target.closest('[data-team-item]');
    if (!inviteForm && !itemForm) return;
    event.preventDefault();

    try {
      if (inviteForm) {
        await api(`/teams/${inviteForm.dataset.teamInvite}/invite`, {
          method: 'POST',
          body: JSON.stringify({ username: inviteForm.elements.username.value.trim() })
        });
        auth.showToast('Учасника додано', 'success');
      }

      if (itemForm) {
        await api(`/teams/${itemForm.dataset.teamItem}/items`, {
          method: 'POST',
          body: JSON.stringify({
            title: itemForm.elements.title.value.trim(),
            type: itemForm.elements.type.value,
            scheduledAt: itemForm.elements.scheduledAt.value.trim()
          })
        });
        auth.showToast('Пункт додано', 'success');
      }

      await refreshTeams();
    } catch (error) {
      auth.showToast(error.message || 'Дію не виконано', 'error');
    }
  });

  workspace?.addEventListener('click', async event => {
    const button = event.target.closest('[data-team-vote][data-item-id]');
    if (!button) return;
    try {
      await api(`/teams/${button.dataset.teamVote}/items/${button.dataset.itemId}/vote`, { method: 'POST' });
      await refreshTeams();
    } catch (error) {
      auth.showToast(error.message || 'Не вдалося проголосувати', 'error');
    }
  });

  refreshTeams().catch(error => {
    auth.showToast(error.message || 'Не вдалося завантажити команди', 'error');
  });
})();
