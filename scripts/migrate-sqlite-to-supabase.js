require('dotenv').config();

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const shouldReset = args.has('--reset');
const confirmed = args.has('--yes');
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_FILE = process.env.DB_FILE || path.join(PROJECT_ROOT, 'watchlist.db');

function databaseUrlFromLinkedSupabase() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const poolerUrlPath = path.join(PROJECT_ROOT, 'supabase', '.temp', 'pooler-url');
  if (!password || !fs.existsSync(poolerUrlPath)) return '';

  const rawUrl = fs.readFileSync(poolerUrlPath, 'utf8').trim();
  if (!rawUrl) return '';

  const url = new URL(rawUrl);
  url.password = password;
  return url.toString();
}

const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || databaseUrlFromLinkedSupabase();

const tables = [
  {
    name: 'users',
    columns: ['id', 'name', 'email', 'password', 'role', 'account_status', 'presence_status', 'last_seen', 'online_visibility', 'profile_visibility', 'friend_request_policy', 'preferred_language', 'avatar_url', 'cover_url', 'bio', 'favorite_genres'],
    timestamps: ['last_seen']
  },
  {
    name: 'entries',
    columns: ['id', 'user_id', 'title', 'type', 'status', 'rating', 'year', 'genre', 'tags', 'mood', 'poster_url', 'director', 'runtime', 'comment', 'current_season', 'current_episode', 'next_episode_date', 'created_by_admin', 'sort_order', 'is_favorite', 'created_at'],
    booleans: ['created_by_admin', 'is_favorite'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'friends',
    columns: ['id', 'user_id', 'friend_id', 'status', 'requested_by', 'interactions', 'messages_count', 'games_count', 'streak_days', 'last_interaction_at', 'muted_by_user', 'muted_by_friend', 'blocked_by_user', 'blocked_by_friend', 'created_at', 'updated_at'],
    booleans: ['muted_by_user', 'muted_by_friend', 'blocked_by_user', 'blocked_by_friend'],
    timestamps: ['last_interaction_at'],
    requiredTimestamps: ['created_at', 'updated_at']
  },
  {
    name: 'friend_messages',
    columns: ['id', 'relation_id', 'sender_id', 'receiver_id', 'body', 'content_title', 'content_url', 'content_meta', 'read_at', 'created_at'],
    timestamps: ['read_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'teams',
    columns: ['id', 'name', 'description', 'owner_id', 'created_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'team_members',
    columns: ['id', 'team_id', 'user_id', 'role', 'joined_at'],
    requiredTimestamps: ['joined_at']
  },
  {
    name: 'team_items',
    columns: ['id', 'team_id', 'title', 'type', 'status', 'scheduled_at', 'created_by', 'created_at'],
    timestamps: ['scheduled_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'team_votes',
    columns: ['id', 'item_id', 'user_id', 'value', 'created_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'reports',
    columns: ['id', 'user_id', 'email', 'subject', 'body', 'status', 'admin_response', 'responded_at', 'responded_by', 'created_at'],
    timestamps: ['responded_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'report_messages',
    columns: ['id', 'report_id', 'sender_id', 'sender_role', 'body', 'created_at'],
    requiredTimestamps: ['created_at']
  },
  {
    name: 'audit_logs',
    columns: ['id', 'user_id', 'action', 'details', 'created_at'],
    requiredTimestamps: ['created_at']
  }
];

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
  });
}

function quoteId(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function toBool(value) {
  return value === true || value === 1 || value === '1';
}

function optionalTimestamp(value) {
  return value ? value : null;
}

function requiredTimestamp(value) {
  return value || new Date().toISOString();
}

function normalizeValue(table, column, value) {
  if (table.booleans?.includes(column)) return toBool(value);
  if (table.requiredTimestamps?.includes(column)) return requiredTimestamp(value);
  if (table.timestamps?.includes(column)) return optionalTimestamp(value);
  if (value === undefined) return null;
  return value;
}

async function loadTableRows(db, table) {
  const rows = await sqliteAll(db, `SELECT * FROM ${quoteId(table.name)} ORDER BY id ASC`);
  return rows.map(row => {
    const next = {};
    table.columns.forEach(column => {
      next[column] = normalizeValue(table, column, row[column]);
    });
    return next;
  });
}

async function insertRows(client, table, rows) {
  if (!rows.length) return 0;
  const columnsSql = table.columns.map(quoteId).join(', ');
  const placeholders = table.columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = table.columns
    .filter(column => column !== 'id')
    .map(column => `${quoteId(column)} = excluded.${quoteId(column)}`)
    .join(', ');
  const sql = `
    insert into public.${quoteId(table.name)} (${columnsSql})
    values (${placeholders})
    on conflict (id) do update set ${updates}
  `;

  let inserted = 0;
  for (const row of rows) {
    const values = table.columns.map(column => row[column]);
    await client.query(sql, values);
    inserted += 1;
  }
  return inserted;
}

async function run() {
  const sqlite = new sqlite3.Database(DB_FILE);
  const loaded = [];

  try {
    for (const table of tables) {
      const rows = await loadTableRows(sqlite, table);
      loaded.push({ table, rows });
    }

    const counts = Object.fromEntries(loaded.map(({ table, rows }) => [table.name, rows.length]));
    if (!shouldApply) {
      console.log(JSON.stringify({
        ok: true,
        mode: 'dry-run',
        dbFile: DB_FILE,
        counts,
        next: 'Run SUPABASE_DB_PASSWORD="..." npm run db:supabase:migrate -- --apply after supabase link/db push.'
      }, null, 2));
      return;
    }

    if (!DATABASE_URL) {
      throw new Error('Set SUPABASE_DB_URL/DATABASE_URL, or set SUPABASE_DB_PASSWORD after running supabase link.');
    }
    if (shouldReset && !confirmed) {
      throw new Error('The --reset option is destructive. Add --yes to confirm.');
    }

    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });

    await client.connect();
    try {
      await client.query('begin');
      if (shouldReset) {
        await client.query(`
          truncate table
            public.audit_logs,
            public.report_messages,
            public.reports,
            public.team_votes,
            public.team_items,
            public.team_members,
            public.teams,
            public.friend_messages,
            public.friends,
            public.entries,
            public.users
          restart identity cascade
        `);
      }

      const migrated = {};
      for (const { table, rows } of loaded) {
        migrated[table.name] = await insertRows(client, table, rows);
      }
      await client.query('select public.sync_watchlist_identity_sequences()');
      await client.query('commit');
      console.log(JSON.stringify({ ok: true, mode: 'apply', migrated }, null, 2));
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      await client.end();
    }
  } finally {
    sqlite.close();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
