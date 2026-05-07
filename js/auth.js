(() => {
  'use strict';

  const API_BASE = '/api';
  const SESSION_KEY = 'watchlist_session';
  const THEME_KEY = 'watchlist_theme';
  const AUTH_MODAL_ID = 'auth-overlay';
  let accountSocket = null;
  let interfaceObserver = null;
  let interfaceTranslateTimer = null;
  let deferredInstallPrompt = null;
  const LANGUAGE_LABELS = {
    UK: 'Українська (UA)',
    RU: 'Русский (RU)',
    EN: 'English (EN)'
  };
  const UI_TRANSLATIONS = {
    RU: {
      "Головна": "Главная",
      "Статистика": "Статистика",
      "Профіль": "Профиль",
      "Друзі": "Друзья",
      "Повідомлення": "Сообщения",
      "Налаштування": "Настройки",
      "Адмін панель": "Админ-панель",
      "Вийти": "Выйти",
      "Увійти": "Войти",
      "Реєстрація": "Регистрация",
      "Компанія": "Компания",
      "Про нас": "О нас",
      "Партнери": "Партнеры",
      "Правова інформація": "Правовая информация",
      "Політика приватності": "Политика конфиденциальности",
      "Приватність і політика": "Конфиденциальность и политика",
      "Підтримка": "Поддержка",
      "Центр допомоги": "Центр помощи",
      "Умови користування": "Условия использования",
      "Спільнота": "Сообщество",
      "Зв’язатися з підтримкою": "Связаться с поддержкой",
      "Безпека акаунта": "Безопасность аккаунта",
      "Розробникам": "Разработчикам",
      "Документація API": "Документация API",
      "Інтеграції": "Интеграции",
      "Нотатки інтеграції": "Заметки интеграции",
      "Історія змін": "История изменений",
      "План розвитку": "План развития",
      "Продукти": "Продукты",
      "Команди": "Команды",
      "Для команд": "Для команд",
      "Сценарії": "Сценарии",
      "Особистий каталог": "Личный каталог",
      "Перегляд із друзями": "Просмотр с друзьями",
      "Приватний профіль": "Приватный профиль",
      "Аналітика перегляду": "Аналитика просмотра",
      "Командне планування": "Командное планирование",
      "Фільми, серіали й друзі в одному каталозі.": "Фильмы, сериалы и друзья в одном каталоге.",
      "© 2026 Watchlist. Усі права захищено.": "© 2026 Watchlist. Все права защищены.",
      "Мова сайту": "Язык сайта",
      "Мова інтерфейсу": "Язык интерфейса",
      "Зберегти мову": "Сохранить язык",
      "Зберегти приватність": "Сохранить приватность",
      "Параметри": "Параметры",
      "Новий пароль": "Новый пароль",
      "Логін": "Логин",
      "Пароль": "Пароль",
      "Email": "Email",
      "Налаштування акаунта": "Настройки аккаунта",
      "Приватність": "Приватность",
      "Заблоковані користувачі": "Заблокированные пользователи",
      "Заблокованих користувачів немає.": "Заблокированных пользователей нет.",
      "Ваш статус": "Ваш статус",
      "Онлайн": "Онлайн",
      "Офлайн": "Офлайн",
      "Не турбувати": "Не беспокоить",
      "Хто бачить онлайн": "Кто видит онлайн",
      "Видимість профілю": "Видимость профиля",
      "Хто може надсилати заявки": "Кто может отправлять заявки",
      "Усі": "Все",
      "Друзі друзів": "Друзья друзей",
      "Ніхто": "Никто",
      "Список друзів": "Список друзей",
      "Пошук друзів": "Поиск друзей",
      "Додати друга": "Добавить друга",
      "Заявки": "Заявки",
      "Рейтинг друзів": "Рейтинг друзей",
      "Друзів поки немає.": "Друзей пока нет.",
      "Нових заявок немає.": "Новых заявок нет.",
      "Надіслати заявку": "Отправить заявку",
      "Скасувати заявку": "Отменить заявку",
      "Прийняти": "Принять",
      "Відхилити": "Отклонить",
      "Видалити": "Удалить",
      "Розблокувати": "Разблокировать",
      "Написати": "Написать",
      "Оберіть діалог": "Выберите диалог",
      "Повідомлення з друзями з’являться тут.": "Сообщения от друзей появятся здесь.",
      "Напишіть повідомлення...": "Напишите сообщение...",
      "Надіслати": "Отправить",
      "Створити звернення": "Создать обращение",
      "Новий тікет": "Новый тикет",
      "Підтримка Watchlist": "Поддержка Watchlist",
      "Ви": "Вы",
      "надіслано": "отправлено",
      "прочитано": "прочитано",
      "Ще немає повідомлень.": "Сообщений пока нет.",
      "Почніть діалог першим повідомленням.": "Начните диалог первым сообщением.",
      "Каталог": "Каталог",
      "Відкрити каталог": "Открыть каталог",
      "До списку": "К списку",
      "Ваш Watchlist одним поглядом": "Ваш Watchlist одним взглядом",
      "Головна показує стан каталогу без зайвого шуму: скільки вже додано, що зараз у процесі і куди варто перейти далі.": "Главная показывает состояние каталога без лишнего шума: сколько уже добавлено, что сейчас в процессе и куда перейти дальше.",
      "У каталозі": "В каталоге",
      "Завантажуємо ваші записи.": "Загружаем ваши записи.",
      "Завершені фільми й серіали.": "Завершенные фильмы и сериалы.",
      "Те, до чого ви вже повертаєтесь.": "То, к чему вы уже возвращаетесь.",
      "Середня оцінка": "Средняя оценка",
      "За 5-бальною системою.": "По 5-балльной системе.",
      "Останні записи": "Последние записи",
      "Короткий зріз того, що нещодавно потрапило у ваш каталог.": "Короткий обзор того, что недавно попало в ваш каталог.",
      "Після входу тут з’являться останні додані фільми й серіали.": "После входа здесь появятся последние добавленные фильмы и сериалы.",
      "Швидкі переходи": "Быстрые переходы",
      "Основні дії винесені окремо, а повний список живе на сторінці каталогу.": "Основные действия вынесены отдельно, а полный список находится на странице каталога.",
      "Ваші фільми, серіали і особисті нотатки": "Ваши фильмы, сериалы и личные заметки",
      "Кожен запис лишається компактним: постер, статус і ключові деталі видно одразу, а коментар відкривається по кліку.": "Каждая запись остается компактной: постер, статус и ключевые детали видны сразу, а комментарий открывается по клику.",
      "Усі типи": "Все типы",
      "Фільми": "Фильмы",
      "Серіали": "Сериалы",
      "Усі статуси": "Все статусы",
      "Переглянуто": "Просмотрено",
      "У процесі": "В процессе",
      "У планах": "В планах",
      "Будь-яка оцінка": "Любая оценка",
      "Лише улюблені": "Только избранные",
      "Нові спочатку": "Сначала новые",
      "Старі спочатку": "Сначала старые",
      "Найкраща оцінка": "Лучшая оценка",
      "Найгірша оцінка": "Худшая оценка",
      "Пошук за назвою": "Поиск по названию",
      "Скинути": "Сбросить",
      "Додати запис": "Добавить запись",
      "Випадковий вибір": "Случайный выбор",
      "Вигляд каталогу": "Вид каталога",
      "Квадратами": "Плиткой",
      "Рядками": "Строками",
      "Показати квадратами": "Показать плиткой",
      "Показати рядками": "Показать строками",
      "Деталі запису": "Детали записи",
      "Закрити деталі запису": "Закрыть детали записи",
      "Коментар": "Комментарий",
      "Коментар ще не додано.": "Комментарий еще не добавлен.",
      "Натисніть, щоб відкрити коментар.": "Нажмите, чтобы открыть комментарий.",
      "Натисніть, щоб відкрити деталі.": "Нажмите, чтобы открыть детали.",
      "Оцінка": "Оценка",
      "Настрій": "Настроение",
      "Прогрес": "Прогресс",
      "Фільм": "Фильм",
      "Серіал": "Сериал",
      "Гра": "Игра",
      "Планую": "Планирую",
      "Дивлюсь": "Смотрю",
      "Завершено": "Завершено",
      "Улюблене": "Избранное",
      "Редагувати": "Редактировать",
      "Додати": "Добавить",
      "Зберегти": "Сохранить",
      "Скасувати": "Отмена",
      "Пошук": "Поиск",
      "Фільтри": "Фильтры",
      "Повернутися в профіль": "Вернуться в профиль",
      "Огляд": "Обзор",
      "Користувачі": "Пользователи",
      "Контент": "Контент",
      "Звернення": "Обращения",
      "Модерація": "Модерация",
      "Аудит": "Аудит",
      "Адміністратор": "Администратор",
      "Користувач": "Пользователь",
      "Роль": "Роль",
      "Статус": "Статус",
      "Заблокувати": "Заблокировать",
      "Розблокувати акаунт": "Разблокировать аккаунт",
      "Видалити акаунт": "Удалить аккаунт",
      "Введіть логін або email": "Введите логин или email",
      "Ваш пароль": "Ваш пароль",
      "Встановити": "Установить",
      "Керування доступом": "Управление доступом",
      "Тут редагуються лише облікові дані. Профіль винесений в окрему оглядову сторінку.": "Здесь редактируются только учетные данные. Профиль вынесен на отдельную обзорную страницу.",
      "Вигляд профілю": "Внешний вид профиля",
      "Додайте аватар, обкладинку, короткий опис і жанри, щоб профіль виглядав живіше.": "Добавьте аватар, обложку, короткое описание и жанры, чтобы профиль выглядел живее.",
      "Короткий опис з’явиться тут.": "Краткое описание появится здесь.",
      "Аватарка (URL)": "Аватар (URL)",
      "Обкладинка профілю (URL)": "Обложка профиля (URL)",
      "Про себе": "О себе",
      "Улюблені жанри": "Любимые жанры",
      "Наприклад: люблю фантастику, кіберпанк і серіали на один вечір.": "Например: люблю фантастику, киберпанк и сериалы на один вечер.",
      "Зберегти вигляд профілю": "Сохранить внешний вид профиля",
      "Профіль адміністратора": "Профиль администратора",
      "Профіль користувача": "Профиль пользователя",
      "Профіль бачать": "Профиль видят",
      "Розумний підбір для наступного перегляду": "Умная подборка для следующего просмотра",
      "Підказки рахуються з ваших оцінок, статусів, жанрів і планів без зовнішнього сервісу.": "Подсказки считаются по вашим оценкам, статусам, жанрам и планам без внешнего сервиса.",
      "Додати у список": "Добавить в список",
      "Показати в каталозі": "Показать в каталоге",
      "Продовжити": "Продолжить",
      "Сьогодні": "Сегодня",
      "Добірка": "Подборка",
      "Закрити вікно авторизації": "Закрыть окно авторизации"
    },
    EN: {
      "Головна": "Home",
      "Статистика": "Statistics",
      "Профіль": "Profile",
      "Друзі": "Friends",
      "Повідомлення": "Messages",
      "Налаштування": "Settings",
      "Адмін панель": "Admin panel",
      "Вийти": "Log out",
      "Увійти": "Log in",
      "Реєстрація": "Sign up",
      "Компанія": "Company",
      "Про нас": "About",
      "Партнери": "Partners",
      "Правова інформація": "Legal",
      "Політика приватності": "Privacy policy",
      "Приватність і політика": "Privacy policy",
      "Підтримка": "Support",
      "Центр допомоги": "Help center",
      "Умови користування": "Terms of service",
      "Спільнота": "Community",
      "Зв’язатися з підтримкою": "Contact support",
      "Безпека акаунта": "Account security",
      "Розробникам": "Developers",
      "Документація API": "API documentation",
      "Інтеграції": "Integrations",
      "Нотатки інтеграції": "Integration notes",
      "Історія змін": "Changelog",
      "План розвитку": "Roadmap",
      "Продукти": "Products",
      "Команди": "Teams",
      "Для команд": "For teams",
      "Сценарії": "Scenarios",
      "Особистий каталог": "Personal catalog",
      "Перегляд із друзями": "Watch with friends",
      "Приватний профіль": "Private profile",
      "Аналітика перегляду": "Viewing analytics",
      "Командне планування": "Team planning",
      "Фільми, серіали й друзі в одному каталозі.": "Movies, series, and friends in one catalog.",
      "© 2026 Watchlist. Усі права захищено.": "© 2026 Watchlist. All rights reserved.",
      "Мова сайту": "Site language",
      "Мова інтерфейсу": "Interface language",
      "Зберегти мову": "Save language",
      "Зберегти приватність": "Save privacy",
      "Параметри": "Settings",
      "Новий пароль": "New password",
      "Логін": "Username",
      "Пароль": "Password",
      "Email": "Email",
      "Налаштування акаунта": "Account settings",
      "Приватність": "Privacy",
      "Заблоковані користувачі": "Blocked users",
      "Заблокованих користувачів немає.": "No blocked users.",
      "Ваш статус": "Your status",
      "Онлайн": "Online",
      "Офлайн": "Offline",
      "Не турбувати": "Do not disturb",
      "Хто бачить онлайн": "Who sees online status",
      "Видимість профілю": "Profile visibility",
      "Хто може надсилати заявки": "Who can send requests",
      "Усі": "Everyone",
      "Друзі друзів": "Friends of friends",
      "Ніхто": "Nobody",
      "Список друзів": "Friends list",
      "Пошук друзів": "Friend search",
      "Додати друга": "Add friend",
      "Заявки": "Requests",
      "Рейтинг друзів": "Friends ranking",
      "Друзів поки немає.": "No friends yet.",
      "Нових заявок немає.": "No new requests.",
      "Надіслати заявку": "Send request",
      "Скасувати заявку": "Cancel request",
      "Прийняти": "Accept",
      "Відхилити": "Decline",
      "Видалити": "Delete",
      "Розблокувати": "Unblock",
      "Написати": "Message",
      "Оберіть діалог": "Choose a conversation",
      "Повідомлення з друзями з’являться тут.": "Messages with friends will appear here.",
      "Напишіть повідомлення...": "Write a message...",
      "Надіслати": "Send",
      "Створити звернення": "Create ticket",
      "Новий тікет": "New ticket",
      "Підтримка Watchlist": "Watchlist support",
      "Ви": "You",
      "надіслано": "sent",
      "прочитано": "read",
      "Ще немає повідомлень.": "No messages yet.",
      "Почніть діалог першим повідомленням.": "Start the conversation with the first message.",
      "Каталог": "Catalog",
      "Відкрити каталог": "Open catalog",
      "До списку": "To the list",
      "Ваш Watchlist одним поглядом": "Your Watchlist at a glance",
      "Головна показує стан каталогу без зайвого шуму: скільки вже додано, що зараз у процесі і куди варто перейти далі.": "Home shows your catalog status without extra noise: how much is added, what is in progress, and where to go next.",
      "У каталозі": "In catalog",
      "Завантажуємо ваші записи.": "Loading your entries.",
      "Завершені фільми й серіали.": "Completed movies and series.",
      "Те, до чого ви вже повертаєтесь.": "What you are already returning to.",
      "Середня оцінка": "Average rating",
      "За 5-бальною системою.": "Based on the 5-point system.",
      "Останні записи": "Recent entries",
      "Короткий зріз того, що нещодавно потрапило у ваш каталог.": "A quick look at what recently landed in your catalog.",
      "Після входу тут з’являться останні додані фільми й серіали.": "After signing in, your latest added movies and series will appear here.",
      "Швидкі переходи": "Quick links",
      "Основні дії винесені окремо, а повний список живе на сторінці каталогу.": "Main actions are separated here, while the full list lives on the catalog page.",
      "Ваші фільми, серіали і особисті нотатки": "Your movies, series, and personal notes",
      "Кожен запис лишається компактним: постер, статус і ключові деталі видно одразу, а коментар відкривається по кліку.": "Each entry stays compact: poster, status, and key details are visible right away, while the comment opens on click.",
      "Усі типи": "All types",
      "Фільми": "Movies",
      "Серіали": "Series",
      "Усі статуси": "All statuses",
      "Переглянуто": "Watched",
      "У процесі": "In progress",
      "У планах": "Planned",
      "Будь-яка оцінка": "Any rating",
      "Лише улюблені": "Favorites only",
      "Нові спочатку": "Newest first",
      "Старі спочатку": "Oldest first",
      "Найкраща оцінка": "Highest rating",
      "Найгірша оцінка": "Lowest rating",
      "Пошук за назвою": "Search by title",
      "Скинути": "Reset",
      "Додати запис": "Add entry",
      "Випадковий вибір": "Random pick",
      "Вигляд каталогу": "Catalog view",
      "Квадратами": "Grid",
      "Рядками": "Rows",
      "Показати квадратами": "Show as grid",
      "Показати рядками": "Show as rows",
      "Деталі запису": "Entry details",
      "Закрити деталі запису": "Close entry details",
      "Коментар": "Comment",
      "Коментар ще не додано.": "No comment yet.",
      "Натисніть, щоб відкрити коментар.": "Click to open the comment.",
      "Натисніть, щоб відкрити деталі.": "Click to open details.",
      "Оцінка": "Rating",
      "Настрій": "Mood",
      "Прогрес": "Progress",
      "Фільм": "Movie",
      "Серіал": "Series",
      "Гра": "Game",
      "Планую": "Planned",
      "Дивлюсь": "Watching",
      "Завершено": "Completed",
      "Улюблене": "Favorite",
      "Редагувати": "Edit",
      "Додати": "Add",
      "Зберегти": "Save",
      "Скасувати": "Cancel",
      "Пошук": "Search",
      "Фільтри": "Filters",
      "Повернутися в профіль": "Return to profile",
      "Огляд": "Overview",
      "Користувачі": "Users",
      "Контент": "Content",
      "Звернення": "Tickets",
      "Модерація": "Moderation",
      "Аудит": "Audit",
      "Адміністратор": "Administrator",
      "Користувач": "User",
      "Роль": "Role",
      "Статус": "Status",
      "Заблокувати": "Block",
      "Розблокувати акаунт": "Unblock account",
      "Видалити акаунт": "Delete account",
      "Введіть логін або email": "Enter username or email",
      "Ваш пароль": "Your password",
      "Встановити": "Install",
      "Керування доступом": "Access management",
      "Тут редагуються лише облікові дані. Профіль винесений в окрему оглядову сторінку.": "Only account credentials are edited here. The profile lives on a separate overview page.",
      "Вигляд профілю": "Profile appearance",
      "Додайте аватар, обкладинку, короткий опис і жанри, щоб профіль виглядав живіше.": "Add an avatar, cover, short bio, and genres to make the profile feel more alive.",
      "Короткий опис з’явиться тут.": "A short bio will appear here.",
      "Аватарка (URL)": "Avatar (URL)",
      "Обкладинка профілю (URL)": "Profile cover (URL)",
      "Про себе": "About you",
      "Улюблені жанри": "Favorite genres",
      "Наприклад: люблю фантастику, кіберпанк і серіали на один вечір.": "For example: I love sci-fi, cyberpunk, and one-evening series.",
      "Зберегти вигляд профілю": "Save profile appearance",
      "Профіль адміністратора": "Administrator profile",
      "Профіль користувача": "User profile",
      "Профіль бачать": "Profile visible to",
      "Розумний підбір для наступного перегляду": "Smart picks for your next watch",
      "Підказки рахуються з ваших оцінок, статусів, жанрів і планів без зовнішнього сервісу.": "Suggestions are calculated from your ratings, statuses, genres, and plans without an external service.",
      "Додати у список": "Add to list",
      "Показати в каталозі": "Show in catalog",
      "Продовжити": "Continue",
      "Сьогодні": "Today",
      "Добірка": "Collection",
      "Закрити вікно авторизації": "Close authorization window"
    }
  };

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    renderTopBarAuth();
    updateFooterLanguage();
    connectAccountStatusSocket();
    scheduleInterfaceLanguage(document.body, true);
  }

  function clearSession() {
    if (accountSocket) {
      accountSocket.close();
      accountSocket = null;
    }
    localStorage.removeItem(SESSION_KEY);
    renderTopBarAuth();
    updateFooterLanguage();
    restoreInterfaceLanguage(document.body);
  }

  function isAuthPage() {
    return document.body.classList.contains('page-auth');
  }

  function showToast(msg, cls = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast' + (cls ? ' ' + cls : '');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function escapeHTML(value) {
    const node = document.createElement('div');
    node.textContent = value || '';
    return node.innerHTML;
  }

  async function apiRequest(path, options = {}) {
    const headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const session = getSession();
    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(API_BASE + path, { ...options, headers });
    const body = await response.text();
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch (err) { }
    if (!response.ok) {
      const message = json?.error || `HTTP ${response.status}`;
      if (response.status === 403 && /account is blocked/i.test(message)) {
        showToast('Акаунт заблоковано адміністратором');
        clearSession();
        setTimeout(() => { window.location.href = '/login.html'; }, 600);
      }
      throw new Error(message);
    }
    return json;
  }

  function renderTopBarAuth() {
    const authEl = document.getElementById('top-bar-auth');
    if (!authEl) return;
    const session = getSession();
    if (session) {
      const rawDisplayName = session.username || session.name || 'User';
      const displayName = escapeHTML(rawDisplayName);
      const avatarUrl = session.avatarUrl ? escapeHTML(session.avatarUrl) : '';
      const initials = rawDisplayName.slice(0, 1).toUpperCase() || '?';
      authEl.innerHTML = `
        <div class="account-menu">
          <button type="button" class="account-trigger" id="account-menu-trigger" aria-expanded="false">
            <span class="account-mini-avatar ${avatarUrl ? 'has-image' : ''}">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="" loading="lazy">` : `<span>${initials}</span>`}
            </span>
            <span class="top-bar-user">${displayName}</span>
            <span class="account-caret">▾</span>
          </button>
          <div class="account-dropdown">
            <a href="/profile.html" class="account-dropdown-link">Профіль</a>
            <a href="/friends.html" class="account-dropdown-link">Друзі</a>
            <a href="/messages.html" class="account-dropdown-link">Повідомлення</a>
            <a href="/settings.html" class="account-dropdown-link">Налаштування</a>
            ${session.role === 'admin' ? `<a href="/admin.html" class="account-dropdown-link">Адмін панель</a>` : ''}
            <button class="account-dropdown-link account-dropdown-button" id="btn-logout-main">Вийти</button>
          </div>
        </div>
      `;
      const accountMenu = authEl.querySelector('.account-menu');
      const accountTrigger = document.getElementById('account-menu-trigger');
      if (accountMenu && accountTrigger) {
        accountTrigger.addEventListener('click', event => {
          event.stopPropagation();
          const isOpen = accountMenu.classList.toggle('open');
          accountTrigger.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', event => {
          if (!accountMenu.contains(event.target)) {
            accountMenu.classList.remove('open');
            accountTrigger.setAttribute('aria-expanded', 'false');
          }
        });
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            accountMenu.classList.remove('open');
            accountTrigger.setAttribute('aria-expanded', 'false');
          }
        });
      }
      const logoutBtn = document.getElementById('btn-logout-main');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          clearSession();
          window.location.href = '/index.html';
        });
      }
    } else {
      authEl.innerHTML = `<a href="/login.html" class="btn btn-secondary btn-sm-nav" data-open-auth-modal="login">Увійти</a>` +
        `<a href="/register.html" class="btn btn-primary btn-sm-nav" data-open-auth-modal="register">Реєстрація</a>`;
      authEl.querySelectorAll('[data-open-auth-modal]').forEach((link) => {
        link.addEventListener('click', (event) => {
          if (isAuthPage()) return;
          event.preventDefault();
          openAuthModal(link.getAttribute('data-open-auth-modal') || 'login');
        });
      });
    }
    renderPwaInstallButton();
  }

  function renderPwaInstallButton() {
    const navActions = document.querySelector('.nav-actions');
    const authEl = document.getElementById('top-bar-auth');
    if (!navActions || !authEl) return;

    navActions.querySelector('#btn-install-pwa')?.remove();
    if (!deferredInstallPrompt) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-install-pwa';
    button.className = 'btn btn-secondary btn-sm-nav pwa-install-button';
    button.textContent = 'Встановити';
    button.addEventListener('click', async () => {
      const promptEvent = deferredInstallPrompt;
      if (!promptEvent) return;
      deferredInstallPrompt = null;
      promptEvent.prompt();
      await promptEvent.userChoice.catch(() => null);
      renderPwaInstallButton();
    });
    navActions.insertBefore(button, authEl);
  }

  function getPreferredLanguageLabel() {
    const session = getSession();
    return LANGUAGE_LABELS[normalizeLanguageCode(session?.preferredLanguage)] || LANGUAGE_LABELS.UK;
  }

  function updateFooterLanguage() {
    const languageLabel = document.querySelector('[data-footer-language-label]');
    if (languageLabel) languageLabel.textContent = getPreferredLanguageLabel();
  }

  function handleAccountEvent(payload) {
    if (payload.type === 'account-status' && payload.status === 'blocked') {
      showToast('Акаунт заблоковано адміністратором');
      clearSession();
      setTimeout(() => { window.location.href = '/login.html'; }, 600);
      return;
    }

    if (payload.type === 'account-updated' && payload.user) {
      setSession({ ...getSession(), ...payload.user });
      showToast('Права акаунта оновлено');
    }
  }

  function connectAccountStatusSocket() {
    const session = getSession();
    if (!session?.token || accountSocket) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    accountSocket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(session.token)}`);
    accountSocket.addEventListener('message', event => {
      try {
        handleAccountEvent(JSON.parse(event.data));
      } catch (error) { }
    });
    accountSocket.addEventListener('close', () => {
      accountSocket = null;
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderPwaInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    renderPwaInstallButton();
  });

  function normalizeLanguageCode(value) {
    const raw = String(value || 'UK').trim().toUpperCase().replace('_', '-');
    if (raw === 'UA' || raw === 'UK-UA' || raw === 'UA-UA') return 'UK';
    if (raw === 'RU' || raw === 'RU-RU') return 'RU';
    if (raw === 'EN' || raw === 'EN-US' || raw === 'EN-GB' || raw === 'EN-UK') return 'EN';
    return 'UK';
  }

  function documentLang(code) {
    if (code === 'RU') return 'ru';
    if (code === 'EN') return 'en';
    return 'uk';
  }

  function translateInterfaceValue(value, targetLang) {
    const dictionary = UI_TRANSLATIONS[targetLang];
    if (!dictionary || !value) return value;

    const trimmed = String(value).trim();
    if (!trimmed) return value;
    const translated = dictionary[trimmed];
    if (!translated) return value;
    return String(value).replace(trimmed, translated);
  }

  function shouldSkipInterfaceElement(element) {
    if (!element) return true;
    return !!element.closest([
      'script',
      'style',
      'noscript',
      'code',
      'pre',
      '.no-i18n',
      '.nav-logo-mark',
      '.site-footer-brand-mark',
      '.top-bar-user',
      '.friend-avatar',
      '.profile-avatar',
      '#toast-container',
      '#watchlist',
      '#messages-thread',
      '#users-tbody',
      '#entries-tbody',
      '#admin-reports-list',
      '#admin-audit-list',
      '#profile-name-display',
      '#profile-email-display',
      '#media-suggestions'
    ].join(','));
  }

  function shouldSkipInterfaceText(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.matches('input, textarea')) return true;
    return shouldSkipInterfaceElement(parent);
  }

  function collectInterfaceTextNodes(root = document.body) {
    const nodes = [];
    if (!root) return nodes;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (shouldSkipInterfaceText(node)) continue;
      if (!node.__watchlistOriginalText) node.__watchlistOriginalText = node.nodeValue;
      const original = node.__watchlistOriginalText;
      const text = original.trim();
      if (text.length < 2) continue;
      if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(text)) continue;
      nodes.push(node);
    }
    return nodes;
  }

  function restoreInterfaceLanguage(root = document.body) {
    collectInterfaceTextNodes(root).forEach(node => {
      if (node.__watchlistOriginalText) node.nodeValue = node.__watchlistOriginalText;
    });
    collectInterfaceAttributes(root).forEach(item => {
      item.element.setAttribute(item.attribute, item.original);
    });
  }

  function collectInterfaceAttributes(root = document.body) {
    if (!root) return [];
    const attributes = ['placeholder', 'title', 'aria-label'];
    const elements = root.querySelectorAll(attributes.map(attribute => `[${attribute}]`).join(','));
    const items = [];
    elements.forEach(element => {
      if (shouldSkipInterfaceElement(element)) return;
      attributes.forEach(attribute => {
        if (!element.hasAttribute(attribute)) return;
        const key = `watchlistOriginal${attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}`;
        if (!element.dataset[key]) element.dataset[key] = element.getAttribute(attribute) || '';
        const original = element.dataset[key];
        if (original.trim().length < 2) return;
        items.push({ element, attribute, original });
      });
    });
    return items;
  }

  async function applyInterfaceLanguage(root = document.body) {
    const session = getSession();
    const targetLang = normalizeLanguageCode(session?.preferredLanguage);
    if (!session) return;
    if (targetLang === 'UK') {
      restoreInterfaceLanguage(root);
      document.documentElement.lang = 'uk';
      return;
    }

    collectInterfaceTextNodes(root).forEach(node => {
      node.nodeValue = translateInterfaceValue(node.__watchlistOriginalText, targetLang);
    });
    collectInterfaceAttributes(root).forEach(item => {
      item.element.setAttribute(item.attribute, translateInterfaceValue(item.original, targetLang));
    });
    document.documentElement.lang = documentLang(targetLang);
  }

  function scheduleInterfaceLanguage(root = document.body, force = false) {
    clearTimeout(interfaceTranslateTimer);
    interfaceTranslateTimer = setTimeout(() => applyInterfaceLanguage(root, force), 120);
  }

  function observeInterfaceLanguage() {
    if (interfaceObserver || !document.body) return;
    interfaceObserver = new MutationObserver(mutations => {
      const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length);
      if (hasAddedNodes) scheduleInterfaceLanguage(document.body);
    });
    interfaceObserver.observe(document.body, { childList: true, subtree: true });
  }

  function getAuthModalMarkup() {
    return `
      <div class="auth-overlay" id="${AUTH_MODAL_ID}" aria-hidden="true">
        <div class="auth-overlay-backdrop" data-close-auth-modal></div>
        <div class="auth-overlay-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-overlay-title">
          <button class="auth-overlay-close" type="button" data-close-auth-modal aria-label="Закрити вікно авторизації">✕</button>
          <div class="auth-overlay-header">
            <div class="auth-overlay-brand">
              <span class="auth-overlay-mark">◐</span>
              <div>
                <h2 id="auth-overlay-title">Watchlist</h2>
              </div>
            </div>
            <div class="auth-overlay-tabs" role="tablist" aria-label="Авторизація">
              <button class="auth-overlay-tab active" type="button" data-auth-tab="login" role="tab" aria-selected="true">Увійти</button>
              <button class="auth-overlay-tab" type="button" data-auth-tab="register" role="tab" aria-selected="false">Реєстрація</button>
            </div>
          </div>

          <section class="auth-overlay-panel active" data-auth-panel="login">
            <div class="auth-overlay-panel-head">
              <h3>Увійти</h3>
            </div>
            <form id="login-form-modal" class="auth-form-stack" data-auth-form="login">
              <div class="form-group auth-field-group">
                <label for="login-identifier-modal">Логін або email</label>
                <input type="text" id="login-identifier-modal" required placeholder="Введіть логін або email" autocomplete="username">
              </div>
              <div class="form-group auth-field-group">
                <label for="login-password-modal">Пароль</label>
                <div class="auth-input-shell">
                  <input type="password" id="login-password-modal" required placeholder="Ваш пароль" autocomplete="current-password">
                  <button type="button" class="auth-visibility-toggle" data-toggle-password="login-password-modal" aria-label="Показати або приховати пароль">◉</button>
                </div>
              </div>
              <div class="form-actions auth-actions">
                <button type="submit" class="btn btn-primary auth-submit">Увійти</button>
              </div>
              <p class="auth-link">Ще немає акаунта? <button type="button" class="auth-inline-button" data-auth-tab="register">Зареєструватися</button></p>
            </form>
          </section>

          <section class="auth-overlay-panel" data-auth-panel="register" hidden>
            <div class="auth-overlay-panel-head">
              <h3>Реєстрація</h3>
            </div>
            <form id="register-form-modal" class="auth-form-stack" data-auth-form="register">
              <div class="form-group auth-field-group">
                <label for="reg-username-modal">Логін</label>
                <input type="text" id="reg-username-modal" required placeholder="Оберіть логін" minlength="3" autocomplete="username">
              </div>
              <div class="form-group auth-field-group">
                <label for="reg-email-modal">Email</label>
                <input type="email" id="reg-email-modal" required placeholder="name@example.com" autocomplete="email">
              </div>
              <div class="form-group auth-field-group">
                <label for="reg-password-modal">Пароль</label>
                <div class="auth-input-shell">
                  <input type="password" id="reg-password-modal" required placeholder="Мінімум 6 символів" minlength="6" autocomplete="new-password">
                  <button type="button" class="auth-visibility-toggle" data-toggle-password="reg-password-modal" aria-label="Показати або приховати пароль">◉</button>
                </div>
              </div>
              <div class="form-group auth-field-group">
                <label for="reg-password2-modal">Підтвердження пароля</label>
                <div class="auth-input-shell">
                  <input type="password" id="reg-password2-modal" required placeholder="Повторіть пароль" autocomplete="new-password">
                  <button type="button" class="auth-visibility-toggle" data-toggle-password="reg-password2-modal" aria-label="Показати або приховати пароль">◉</button>
                </div>
              </div>
              <div class="form-actions auth-actions">
                <button type="submit" class="btn btn-primary auth-submit">Створити акаунт</button>
              </div>
              <p class="auth-link">Вже є акаунт? <button type="button" class="auth-inline-button" data-auth-tab="login">Увійти</button></p>
            </form>
          </section>
        </div>
      </div>
    `;
  }

  function setAuthMode(mode = 'login') {
    const modal = document.getElementById(AUTH_MODAL_ID);
    if (!modal) return;
    modal.dataset.mode = mode;
    modal.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      const isActive = tab.getAttribute('data-auth-tab') === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-auth-panel]').forEach((panel) => {
      const isActive = panel.getAttribute('data-auth-panel') === mode;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });
  }

  function closeAuthModal() {
    const modal = document.getElementById(AUTH_MODAL_ID);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-modal-open');
  }

  function openAuthModal(mode = 'login') {
    const modal = ensureAuthModal();
    if (!modal) return;
    setAuthMode(mode);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-modal-open');
    const targetInput = modal.querySelector(
      mode === 'register' ? '#reg-username-modal' : '#login-identifier-modal'
    );
    targetInput?.focus();
  }

  function bindPasswordToggles(root = document) {
    root.querySelectorAll('[data-toggle-password]').forEach((button) => {
      if (button.dataset.passwordBound === 'true') return;
      button.dataset.passwordBound = 'true';
      button.addEventListener('click', () => {
        const inputId = button.getAttribute('data-toggle-password');
        const input = inputId ? document.getElementById(inputId) : null;
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? '◌' : '◉';
        button.setAttribute('aria-label', isPassword ? 'Приховати пароль' : 'Показати або приховати пароль');
      });
    });
  }

  function bindAuthFormListeners(root = document) {
    root.querySelectorAll('[data-auth-form="register"]').forEach((form) => {
      if (form.dataset.authBound === 'true') return;
      form.dataset.authBound = 'true';
      form.addEventListener('submit', handleRegister);
    });
    root.querySelectorAll('[data-auth-form="login"]').forEach((form) => {
      if (form.dataset.authBound === 'true') return;
      form.dataset.authBound = 'true';
      form.addEventListener('submit', handleLogin);
    });
  }

  function ensureAuthModal() {
    if (isAuthPage()) return null;
    let modal = document.getElementById(AUTH_MODAL_ID);
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', getAuthModalMarkup());
    modal = document.getElementById(AUTH_MODAL_ID);
    if (!modal) return null;

    modal.addEventListener('click', (event) => {
      const closeTrigger = event.target.closest('[data-close-auth-modal]');
      if (closeTrigger) {
        closeAuthModal();
        return;
      }
      const switchTrigger = event.target.closest('[data-auth-tab]');
      if (switchTrigger) {
        setAuthMode(switchTrigger.getAttribute('data-auth-tab') || 'login');
      }
    });

    bindPasswordToggles(modal);
    bindAuthFormListeners(modal);
    return modal;
  }

  function getSiteFooterMarkup() {
    const columns = [
      {
        title: 'Компанія',
        icon: 'building',
        links: [
          ['Про нас', '/about.html'],
          ['Партнери', '/partners.html'],
          ['Правова інформація', '/legal.html'],
          ['Політика приватності', '/privacy.html']
        ]
      },
      {
        title: 'Підтримка',
        icon: 'support',
        links: [
          ['Центр допомоги', '/help-center.html'],
          ['Зв’язатися з підтримкою', '/contact-support.html'],
          ['Безпека акаунта', '/security.html'],
          ['Умови користування', '/terms.html']
        ]
      },
      {
        title: 'Розробникам',
        icon: 'code',
        links: [
          ['Документація API', '/api-docs.html'],
          ['Інтеграції', '/integration-notes.html'],
          ['Історія змін', '/changelog.html'],
          ['План розвитку', '/roadmap']
        ]
      },
      {
        title: 'Продукти',
        icon: 'box',
        links: [
          ['Каталог', '/catalog.html'],
          ['Друзі', '/friends'],
          ['Повідомлення', '/messages'],
          ['Команди', '/teams']
        ]
      },
      {
        title: 'Сценарії',
        icon: 'spark',
        links: [
          ['Особистий каталог', '/scenarios/personal'],
          ['Перегляд із друзями', '/scenarios/watch-with-friends'],
          ['Приватний профіль', '/scenarios/private-profile'],
          ['Аналітика перегляду', '/scenarios/analytics'],
          ['Командне планування', '/scenarios/team-planning']
        ]
      }
    ];

    const icons = {
      building: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 21V6.5L12 3l8 3.5V21" />
          <path d="M9 21v-6h6v6" />
          <path d="M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01" />
        </svg>
      `,
      support: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 0 1 16 0" />
          <path d="M4 12v4a2 2 0 0 0 2 2h2v-6H4Z" />
          <path d="M20 12v4a2 2 0 0 1-2 2h-2v-6h4Z" />
          <path d="M16 18c0 1.7-1.8 3-4 3" />
        </svg>
      `,
      code: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18-6-6 6-6" />
          <path d="m15 6 6 6-6 6" />
          <path d="m13 4-2 16" />
        </svg>
      `,
      box: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4.5 8 7.5 4 7.5-4" />
          <path d="M12 12v9" />
        </svg>
      `,
      spark: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <path d="m6.5 6.5 2.8 2.8" />
          <path d="m14.7 14.7 2.8 2.8" />
          <path d="m17.5 6.5-2.8 2.8" />
          <path d="m9.3 14.7-2.8 2.8" />
        </svg>
      `
    };

    const columnsMarkup = columns.map(({ title, icon, links }) => `
      <nav class="site-footer-column" aria-label="${title}">
        <h2><span class="site-footer-heading-icon">${icons[icon] || icons.spark}</span>${title}</h2>
        ${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
      </nav>
    `).join('');

    return `
      <div class="site-footer-inner">
        <div class="site-footer-brand-row">
          <a class="site-footer-brand" href="/index.html" aria-label="Головна сторінка Watchlist">
            <span class="site-footer-brand-mark" aria-hidden="true">◐</span>
            <span>
              <strong>Watchlist</strong>
              <small>Фільми, серіали й друзі в одному каталозі.</small>
            </span>
          </a>
        </div>
        <div class="site-footer-grid">
          ${columnsMarkup}
        </div>
        <div class="site-footer-bottom">
          <a class="site-footer-language" id="site-footer-language" href="/settings.html" aria-label="Мова сайту">
            <span class="site-footer-globe" aria-hidden="true">◎</span>
            <span data-footer-language-label>${getPreferredLanguageLabel()}</span>
          </a>
          <p>&copy; 2026 Watchlist. Усі права захищено.</p>
        </div>
      </div>
    `;
  }

  function ensureSiteFooter() {
    if (document.getElementById('site-footer')) return;
    const footer = document.createElement('footer');
    footer.id = 'site-footer';
    footer.className = 'site-footer';
    footer.innerHTML = getSiteFooterMarkup();

    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      document.body.insertBefore(footer, toastContainer);
      return;
    }
    document.body.appendChild(footer);
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem(THEME_KEY, theme);
  }

  const initialTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(initialTheme);
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
    });
  }

  async function handleRegister(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.querySelector('#reg-username, #reg-username-modal')?.value || '').trim();
    const email = (form.querySelector('#reg-email, #reg-email-modal')?.value || '').trim().toLowerCase();
    const password = form.querySelector('#reg-password, #reg-password-modal')?.value || '';
    const password2 = form.querySelector('#reg-password2, #reg-password2-modal')?.value || '';

    if (!username || !email || !password || !password2) {
      showToast('Заповніть усі поля');
      return;
    }
    if (username.length < 3) {
      showToast('Логін має бути мінімум 3 символи');
      return;
    }
    if (password !== password2) {
      showToast('Паролі не збігаються');
      return;
    }
    if (password.length < 6) {
      showToast('Пароль має бути мінімум 6 символів');
      return;
    }

    try {
      const data = await apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      setSession({ token: data.token, ...data.user });
      showToast('Реєстрація успішна!');
      if (!isAuthPage()) closeAuthModal();
      setTimeout(() => { window.location.href = isAuthPage() ? 'index.html' : window.location.href; }, 800);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const identifier = (form.querySelector('#login-identifier, #login-identifier-modal')?.value || '').trim().toLowerCase();
    const password = form.querySelector('#login-password, #login-password-modal')?.value || '';

    if (!identifier || !password) {
      showToast('Введіть логін або email та пароль');
      return;
    }

    try {
      const data = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      setSession({ token: data.token, ...data.user });
      showToast('Вхід успішний!');
      if (!isAuthPage()) closeAuthModal();
      setTimeout(() => { window.location.href = isAuthPage() ? 'index.html' : window.location.href; }, 800);
    } catch (error) {
      showToast(error.message);
    }
  }

  bindPasswordToggles(document);
  bindAuthFormListeners(document);

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAuthModal();
  });

  renderTopBarAuth();
  ensureSiteFooter();
  updateFooterLanguage();
  ensureAuthModal();
  connectAccountStatusSocket();
  registerServiceWorker();
  observeInterfaceLanguage();
  scheduleInterfaceLanguage(document.body);

  window.WatchlistAuth = {
    getSession,
    setSession,
    clearSession,
    showToast,
    apiRequest,
    openAuthModal,
    closeAuthModal,
    applyInterfaceLanguage,
    scheduleInterfaceLanguage
  };
})();
