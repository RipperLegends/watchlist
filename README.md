# Watchlist

Веб-застосунок для власного каталогу фільмів, серіалів, друзів, повідомлень, звернень у підтримку і адмін-керування.

## Функціонал

- акаунти користувачів і ролі `user` / `admin`;
- Watchlist із 5-бальною оцінкою;
- друзі, заявки, блокування і приватність;
- повідомлення між друзями;
- звернення в підтримку з перепискою;
- адмін-панель з користувачами, зверненнями, аудитом і maintenance;
- footer-сторінки, сценарії, продукти і roadmap;
- локальна SQLite БД для розробки;
- підготовлена Supabase/Postgres схема для продакшну.

## Запуск

```bash
npm install
npm run server
```

Сайт буде доступний на:

```bash
http://localhost:3000
```

Для production build:

```bash
npm run build
```

Для smoke e2e:

```bash
npm run test:e2e
```

## База даних

Поточна локальна база:

```bash
watchlist.db
```

Supabase/Postgres міграція:

```bash
supabase/schema.sql
docs/supabase.md
```

Перевірка майбутнього імпорту:

```bash
npm run db:supabase:dry-run
```

## Env файли

- `.env` - реальні локальні секрети, не комітити.
- `.env.example` - безпечний шаблон зі списком потрібних змінних.

## Технології

- Express;
- SQLite для локальної розробки;
- Supabase/Postgres як наступний production-рівень БД;
- Vanilla JavaScript;
- HTML/CSS;
- WebSocket для realtime-подій.
