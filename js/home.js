(() => {
  'use strict';

  const auth = window.WatchlistAuth;
  const session = auth?.getSession();

  const statNodes = {
    total: document.querySelector('[data-home-stat="total"]'),
    watched: document.querySelector('[data-home-stat="watched"]'),
    watching: document.querySelector('[data-home-stat="watching"]'),
    average: document.querySelector('[data-home-stat="average"]')
  };
  const noteNodes = {
    total: document.querySelector('[data-home-note="total"]'),
    watched: document.querySelector('[data-home-note="watched"]'),
    watching: document.querySelector('[data-home-note="watching"]'),
    average: document.querySelector('[data-home-note="average"]')
  };
  const recentList = document.getElementById('home-recent-list');

  const STATUS_LABELS = {
    watched: 'Переглянуто',
    watching: 'У процесі',
    plan_to_watch: 'У планах'
  };

  function setStat(key, value, note) {
    if (statNodes[key]) statNodes[key].textContent = value;
    if (noteNodes[key] && note) noteNodes[key].textContent = note;
  }

  function normalizeEntry(entry) {
    return {
      ...entry,
      rating: Math.max(0, Math.min(5, Math.round(Number(entry.rating) || 0))),
      posterUrl: entry.posterUrl || entry.poster_url || '',
      createdAt: entry.createdAt || entry.created_at || ''
    };
  }

  function renderLoggedOut() {
    setStat('total', '—', 'Увійдіть, щоб бачити свої записи.');
    setStat('watched', '—', 'Особиста статистика з’явиться після входу.');
    setStat('watching', '—', 'Каталог доступний зареєстрованим користувачам.');
    setStat('average', '—', 'Оцінки рахуються за 5-бальною системою.');
    if (recentList) {
      recentList.innerHTML = '<div class="empty home-empty">Увійдіть або зареєструйтесь, щоб бачити останні записи зі свого каталогу.</div>';
    }
  }

  function renderStats(entries) {
    const watched = entries.filter(entry => entry.status === 'watched').length;
    const watching = entries.filter(entry => entry.status === 'watching').length;
    const planned = entries.filter(entry => entry.status === 'plan_to_watch').length;
    const rated = entries.filter(entry => entry.rating > 0);
    const average = rated.length
      ? (rated.reduce((sum, entry) => sum + entry.rating, 0) / rated.length).toFixed(1)
      : '0';

    setStat('total', String(entries.length), planned ? `${planned} у планах.` : 'Усі записи під рукою.');
    setStat('watched', String(watched), watched ? 'Завершені записи.' : 'Ще нічого не завершено.');
    setStat('watching', String(watching), watching ? 'Активний перегляд.' : 'Немає активного перегляду.');
    setStat('average', `${average}/5`, rated.length ? `${rated.length} оцінених записів.` : 'Оцінок поки немає.');
  }

  function renderRecent(entries) {
    if (!recentList) return;
    if (!entries.length) {
      recentList.innerHTML = '<div class="empty home-empty">Каталог поки порожній. Додайте перший фільм або серіал на сторінці каталогу.</div>';
      return;
    }

    const recent = entries
      .slice()
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .slice(0, 4);

    recentList.innerHTML = recent.map(entry => `
      <a class="home-recent-item" href="/catalog.html" aria-label="Відкрити каталог: ${escapeHTML(entry.title)}">
        <span class="home-recent-poster">
          ${entry.posterUrl ? `<img src="${escapeHTML(entry.posterUrl)}" alt="" loading="lazy">` : `<span>${entry.type === 'series' ? 'С' : 'Ф'}</span>`}
        </span>
        <span class="home-recent-copy">
          <strong>${escapeHTML(entry.title)}</strong>
          <small>${escapeHTML([entry.type === 'series' ? 'Серіал' : 'Фільм', STATUS_LABELS[entry.status], entry.rating ? `${entry.rating}/5` : 'без оцінки'].filter(Boolean).join(' · '))}</small>
        </span>
      </a>
    `).join('');
  }

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  async function init() {
    if (!auth || !session) {
      renderLoggedOut();
      return;
    }

    try {
      const entries = (await auth.apiRequest('/entries')).map(normalizeEntry);
      renderStats(entries);
      renderRecent(entries);
    } catch (error) {
      setStat('total', '—', 'Не вдалося завантажити статистику.');
      if (recentList) {
        recentList.innerHTML = '<div class="empty home-empty">Статистика тимчасово недоступна. Каталог можна відкрити напряму.</div>';
      }
    }
  }

  init();
})();
