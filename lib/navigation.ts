import {
  BarChart3,
  BookOpen,
  Building2,
  Code2,
  HelpCircle,
  Layers3,
  MessageCircle,
  Shield,
  Sparkles,
  Users
} from "lucide-react";

export const mainNav = [
  { href: "/", label: "Головна" },
  { href: "/catalog", label: "Каталог" },
  { href: "/friends", label: "Друзі" },
  { href: "/messages", label: "Повідомлення" },
  { href: "/teams", label: "Команди" }
];

export const userNav = [
  { href: "/profile", label: "Профіль" },
  { href: "/settings", label: "Налаштування" },
  { href: "/admin", label: "Адмін панель", adminOnly: true }
];

export const footerGroups = [
  {
    title: "Компанія",
    icon: Building2,
    links: [
      { href: "/about", label: "Про нас" },
      { href: "/partners", label: "Партнери" },
      { href: "/legal", label: "Правова інформація" },
      { href: "/privacy", label: "Політика приватності" }
    ]
  },
  {
    title: "Підтримка",
    icon: HelpCircle,
    links: [
      { href: "/help-center", label: "Центр допомоги" },
      { href: "/contact-support", label: "Зв’язатися з підтримкою" },
      { href: "/security", label: "Безпека акаунта" },
      { href: "/terms", label: "Умови користування" }
    ]
  },
  {
    title: "Розробникам",
    icon: Code2,
    links: [
      { href: "/api-docs", label: "Документація API" },
      { href: "/integration-notes", label: "Інтеграції" },
      { href: "/changelog", label: "Історія змін" },
      { href: "/roadmap", label: "План розвитку" }
    ]
  },
  {
    title: "Продукти",
    icon: Layers3,
    links: [
      { href: "/catalog", label: "Каталог" },
      { href: "/friends", label: "Друзі" },
      { href: "/messages", label: "Повідомлення" },
      { href: "/teams", label: "Команди" }
    ]
  },
  {
    title: "Сценарії",
    icon: Sparkles,
    links: [
      { href: "/scenarios/personal", label: "Особистий каталог" },
      { href: "/scenarios/watch-with-friends", label: "Перегляд із друзями" },
      { href: "/scenarios/private-profile", label: "Приватний профіль" },
      { href: "/scenarios/analytics", label: "Аналітика перегляду" },
      { href: "/scenarios/team-planning", label: "Командне планування" }
    ]
  }
];

export const productCards = [
  { href: "/catalog", title: "Каталог", icon: BookOpen, description: "Фільми й серіали з фільтрами, нотатками і 5-бальною оцінкою." },
  { href: "/friends", title: "Друзі", icon: Users, description: "Список друзів, заявки, приватність і соціальна активність." },
  { href: "/messages", title: "Повідомлення", icon: MessageCircle, description: "Чати між друзями та відповіді підтримки на звернення." },
  { href: "/admin", title: "Адмінка", icon: Shield, description: "Користувачі, звернення, модерація, аудит і maintenance." },
  { href: "/watchlist-plus", title: "Plus", icon: BarChart3, description: "Аналітика перегляду й розумні рекомендації для наступних релізів." }
];
