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
  { href: "/catalog", label: "Каталог", labelKey: "nav.catalog" },
  { href: "/friends", label: "Друзі", labelKey: "nav.friends", authOnly: true },
  { href: "/messages", label: "Повідомлення", labelKey: "nav.messages", authOnly: true },
  { href: "/teams", label: "Команди", labelKey: "nav.teams", authOnly: true }
];

export const userNav = [
  { href: "/profile", label: "Профіль", labelKey: "nav.profile" },
  { href: "/settings", label: "Налаштування", labelKey: "nav.settings" },
  { href: "/admin", label: "Адмін панель", labelKey: "nav.admin", adminOnly: true }
];

export const footerGroups = [
  {
    title: "Компанія",
    titleKey: "footer.company",
    icon: Building2,
    links: [
      { href: "/about", label: "Про нас", labelKey: "footer.about" },
      { href: "/partners", label: "Партнери", labelKey: "footer.partners" },
      { href: "/legal", label: "Правова інформація", labelKey: "footer.legal" },
      { href: "/privacy", label: "Політика приватності", labelKey: "footer.privacy" }
    ]
  },
  {
    title: "Підтримка",
    titleKey: "footer.support",
    icon: HelpCircle,
    links: [
      { href: "/help-center", label: "Центр допомоги", labelKey: "footer.help" },
      { href: "/contact-support", label: "Зв’язатися з підтримкою", labelKey: "footer.contact" },
      { href: "/security", label: "Безпека акаунта", labelKey: "footer.security" },
      { href: "/terms", label: "Умови користування", labelKey: "footer.terms" }
    ]
  },
  {
    title: "Розробникам",
    titleKey: "footer.developers",
    icon: Code2,
    links: [
      { href: "/api-docs", label: "Документація API", labelKey: "footer.api" },
      { href: "/integration-notes", label: "Інтеграції", labelKey: "footer.integrations" },
      { href: "/changelog", label: "Історія змін", labelKey: "footer.changelog" },
      { href: "/roadmap", label: "План розвитку", labelKey: "footer.roadmap" }
    ]
  },
  {
    title: "Продукти",
    titleKey: "footer.products",
    icon: Layers3,
    links: [
      { href: "/catalog", label: "Каталог", labelKey: "nav.catalog" },
      { href: "/friends", label: "Друзі", labelKey: "nav.friends" },
      { href: "/messages", label: "Повідомлення", labelKey: "nav.messages" },
      { href: "/teams", label: "Команди", labelKey: "nav.teams" }
    ]
  },
  {
    title: "Сценарії",
    titleKey: "footer.scenarios",
    icon: Sparkles,
    links: [
      { href: "/scenarios/personal", label: "Особистий каталог", labelKey: "footer.personal" },
      { href: "/scenarios/watch-with-friends", label: "Перегляд із друзями", labelKey: "footer.watchWithFriends" },
      { href: "/scenarios/private-profile", label: "Приватний профіль", labelKey: "footer.privateProfile" },
      { href: "/scenarios/analytics", label: "Аналітика перегляду", labelKey: "footer.analytics" },
      { href: "/scenarios/team-planning", label: "Командне планування", labelKey: "footer.teamPlanning" }
    ]
  }
];

export const productCards = [
  { href: "/catalog", title: "Каталог", icon: BookOpen, description: "Фільми й серіали з фільтрами, нотатками і 5-бальною оцінкою." },
  { href: "/friends", title: "Друзі", icon: Users, description: "Список друзів, заявки, приватність і соціальна активність." },
  { href: "/messages", title: "Повідомлення", icon: MessageCircle, description: "Чати між друзями та відповіді підтримки на звернення." },
  { href: "/teams", title: "Команди", icon: Users, description: "Спільні списки, учасники й голосування за наступний перегляд." },
  { href: "/admin", title: "Адмінка", icon: Shield, description: "Користувачі, звернення, модерація, аудит і maintenance.", adminOnly: true },
  { href: "/watchlist-plus", title: "Plus", icon: BarChart3, description: "Розширена аналітика перегляду без зайвого шуму." }
];
