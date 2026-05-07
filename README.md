# Watchlist

Full-stack веб-застосунок для власного каталогу фільмів, серіалів, друзів, повідомлень, звернень у підтримку і адмін-керування.

## Стек

- Next.js App Router;
- TypeScript;
- Tailwind CSS;
- shadcn/ui style source components;
- PostgreSQL;
- Prisma ORM;
- Auth.js credentials auth;
- Vercel deploy.

## Функціонал

- акаунти користувачів і ролі `user` / `admin`;
- Watchlist із 5-бальною оцінкою;
- друзі, заявки, блокування і приватність;
- повідомлення між друзями;
- звернення в підтримку з перепискою;
- адмін-панель з користувачами, зверненнями, аудитом і maintenance;
- footer-сторінки, сценарії, продукти і roadmap;
- PostgreSQL/Prisma схема для продакшну.

## Запуск

```bash
npm install
npx prisma generate
npm run dev
```

Сайт буде доступний на:

```bash
http://localhost:3000
```

Для production build:

```bash
npm run build
```

## База даних

Prisma schema:

```bash
prisma/schema.prisma
```

Створення міграції:

```bash
npm run prisma:migrate
```

## Env файли

- `.env.local` або `.env` - реальні локальні секрети, не комітити.
- `.env.example` - безпечний шаблон зі списком потрібних змінних.
