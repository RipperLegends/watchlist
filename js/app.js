(async () => {
  'use strict';

  const auth = window.WatchlistAuth;
  const session = auth?.getSession();
  const isAdmin = session?.role === 'admin';

  const $ = s => document.querySelector(s);
  const watchlistEl = $('#watchlist');
  const recoEl = $('#recommendations');
  const modalOverlay = $('#modal-overlay');
  const confirmOverlay = $('#confirm-overlay');
  const randomOverlay = $('#random-overlay');
  const detailsOverlay = $('#details-overlay');
  const detailsTitle = $('#details-title');
  const detailsContent = $('#details-content');
  const detailsCloseBtn = $('#btn-details-close');
  const toastContainer = $('#toast-container');
  const form = $('#entry-form');
  const modalTitle = $('#modal-title');
  const filterType = $('#filter-type');
  const filterStatus = $('#filter-status');
  const filterRating = $('#filter-rating');
  const filterFavorite = $('#filter-favorite');
  const sortBy = $('#sort-by');
  const searchInput = $('#search-input');
  const resetFiltersBtn = $('#btn-reset-filters');
  const filtersStatus = $('#filters-status');
  const randomMood = $('#random-mood');
  const randomTime = $('#random-time');
  const randomGenre = $('#random-genre');
  const heroEyebrow = $('#hero-eyebrow');
  const heroTitle = $('#hero-title');
  const heroSubtitle = $('#hero-subtitle');
  const heroPrimaryAction = $('#hero-primary-action');
  const recommendationsIntro = $('#recommendations-intro');
  const searchDebounceDelay = 250;
  const starRating = $('#star-rating');
  const ratingInput = $('#entry-rating');
  const mediaSuggestionsEl = $('#media-suggestions');
  const entryTitleInput = $('#entry-title');
  const viewGridBtn = $('#btn-view-grid');
  const viewListBtn = $('#btn-view-list');
  const CATALOG_VIEW_KEY = 'watchlist_catalog_view';

  let entries = [];
  let recommendationSets = [];
  let deleteTargetId = null;
  let draggedEntryId = null;
  let catalogView = localStorage.getItem(CATALOG_VIEW_KEY) === 'list' ? 'list' : 'grid';

  function showToast(msg, cls = '') {
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '');
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function migrateEntry(e) {
    if (typeof e.genre === 'string' && e.genre) {
      try { e.genre = JSON.parse(e.genre); } catch { e.genre = e.genre.split(',').map(g => g.trim()).filter(Boolean); }
    } else if (!Array.isArray(e.genre)) {
      e.genre = [];
    }
    if (typeof e.tags === 'string' && e.tags) {
      try { e.tags = JSON.parse(e.tags); } catch { e.tags = e.tags.split(',').map(t => t.trim()).filter(Boolean); }
    } else if (!Array.isArray(e.tags)) {
      e.tags = [];
    }
    if (e.status === 'watched') e.status = 'completed';
    if (e.status === 'plan_to_watch') e.status = 'planned';
    if (!e.status) e.status = 'completed';
    if (typeof e.isFavorite !== 'boolean') e.isFavorite = !!e.isFavorite;
    if (!e.posterUrl) e.posterUrl = e.poster_url || '';
    if (!e.director) e.director = '';
    if (!e.runtime) e.runtime = 0;
    e.rating = Math.max(0, Math.min(5, Math.round(Number(e.rating) || 0)));
    if (!e.mood) e.mood = '';
    e.currentSeason = e.currentSeason || e.current_season || 0;
    e.currentEpisode = e.currentEpisode || e.current_episode || 0;
    e.nextEpisodeDate = e.nextEpisodeDate || e.next_episode_date || '';
    return e;
  }

  async function apiRequest(path, options = {}) {
    if (!auth) throw new Error('Auth not available');
    return auth.apiRequest(path, options);
  }

  async function loadEntries() {
    if (session) {
      try {
        return (await apiRequest('/entries')).map(migrateEntry);
      } catch (error) {
        console.warn('API entries failed', error);
      }
      return [];
    }
    return [];
  }

  async function loadRecommendationSets() {
    try {
      const response = await fetch('/api/recommendations');
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data?.sets) ? data.sets : [];
    } catch (error) {
      return [];
    }
  }

  async function createEntry(entry) {
    if (!session) throw new Error('Увійдіть, щоб додавати записи.');
    const apiEntry = { ...entry };
    const response = await apiRequest('/entries', { method: 'POST', body: JSON.stringify(apiEntry) });
    return { ...entry, id: response.id, userId: session.id, createdByAdmin: isAdmin, createdAt: entry.createdAt || new Date().toISOString().slice(0, 10) };
  }

  async function updateEntry(entry) {
    if (!session) throw new Error('Увійдіть, щоб редагувати записи.');
    await apiRequest(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) });
    return entry;
  }

  async function deleteEntryById(id) {
    if (!session) throw new Error('Увійдіть, щоб видаляти записи.');
    await apiRequest(`/entries/${id}`, { method: 'DELETE' });
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function canEditEntry(entry) {
    if (!session) return false;
    return isAdmin || Number(entry.userId) === Number(session.id);
  }

  function setStars(v) {
    const rating = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    ratingInput.value = rating;
    starRating.querySelectorAll('.star').forEach(s => s.classList.toggle('active', +s.dataset.value <= rating));
  }

  if (starRating) {
    starRating.addEventListener('click', e => {
      const star = e.target.closest('.star');
      if (!star) return;
      setStars(+star.dataset.value);
    });
  }

  function openModal(entry = null) {
    if (!session) {
      showToast('Увійдіть або зареєструйтесь, щоб додавати власні записи.', 'error');
      setTimeout(() => { window.location.href = '/login.html'; }, 500);
      return;
    }
    form.reset(); setStars(0);
    if (mediaSuggestionsEl) mediaSuggestionsEl.innerHTML = '';
    $('#entry-id').value = '';
    $('#entry-poster').value = '';
    $('#entry-director').value = '';
    $('#entry-runtime').value = '';
    $('#entry-favorite').checked = false;
    $('#entry-status').value = 'completed';
    $('#entry-tags').value = '';
    $('#entry-mood').value = '';
    $('#entry-season').value = '';
    $('#entry-episode').value = '';
    $('#entry-next-episode').value = '';
    if (entry) {
      modalTitle.textContent = 'Редагувати запис';
      $('#entry-id').value = entry.id;
      $('#entry-title').value = entry.title;
      $('#entry-type').value = entry.type;
      $('#entry-genre').value = Array.isArray(entry.genre) ? entry.genre.join(', ') : (entry.genre || '');
      $('#entry-tags').value = Array.isArray(entry.tags) ? entry.tags.join(', ') : (entry.tags || '');
      $('#entry-mood').value = entry.mood || '';
      $('#entry-year').value = entry.year || '';
      $('#entry-comment').value = entry.comment || '';
      $('#entry-status').value = entry.status || 'completed';
      $('#entry-poster').value = entry.posterUrl || '';
      $('#entry-director').value = entry.director || '';
      $('#entry-runtime').value = entry.runtime || '';
      $('#entry-season').value = entry.currentSeason || '';
      $('#entry-episode').value = entry.currentEpisode || '';
      $('#entry-next-episode').value = entry.nextEpisodeDate || '';
      $('#entry-favorite').checked = !!entry.isFavorite;
      setStars(entry.rating || 0);
    } else {
      modalTitle.textContent = 'Додати запис';
    }
    modalOverlay.classList.add('active');
  }

  function openPrefilledModal(item) {
    openModal();
    $('#entry-title').value = item.title || '';
    $('#entry-type').value = item.type === 'series' ? 'series' : 'movie';
    $('#entry-genre').value = Array.isArray(item.genre) ? item.genre.join(', ') : (item.tags || []).join(', ');
    $('#entry-tags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    $('#entry-mood').value = item.mood || '';
    $('#entry-year').value = item.year || '';
    $('#entry-poster').value = item.posterUrl || '';
    $('#entry-status').value = 'planned';
    if (item.rating) setStars(Math.max(0, Math.min(5, Math.round(item.rating))));
    if (item.description) $('#entry-comment').value = item.description;
  }

  function closeModal() { modalOverlay.classList.remove('active'); }

  function setCatalogView(mode) {
    catalogView = mode === 'list' ? 'list' : 'grid';
    localStorage.setItem(CATALOG_VIEW_KEY, catalogView);
    watchlistEl.classList.toggle('view-list', catalogView === 'list');
    watchlistEl.classList.toggle('view-grid', catalogView === 'grid');
    viewGridBtn?.classList.toggle('active', catalogView === 'grid');
    viewListBtn?.classList.toggle('active', catalogView === 'list');
    viewGridBtn?.setAttribute('aria-pressed', catalogView === 'grid' ? 'true' : 'false');
    viewListBtn?.setAttribute('aria-pressed', catalogView === 'list' ? 'true' : 'false');
  }

  viewGridBtn?.addEventListener('click', () => setCatalogView('grid'));
  viewListBtn?.addEventListener('click', () => setCatalogView('list'));

  function fillFromMedia(item) {
    if (!item) return;
    $('#entry-title').value = item.title || $('#entry-title').value;
    $('#entry-type').value = item.type === 'series' ? 'series' : 'movie';
    if (item.year) $('#entry-year').value = item.year;
    if (item.posterUrl) $('#entry-poster').value = item.posterUrl;
    if (Array.isArray(item.genre) && item.genre.length) $('#entry-genre').value = item.genre.join(', ');
    if (item.rating) setStars(Math.max(0, Math.min(5, Math.round(item.rating))));
    if (item.overview && !$('#entry-comment').value.trim()) $('#entry-comment').value = item.overview;
    if (mediaSuggestionsEl) mediaSuggestionsEl.innerHTML = '';
  }

  async function searchMediaSuggestions() {
    if (!mediaSuggestionsEl || !session) return;
    const query = entryTitleInput?.value.trim() || '';
    if (query.length < 2) {
      mediaSuggestionsEl.innerHTML = '';
      return;
    }
    try {
      const results = await apiRequest(`/media/search?q=${encodeURIComponent(query)}`);
      mediaSuggestionsEl.innerHTML = results.length
        ? results.slice(0, 5).map((item, index) => `
            <button type="button" class="media-suggestion" data-media-index="${index}">
              ${item.posterUrl ? `<img src="${escapeHTML(item.posterUrl)}" alt="" loading="lazy">` : '<span class="media-suggestion-empty"></span>'}
              <span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML([item.year, item.type === 'series' ? 'Серіал' : 'Фільм', item.source].filter(Boolean).join(' · '))}</small></span>
            </button>
          `).join('')
        : '<div class="media-suggestion-note">Нічого не знайдено. Можна заповнити вручну.</div>';
      mediaSuggestionsEl._items = results;
    } catch (error) {
      mediaSuggestionsEl.innerHTML = '<div class="media-suggestion-note">Пошук медіа зараз недоступний.</div>';
    }
  }

  if ($('#btn-add')) {
    $('#btn-add').addEventListener('click', () => openModal());
  }
  $('#btn-modal-close').addEventListener('click', closeModal);
  $('#btn-cancel').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  entryTitleInput?.addEventListener('input', debounce(searchMediaSuggestions, 300));
  mediaSuggestionsEl?.addEventListener('click', event => {
    const button = event.target.closest('[data-media-index]');
    if (!button) return;
    fillFromMedia(mediaSuggestionsEl._items?.[Number(button.dataset.mediaIndex)]);
  });

  $('#btn-autofill').addEventListener('click', async () => {
    const title = $('#entry-title').value.trim();
    if (!title) return;
    const btn = $('#btn-autofill');
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const results = await apiRequest(`/media/search?q=${encodeURIComponent(title)}`);
      if (results?.length) {
        fillFromMedia(results[0]);
      } else {
        const data = await apiRequest(`/omdb?title=${encodeURIComponent(title)}`);
        if (data.Year) $('#entry-year').value = parseInt(data.Year) || '';
        if (data.Genre) $('#entry-genre').value = data.Genre;
        if (data.Type === 'movie') $('#entry-type').value = 'movie';
        else if (data.Type === 'series') $('#entry-type').value = 'series';
        if (data.Poster && data.Poster !== 'N/A') $('#entry-poster').value = data.Poster;
        if (data.Director && data.Director !== 'N/A') $('#entry-director').value = data.Director;
        if (data.Runtime && data.Runtime !== 'N/A') $('#entry-runtime').value = parseInt(data.Runtime) || '';
      }
    } catch (err) {
      showToast(err.message || 'Помилка з’єднання з OMDb API.');
    }
    btn.disabled = false; btn.textContent = '🔍';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#entry-id').value;
    const genreRaw = $('#entry-genre').value.trim();
    const data = {
      title: $('#entry-title').value.trim(),
      type: $('#entry-type').value,
      genre: genreRaw ? genreRaw.split(',').map(g => g.trim()).filter(Boolean) : [],
      tags: $('#entry-tags').value.trim().split(',').map(t => t.trim()).filter(Boolean),
      mood: $('#entry-mood').value.trim(),
      year: $('#entry-year').value ? +$('#entry-year').value : null,
      rating: +ratingInput.value || 0,
      comment: $('#entry-comment').value.trim(),
      status: $('#entry-status').value,
      isFavorite: $('#entry-favorite').checked,
      posterUrl: $('#entry-poster').value.trim(),
      director: $('#entry-director').value.trim(),
      runtime: +$('#entry-runtime').value || 0,
      currentSeason: $('#entry-season').value ? +$('#entry-season').value : 0,
      currentEpisode: $('#entry-episode').value ? +$('#entry-episode').value : 0,
      nextEpisodeDate: $('#entry-next-episode').value.trim(),
    };
    if (!data.title) return;

    if (id) {
      const idx = entries.findIndex(e => e.id === +id);
      if (idx !== -1) {
        entries[idx] = { ...entries[idx], ...data };
        await updateEntry(entries[idx]);
      }
    } else {
      const newEntry = { ...data, id: Date.now(), createdAt: new Date().toISOString().slice(0, 10) };
      const createdEntry = await createEntry(newEntry);
      entries.push(createdEntry);
    }

    closeModal();
    render();
    if (navigator.vibrate) navigator.vibrate(30);
  });

  function openConfirm(id) { deleteTargetId = id; confirmOverlay.classList.add('active'); }
  $('#btn-confirm-yes').addEventListener('click', async () => {
    entries = entries.filter(e => e.id !== deleteTargetId);
    await deleteEntryById(deleteTargetId);
    confirmOverlay.classList.remove('active');
    deleteTargetId = null;
    render();
  });
  $('#btn-confirm-no').addEventListener('click', () => confirmOverlay.classList.remove('active'));
  confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) confirmOverlay.classList.remove('active'); });

  async function toggleFavorite(id) {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
      await updateEntry(entry);
      render();
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }

  function pickRandom() {
    const planList = entries.filter(e => e.status === 'planned');
    const resultEl = $('#random-result');
    if (!planList.length) {
      resultEl.innerHTML = '<p style="color:var(--text2)">У вас немає фільмів зі статусом «В планах» 😢</p>';
      return;
    }

    const mood = randomMood?.value || 'any';
    const time = randomTime?.value || 'any';
    const genre = randomGenre?.value || 'any';

    let candidates = planList.filter(e => {
      if (mood !== 'any' && e.mood.toLowerCase() !== mood.toLowerCase()) return false;
      if (genre !== 'any' && ![...e.genre, ...(e.tags || [])].some(tag => tag.toLowerCase() === genre.toLowerCase())) return false;
      if (time !== 'any') {
        const duration = e.runtime || 0;
        if (time === 'short' && duration > 90) return false;
        if (time === 'medium' && (duration < 80 || duration > 150)) return false;
        if (time === 'long' && duration <= 150) return false;
      }
      return true;
    });

    if (!candidates.length) candidates = planList;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const reason = mood !== 'any' ? `За настроєм: ${escapeHTML(mood)}` : genre !== 'any' ? `Жанр: ${escapeHTML(genre)}` : time !== 'any' ? `Доступний час: ${time}` : 'Випадковий вибір із планів';

    resultEl.innerHTML = `<div class="random-pick">
      ${pick.posterUrl ? `<img src="${escapeHTML(pick.posterUrl)}" alt="" class="random-poster">` : ''}
      <p class="random-title">${escapeHTML(pick.title)}</p>
      <p style="color:var(--text2);margin:4px 0">${escapeHTML(reason)}</p>
      ${pick.year ? `<p style="color:var(--text2)">${pick.year}</p>` : ''}
      ${pick.genre.length ? `<p style="color:var(--text2)">${escapeHTML(pick.genre.join(', '))}</p>` : ''}
      ${pick.mood ? `<p style="color:var(--text2)">Муд: ${escapeHTML(pick.mood)}</p>` : ''}
    </div>`;
  }

  $('#btn-random').addEventListener('click', () => { pickRandom(); randomOverlay.classList.add('active'); });
  $('#btn-random-again').addEventListener('click', pickRandom);
  $('#btn-random-close').addEventListener('click', () => randomOverlay.classList.remove('active'));
  randomOverlay.addEventListener('click', e => { if (e.target === randomOverlay) randomOverlay.classList.remove('active'); });

  function getFiltered() {
    let list = [...entries];
    const type = filterType.value;
    const status = filterStatus.value;
    const rating = filterRating.value;
    const favOnly = filterFavorite.checked;
    const sort = sortBy.value;
    const search = searchInput.value.trim().toLowerCase();

    if (type !== 'all') list = list.filter(e => e.type === type);
    if (status !== 'all') list = list.filter(e => e.status === status);
    if (rating !== 'all') list = list.filter(e => e.rating >= +rating);
    if (favOnly) list = list.filter(e => e.isFavorite);
    if (search) {
      list = list.filter(e => {
        const haystack = [
          e.title,
          e.comment,
          e.director,
          e.mood,
          e.year,
          ...(Array.isArray(e.genre) ? e.genre : []),
          ...(Array.isArray(e.tags) ? e.tags : [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }
    list.sort((a, b) => {
      if (sort === 'date-desc') {
        const ao = a.sortOrder || 999999;
        const bo = b.sortOrder || 999999;
        return ao - bo || b.id - a.id;
      }
      if (sort === 'date-asc') return a.id - b.id;
      if (sort === 'rating-desc') return b.rating - a.rating;
      if (sort === 'rating-asc') return a.rating - b.rating;
      return 0;
    });
    return list;
  }

  function showSkeleton() {
    watchlistEl.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="card skeleton-card skeleton"></div>
    `).join('');
  }

  function applyCatalogMode() {
    if (session) return;

    document.title = 'Watchlist — Каталог';
    if (heroEyebrow) heroEyebrow.textContent = 'Публічний каталог';
    if (heroTitle) heroTitle.textContent = 'Каталог для перегляду';
    if (heroSubtitle) heroSubtitle.textContent = 'Переглядайте готову добірку, фільтруйте записи і швидко знаходьте, що подивитися далі без редагування контенту.';
    if (heroPrimaryAction) heroPrimaryAction.textContent = 'Перейти до каталогу';

    const addBtn = $('#btn-add');
    const randomBtn = $('#btn-random');
    const favoriteFilterLabel = filterFavorite?.closest('.filter-fav');
    if (recommendationsIntro) recommendationsIntro.hidden = true;
    if (recoEl) recoEl.hidden = true;
    if (addBtn) addBtn.hidden = true;
    if (randomBtn) randomBtn.hidden = true;
    if (favoriteFilterLabel) favoriteFilterLabel.hidden = true;
  }

  function resetFilters() {
    filterType.value = 'all';
    filterStatus.value = 'all';
    filterRating.value = 'all';
    filterFavorite.checked = false;
    sortBy.value = 'date-desc';
    searchInput.value = '';
    render();
  }

  function renderFiltersStatus(filteredCount, totalCount) {
    if (!filtersStatus) return;

    const activeFilters = [];
    if (filterType.value !== 'all') activeFilters.push(filterType.options[filterType.selectedIndex]?.text || 'тип');
    if (filterStatus.value !== 'all') activeFilters.push(filterStatus.options[filterStatus.selectedIndex]?.text || 'статус');
    if (filterRating.value !== 'all') activeFilters.push(`рейтинг ${filterRating.value}+`);
    if (filterFavorite.checked) activeFilters.push('лише улюблені');
    if (searchInput.value.trim()) activeFilters.push(`пошук: "${searchInput.value.trim()}"`);

    if (!totalCount) {
      filtersStatus.textContent = 'Після першого запису тут з’явиться короткий зріз по фільтрах і пошуку.';
      return;
    }

    if (!activeFilters.length) {
      filtersStatus.textContent = `Показано всі ${totalCount} ${totalCount === 1 ? 'запис' : 'записи'} каталогу.`;
      return;
    }

    filtersStatus.textContent = `Знайдено ${filteredCount} з ${totalCount}. Активно: ${activeFilters.join(', ')}.`;
  }

  [filterType, filterStatus, filterRating, sortBy].forEach(el => el.addEventListener('change', render));
  filterFavorite.addEventListener('change', render);
  const debouncedRender = debounce(render, searchDebounceDelay);
  searchInput.addEventListener('input', debouncedRender);
  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);
  const STATUS_LABELS = {
    completed: 'Переглянуто',
    watched: 'Переглянуто',
    watching: 'У процесі',
    planned: 'У планах',
    plan_to_watch: 'У планах'
  };

  function starsHTML(r) {
    return Array.from({ length: 5 }, (_, i) => `<span class="star-display${i < r ? ' filled' : ''}">★</span>`).join('');
  }

  function genreHTML(genre) {
    if (!genre || !genre.length) return '';
    const arr = Array.isArray(genre) ? genre : [genre];
    return `<div class="card-genres">${arr.map(g => `<span class="genre-tag">${escapeHTML(g)}</span>`).join('')}</div>`;
  }

  function tagsHTML(tags) {
    if (!tags || !tags.length) return '';
    const arr = Array.isArray(tags) ? tags : [tags];
    return `<div class="card-genres">${arr.map(t => `<span class="genre-tag">${escapeHTML(t)}</span>`).join('')}</div>`;
  }

  function cardPosterHTML(entry) {
    return `<div class="card-poster">
      ${entry.posterUrl
        ? `<img src="${escapeHTML(entry.posterUrl)}" alt="${escapeHTML(entry.title)}" loading="lazy">`
        : `<div class="card-poster-placeholder"><span>${entry.type === 'movie' ? 'Фільм' : 'Серіал'}</span></div>`}
    </div>`;
  }

  function cardSummary(entry) {
    const typeLabel = entry.type === 'movie' ? 'Фільм' : 'Серіал';
    const statusLabel = STATUS_LABELS[entry.status] || 'Збережено';
    const lead = [typeLabel];
    if (entry.year) lead.push(`${entry.year} рік`);
    if (entry.director) lead.push(`режисер ${entry.director}`);
    if (entry.runtime) {
      lead.push(entry.type === 'series' ? `${entry.runtime} хв на епізод` : `${entry.runtime} хв`);
    }

    const details = [`Статус: ${statusLabel}`];
    if (entry.type === 'series' && (entry.currentSeason || entry.currentEpisode)) {
      details.push(`зараз S${entry.currentSeason || 1} · E${entry.currentEpisode || 1}`);
    }
    if (entry.mood) details.push(`настрій: ${entry.mood}`);

    return `${lead.join(' • ')}. ${details.join('. ')}.`;
  }

  function detailLine(label, value) {
    if (!value) return '';
    return `<div class="card-detail">
      <span class="card-detail-label">${label}</span>
      <span class="card-detail-value">${escapeHTML(String(value))}</span>
    </div>`;
  }

  function closeDetails() {
    detailsOverlay?.classList.remove('active');
    document.body.classList.remove('modal-open');
  }

  function openDetails(entry) {
    if (!entry || !detailsOverlay || !detailsContent || !detailsTitle) return;
    const statusLabel = STATUS_LABELS[entry.status] || entry.status || 'Не вказано';
    const typeLabel = entry.type === 'series' ? 'Серіал' : 'Фільм';
    detailsTitle.textContent = entry.title || 'Деталі запису';
    detailsContent.innerHTML = `
      <div class="details-layout">
        <div class="details-poster">
          ${entry.posterUrl
            ? `<img src="${escapeHTML(entry.posterUrl)}" alt="${escapeHTML(entry.title)}" loading="lazy">`
            : `<span>${escapeHTML(typeLabel)}</span>`}
        </div>
        <div class="details-body">
          <div class="details-badges">
            <span class="badge badge-${entry.type}">${escapeHTML(typeLabel)}</span>
            <span class="badge badge-status badge-status-${entry.status}">${escapeHTML(statusLabel)}</span>
            ${entry.year ? `<span class="card-year">${entry.year}</span>` : ''}
          </div>
          <div class="details-rating">${starsHTML(entry.rating || 0)} <span>${entry.rating ? `${entry.rating}/5` : 'Без оцінки'}</span></div>
          <div class="details-meta-grid">
            ${detailLine('Режисер', entry.director)}
            ${detailLine('Тривалість', entry.runtime ? `${entry.runtime} хв` : '')}
            ${detailLine('Настрій', entry.mood)}
            ${entry.type === 'series' && (entry.currentSeason || entry.currentEpisode) ? detailLine('Прогрес', `S${entry.currentSeason || 1} · E${entry.currentEpisode || 1}`) : ''}
            ${detailLine('Наступний епізод', entry.nextEpisodeDate)}
            ${detailLine('Додано', entry.createdAt)}
          </div>
          ${genreHTML(entry.genre)}
          ${tagsHTML(entry.tags)}
        </div>
      </div>
      <section class="details-comment">
        <h3>Коментар</h3>
        <p>${entry.comment ? escapeHTML(entry.comment) : 'Коментар ще не додано.'}</p>
      </section>
    `;
    detailsOverlay.classList.add('active');
    document.body.classList.add('modal-open');
  }

  detailsCloseBtn?.addEventListener('click', closeDetails);
  detailsOverlay?.addEventListener('click', event => {
    if (event.target === detailsOverlay) closeDetails();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && detailsOverlay?.classList.contains('active')) closeDetails();
  });

  function recommendationMeta(item) {
    return [
      item.year,
      item.type === 'series' ? 'Серіал' : 'Фільм',
      item.rating ? `${item.rating}/5` : '',
      Array.isArray(item.genre) ? item.genre.slice(0, 2).join(', ') : ''
    ].filter(Boolean).join(' · ');
  }

  function buildSmartRecommendations() {
    if (!session) return [];

    const usedTitles = new Set(entries.map(entry => entry.title.toLowerCase()));
    const watched = entries.filter(entry => entry.status === 'completed' && entry.rating >= 4);
    const planned = entries.filter(entry => entry.status === 'planned');
    const watching = entries.filter(entry => entry.status === 'watching');
    const genreScore = {};
    watched.forEach(entry => {
      entry.genre.forEach(genre => {
        genreScore[genre] = (genreScore[genre] || 0) + (entry.rating || 1);
      });
    });
    const topGenre = Object.entries(genreScore).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const topRated = watched.slice().sort((a, b) => b.rating - a.rating)[0];
    const recos = [];

    const pushReco = (item, reason, source, action = 'open') => {
      if (!item || recos.some(existing => existing.title === item.title)) return;
      recos.push({
        ...item,
        reason,
        source,
        action,
        entryId: item.id || null,
        genre: Array.isArray(item.genre) ? item.genre : (item.tags || [])
      });
    };

    if (watching.length) {
      const current = watching
        .slice()
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
      pushReco(
        current,
        current.type === 'series'
          ? `Ви вже в процесі: S${current.currentSeason || 1} · E${current.currentEpisode || 1}`
          : 'Ви вже почали цей запис, його варто закрити першим.',
        'Продовжити'
      );
    }

    const plannedMatch = planned
      .filter(item => !topGenre || item.genre.includes(topGenre))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || planned[0];
    if (plannedMatch) {
      pushReco(
        plannedMatch,
        topRated
          ? `Після «${topRated.title}» це схоже на хороший наступний вибір.`
          : 'Цей запис уже у планах, тож його легко взяти наступним.',
        'Сьогодні'
      );
    }

    recommendationSets.flatMap(set => (set.items || []).map(item => ({ ...item, setTitle: set.title })))
      .filter(item => !usedTitles.has(String(item.title || '').toLowerCase()))
      .slice(0, 4)
      .forEach(item => {
        if (recos.length >= 3) return;
        pushReco(
          {
            title: item.title,
            type: item.type || 'movie',
            rating: item.rating ? Math.round(Number(item.rating)) : 0,
            tags: item.tags || [],
            genre: item.tags || [],
            description: `Добірка «${item.setTitle}».`
          },
          topGenre
            ? `Підбірка збігається з вашим інтересом до ${topGenre}.`
            : 'Стартова добірка для швидкого наповнення каталогу.',
          item.setTitle || 'Добірка',
          'add'
        );
      });

    return recos.slice(0, 3);
  }

  function renderRecommendations() {
    const recos = buildSmartRecommendations();
    if (!recos.length) {
      recoEl.innerHTML = '';
      if (recommendationsIntro) recommendationsIntro.hidden = true;
      if (recoEl) recoEl.hidden = true;
      return;
    }

    if (recommendationsIntro) recommendationsIntro.hidden = false;
    if (recoEl) recoEl.hidden = false;
    recoEl.innerHTML = `
      <div class="reco-head">
        <h2>Розумний підбір для наступного перегляду</h2>
        <p>Підказки рахуються з ваших оцінок, статусів, жанрів і планів без зовнішнього сервісу.</p>
      </div>
      <div class="reco-list">${recos.map((item, index) => `
        <article class="reco-card">
          ${item.posterUrl ? `<div class="reco-poster"><img src="${escapeHTML(item.posterUrl)}" alt="" loading="lazy"></div>` : `<div class="reco-poster reco-poster-empty">${escapeHTML(item.type === 'series' ? 'S' : 'M')}</div>`}
          <div class="reco-info">
            <span class="reco-source">${escapeHTML(item.source)}</span>
            <div class="reco-title">${escapeHTML(item.title)}</div>
            <div class="reco-reason">${escapeHTML(item.reason)}</div>
            <div class="reco-meta">${escapeHTML(recommendationMeta(item))}</div>
            ${item.action === 'add'
              ? `<button class="btn btn-sm btn-reco-add" data-reco-index="${index}">Додати у список</button>`
              : `<button class="btn btn-sm btn-secondary btn-reco-open" data-reco-entry="${item.entryId}">Показати в каталозі</button>`}
          </div>
        </article>`).join('')}</div>`;
    recoEl._items = recos;
  }

  function render() {
    const list = getFiltered();
    const total = entries.length;

    renderRecommendations();
    renderFiltersStatus(list.length, total);

    if (!list.length) {
      const hasActiveFilters = (
        filterType.value !== 'all' ||
        filterStatus.value !== 'all' ||
        filterRating.value !== 'all' ||
        filterFavorite.checked ||
        !!searchInput.value.trim()
      );

      watchlistEl.innerHTML = `<div class="empty">${
        total && hasActiveFilters
          ? 'За поточними фільтрами нічого не знайдено. Спробуйте змінити умови або скинути їх.'
          : session
            ? 'Список порожній. Додайте перший запис, щоб запустити свій Watchlist.'
            : 'Власні записи доступні тільки після входу. Зареєструйтесь або увійдіть, щоб вести свій Watchlist.'
      }</div>`;
      return;
    }
    watchlistEl.innerHTML = list.map(entry => `
      <article class="card" data-entry-id="${entry.id}" draggable="${canEditEntry(entry) ? 'true' : 'false'}" tabindex="0" aria-label="Відкрити коментар і деталі: ${escapeHTML(entry.title)}">
        <div class="card-shell">
          ${cardPosterHTML(entry)}
          <div class="card-body">
            <div class="card-header">
              <span class="badge badge-${entry.type}">${entry.type === 'movie' ? 'Фільм' : 'Серіал'}</span>
              <span class="badge badge-status badge-status-${entry.status}">${STATUS_LABELS[entry.status] || entry.status}</span>
              ${entry.year ? `<span class="card-year">${entry.year}</span>` : ''}
            </div>
            <h3 class="card-title">${escapeHTML(entry.title)}${entry.isFavorite ? ' <span class="fav-icon">❤️</span>' : ''}</h3>
            <p class="card-summary">${escapeHTML(cardSummary(entry))}</p>
            <div class="card-meta-row">
              ${entry.director ? `<span class="card-meta-chip">${escapeHTML(entry.director)}</span>` : ''}
              ${entry.runtime ? `<span class="card-meta-chip">${entry.runtime} хв</span>` : ''}
              ${entry.mood ? `<span class="card-meta-chip">${escapeHTML(entry.mood)}</span>` : ''}
            </div>
            ${genreHTML(entry.genre)}
            ${tagsHTML(entry.tags)}
            <div class="card-details">
              ${detailLine('Оцінка', entry.rating ? `${entry.rating}/5` : 'Не вказано')}
              ${detailLine('Настрій', entry.mood)}
              ${entry.type === 'series' && (entry.currentSeason || entry.currentEpisode) ? detailLine('Прогрес', `S${entry.currentSeason || 1} · E${entry.currentEpisode || 1}`) : ''}
            </div>
            <p class="card-open-hint">${entry.comment ? 'Натисніть, щоб відкрити коментар.' : 'Натисніть, щоб відкрити деталі.'}</p>
            <div class="card-footer">
              <span class="card-date">${entry.createdAt || ''}</span>
              <div class="card-actions">
                <button class="btn btn-sm btn-share-entry" data-share="${entry.id}">Подивись це</button>
                <span class="catalog-badge">${entry.createdByAdmin && !canEditEntry(entry) ? 'Добірка Watchlist' : 'Ваш запис'}</span>
                ${canEditEntry(entry) ? `<button class="btn btn-sm btn-fav" data-id="${entry.id}" title="Улюблене">${entry.isFavorite ? '❤️' : '🤍'}</button>
                <button class="btn btn-sm btn-edit" data-id="${entry.id}">Редагувати</button>
                <button class="btn btn-sm btn-delete" data-id="${entry.id}">Видалити</button>` : ''}
              </div>
            </div>
          </div>
        </div>
      </article>`).join('');
  }

  recoEl?.addEventListener('click', event => {
    const addButton = event.target.closest('[data-reco-index]');
    if (addButton) {
      const item = recoEl._items?.[Number(addButton.dataset.recoIndex)];
      if (item) openPrefilledModal(item);
      return;
    }

    const openButton = event.target.closest('[data-reco-entry]');
    if (openButton) {
      const id = Number(openButton.dataset.recoEntry);
      const card = document.querySelector(`[data-entry-id="${id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('card-highlight');
        setTimeout(() => card.classList.remove('card-highlight'), 1400);
      }
    }
  });

  watchlistEl.addEventListener('click', async e => {
    const shareBtn = e.target.closest('[data-share]');
    if (shareBtn) {
      const entry = entries.find(item => item.id === Number(shareBtn.dataset.share));
      if (!entry) return;
      localStorage.setItem('watchlist_share_payload', JSON.stringify({
        title: entry.title,
        type: entry.type,
        year: entry.year || '',
        rating: entry.rating || 0,
        posterUrl: entry.posterUrl || ''
      }));
      window.location.href = '/messages.html';
      return;
    }

    const btn = e.target.closest('[data-id]');
    if (btn) {
      const id = +btn.dataset.id;
      if (btn.classList.contains('btn-edit')) {
        openModal(entries.find(e => e.id === id));
      } else if (btn.classList.contains('btn-delete')) {
        openConfirm(id);
      } else if (btn.classList.contains('btn-fav')) {
        await toggleFavorite(id);
      }
      return;
    }

    const card = e.target.closest('[data-entry-id]');
    if (!card || e.target.closest('button, a, input, select, textarea')) return;
    openDetails(entries.find(item => item.id === Number(card.dataset.entryId)));
  });

  watchlistEl.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('button, a, input, select, textarea')) return;
    const card = event.target.closest('[data-entry-id]');
    if (!card) return;
    event.preventDefault();
    openDetails(entries.find(item => item.id === Number(card.dataset.entryId)));
  });

  watchlistEl.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-entry-id]');
    if (!card || card.getAttribute('draggable') !== 'true') return;
    draggedEntryId = Number(card.dataset.entryId);
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  watchlistEl.addEventListener('dragend', event => {
    event.target.closest('[data-entry-id]')?.classList.remove('dragging');
    draggedEntryId = null;
  });

  watchlistEl.addEventListener('dragover', event => {
    if (!draggedEntryId) return;
    event.preventDefault();
  });

  watchlistEl.addEventListener('drop', async event => {
    if (!draggedEntryId) return;
    const targetCard = event.target.closest('[data-entry-id]');
    if (!targetCard) return;
    const targetId = Number(targetCard.dataset.entryId);
    if (targetId === draggedEntryId) return;

    const current = getFiltered();
    const from = current.findIndex(entry => entry.id === draggedEntryId);
    const to = current.findIndex(entry => entry.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);

    const orderedIds = current.filter(canEditEntry).map(entry => entry.id);
    current.forEach((entry, index) => { entry.sortOrder = index + 1; });
    entries.sort((a, b) => {
      const ai = orderedIds.indexOf(a.id);
      const bi = orderedIds.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    render();
    if (session) {
      try {
        await apiRequest('/entries/reorder', {
          method: 'POST',
          body: JSON.stringify({ ids: orderedIds })
        });
      } catch (error) {
        showToast('Порядок оновлено локально, але сервер не зберіг зміни.');
      }
    }
  });

  async function init() {
    applyCatalogMode();
    setCatalogView(catalogView);
    showSkeleton();
    const [loadedEntries, loadedSets] = await Promise.all([
      loadEntries(),
      loadRecommendationSets()
    ]);
    entries = loadedEntries;
    recommendationSets = loadedSets;
    render();
  }

  init();
})();
