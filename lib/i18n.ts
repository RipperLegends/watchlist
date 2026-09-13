import { cache } from "react";
import { cookies } from "next/headers";
import type { Language } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Locale = Language;

const LOCALE_COOKIE = "watchlist-locale";

const dictionary: Record<Locale, Record<string, string>> = {
  UK: {
    "common.brandTagline": "Фільми, серіали й друзі в одному каталозі.",
    "common.copyright": "© 2026 Watchlist. Усі права захищено.",
    "common.open": "Відкрити",
    "common.signIn": "Увійти",
    "common.signUp": "Реєстрація",
    "common.signOut": "Вийти",
    "role.admin": "admin",
    "role.user": "user",

    "nav.home": "Головна",
    "nav.catalog": "Каталог",
    "nav.friends": "Друзі",
    "nav.messages": "Повідомлення",
    "nav.teams": "Команди",
    "nav.profile": "Профіль",
    "nav.settings": "Налаштування",
    "nav.admin": "Адмін панель",

    "footer.company": "Компанія",
    "footer.support": "Підтримка",
    "footer.developers": "Розробникам",
    "footer.products": "Продукти",
    "footer.scenarios": "Сценарії",
    "footer.about": "Про нас",
    "footer.partners": "Партнери",
    "footer.legal": "Правова інформація",
    "footer.privacy": "Політика приватності",
    "footer.help": "Центр допомоги",
    "footer.contact": "Зв’язатися з підтримкою",
    "footer.security": "Безпека акаунта",
    "footer.terms": "Умови користування",
    "footer.api": "Документація API",
    "footer.integrations": "Інтеграції",
    "footer.changelog": "Історія змін",
    "footer.roadmap": "План розвитку",
    "footer.personal": "Особистий каталог",
    "footer.watchWithFriends": "Перегляд із друзями",
    "footer.privateProfile": "Приватний профіль",
    "footer.analytics": "Аналітика перегляду",
    "footer.teamPlanning": "Командне планування",

    "settings.eyebrow": "Налаштування",
    "settings.title": "Налаштування профілю",
    "settings.description": "Керуйте акаунтом, профілем, приватністю та заблокованими користувачами в одному місці.",
    "settings.account.title": "Акаунт",
    "settings.account.description": "Логін, email і пароль для входу.",
    "settings.account.name": "Логін",
    "settings.account.email": "Email",
    "settings.account.password": "Новий пароль",
    "settings.account.passwordPlaceholder": "Залиште порожнім, щоб не змінювати",
    "settings.account.save": "Зберегти акаунт",
    "settings.profile.title": "Публічний профіль",
    "settings.profile.description": "Біо й жанри, які допомагають профілю виглядати живим.",
    "settings.profile.bio": "Біо",
    "settings.profile.bioPlaceholder": "Коротко про ваші смаки у фільмах і серіалах",
    "settings.profile.genres": "Улюблені жанри",
    "settings.profile.genresPlaceholder": "драма, фантастика, кіберпанк",
    "settings.profile.save": "Зберегти профіль",
    "settings.privacy.title": "Приватність",
    "settings.privacy.description": "Хто бачить вас онлайн, профіль і хто може надсилати заявки.",
    "settings.privacy.status": "Ваш статус",
    "settings.privacy.onlineVisibility": "Хто бачить онлайн",
    "settings.privacy.profileVisibility": "Видимість профілю",
    "settings.privacy.friendRequests": "Хто може надсилати заявки",
    "settings.privacy.save": "Зберегти приватність",
    "settings.blocked.title": "Заблоковані користувачі",
    "settings.blocked.description": "Користувачі, яких ви заблокували у друзях.",
    "settings.blocked.empty": "Заблокованих користувачів немає.",
    "settings.blocked.unblock": "Розблокувати",
    "settings.images.title": "Зображення профілю",
    "settings.images.description": "Аватарка й обкладинка профілю.",
    "settings.images.storageMissing": "Завантаження зображень ще не підключене. Поки що аватар і обкладинку можна буде додати після налаштування сховища.",
    "settings.images.pickFirst": "Спочатку виберіть зображення.",
    "settings.images.uploadFailed": "Не вдалося завантажити зображення.",
    "settings.images.avatarUpdated": "Аватарку оновлено.",
    "settings.images.coverUpdated": "Обкладинку оновлено.",
    "settings.images.avatar": "Аватар",
    "settings.images.cover": "Обкладинка",
    "settings.option.online": "Онлайн",
    "settings.option.offline": "Офлайн",
    "settings.option.dnd": "Не турбувати",
    "settings.option.hidden": "Прихований",
    "settings.option.everyone": "Усі",
    "settings.option.friends": "Друзі",
    "settings.option.friendsOfFriends": "Друзі друзів",
    "settings.option.nobody": "Ніхто"
  },
  RU: {
    "common.brandTagline": "Фильмы, сериалы и друзья в одном каталоге.",
    "common.copyright": "© 2026 Watchlist. Все права защищены.",
    "common.open": "Открыть",
    "common.signIn": "Войти",
    "common.signUp": "Регистрация",
    "common.signOut": "Выйти",
    "role.admin": "admin",
    "role.user": "user",

    "nav.home": "Главная",
    "nav.catalog": "Каталог",
    "nav.friends": "Друзья",
    "nav.messages": "Сообщения",
    "nav.teams": "Команды",
    "nav.profile": "Профиль",
    "nav.settings": "Настройки",
    "nav.admin": "Админ панель",

    "footer.company": "Компания",
    "footer.support": "Поддержка",
    "footer.developers": "Разработчикам",
    "footer.products": "Продукты",
    "footer.scenarios": "Сценарии",
    "footer.about": "О нас",
    "footer.partners": "Партнеры",
    "footer.legal": "Правовая информация",
    "footer.privacy": "Политика приватности",
    "footer.help": "Центр помощи",
    "footer.contact": "Связаться с поддержкой",
    "footer.security": "Безопасность аккаунта",
    "footer.terms": "Условия использования",
    "footer.api": "Документация API",
    "footer.integrations": "Интеграции",
    "footer.changelog": "История изменений",
    "footer.roadmap": "План развития",
    "footer.personal": "Личный каталог",
    "footer.watchWithFriends": "Просмотр с друзьями",
    "footer.privateProfile": "Приватный профиль",
    "footer.analytics": "Аналитика просмотра",
    "footer.teamPlanning": "Командное планирование",

    "settings.eyebrow": "Настройки",
    "settings.title": "Настройки профиля",
    "settings.description": "Управляйте аккаунтом, профилем, приватностью и заблокированными пользователями в одном месте.",
    "settings.account.title": "Аккаунт",
    "settings.account.description": "Логин, email и пароль для входа.",
    "settings.account.name": "Логин",
    "settings.account.email": "Email",
    "settings.account.password": "Новый пароль",
    "settings.account.passwordPlaceholder": "Оставьте пустым, чтобы не менять",
    "settings.account.save": "Сохранить аккаунт",
    "settings.profile.title": "Публичный профиль",
    "settings.profile.description": "Био и жанры, которые делают профиль живее.",
    "settings.profile.bio": "Био",
    "settings.profile.bioPlaceholder": "Коротко о ваших вкусах в фильмах и сериалах",
    "settings.profile.genres": "Любимые жанры",
    "settings.profile.genresPlaceholder": "драма, фантастика, киберпанк",
    "settings.profile.save": "Сохранить профиль",
    "settings.privacy.title": "Приватность",
    "settings.privacy.description": "Кто видит вас онлайн, профиль и кто может отправлять заявки.",
    "settings.privacy.status": "Ваш статус",
    "settings.privacy.onlineVisibility": "Кто видит онлайн",
    "settings.privacy.profileVisibility": "Видимость профиля",
    "settings.privacy.friendRequests": "Кто может отправлять заявки",
    "settings.privacy.save": "Сохранить приватность",
    "settings.blocked.title": "Заблокированные пользователи",
    "settings.blocked.description": "Пользователи, которых вы заблокировали в друзьях.",
    "settings.blocked.empty": "Заблокированных пользователей нет.",
    "settings.blocked.unblock": "Разблокировать",
    "settings.images.title": "Изображения профиля",
    "settings.images.description": "Аватар и обложка профиля.",
    "settings.images.storageMissing": "Загрузка изображений еще не подключена. Аватар и обложку можно будет добавить после настройки хранилища.",
    "settings.images.pickFirst": "Сначала выберите изображение.",
    "settings.images.uploadFailed": "Не удалось загрузить изображение.",
    "settings.images.avatarUpdated": "Аватар обновлен.",
    "settings.images.coverUpdated": "Обложка обновлена.",
    "settings.images.avatar": "Аватар",
    "settings.images.cover": "Обложка",
    "settings.option.online": "Онлайн",
    "settings.option.offline": "Офлайн",
    "settings.option.dnd": "Не беспокоить",
    "settings.option.hidden": "Скрытый",
    "settings.option.everyone": "Все",
    "settings.option.friends": "Друзья",
    "settings.option.friendsOfFriends": "Друзья друзей",
    "settings.option.nobody": "Никто"
  },
  EN: {
    "common.brandTagline": "Movies, series and friends in one catalog.",
    "common.copyright": "© 2026 Watchlist. All rights reserved.",
    "common.open": "Open",
    "common.signIn": "Sign in",
    "common.signUp": "Create account",
    "common.signOut": "Sign out",
    "role.admin": "admin",
    "role.user": "user",

    "nav.home": "Home",
    "nav.catalog": "Catalog",
    "nav.friends": "Friends",
    "nav.messages": "Messages",
    "nav.teams": "Teams",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.admin": "Admin panel",

    "footer.company": "Company",
    "footer.support": "Support",
    "footer.developers": "Developers",
    "footer.products": "Products",
    "footer.scenarios": "Scenarios",
    "footer.about": "About",
    "footer.partners": "Partners",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy policy",
    "footer.help": "Help center",
    "footer.contact": "Contact support",
    "footer.security": "Account security",
    "footer.terms": "Terms of service",
    "footer.api": "API docs",
    "footer.integrations": "Integrations",
    "footer.changelog": "Changelog",
    "footer.roadmap": "Roadmap",
    "footer.personal": "Personal catalog",
    "footer.watchWithFriends": "Watch with friends",
    "footer.privateProfile": "Private profile",
    "footer.analytics": "Viewing analytics",
    "footer.teamPlanning": "Team planning",

    "settings.eyebrow": "Settings",
    "settings.title": "Profile settings",
    "settings.description": "Manage your account, profile, privacy and blocked users in one place.",
    "settings.account.title": "Account",
    "settings.account.description": "Login, email and password for signing in.",
    "settings.account.name": "Login",
    "settings.account.email": "Email",
    "settings.account.password": "New password",
    "settings.account.passwordPlaceholder": "Leave empty to keep current password",
    "settings.account.save": "Save account",
    "settings.profile.title": "Public profile",
    "settings.profile.description": "Bio and genres that make the profile feel alive.",
    "settings.profile.bio": "Bio",
    "settings.profile.bioPlaceholder": "Briefly describe your taste in movies and series",
    "settings.profile.genres": "Favorite genres",
    "settings.profile.genresPlaceholder": "drama, sci-fi, cyberpunk",
    "settings.profile.save": "Save profile",
    "settings.privacy.title": "Privacy",
    "settings.privacy.description": "Who can see you online, view your profile and send friend requests.",
    "settings.privacy.status": "Your status",
    "settings.privacy.onlineVisibility": "Who sees online status",
    "settings.privacy.profileVisibility": "Profile visibility",
    "settings.privacy.friendRequests": "Who can send requests",
    "settings.privacy.save": "Save privacy",
    "settings.blocked.title": "Blocked users",
    "settings.blocked.description": "Users you blocked in friends.",
    "settings.blocked.empty": "There are no blocked users.",
    "settings.blocked.unblock": "Unblock",
    "settings.images.title": "Profile images",
    "settings.images.description": "Profile avatar and cover image.",
    "settings.images.storageMissing": "Image uploads are not connected yet. You will be able to add an avatar and cover after storage is configured.",
    "settings.images.pickFirst": "Choose an image first.",
    "settings.images.uploadFailed": "Could not upload the image.",
    "settings.images.avatarUpdated": "Avatar updated.",
    "settings.images.coverUpdated": "Cover updated.",
    "settings.images.avatar": "Avatar",
    "settings.images.cover": "Cover",
    "settings.option.online": "Online",
    "settings.option.offline": "Offline",
    "settings.option.dnd": "Do not disturb",
    "settings.option.hidden": "Hidden",
    "settings.option.everyone": "Everyone",
    "settings.option.friends": "Friends",
    "settings.option.friendsOfFriends": "Friends of friends",
    "settings.option.nobody": "Nobody"
  }
};

export const localeLabels: Record<Locale, string> = {
  UK: "Українська (UA)",
  RU: "Русский (RU)",
  EN: "English (EN)"
};

export const localeToHtmlLang: Record<Locale, string> = {
  UK: "uk",
  RU: "ru",
  EN: "en"
};

export function normalizeLocale(value: unknown): Locale {
  return value === "RU" || value === "EN" ? value : "UK";
}

export function parseLocale(value: unknown): Locale | null {
  return value === "UK" || value === "RU" || value === "EN" ? value : null;
}

export function t(locale: Locale, key: string) {
  return dictionary[locale]?.[key] ?? dictionary.UK[key] ?? key;
}

export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id < 0) {
    const cookieStore = await cookies();
    return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? "UK";
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { preferredLanguage: true }
  });

  return normalizeLocale(user?.preferredLanguage);
});

export async function saveLocalePreference(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax"
  });

  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id < 0) return;

  await prisma.user.update({
    where: { id },
    data: { preferredLanguage: locale }
  });
}
