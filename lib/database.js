const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BOOLEAN_COLUMNS = new Set([
  'created_by_admin',
  'is_favorite',
  'muted_by_user',
  'muted_by_friend',
  'blocked_by_user',
  'blocked_by_friend'
]);

const NUMERIC_ALIASES = new Set([
  'total',
  'count',
  'blocked',
  'accepted',
  'acceptedFriends',
  'activeDays',
  'averageRating',
  'backlog',
  'favorites',
  'messageCount',
  'messagesCount',
  'movies',
  'publicEntries',
  'series',
  'totalAdmins',
  'totalEntries',
  'totalUsers',
  'votes',
  'votedByMe',
  'watchedMinutes',
  'watchedMovies',
  'watchingNow'
]);

function databaseUrlFromLinkedSupabase(projectRoot) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const poolerUrlPath = path.join(projectRoot, 'supabase', '.temp', 'pooler-url');
  if (!password || !fs.existsSync(poolerUrlPath)) return '';

  const rawUrl = fs.readFileSync(poolerUrlPath, 'utf8').trim();
  if (!rawUrl) return '';

  const url = new URL(rawUrl);
  url.password = password;
  return url.toString();
}

function postgresConnectionString(projectRoot) {
  return process.env.SUPABASE_DB_URL
    || process.env.DATABASE_URL
    || databaseUrlFromLinkedSupabase(projectRoot);
}

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isSupabasePoolerUrl(connectionString) {
  try {
    const url = new URL(connectionString);
    return /\.pooler\.supabase\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function normalizeRuntimeConnectionString(connectionString) {
  const poolerMode = String(process.env.SUPABASE_POOLER_MODE || 'transaction').trim().toLowerCase();
  if (poolerMode === 'session' || !isSupabasePoolerUrl(connectionString)) return connectionString;

  try {
    const url = new URL(connectionString);
    if (url.port === '5432' || !url.port) {
      url.port = '6543';
    }
    if (!url.searchParams.has('application_name')) {
      url.searchParams.set('application_name', 'watchlist');
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

function defaultPoolMax(connectionString) {
  if (process.env.DB_POOL_MAX) return positiveIntegerEnv('DB_POOL_MAX', 1);
  if (process.env.VERCEL || isSupabasePoolerUrl(connectionString)) return 1;
  return 5;
}

function isPostgresProvider(projectRoot) {
  const provider = String(process.env.DATABASE_PROVIDER || process.env.DB_PROVIDER || '').toLowerCase();
  if (['supabase', 'postgres', 'postgresql', 'pg'].includes(provider)) return true;
  return false;
}

function quoteCamelAliases(sql) {
  return sql.replace(/\bAS\s+([A-Za-z][A-Za-z0-9]*)\b/g, (match, alias) => {
    return /[A-Z]/.test(alias) ? `AS "${alias}"` : match;
  });
}

function convertPlaceholders(sql) {
  let index = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (char === "'") {
      result += char;
      if (inString && next === "'") {
        result += next;
        i += 1;
      } else {
        inString = !inString;
      }
      continue;
    }
    if (char === '?' && !inString) {
      index += 1;
      result += `$${index}`;
      continue;
    }
    result += char;
  }

  return result;
}

function splitSqlList(value) {
  const items = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const next = value[i + 1];
    if (char === "'") {
      current += char;
      if (inString && next === "'") {
        current += next;
        i += 1;
      } else {
        inString = !inString;
      }
      continue;
    }
    if (!inString && char === '(') depth += 1;
    if (!inString && char === ')') depth -= 1;
    if (!inString && depth === 0 && char === ',') {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function countPlaceholders(value) {
  return (value.match(/\?/g) || []).length;
}

function toPgBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function normalizePostgresParams(sql, params = []) {
  const next = [...params];
  const insert = sql.match(/insert\s+(?:or\s+ignore\s+)?into\s+\w+\s*\(([\s\S]+?)\)\s*values\s*\(([\s\S]+?)\)/i);
  if (insert) {
    const columns = splitSqlList(insert[1]).map(column => column.replace(/["`]/g, '').trim());
    const values = splitSqlList(insert[2]);
    let paramIndex = 0;
    values.forEach((value, index) => {
      const placeholders = countPlaceholders(value);
      if (placeholders === 1 && BOOLEAN_COLUMNS.has(columns[index])) {
        next[paramIndex] = toPgBoolean(next[paramIndex]);
      }
      paramIndex += placeholders;
    });
  }

  const chunks = sql.split('?');
  for (let index = 0; index < chunks.length - 1; index += 1) {
    const prefix = chunks[index].slice(-120);
    const match = prefix.match(/(?:^|[,\s])([a-z_]+)\s*=\s*$/i);
    if (match && BOOLEAN_COLUMNS.has(match[1])) {
      next[index] = toPgBoolean(next[index]);
    }
  }

  return next;
}

function normalizePostgresSql(sql, { forRun = false } = {}) {
  let next = String(sql || '').trim().replace(/;+\s*$/, '');
  const insertIgnore = /^\s*insert\s+or\s+ignore\s+into\b/i.test(next);

  next = next
    .replace(/BEGIN TRANSACTION/gi, 'BEGIN')
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/ON CONFLICT\(/gi, 'ON CONFLICT (')
    .replace(/datetime\('now',\s*'-1 hour'\)/gi, "(CURRENT_TIMESTAMP - INTERVAL '1 hour')")
    .replace(/date\('now',\s*'-1 day'\)/gi, "(CURRENT_DATE - INTERVAL '1 day')")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/\bSUM\(is_favorite\)/gi, 'SUM(CASE WHEN is_favorite THEN 1 ELSE 0 END)');

  BOOLEAN_COLUMNS.forEach(column => {
    const target = `(?:\\w+\\.)?${column}`;
    next = next
      .replace(new RegExp(`\\b(${target})\\s*=\\s*1\\b`, 'gi'), '$1 = true')
      .replace(new RegExp(`\\b(${target})\\s*=\\s*0\\b`, 'gi'), '$1 = false');
  });

  if (insertIgnore && !/\bon\s+conflict\b/i.test(next)) {
    next += ' ON CONFLICT DO NOTHING';
  }
  if (forRun && /^\s*insert\b/i.test(next) && !/\breturning\b/i.test(next)) {
    next += ' RETURNING id';
  }

  return convertPlaceholders(quoteCamelAliases(next));
}

function normalizePostgresRow(row) {
  if (!row) return row;
  Object.keys(row).forEach(key => {
    if (NUMERIC_ALIASES.has(key) && row[key] !== null && row[key] !== undefined) {
      row[key] = Number(row[key]) || 0;
    }
  });
  return row;
}

function createSqliteDatabase(dbFile) {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbFile);
  db.isPostgres = false;
  return db;
}

function createPostgresDatabase(projectRoot) {
  const rawConnectionString = postgresConnectionString(projectRoot);
  const connectionString = normalizeRuntimeConnectionString(rawConnectionString);
  if (!connectionString) {
    throw new Error('DATABASE_PROVIDER=supabase requires SUPABASE_DB_URL, DATABASE_URL, or SUPABASE_DB_PASSWORD after supabase link.');
  }

  const pool = new Pool({
    connectionString,
    max: defaultPoolMax(connectionString),
    idleTimeoutMillis: positiveIntegerEnv('DB_POOL_IDLE_TIMEOUT_MS', 1000),
    connectionTimeoutMillis: positiveIntegerEnv('DB_POOL_CONNECTION_TIMEOUT_MS', 10000),
    maxLifetimeSeconds: positiveIntegerEnv('DB_POOL_MAX_LIFETIME_SECONDS', 60),
    allowExitOnIdle: process.env.DB_POOL_ALLOW_EXIT_ON_IDLE !== 'false',
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });

  return {
    isPostgres: true,
    pool,
    run(sql, params = [], callback = () => {}) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const query = normalizePostgresSql(sql, { forRun: true });
      const values = normalizePostgresParams(sql, params);
      pool.query(query, values)
        .then(result => {
          const context = {
            lastID: result.rows?.[0]?.id || null,
            changes: result.rowCount || 0
          };
          callback.call(context, null);
        })
        .catch(error => callback(error));
    },
    get(sql, params = [], callback = () => {}) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(normalizePostgresSql(sql), params)
        .then(result => callback(null, normalizePostgresRow(result.rows[0] || null)))
        .catch(error => callback(error));
    },
    all(sql, params = [], callback = () => {}) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(normalizePostgresSql(sql), params)
        .then(result => callback(null, result.rows.map(normalizePostgresRow)))
        .catch(error => callback(error));
    },
    serialize(callback) {
      callback();
    },
    close(callback = () => {}) {
      pool.end().then(() => callback()).catch(callback);
    }
  };
}

function createDatabase({ projectRoot, dbFile }) {
  if (isPostgresProvider(projectRoot)) return createPostgresDatabase(projectRoot);
  return createSqliteDatabase(dbFile);
}

module.exports = {
  createDatabase,
  postgresConnectionString
};
