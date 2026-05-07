import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/marketing-page";

const scenarios = {
  personal: {
    title: "Особистий каталог",
    description: "Приватний простір для фільмів, серіалів, ігор, тегів, нотаток і 5-бальної оцінки.",
    sections: [
      ["Списки", "Фільми, серіали й ігри зі статусами: планую, дивлюсь, завершено."],
      ["Фішки", "Швидке додавання, нотатки, постери, власні теги й компактна модалка коментаря."]
    ]
  },
  "watch-with-friends": {
    title: "Перегляд із друзями",
    description: "Соціальний сценарій без зайвих кімнат: друзі, повідомлення, рекомендації і спільні плани.",
    sections: [
      ["Друзі", "Онлайн-статус, заявки, блокування і приватність."],
      ["Повідомлення", "Швидко надіслати другу посилання або назву контенту."]
    ]
  },
  "private-profile": {
    title: "Приватний профіль",
    description: "Контроль видимості профілю, онлайн-статусу і заявок у налаштуваннях.",
    sections: [
      ["Видимість", "Усі, друзі або ніхто для профілю та онлайн-статусу."],
      ["Блокування", "Заблоковані користувачі не можуть взаємодіяти з вами."]
    ]
  },
  analytics: {
    title: "Аналітика перегляду",
    description: "Статистика каталогу, середня оцінка, активність і майбутні рекомендації.",
    sections: [
      ["Огляд", "Кількість записів, завершені, активні й середня оцінка."],
      ["Plus", "Після підключення AI/TMDb аналітика стане персональною."]
    ]
  },
  "team-planning": {
    title: "Командне планування",
    description: "Команди для друзів, кіберспорту або студій: ролі, спільний список і голосування.",
    sections: [
      ["Ролі", "admin/member і власник команди."],
      ["Плани", "Спільний watchlist, розклад і голосування що дивитись."]
    ]
  }
} satisfies Record<string, { title: string; description: string; sections: Array<[string, string]> }>;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ScenarioPage({ params }: PageProps) {
  const { slug } = await params;
  const page = scenarios[slug as keyof typeof scenarios];
  if (!page) notFound();
  return <MarketingPage {...page} />;
}
