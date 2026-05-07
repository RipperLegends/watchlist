# Supabase migration

Цей проєкт працює через власний Express backend. Локально сайт піднімається як раніше, але backend може читати й писати дані напряму в Supabase Postgres.

## 1. Створити Supabase project

У Supabase створи новий project і відкрий **SQL Editor**.

Скопіюй і виконай файл:

```bash
supabase/schema.sql
```

Або через Supabase CLI:

```bash
supabase login
supabase init
supabase link --project-ref yeucaymxtyysxrvayxsd
supabase db push
```

Для CLI вже підготовлена міграція:

```bash
supabase/migrations/20260502084757_watchlist_schema.sql
```

Якщо `supabase link` попросить пароль - це пароль від Postgres database у твоєму Supabase project, не пароль від акаунта Supabase.

Схема створює таблиці для:

- користувачів;
- записів Watchlist;
- друзів і заявок;
- повідомлень;
- звернень у підтримку;
- команд;
- аудиту.

RLS увімкнено без публічних frontend-політик. Це спеціально: зараз доступ до даних має йти через `server.js`, де вже є JWT, ролі, адмін-права і перевірки приватності.

## 2. Увімкнути Supabase для локального сайту

У локальному `.env`:

```bash
DATABASE_PROVIDER=supabase
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
SUPABASE_POOLER_MODE=transaction
DB_POOL_MAX=1
```

`SUPABASE_POOLER_MODE=transaction` спеціально перемикає runtime-підключення з session pooler `5432` на transaction pooler `6543`. Це потрібно для Vercel/serverless і прибирає помилку `EMAXCONNSESSION`, коли session mode впирається в `Pool Size`.

Після цього:

```bash
npm run server
```

Сайт буде відкриватися локально на `http://localhost:3000`, а всі таблиці `users`, `entries`, `friends`, `messages`, `reports`, `teams` і `audit_logs` працюватимуть у Supabase.

Якщо хочеш тимчасово повернути SQLite:

```bash
DATABASE_PROVIDER=sqlite
DB_FILE=watchlist.db
```

## 3. Додати підключення для міграції

Найзручніше після `supabase link` використовувати pooler-url, який CLI зберігає локально. Тоді треба передати тільки пароль від Supabase Database:

```bash
SUPABASE_DB_PASSWORD=your_database_password npm run db:supabase:migrate -- --apply
```

Щоб пароль не потрапив в історію shell:

```bash
read -s SUPABASE_DB_PASSWORD
export SUPABASE_DB_PASSWORD
npm run db:supabase:migrate -- --apply
unset SUPABASE_DB_PASSWORD
```

Також можна додати повний URI в локальний `.env`:

```bash
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

Для міграції використовуй database/pooler connection string. Anon key сюди не підходить.

## 4. Перевірити, що буде перенесено

```bash
npm run db:supabase:dry-run
```

Команда покаже кількість рядків у кожній таблиці з `watchlist.db`.

## 5. Перенести дані

```bash
npm run db:supabase:migrate -- --apply
```

Якщо потрібно очистити Supabase-таблиці перед імпортом:

```bash
npm run db:supabase:migrate -- --apply --reset --yes
```

`--reset` видаляє дані з Watchlist-таблиць у Supabase, тому його варто використовувати тільки для першого тестового імпорту або коли ти точно хочеш перезаписати базу.

## 6. Що далі

`watchlist.db` тепер можна тримати як backup/export. Основний режим для розробки: локальний Express + постійна Supabase-база.
