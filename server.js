require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createDatabase } = require('./lib/database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const DB_FILE = process.env.DB_FILE
  ? path.resolve(__dirname, process.env.DB_FILE)
  : path.join(__dirname, 'watchlist.db');
const RECOMMENDATIONS_FILE = path.join(__dirname, 'recommendations.json');
const SUPPORTED_LANGUAGES = [
  { code: 'UK', label: 'Українська (UA)' },
  { code: 'RU', label: 'Русский (RU)' },
  { code: 'EN', label: 'English (EN)' }
];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pageRoutes = {
  '/watchlist': 'watchlist.html',
  '/watchlist-plus': 'watchlist-plus.html',
  '/friends': 'friends.html',
  '/messages': 'messages.html',
  '/teams': 'teams.html',
  '/roadmap': 'roadmap.html',
  '/scenarios/personal': 'scenarios/personal.html',
  '/scenarios/watch-with-friends': 'scenarios/watch-with-friends.html',
  '/scenarios/private-profile': 'scenarios/private-profile.html',
  '/scenarios/analytics': 'scenarios/analytics.html',
  '/scenarios/team-planning': 'scenarios/team-planning.html'
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

const db = createDatabase({ projectRoot: __dirname, dbFile: DB_FILE });
if (!db.isPostgres) db.run('PRAGMA foreign_keys = ON');
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const onlineClients = new Map();

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addColumnIfMissing(table, columnName, columnDefinition, callback = () => {}) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) return callback(err);
    if (rows.some(row => row.name === columnName)) {
      callback(null, false);
      return;
    }

    db.run(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnDefinition}`, alterErr => {
      callback(alterErr, !alterErr);
    });
  });
}

function ensureEntriesSchema(callback = () => {}) {
  const columns = [
    ['tags', 'TEXT'],
    ['mood', 'TEXT'],
    ['current_season', 'INTEGER DEFAULT 0'],
    ['current_episode', 'INTEGER DEFAULT 0'],
    ['next_episode_date', 'TEXT'],
    ['created_by_admin', 'BOOLEAN DEFAULT 0'],
    ['sort_order', 'INTEGER DEFAULT 0']
  ];

  const applyNext = index => {
    if (index >= columns.length) {
      callback();
      return;
    }

    const [columnName, columnDefinition] = columns[index];
    addColumnIfMissing('entries', columnName, columnDefinition, err => {
      if (err) {
        callback(err);
        return;
      }
      applyNext(index + 1);
    });
  };

  applyNext(0);
}

function ensureUsersSchema(callback = () => {}) {
  const columns = [
    ['presence_status', "TEXT DEFAULT 'online'"],
    ['last_seen', 'TEXT'],
    ['online_visibility', "TEXT DEFAULT 'everyone'"],
    ['profile_visibility', "TEXT DEFAULT 'everyone'"],
    ['friend_request_policy', "TEXT DEFAULT 'everyone'"],
    ['account_status', "TEXT DEFAULT 'active'"],
    ['preferred_language', "TEXT DEFAULT 'UK'"],
    ['avatar_url', "TEXT DEFAULT ''"],
    ['cover_url', "TEXT DEFAULT ''"],
    ['bio', "TEXT DEFAULT ''"],
    ['favorite_genres', "TEXT DEFAULT '[]'"]
  ];

  const applyNext = index => {
    if (index >= columns.length) {
      callback();
      return;
    }

    const [columnName, columnDefinition] = columns[index];
    addColumnIfMissing('users', columnName, columnDefinition, err => {
      if (err) {
        callback(err);
        return;
      }
      applyNext(index + 1);
    });
  };

  applyNext(0);
}

function ensureFriendMessagesSchema(callback = () => {}) {
  const columns = [
    ['content_title', "TEXT DEFAULT ''"],
    ['content_url', "TEXT DEFAULT ''"],
    ['content_meta', "TEXT DEFAULT ''"],
    ['read_at', 'TEXT']
  ];

  const applyNext = index => {
    if (index >= columns.length) {
      callback();
      return;
    }

    const [columnName, columnDefinition] = columns[index];
    addColumnIfMissing('friend_messages', columnName, columnDefinition, err => {
      if (err) {
        callback(err);
        return;
      }
      applyNext(index + 1);
    });
  };

  applyNext(0);
}

function ensureReportsSchema(callback = () => {}) {
  const columns = [
    ['admin_response', "TEXT DEFAULT ''"],
    ['responded_at', 'TEXT'],
    ['responded_by', 'INTEGER']
  ];

  const applyNext = index => {
    if (index >= columns.length) {
      callback();
      return;
    }

    const [columnName, columnDefinition] = columns[index];
    addColumnIfMissing('reports', columnName, columnDefinition, err => {
      if (err) {
        callback(err);
        return;
      }
      applyNext(index + 1);
    });
  };

  applyNext(0);
}

function ensureReportMessagesSchema(callback = () => {}) {
  db.run(`CREATE TABLE IF NOT EXISTS report_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    sender_id INTEGER,
    sender_role TEXT DEFAULT 'user',
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )`, err => {
    if (err) return callback(err);

    db.run(`CREATE INDEX IF NOT EXISTS idx_report_messages_report ON report_messages (report_id, created_at)`, indexErr => {
      if (indexErr) return callback(indexErr);

      db.all('SELECT * FROM reports', (selectErr, reports = []) => {
        if (selectErr) return callback(selectErr);
        if (!reports.length) return callback();

        let pending = reports.length;
        let failed = false;
        const done = err => {
          if (failed) return;
          if (err) {
            failed = true;
            callback(err);
            return;
          }
          pending -= 1;
          if (pending === 0) callback();
        };

        reports.forEach(report => {
          db.get('SELECT COUNT(*) AS total FROM report_messages WHERE report_id = ?', [report.id], (countErr, row) => {
            if (countErr) return done(countErr);
            if ((row?.total || 0) > 0) return done();

            db.run(
              `INSERT INTO report_messages (report_id, sender_id, sender_role, body, created_at)
               VALUES (?, ?, 'user', ?, COALESCE(?, CURRENT_TIMESTAMP))`,
              [report.id, report.user_id || null, report.body || report.subject, report.created_at],
              insertErr => {
                if (insertErr) return done(insertErr);
                if (!report.admin_response) return done();
                db.run(
                  `INSERT INTO report_messages (report_id, sender_id, sender_role, body, created_at)
                   VALUES (?, ?, 'admin', ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                  [report.id, report.responded_by || null, report.admin_response, report.responded_at],
                  done
                );
              }
            );
          });
        });
      });
    });
  });
}

function normalizeReport(row) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    userName: row.userName || '',
    email: row.email || '',
    subject: row.subject || '',
    body: row.body || '',
    status: row.status || 'new',
    adminResponse: row.admin_response || row.adminResponse || '',
    respondedAt: row.responded_at || row.respondedAt || '',
    respondedBy: row.responded_by ?? row.respondedBy ?? null,
    createdAt: row.created_at || row.createdAt || '',
    lastMessage: row.lastMessage || row.last_message || '',
    lastMessageAt: row.lastMessageAt || row.last_message_at || '',
    messageCount: row.messageCount || row.message_count || 0,
    messages: row.messages || []
  };
}

function normalizeReportMessage(row) {
  return {
    id: row.id,
    reportId: row.report_id || row.reportId,
    senderId: row.sender_id ?? row.senderId ?? null,
    senderRole: row.sender_role || row.senderRole || 'user',
    senderName: row.senderName || '',
    body: row.body || '',
    createdAt: row.created_at || row.createdAt || ''
  };
}

function normalizeEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    createdByAdmin: !!row.created_by_admin,
    title: row.title,
    type: row.type,
    status: normalizeEntryStatus(row.status),
    rating: normalizeRatingValue(row.rating),
    year: row.year || null,
    genre: parseJsonArray(row.genre),
    tags: parseJsonArray(row.tags),
    mood: row.mood || '',
    posterUrl: row.poster_url || '',
    director: row.director || '',
    runtime: row.runtime || 0,
    comment: row.comment || '',
    currentSeason: row.current_season || 0,
    currentEpisode: row.current_episode || 0,
    nextEpisodeDate: row.next_episode_date || '',
    isFavorite: !!row.is_favorite,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at || ''
  };
}

function normalizeEntryStatus(value, fallback = 'planned') {
  const status = String(value || '').trim();
  if (status === 'watched') return 'completed';
  if (status === 'plan_to_watch') return 'planned';
  if (['planned', 'watching', 'completed'].includes(status)) return status;
  return fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err, tokenUser) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    db.get(
      `SELECT id, name, email, role, account_status, preferred_language
       FROM users
       WHERE id = ?`,
      [tokenUser.id],
      (dbErr, user) => {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        if (!user) return res.status(403).json({ error: 'Forbidden' });
        if (user.account_status === 'blocked') return res.status(403).json({ error: 'Account is blocked' });

        req.user = {
          ...tokenUser,
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          preferredLanguage: normalizeTargetLanguage(user.preferred_language || 'UK')
        };
        next();
      }
    );
  });
}

function sendJson(res, payload) {
  res.json(payload);
}

function normalizeUsername(value) {
  return (value || '').trim();
}

function normalizeEmail(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeProfileUrl(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function normalizeProfileBio(value) {
  return (value || '').trim().slice(0, 220);
}

function normalizeFavoriteGenres(value) {
  let source = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      source = trimmed.split(',');
    }
  }

  if (!Array.isArray(source)) return [];
  return source
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6)
    .map(item => item.slice(0, 28));
}

function parseFavoriteGenres(value) {
  return normalizeFavoriteGenres(value);
}

function stringifyFavoriteGenres(value) {
  return JSON.stringify(normalizeFavoriteGenres(value));
}

function userPublicPayload(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.name,
    email: user.email,
    role: user.role,
    preferredLanguage: normalizeTargetLanguage(user.preferredLanguage || user.preferred_language || 'UK'),
    avatarUrl: user.avatarUrl || user.avatar_url || '',
    coverUrl: user.coverUrl || user.cover_url || '',
    bio: user.bio || '',
    favoriteGenres: parseFavoriteGenres(user.favoriteGenres || user.favorite_genres)
  };
}

function normalizeRatingValue(value) {
  return Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
}

function tmdbRatingToFive(value) {
  return normalizeRatingValue((Number(value) || 0) / 2);
}

function normalizeTargetLanguage(value, fallback = 'UK') {
  const aliases = {
    UA: 'UK',
    'UK-UA': 'UK',
    'UA-UA': 'UK',
    EN: 'EN',
    'EN-US': 'EN',
    'EN_US': 'EN',
    'EN-GB': 'EN',
    'EN_GB': 'EN',
    'EN-UK': 'EN',
    'EN_UK': 'EN',
    RU: 'RU',
    'RU-RU': 'RU',
    'RU_UA': 'RU'
  };
  const raw = String(value || fallback || 'UK').trim().toUpperCase();
  const normalized = aliases[raw] || raw.replace('_', '-');
  return SUPPORTED_LANGUAGES.some(lang => lang.code === normalized) ? normalized : fallback;
}

function getLanguageLabel(code) {
  const normalized = normalizeTargetLanguage(code || 'UK');
  return SUPPORTED_LANGUAGES.find(lang => lang.code === normalized)?.label || 'Українська (UA)';
}

function normalizeFriendPair(userId, friendId) {
  const first = Number(userId);
  const second = Number(friendId);
  return first < second ? [first, second] : [second, first];
}

function friendshipLevel(interactions = 0) {
  return Math.max(1, Math.min(20, Math.floor(Number(interactions || 0) / 5) + 1));
}

function friendAchievements(row) {
  const achievements = [];
  if ((row.messages_count || 0) >= 100) achievements.push({ id: 'messages-100', title: '100 повідомлень' });
  if ((row.games_count || 0) >= 10) achievements.push({ id: 'games-10', title: '10 спільних ігор' });
  if ((row.streak_days || 0) >= 7) achievements.push({ id: 'streak-7', title: '7 днів стріку' });
  return achievements;
}

async function buildUserAchievements(userId) {
  const [entryStats, friendStats] = await Promise.all([
    dbGet(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN type = 'movie' AND status = 'completed' THEN 1 ELSE 0 END) AS watchedMovies,
         SUM(CASE WHEN status = 'completed' THEN runtime ELSE 0 END) AS watchedMinutes,
         COUNT(DISTINCT date(created_at)) AS activeDays
       FROM entries
       WHERE user_id = ?`,
      [userId]
    ),
    dbGet(
      `SELECT COUNT(*) AS acceptedFriends
       FROM friends
       WHERE status = 'accepted'
         AND (user_id = ? OR friend_id = ?)`,
      [userId, userId]
    )
  ]);

  const watchedHours = Math.floor((entryStats?.watchedMinutes || 0) / 60);
  const achievements = [
    {
      id: 'movies-10',
      title: '10 фільмів переглянуто',
      progress: Math.min(entryStats?.watchedMovies || 0, 10),
      goal: 10,
      unlocked: (entryStats?.watchedMovies || 0) >= 10
    },
    {
      id: 'active-7-days',
      title: '7 днів активності',
      progress: Math.min(entryStats?.activeDays || 0, 7),
      goal: 7,
      unlocked: (entryStats?.activeDays || 0) >= 7
    },
    {
      id: 'watch-100-hours',
      title: '100 годин перегляду',
      progress: Math.min(watchedHours, 100),
      goal: 100,
      unlocked: watchedHours >= 100
    },
    {
      id: 'first-friend',
      title: 'Перший друг',
      progress: Math.min(friendStats?.acceptedFriends || 0, 1),
      goal: 1,
      unlocked: (friendStats?.acceptedFriends || 0) >= 1
    }
  ];

  return achievements;
}

function logAudit(userId, action, details = '') {
  db.run(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [userId || null, action, details],
    err => {
      if (err && !/no such table/i.test(err.message)) {
        console.error('Audit log failed:', err.message);
      }
    }
  );
}

async function deleteUserCascade(userId) {
  const id = Number(userId);
  const relations = await dbAll(
    'SELECT id FROM friends WHERE user_id = ? OR friend_id = ?',
    [id, id]
  );
  const relationIds = relations.map(row => row.id);

  if (relationIds.length) {
    const placeholders = relationIds.map(() => '?').join(',');
    await dbRun(`DELETE FROM friend_messages WHERE relation_id IN (${placeholders})`, relationIds);
    await dbRun(`DELETE FROM friends WHERE id IN (${placeholders})`, relationIds);
  }

  await dbRun('DELETE FROM friend_messages WHERE sender_id = ? OR receiver_id = ?', [id, id]);
  await dbRun('DELETE FROM entries WHERE user_id = ?', [id]);
  await dbRun('DELETE FROM report_messages WHERE report_id IN (SELECT id FROM reports WHERE user_id = ?)', [id]);
  await dbRun('UPDATE report_messages SET sender_id = NULL WHERE sender_id = ?', [id]);
  await dbRun('DELETE FROM reports WHERE user_id = ?', [id]);
  await dbRun('DELETE FROM team_votes WHERE user_id = ?', [id]);

  const ownedTeams = await dbAll('SELECT id FROM teams WHERE owner_id = ?', [id]);
  const ownedTeamIds = ownedTeams.map(row => row.id);
  if (ownedTeamIds.length) {
    const placeholders = ownedTeamIds.map(() => '?').join(',');
    await dbRun(`DELETE FROM team_votes WHERE item_id IN (SELECT id FROM team_items WHERE team_id IN (${placeholders}))`, ownedTeamIds);
    await dbRun(`DELETE FROM team_items WHERE team_id IN (${placeholders})`, ownedTeamIds);
    await dbRun(`DELETE FROM team_members WHERE team_id IN (${placeholders})`, ownedTeamIds);
    await dbRun(`DELETE FROM teams WHERE id IN (${placeholders})`, ownedTeamIds);
  }

  const userItems = await dbAll('SELECT id FROM team_items WHERE created_by = ?', [id]);
  const userItemIds = userItems.map(row => row.id);
  if (userItemIds.length) {
    const placeholders = userItemIds.map(() => '?').join(',');
    await dbRun(`DELETE FROM team_votes WHERE item_id IN (${placeholders})`, userItemIds);
    await dbRun(`DELETE FROM team_items WHERE id IN (${placeholders})`, userItemIds);
  }

  await dbRun('DELETE FROM team_members WHERE user_id = ?', [id]);
  await dbRun('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [id]);
  return dbRun('DELETE FROM users WHERE id = ?', [id]);
}

async function getOrphanSummary() {
  const checks = await Promise.all([
    dbGet(
      `SELECT COUNT(*) AS total
       FROM entries e
       WHERE e.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id)`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM friends f
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.requested_by)`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM friend_messages m
       WHERE NOT EXISTS (SELECT 1 FROM friends f WHERE f.id = m.relation_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.sender_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.receiver_id)
          OR m.relation_id IN (
            SELECT f.id
            FROM friends f
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
               OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)
               OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.requested_by)
          )`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM reports r
       WHERE r.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM report_messages rm
       WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.id = rm.report_id)
          OR (rm.sender_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = rm.sender_id))
          OR rm.report_id IN (
            SELECT r.id
            FROM reports r
            WHERE r.user_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)
          )`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM audit_logs a
       WHERE a.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM teams t
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM team_members tm
       WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tm.team_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tm.user_id)
          OR tm.team_id IN (
            SELECT t.id
            FROM teams t
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
          )`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM team_items ti
       WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = ti.team_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ti.created_by)
          OR ti.team_id IN (
            SELECT t.id
            FROM teams t
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
          )`
    ),
    dbGet(
      `SELECT COUNT(*) AS total
       FROM team_votes tv
       WHERE NOT EXISTS (SELECT 1 FROM team_items ti WHERE ti.id = tv.item_id)
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tv.user_id)
          OR tv.item_id IN (
            SELECT ti.id
            FROM team_items ti
            WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = ti.team_id)
               OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ti.created_by)
               OR ti.team_id IN (
                 SELECT t.id
                 FROM teams t
                 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
               )
          )`
    )
  ]);

  const labels = [
    ['entries', 'Записи'],
    ['friends', 'Дружби'],
    ['friendMessages', 'Повідомлення друзів'],
    ['reports', 'Звернення'],
    ['reportMessages', 'Повідомлення звернень'],
    ['auditLogs', 'Аудит'],
    ['teams', 'Команди'],
    ['teamMembers', 'Учасники команд'],
    ['teamItems', 'Пункти команд'],
    ['teamVotes', 'Голоси команд']
  ];

  const tables = labels.map(([key, label], index) => ({
    key,
    label,
    count: checks[index]?.total || 0
  }));

  return {
    total: tables.reduce((sum, item) => sum + item.count, 0),
    tables
  };
}

async function cleanupOrphanRecords() {
  const before = await getOrphanSummary();
  const removed = {};

  const runCleanup = async (key, sql) => {
    const result = await dbRun(sql);
    removed[key] = result.changes || 0;
  };

  await runCleanup(
    'teamVotes',
    `DELETE FROM team_votes
     WHERE NOT EXISTS (SELECT 1 FROM team_items ti WHERE ti.id = team_votes.item_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = team_votes.user_id)
        OR item_id IN (
          SELECT ti.id
          FROM team_items ti
          WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = ti.team_id)
             OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ti.created_by)
             OR ti.team_id IN (
               SELECT t.id
               FROM teams t
               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
             )
        )`
  );
  await runCleanup(
    'teamItems',
    `DELETE FROM team_items
     WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = team_items.team_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = team_items.created_by)
        OR team_id IN (
          SELECT t.id
          FROM teams t
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
        )`
  );
  await runCleanup(
    'teamMembers',
    `DELETE FROM team_members
     WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = team_members.team_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = team_members.user_id)
        OR team_id IN (
          SELECT t.id
          FROM teams t
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)
        )`
  );
  await runCleanup(
    'teams',
    `DELETE FROM teams
     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = teams.owner_id)`
  );
  await runCleanup(
    'friendMessages',
    `DELETE FROM friend_messages
     WHERE NOT EXISTS (SELECT 1 FROM friends f WHERE f.id = friend_messages.relation_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = friend_messages.sender_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = friend_messages.receiver_id)
        OR relation_id IN (
          SELECT f.id
          FROM friends f
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
             OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)
             OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.requested_by)
        )`
  );
  await runCleanup(
    'friends',
    `DELETE FROM friends
     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = friends.user_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = friends.friend_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = friends.requested_by)`
  );
  await runCleanup(
    'entries',
    `DELETE FROM entries
     WHERE user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = entries.user_id)`
  );
  await runCleanup(
    'reportMessages',
    `DELETE FROM report_messages
     WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.id = report_messages.report_id)
        OR (sender_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = report_messages.sender_id))
        OR report_id IN (
          SELECT r.id
          FROM reports r
          WHERE r.user_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)
        )`
  );
  await runCleanup(
    'reportsDetached',
    `UPDATE reports
     SET user_id = NULL
     WHERE user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = reports.user_id)`
  );
  await runCleanup(
    'auditDetached',
    `UPDATE audit_logs
     SET user_id = NULL
     WHERE user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = audit_logs.user_id)`
  );

  const after = await getOrphanSummary();
  const total = Object.values(removed).reduce((sum, count) => sum + count, 0);
  return { before, after, removed: { ...removed, total } };
}

async function getReportWithAccess(reportId, user) {
  const report = await dbGet(
    `SELECT r.*, u.name AS userName
     FROM reports r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = ?`,
    [reportId]
  );
  if (!report) return null;
  if (user.role !== 'admin' && Number(report.user_id) !== Number(user.id)) return null;
  return report;
}

async function getReportMessages(reportId) {
  const rows = await dbAll(
    `SELECT rm.id, rm.report_id, rm.sender_id, rm.sender_role, rm.body, rm.created_at,
            u.name AS senderName
     FROM report_messages rm
     LEFT JOIN users u ON u.id = rm.sender_id
     WHERE rm.report_id = ?
     ORDER BY rm.created_at ASC, rm.id ASC`,
    [reportId]
  );
  return rows.map(normalizeReportMessage);
}

async function appendReportMessage(report, sender, body, status = '') {
  const text = String(body || '').trim().slice(0, 4000);
  if (!text) throw new Error('Message cannot be empty');

  const senderRole = sender.role === 'admin' ? 'admin' : 'user';
  const result = await dbRun(
    `INSERT INTO report_messages (report_id, sender_id, sender_role, body)
     VALUES (?, ?, ?, ?)`,
    [report.id, sender.id, senderRole, text]
  );

  let nextStatus = status;
  if (!['new', 'reviewing', 'answered', 'closed'].includes(nextStatus)) {
    nextStatus = senderRole === 'admin'
      ? 'answered'
      : (['answered', 'closed'].includes(report.status) ? 'reviewing' : report.status || 'new');
  }

  if (senderRole === 'admin') {
    await dbRun(
      `UPDATE reports
       SET admin_response = ?,
           status = ?,
           responded_at = CURRENT_TIMESTAMP,
           responded_by = ?
       WHERE id = ?`,
      [text, nextStatus, sender.id, report.id]
    );
  } else {
    await dbRun(
      `UPDATE reports
       SET status = ?
       WHERE id = ?`,
      [nextStatus, report.id]
    );
  }

  const message = await dbGet(
    `SELECT rm.id, rm.report_id, rm.sender_id, rm.sender_role, rm.body, rm.created_at,
            u.name AS senderName
     FROM report_messages rm
     LEFT JOIN users u ON u.id = rm.sender_id
     WHERE rm.id = ?`,
    [result.lastID]
  );

  return normalizeReportMessage(message);
}

function isFriendBlocked(row) {
  return !!(row?.blocked_by_user || row?.blocked_by_friend || row?.status === 'blocked');
}

function canSeeOnline(viewerId, user) {
  if (!user) return false;
  if (Number(viewerId) === Number(user.id)) return true;
  return user.online_visibility !== 'nobody';
}

function publicUserStatus(viewerId, user) {
  if (!canSeeOnline(viewerId, user)) return 'hidden';
  if (onlineClients.has(Number(user.id))) return user.presence_status === 'dnd' ? 'dnd' : 'online';
  return user.presence_status === 'dnd' ? 'dnd' : 'offline';
}

function mapFriendRow(row, viewerId) {
  const otherId = Number(row.user_id) === Number(viewerId) ? row.friend_id : row.user_id;
  const muted = Number(row.user_id) === Number(viewerId) ? !!row.muted_by_user : !!row.muted_by_friend;
  const blockedByMe = Number(row.user_id) === Number(viewerId) ? !!row.blocked_by_user : !!row.blocked_by_friend;
  const blockedMe = Number(row.user_id) === Number(viewerId) ? !!row.blocked_by_friend : !!row.blocked_by_user;

  return {
    relationId: row.id,
    id: otherId,
    name: row.friend_name,
    nickname: row.friend_name,
    status: publicUserStatus(viewerId, {
      id: otherId,
      presence_status: row.friend_presence_status,
      online_visibility: row.friend_online_visibility
    }),
    activity: row.friend_last_seen ? `був ${row.friend_last_seen}` : 'активність ще не зафіксована',
    lastSeen: row.friend_last_seen || '',
    friendshipLevel: friendshipLevel(row.interactions),
    interactions: row.interactions || 0,
    messagesCount: row.messages_count || 0,
    gamesCount: row.games_count || 0,
    streakDays: row.streak_days || 0,
    achievements: friendAchievements(row),
    muted,
    blockedByMe,
    blockedMe,
    blocked: isFriendBlocked(row),
    profileVisibility: row.friend_profile_visibility || 'friends'
  };
}

async function findFriendRelation(userId, friendId) {
  const [leftId, rightId] = normalizeFriendPair(userId, friendId);
  return dbGet('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?', [leftId, rightId]);
}

async function getAcceptedFriendIds(userId) {
  const rows = await dbAll(
    `SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS friend_id
     FROM friends
     WHERE status = 'accepted'
       AND (user_id = ? OR friend_id = ?)`,
    [userId, userId, userId]
  );
  return rows.map(row => row.friend_id);
}

async function broadcastFriendEvent(userId, event) {
  const sockets = onlineClients.get(Number(userId));
  if (!sockets) return;
  const payload = JSON.stringify(event);
  sockets.forEach(socket => {
    if (socket.readyState === 1) socket.send(payload);
  });
}

async function sendAccountEvent(userId, event, closeAfter = false) {
  const sockets = onlineClients.get(Number(userId));
  if (!sockets) return;
  const payload = JSON.stringify(event);
  sockets.forEach(socket => {
    if (socket.readyState === 1) {
      socket.send(payload);
      if (closeAfter) socket.close(4001, event.reason || 'Account status changed');
    }
  });
}

async function broadcastPresence(userId) {
  const user = await dbGet('SELECT id, name, presence_status, last_seen, online_visibility FROM users WHERE id = ?', [userId]);
  const friendIds = await getAcceptedFriendIds(userId);
  await Promise.all(friendIds.map(friendId => broadcastFriendEvent(friendId, {
    type: 'presence',
    userId,
    status: publicUserStatus(friendId, user),
    lastSeen: user?.last_seen || ''
  })));
}

function seedAdmin() {
  db.get('SELECT COUNT(*) AS count FROM users WHERE role = ?', ['admin'], (err, row) => {
    if (err) return;
    if (!row || row.count === 0) {
      bcrypt.hash('admin', 10, (hashErr, hash) => {
        if (hashErr) return;
        db.run(
          `INSERT INTO users (
            name, email, password, role, presence_status, online_visibility, profile_visibility, friend_request_policy,
            preferred_language, avatar_url, cover_url, bio, favorite_genres
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Admin',
            'admin@watchlist.com',
            hash,
            'admin',
            'online',
            'everyone',
            'everyone',
            'everyone',
            'UK',
            '',
            '',
            'Керує каталогом Watchlist і слідкує за якістю спільноти.',
            JSON.stringify(['Sci-Fi', 'Drama'])
          ]
        );
      });
    }
  });
}

function ensureAdminZeroUser() {
  db.get('SELECT id, role FROM users WHERE id = ?', [0], (err, row) => {
    if (err) return;
    if (row) {
      if (row.role !== 'admin') {
        db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', 0]);
      }
      return;
    }

    db.get('SELECT id FROM users WHERE role = ? ORDER BY id ASC LIMIT 1', ['admin'], (adminErr, adminRow) => {
      if (adminErr) return;
      if (adminRow) {
        const previousId = adminRow.id;
        if (previousId === 0) return;

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          db.run('UPDATE entries SET user_id = 0 WHERE user_id = ?', [previousId]);
          db.run('UPDATE friends SET user_id = 0 WHERE user_id = ?', [previousId]);
          db.run('UPDATE friends SET friend_id = 0 WHERE friend_id = ?', [previousId]);
          db.run('UPDATE friends SET requested_by = 0 WHERE requested_by = ?', [previousId]);
          db.run('UPDATE friend_messages SET sender_id = 0 WHERE sender_id = ?', [previousId]);
          db.run('UPDATE friend_messages SET receiver_id = 0 WHERE receiver_id = ?', [previousId]);
          db.run('UPDATE users SET id = 0 WHERE id = ?', [previousId], (updateErr) => {
            if (updateErr) console.error('Failed to move admin to id 0:', updateErr.message);
            db.run('COMMIT');
          });
        });
        return;
      }

      bcrypt.hash('admin', 10, (hashErr, hash) => {
        if (hashErr) return;
        db.run(
          `INSERT INTO users (
            id, name, email, password, role, presence_status, online_visibility, profile_visibility, friend_request_policy,
            preferred_language, avatar_url, cover_url, bio, favorite_genres
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            0,
            'Admin',
            'admin0@watchlist.com',
            hash,
            'admin',
            'online',
            'everyone',
            'everyone',
            'everyone',
            'UK',
            '',
            '',
            'Керує каталогом Watchlist і слідкує за якістю спільноти.',
            JSON.stringify(['Sci-Fi', 'Drama'])
          ],
          (insertErr) => {
            if (insertErr) console.error('Failed to create admin id 0:', insertErr.message);
          }
        );
      });
    });
  });
}

async function setupPostgresDatabase() {
  try {
    const usersTable = await dbGet(`SELECT to_regclass('public.users') AS tableName`);
    if (!usersTable?.tableName) {
      throw new Error('Supabase schema is missing. Run `supabase db push` before starting the server.');
    }

    await dbRun(
      `UPDATE users
       SET preferred_language = 'EN'
       WHERE preferred_language IN ('EN-US', 'EN-GB', 'EN_US', 'EN_GB', 'EN-UK', 'EN_UK')`
    );
    await dbRun(
      `UPDATE users
       SET preferred_language = 'UK'
       WHERE preferred_language IS NULL
          OR preferred_language NOT IN ('UK', 'RU', 'EN')`
    );

    const adminCount = await dbGet('SELECT COUNT(*) AS count FROM users WHERE role = ?', ['admin']);
    if ((adminCount?.count || 0) === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await dbRun(
        `INSERT INTO users (
          name, email, password, role, presence_status, online_visibility, profile_visibility, friend_request_policy,
          preferred_language, avatar_url, cover_url, bio, favorite_genres
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Admin',
          'admin@watchlist.com',
          hash,
          'admin',
          'online',
          'everyone',
          'everyone',
          'everyone',
          'UK',
          '',
          '',
          'Керує каталогом Watchlist і слідкує за якістю спільноти.',
          JSON.stringify(['Sci-Fi', 'Drama'])
        ]
      );
    }

    await dbGet('SELECT public.sync_watchlist_identity_sequences()');
    console.log('Connected to Supabase Postgres database');
  } catch (error) {
    console.error('Supabase database setup failed:', error.message);
  }
}

function setupDatabase() {
  if (db.isPostgres) {
    setupPostgresDatabase();
    return;
  }

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      account_status TEXT DEFAULT 'active',
      presence_status TEXT DEFAULT 'online',
      last_seen TEXT,
      online_visibility TEXT DEFAULT 'everyone',
      profile_visibility TEXT DEFAULT 'everyone',
      friend_request_policy TEXT DEFAULT 'everyone',
      preferred_language TEXT DEFAULT 'UK',
      avatar_url TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      favorite_genres TEXT DEFAULT '[]'
    )`);

    ensureUsersSchema(err => {
      if (err) console.error('Failed to ensure users schema:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      rating INTEGER,
      year INTEGER,
      genre TEXT,
      tags TEXT,
      mood TEXT,
      poster_url TEXT,
      director TEXT,
      runtime INTEGER,
      comment TEXT,
      current_season INTEGER DEFAULT 0,
      current_episode INTEGER DEFAULT 0,
      next_episode_date TEXT,
      created_by_admin BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_favorite BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    ensureEntriesSchema(err => {
      if (err) {
        console.error('Failed to ensure entries schema:', err.message);
        return;
      }

      db.run('UPDATE entries SET created_by_admin = 1 WHERE user_id = 0 AND (created_by_admin IS NULL OR created_by_admin = 0)');
      db.run('UPDATE entries SET rating = 5 WHERE rating > 5');
    });

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique ON entries (user_id, title, type, COALESCE(year, 0))`);

    db.run(`CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      requested_by INTEGER NOT NULL,
      interactions INTEGER DEFAULT 0,
      messages_count INTEGER DEFAULT 0,
      games_count INTEGER DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_interaction_at TEXT,
      muted_by_user BOOLEAN DEFAULT 0,
      muted_by_friend BOOLEAN DEFAULT 0,
      blocked_by_user BOOLEAN DEFAULT 0,
      blocked_by_friend BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id),
      FOREIGN KEY (requested_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS friend_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      content_title TEXT DEFAULT '',
      content_url TEXT DEFAULT '',
      content_meta TEXT DEFAULT '',
      read_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (relation_id) REFERENCES friends(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_friends_pair ON friends (user_id, friend_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_friend_messages_relation ON friend_messages (relation_id, created_at)`);
    ensureFriendMessagesSchema(err => {
      if (err) console.error('Failed to ensure friend messages schema:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS team_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'movie',
      status TEXT DEFAULT 'planned',
      scheduled_at TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS team_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      value INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, user_id),
      FOREIGN KEY (item_id) REFERENCES team_items(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT DEFAULT '',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      admin_response TEXT DEFAULT '',
      responded_at TEXT,
      responded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    ensureReportsSchema(err => {
      if (err) console.error('Failed to ensure reports schema:', err.message);
    });
    ensureReportMessagesSchema(err => {
      if (err) console.error('Failed to ensure report messages schema:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id, team_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_team_items_team ON team_items (team_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at)`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique ON users(name COLLATE NOCASE)`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email COLLATE NOCASE)`);

    seedAdmin();
    ensureAdminZeroUser();
  });
}

setupDatabase();

app.post('/api/register', async (req, res) => {
  const username = normalizeUsername(req.body.name || req.body.username);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Login, email and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO users (
        name, email, password, presence_status, online_visibility, profile_visibility, friend_request_policy, preferred_language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, 'online', 'everyone', 'everyone', 'everyone', 'UK'],
      function(err) {
        if (err) return res.status(400).json({ error: 'Login or email already exists' });
        const user = userPublicPayload({ id: this.lastID, name: username, email, role: 'user', preferred_language: 'UK' });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
        sendJson(res, { token, user });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const identifier = normalizeEmail(req.body.email || req.body.identifier);
  const { password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Login/email and password are required' });

  db.get('SELECT * FROM users WHERE lower(email) = ? OR lower(name) = ?', [identifier, identifier], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.account_status === 'blocked') {
      return res.status(403).json({ error: 'Account is blocked' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
    const result = { token, user: userPublicPayload(user) };
    logAudit(user.id, 'login', 'Користувач увійшов у систему');
    sendJson(res, result);
  });
});

app.get('/api/entries', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT e.*
     FROM entries e
     WHERE e.user_id = ?
        OR e.created_by_admin = 1
     ORDER BY e.sort_order ASC, e.created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendJson(res, rows.map(normalizeEntry));
    }
  );
});

app.post('/api/entries', authenticateToken, (req, res) => {
  const { title, type, status, rating, year, genre, tags, mood, posterUrl, director, runtime, comment, currentSeason, currentEpisode, nextEpisodeDate, isFavorite } = req.body;
  const userId = req.user.id;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });
  const genreJson = JSON.stringify(Array.isArray(genre) ? genre : []);
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  const createdByAdmin = req.user.role === 'admin' ? 1 : 0;

  db.run(
    `INSERT INTO entries (user_id, title, type, status, rating, year, genre, tags, mood, poster_url, director, runtime, comment, current_season, current_episode, next_episode_date, created_by_admin, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, String(title).trim(), type || 'movie', normalizeEntryStatus(status, 'completed'), normalizeRatingValue(rating), year || null, genreJson, tagsJson, mood || '', posterUrl || '', director || '', runtime || 0, comment || '', currentSeason || 0, currentEpisode || 0, nextEpisodeDate || '', createdByAdmin, isFavorite ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(userId, 'entry:create', String(title).trim());
      sendJson(res, { id: this.lastID });
    }
  );
});

app.put('/api/entries/:id', authenticateToken, async (req, res) => {
  const { title, type, status, rating, year, genre, tags, mood, posterUrl, director, runtime, comment, currentSeason, currentEpisode, nextEpisodeDate, isFavorite } = req.body;
  const entryId = req.params.id;
  const userId = req.user.id;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });
  const genreJson = JSON.stringify(Array.isArray(genre) ? genre : []);
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

  try {
    const existing = await dbGet('SELECT * FROM entries WHERE id = ?', [entryId]);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    if (req.user.role !== 'admin' && Number(existing.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'You can edit only your own entries' });
    }

    const createdByAdmin = existing.created_by_admin ? 1 : req.user.role === 'admin' ? 1 : 0;
    const result = await dbRun(
      `UPDATE entries
       SET title=?, type=?, status=?, rating=?, year=?, genre=?, tags=?, mood=?, poster_url=?, director=?, runtime=?, comment=?, current_season=?, current_episode=?, next_episode_date=?, created_by_admin=?, is_favorite=?
       WHERE id=?`,
      [String(title).trim(), type || 'movie', normalizeEntryStatus(status, 'completed'), normalizeRatingValue(rating), year || null, genreJson, tagsJson, mood || '', posterUrl || '', director || '', runtime || 0, comment || '', currentSeason || 0, currentEpisode || 0, nextEpisodeDate || '', createdByAdmin, isFavorite ? 1 : 0, entryId]
    );
    logAudit(userId, 'entry:update', String(title).trim());
    sendJson(res, { changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', authenticateToken, async (req, res) => {
  const entryId = req.params.id;
  const userId = req.user.id;
  try {
    const existing = await dbGet('SELECT * FROM entries WHERE id = ?', [entryId]);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });
    if (req.user.role !== 'admin' && Number(existing.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'You can delete only your own entries' });
    }
    const result = await dbRun('DELETE FROM entries WHERE id=?', [entryId]);
    logAudit(userId, 'entry:delete', existing.title);
    sendJson(res, { changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries/reorder', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.json({ updated: 0 });

  try {
    let updated = 0;
    for (const [index, id] of ids.entries()) {
      const result = await dbRun(
        `UPDATE entries
         SET sort_order = ?
         WHERE id = ?
           AND user_id = ?`,
        [index + 1, id, userId]
      );
      updated += result.changes || 0;
    }
    res.json({ updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.all('SELECT id, name, email, role, account_status AS accountStatus FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    sendJson(res, rows);
  });
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const userId = Number(req.params.id);
  if (userId === Number(req.user.id)) return res.status(400).json({ error: 'Admins cannot delete themselves here' });

  try {
    const result = await deleteUserCascade(userId);
    sendJson(res, { changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const name = normalizeUsername(req.body.name || req.body.username);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const role = ['admin', 'user'].includes(req.body.role) ? req.body.role : 'user';
  const userId = Number(req.params.id);
  if (!name || !email) return res.status(400).json({ error: 'Login and email are required' });

  const finishUpdate = function(err) {
    if (err) return res.status(400).json({ error: 'Login or email already exists' });
    logAudit(req.user.id, 'admin:user:update', `user:${userId}, role:${role}`);
    sendAccountEvent(userId, {
      type: 'account-updated',
      user: { id: userId, name, username: name, email, role }
    });
    sendJson(res, { changes: this.changes, user: { id: userId, name, username: name, email, role } });
  };

  const updateBase = () => {
    db.run('UPDATE users SET name=?, email=?, role=? WHERE id=?', [name, email, role, userId], finishUpdate);
  };

  if (password) {
    bcrypt.hash(password, 10, (err, hashed) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?', [name, email, hashed, role, userId], finishUpdate);
    });
  } else {
    updateBase();
  }
});

app.post('/api/admin/users/:id/block', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const userId = Number(req.params.id);
  if (userId === Number(req.user.id)) return res.status(400).json({ error: 'Admins cannot block themselves' });
  const blocked = req.body.blocked !== false;
  try {
    await dbRun('UPDATE users SET account_status = ? WHERE id = ?', [blocked ? 'blocked' : 'active', userId]);
    logAudit(req.user.id, blocked ? 'admin:user:block' : 'admin:user:unblock', `user:${userId}`);
    await sendAccountEvent(userId, {
      type: 'account-status',
      status: blocked ? 'blocked' : 'active',
      reason: blocked ? 'Account is blocked' : 'Account is active'
    }, blocked);
    res.json({ blocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [users, entries, friends, messages, reports, audits, maintenance] = await Promise.all([
      dbGet(`SELECT COUNT(*) AS total, SUM(CASE WHEN account_status = 'blocked' THEN 1 ELSE 0 END) AS blocked FROM users`),
      dbGet(`SELECT COUNT(*) AS total, SUM(CASE WHEN created_by_admin = 1 THEN 1 ELSE 0 END) AS publicEntries FROM entries`),
      dbGet(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted FROM friends`),
      dbGet(`SELECT COUNT(*) AS total FROM friend_messages`),
      dbAll(`SELECT r.id, r.user_id, u.name AS userName, r.email, r.subject, r.body, r.status,
                    r.admin_response, r.responded_at, r.responded_by, r.created_at
             FROM reports r
             LEFT JOIN users u ON u.id = r.user_id
             ORDER BY r.created_at DESC
             LIMIT 50`),
      dbAll(`SELECT a.id, a.action, a.details, a.created_at AS createdAt, u.name AS userName
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC
             LIMIT 50`),
      getOrphanSummary()
    ]);
    const reportIds = reports.map(report => report.id);
    const reportMessageRows = reportIds.length
      ? await dbAll(
        `SELECT rm.id, rm.report_id, rm.sender_id, rm.sender_role, rm.body, rm.created_at,
                u.name AS senderName
         FROM report_messages rm
         LEFT JOIN users u ON u.id = rm.sender_id
         WHERE rm.report_id IN (${reportIds.map(() => '?').join(',')})
         ORDER BY rm.created_at ASC, rm.id ASC`,
        reportIds
      )
      : [];
    const reportMessages = reportMessageRows.reduce((map, row) => {
      const reportId = row.report_id;
      if (!map[reportId]) map[reportId] = [];
      map[reportId].push(normalizeReportMessage(row));
      return map;
    }, {});

    res.json({
      summary: {
        users: users?.total || 0,
        blockedUsers: users?.blocked || 0,
        entries: entries?.total || 0,
        publicEntries: entries?.publicEntries || 0,
        friendRelations: friends?.accepted || 0,
        messages: messages?.total || 0
      },
      reports: reports.map(report => {
        const messagesForReport = reportMessages[report.id] || [];
        const lastMessage = messagesForReport[messagesForReport.length - 1];
        return normalizeReport({
          ...report,
          messages: messagesForReport,
          messageCount: messagesForReport.length,
          lastMessage: lastMessage?.body || report.admin_response || report.body || '',
          lastMessageAt: lastMessage?.createdAt || report.responded_at || report.created_at || ''
        });
      }),
      audits,
      maintenance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/maintenance/orphans', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    res.json(await getOrphanSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/maintenance/cleanup-orphans', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await cleanupOrphanRecords();
    logAudit(req.user.id, 'admin:maintenance:cleanup', `orphan changes:${result.removed.total}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const reportId = Number(req.params.id);
  const adminResponse = String(req.body.adminResponse || req.body.response || '').trim().slice(0, 4000);
  const status = ['new', 'reviewing', 'answered', 'closed'].includes(req.body.status) ? req.body.status : 'answered';

  if (!reportId) return res.status(400).json({ error: 'Invalid report id' });

  try {
    const existing = await dbGet('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    if (adminResponse) {
      await appendReportMessage(existing, req.user, adminResponse, status);
    } else {
      await dbRun('UPDATE reports SET status = ? WHERE id = ?', [status, reportId]);
    }

    const updated = await dbGet(
      `SELECT r.id, r.user_id, u.name AS userName, r.email, r.subject, r.body, r.status,
              r.admin_response, r.responded_at, r.responded_by, r.created_at
       FROM reports r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`,
      [reportId]
    );

    logAudit(req.user.id, 'admin:report:reply', `report:${reportId}`);
    if (existing.user_id && adminResponse) {
      await sendAccountEvent(existing.user_id, {
        type: 'support-response',
        reportId,
        subject: existing.subject,
        status,
        adminResponse
      });
    }
    res.json(normalizeReport(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const reportId = Number(req.params.id);
  if (!reportId) return res.status(400).json({ error: 'Invalid report id' });

  try {
    const existing = await dbGet('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!existing) return res.status(404).json({ error: 'Report not found' });
    await dbRun('DELETE FROM report_messages WHERE report_id = ?', [reportId]);
    const result = await dbRun('DELETE FROM reports WHERE id = ?', [reportId]);
    logAudit(req.user.id, 'admin:report:delete', `report:${reportId}`);
    if (existing.user_id) {
      await sendAccountEvent(existing.user_id, {
        type: 'support-deleted',
        reportId
      });
    }
    res.json({ deleted: result.changes || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/entries', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.all(`SELECT e.*, u.name as user_name FROM entries e JOIN users u ON e.user_id = u.id ORDER BY e.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = rows.map(row => ({
      ...normalizeEntry(row),
      userName: row.user_name || ''
    }));
    sendJson(res, result);
  });
});

app.get('/api/public/stats', (req, res) => {
  db.get(
    `SELECT COUNT(*) AS totalUsers, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmins FROM users`,
    [],
    (err, userRow) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(
        `SELECT COUNT(*) AS totalEntries,
                SUM(CASE WHEN type = 'movie' THEN 1 ELSE 0 END) AS movies,
                SUM(CASE WHEN type = 'series' THEN 1 ELSE 0 END) AS series,
                SUM(is_favorite) AS favorites,
                AVG(NULLIF(rating, 0)) AS averageRating,
                SUM(CASE WHEN status = 'watching' THEN 1 ELSE 0 END) AS watchingNow,
                SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS backlog
         FROM entries
         WHERE created_by_admin = 1`,
        [],
        (err, entryRow) => {
          if (err) return res.status(500).json({ error: err.message });

          db.get(
            `SELECT title, type, year, rating, runtime, director, genre
             FROM entries
             WHERE created_by_admin = 1
               AND rating > 0
             ORDER BY rating DESC, created_at DESC
             LIMIT 1`,
            [],
            (err, topRow) => {
              if (err) return res.status(500).json({ error: err.message });

              db.all(
                `SELECT runtime, director, year, genre
                 FROM entries
                 WHERE created_by_admin = 1`,
                [],
                (err, rows) => {
                  if (err) return res.status(500).json({ error: err.message });

                  const genreCounts = {};
                  const directorCounts = {};
                  const yearCounts = {};
                  let totalWatchTime = 0;

                  rows.forEach(row => {
                    const runtime = Number(row.runtime) || 0;
                    totalWatchTime += runtime;

                    if (row.director) {
                      directorCounts[row.director] = (directorCounts[row.director] || 0) + 1;
                    }

                    const year = row.year ? String(row.year) : null;
                    if (year) {
                      yearCounts[year] = (yearCounts[year] || 0) + 1;
                    }

                    if (row.genre) {
                      let genres = [];
                      if (typeof row.genre === 'string') {
                        try {
                          const parsed = JSON.parse(row.genre);
                          if (Array.isArray(parsed)) genres = parsed;
                          else if (typeof parsed === 'string') genres = [parsed];
                        } catch {
                          genres = row.genre.split(',').map(g => g.trim()).filter(Boolean);
                        }
                      } else if (Array.isArray(row.genre)) {
                        genres = row.genre;
                      }

                      genres.forEach(genre => {
                        if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                      });
                    }
                  });

                  const topGenres = Object.entries(genreCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([genre, count]) => ({ genre, count }));

                  const topDirectors = Object.entries(directorCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([director, count]) => ({ director, count }));

                  const topYears = Object.entries(yearCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([year, count]) => ({ year, count }));

                  sendJson(res, {
                    totalUsers: userRow.totalUsers || 0,
                    totalAdmins: userRow.totalAdmins || 0,
                    totalEntries: entryRow.totalEntries || 0,
                    movies: entryRow.movies || 0,
                    series: entryRow.series || 0,
                    favorites: entryRow.favorites || 0,
                    averageRating: parseFloat(entryRow.averageRating || 0).toFixed(1),
                    watchingNow: entryRow.watchingNow || 0,
                    backlog: entryRow.backlog || 0,
                    topRated: topRow ? {
                      title: topRow.title,
                      type: topRow.type,
                      year: topRow.year,
                      rating: topRow.rating
                    } : null,
                    totalWatchTime,
                    topGenres,
                    topDirectors,
                    topYears
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.post('/api/admin/entries', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { title, type, status, rating, year, genre, tags, mood, posterUrl, director, runtime, comment, currentSeason, currentEpisode, nextEpisodeDate, isFavorite } = req.body;
  const userId = req.user.id;
  const genreJson = JSON.stringify(Array.isArray(genre) ? genre : []);
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

  db.run(
    `INSERT INTO entries (user_id, title, type, status, rating, year, genre, tags, mood, poster_url, director, runtime, comment, current_season, current_episode, next_episode_date, created_by_admin, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, title, type, normalizeEntryStatus(status, 'completed'), normalizeRatingValue(rating), year || null, genreJson, tagsJson, mood || '', posterUrl || '', director || '', runtime || 0, comment || '', currentSeason || 0, currentEpisode || 0, nextEpisodeDate || '', 1, isFavorite ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(userId, 'admin:entry:create', title);
      sendJson(res, { id: this.lastID });
    }
  );
});

app.delete('/api/admin/entries/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.run('DELETE FROM entries WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req.user.id, 'admin:entry:delete', `entry:${req.params.id}`);
    sendJson(res, { changes: this.changes });
  });
});

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Request failed ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

function buildTmdbUrl(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  const searchParams = new URLSearchParams({ api_key: apiKey, language: 'uk-UA', ...params });
  return `https://api.themoviedb.org/3${path}?${searchParams.toString()}`;
}

async function loadTmdbGenres() {
  const [movieGenres, tvGenres] = await Promise.all([
    httpsGetJson(buildTmdbUrl('/genre/movie/list')),
    httpsGetJson(buildTmdbUrl('/genre/tv/list'))
  ]);
  return {
    movie: (movieGenres.genres || []).reduce((map, genre) => {
      map[genre.id] = genre.name;
      return map;
    }, {}),
    tv: (tvGenres.genres || []).reduce((map, genre) => {
      map[genre.id] = genre.name;
      return map;
    }, {})
  };
}

async function getTmdbRecommendations() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  try {
    const genres = await loadTmdbGenres();
    const [movies, tv] = await Promise.all([
      httpsGetJson(buildTmdbUrl('/trending/movie/week')),
      httpsGetJson(buildTmdbUrl('/trending/tv/week'))
    ]);

    const parseItem = (item, type) => {
      const genreMap = type === 'movie' ? genres.movie : genres.tv;
      const tags = (item.genre_ids || []).slice(0, 3).map(id => genreMap[id]).filter(Boolean);
      return {
        title: item.title || item.name || 'Без назви',
        type,
        tags: tags.length ? tags : [type === 'movie' ? 'Фільм' : 'Серіал'],
        rating: item.vote_average ? tmdbRatingToFive(item.vote_average) : 0,
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
        overview: item.overview || '',
        year: (item.release_date || item.first_air_date || '').slice(0, 4) || '––'
      };
    };

    return {
      sets: [
        {
          title: 'Тренди TMDb — Фільми',
          description: 'Найпопулярніші фільми цього тижня.',
          items: (movies.results || []).slice(0, 6).map(item => parseItem(item, 'movie'))
        },
        {
          title: 'Тренди TMDb — Серіали',
          description: 'Серіали, які зараз в тренді.',
          items: (tv.results || []).slice(0, 6).map(item => parseItem(item, 'series'))
        }
      ]
    };
  } catch (error) {
    return null;
  }
}

app.post('/api/sync-entries', authenticateToken, (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [];
  const userId = req.user.id;
  const createdByAdmin = req.user.role === 'admin' ? 1 : 0;
  if (!entries.length) return res.json({ synced: 0 });

  db.serialize(() => {
    let syncedCount = 0;
    let pending = entries.length;
    let failed = false;

    const finalize = () => {
      db.get('SELECT COUNT(*) AS count FROM entries WHERE user_id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ synced: syncedCount, total: row.count });
      });
    };

    entries.forEach(entry => {
      const genreJson = JSON.stringify(Array.isArray(entry.genre) ? entry.genre : []);
      const tagsJson = JSON.stringify(Array.isArray(entry.tags) ? entry.tags : []);
      db.run(
        `INSERT OR IGNORE INTO entries (user_id, title, type, status, rating, year, genre, tags, mood, poster_url, director, runtime, comment, current_season, current_episode, next_episode_date, created_by_admin, is_favorite)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, entry.title, entry.type, normalizeEntryStatus(entry.status, 'completed'), normalizeRatingValue(entry.rating), entry.year || null, genreJson, tagsJson, entry.mood || '', entry.posterUrl || '', entry.director || '', entry.runtime || 0, entry.comment || '', entry.currentSeason || 0, entry.currentEpisode || 0, entry.nextEpisodeDate || '', createdByAdmin, entry.isFavorite ? 1 : 0],
        function(err) {
          if (failed) return;
          if (err) {
            failed = true;
            return res.status(500).json({ error: err.message });
          }
          if (!err && this.changes > 0) syncedCount += 1;
          pending -= 1;
          if (pending === 0) finalize();
        }
      );
    });
  });
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await dbGet(
      `SELECT id, name, email, role, presence_status AS presenceStatus,
              online_visibility AS onlineVisibility,
              profile_visibility AS profileVisibility,
              friend_request_policy AS friendRequestPolicy,
              preferred_language AS preferredLanguage,
              avatar_url AS avatarUrl,
              cover_url AS coverUrl,
              bio,
              favorite_genres AS favoriteGenres
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) return res.status(500).json({ error: 'Could not load profile' });
    const [stats, entries, friends, achievements] = await Promise.all([
      dbGet(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN type = 'movie' THEN 1 ELSE 0 END) AS movies,
        SUM(CASE WHEN type = 'series' THEN 1 ELSE 0 END) AS series,
        SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) AS favorites,
        SUM(CASE WHEN status = 'completed' THEN runtime ELSE 0 END) AS watchedMinutes,
        ROUND(AVG(rating), 1) AS averageRating
      FROM entries WHERE user_id = ?`,
        [userId]
      ),
      dbAll(
        `SELECT title, type, rating, status, genre, created_at AS createdAt
         FROM entries
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`,
        [userId]
      ),
      dbGet(
        `SELECT COUNT(*) AS total
         FROM friends
         WHERE status = 'accepted'
           AND (user_id = ? OR friend_id = ?)`,
        [userId, userId]
      ),
      buildUserAchievements(userId)
    ]);

    const genreCounts = {};
    entries.forEach(entry => {
      const genres = parseJsonArray(entry.genre);
      genres.forEach(genre => { genreCounts[genre] = (genreCounts[genre] || 0) + 1; });
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    const topRated = entries
      .filter(entry => entry.rating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(entry => ({ title: entry.title, rating: entry.rating, type: entry.type }));
    const recentActivity = entries.slice(0, 6).map(entry => ({
      title: entry.title,
      status: normalizeEntryStatus(entry.status),
      type: entry.type,
      createdAt: entry.createdAt
    }));

    const favoriteGenres = parseFavoriteGenres(user.favoriteGenres);
    res.json({
      user: {
        ...userPublicPayload(user),
        presenceStatus: user.presenceStatus,
        onlineVisibility: user.onlineVisibility,
        profileVisibility: user.profileVisibility,
        friendRequestPolicy: user.friendRequestPolicy,
        favoriteGenres: favoriteGenres.length ? favoriteGenres : topGenres.map(item => item.name).slice(0, 4)
      },
      stats: {
        total: stats.total || 0,
        movies: stats.movies || 0,
        series: stats.series || 0,
        favorites: stats.favorites || 0,
        averageRating: stats.averageRating || 0,
        watchedHours: Math.floor((stats.watchedMinutes || 0) / 60),
        friends: friends?.total || 0
      },
      topGenres,
      topRated,
      recentActivity,
      achievements
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.get('SELECT id, name, role FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Could not load profile' });

    const canChangeUsername = user.role === 'admin';
    const nextName = canChangeUsername
      ? normalizeUsername(req.body.name || req.body.username)
      : user.name;

    if (!nextName) {
      return res.status(400).json({ error: 'Login is required' });
    }

    const updateFields = () => {
      db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [nextName, email, userId], function(updateErr) {
        if (updateErr) return res.status(400).json({ error: 'Login or email is already in use' });
        res.json({ message: 'Profile updated' });
      });
    };

    if (password) {
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?', [nextName, email, hashedPassword, userId], function(updateErr) {
          if (updateErr) return res.status(400).json({ error: 'Login or email is already in use' });
          res.json({ message: 'Profile updated' });
        });
      } catch (hashErr) {
        res.status(500).json({ error: 'Could not update profile' });
      }
    } else {
      updateFields();
    }
  });
});

app.put('/api/profile/presentation', authenticateToken, async (req, res) => {
  const avatarUrl = normalizeProfileUrl(req.body.avatarUrl || req.body.avatar_url);
  const coverUrl = normalizeProfileUrl(req.body.coverUrl || req.body.cover_url);
  const bio = normalizeProfileBio(req.body.bio);
  const favoriteGenres = stringifyFavoriteGenres(req.body.favoriteGenres || req.body.favorite_genres || []);

  try {
    await dbRun(
      `UPDATE users
       SET avatar_url = ?, cover_url = ?, bio = ?, favorite_genres = ?
       WHERE id = ?`,
      [avatarUrl, coverUrl, bio, favoriteGenres, req.user.id]
    );
    const user = await dbGet(
      `SELECT id, name, email, role, preferred_language AS preferredLanguage,
              avatar_url AS avatarUrl, cover_url AS coverUrl, bio, favorite_genres AS favoriteGenres
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );
    res.json({ user: userPublicPayload(user) });
  } catch (error) {
    res.status(500).json({ error: 'Could not update profile presentation' });
  }
});

app.put('/api/profile/preferences', authenticateToken, async (req, res) => {
  const preferredLanguage = normalizeTargetLanguage(req.body.preferredLanguage || 'UK');
  try {
    await dbRun('UPDATE users SET preferred_language = ? WHERE id = ?', [preferredLanguage, req.user.id]);
    res.json({
      preferredLanguage,
      preferredLanguageLabel: getLanguageLabel(preferredLanguage)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/languages', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT preferred_language AS preferredLanguage FROM users WHERE id = ?', [req.user.id]);
    const preferredLanguage = normalizeTargetLanguage(user?.preferredLanguage || 'UK');
    res.json({
      provider: 'static',
      preferredLanguage,
      preferredLanguageLabel: getLanguageLabel(preferredLanguage),
      languages: SUPPORTED_LANGUAGES
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/profile', authenticateToken, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot delete their own account' });
  }
  try {
    await deleteUserCascade(req.user.id);
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete account' });
  }
});

app.get('/api/omdb', async (req, res) => {
  const title = (req.query.title || '').trim();
  const apiKey = process.env.OMDB_API_KEY;
  if (!title) return res.status(400).json({ error: 'Title query is required' });
  if (!apiKey) return res.status(500).json({ error: 'OMDB_API_KEY is not configured' });

  const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}&plot=short`;
  try {
    const data = await httpsGetJson(url);
    if (data.Response === 'False') {
      return res.status(404).json({ error: data.Error || 'Not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/media/search', authenticateToken, async (req, res) => {
  const query = (req.query.q || req.query.query || '').trim();
  if (query.length < 2) return res.json([]);

  const parseTmdb = (item, type) => ({
    title: item.title || item.name || '',
    type,
    year: Number((item.release_date || item.first_air_date || '').slice(0, 4)) || null,
    rating: item.vote_average ? normalizeRatingValue(Number(item.vote_average) / 2) : 0,
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
    overview: item.overview || '',
    source: 'TMDb'
  });

  if (process.env.TMDB_API_KEY) {
    try {
      const [movies, tv] = await Promise.all([
        httpsGetJson(buildTmdbUrl('/search/movie', { query, include_adult: 'false' })),
        httpsGetJson(buildTmdbUrl('/search/tv', { query, include_adult: 'false' }))
      ]);
      return res.json([
        ...(movies.results || []).slice(0, 6).map(item => parseTmdb(item, 'movie')),
        ...(tv.results || []).slice(0, 6).map(item => parseTmdb(item, 'series'))
      ].filter(item => item.title).slice(0, 10));
    } catch (error) {
      console.warn('TMDb search failed:', error.message);
    }
  }

  try {
    const rows = await dbAll(
      `SELECT title, type, rating, year, genre, poster_url AS posterUrl, comment AS overview
       FROM entries
       WHERE lower(title) LIKE ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [`%${query.toLowerCase()}%`]
    );
    res.json(rows.map(row => ({
      title: row.title,
      type: row.type,
      year: row.year || null,
      rating: normalizeRatingValue(row.rating),
      posterUrl: row.posterUrl || '',
      overview: row.overview || '',
      genre: row.genre ? JSON.parse(row.genre) : [],
      source: 'Watchlist'
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/support/reports', authenticateToken, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Support requests are available only for regular users' });
  try {
    const rows = await dbAll(
      `SELECT r.id, r.user_id, r.email, r.subject, r.body, r.status, r.admin_response,
              r.responded_at, r.responded_by, r.created_at,
              last.body AS lastMessage,
              last.created_at AS lastMessageAt,
              (SELECT COUNT(*) FROM report_messages rm WHERE rm.report_id = r.id) AS messageCount
       FROM reports r
       LEFT JOIN report_messages last ON last.id = (
         SELECT rm.id
         FROM report_messages rm
         WHERE rm.report_id = r.id
         ORDER BY rm.created_at DESC, rm.id DESC
         LIMIT 1
       )
       WHERE r.user_id = ?
       ORDER BY COALESCE(last.created_at, r.created_at) DESC, r.id DESC
       LIMIT 30`,
      [req.user.id]
    );
    res.json(rows.map(normalizeReport));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reports', authenticateToken, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only regular users can create support requests' });
  const email = normalizeEmail(req.body.email || req.user.email);
  const subject = String(req.body.subject || req.body.topic || '').trim().slice(0, 160);
  const body = String(req.body.body || req.body.description || '').trim().slice(0, 4000);
  if (!email || !subject || !body) return res.status(400).json({ error: 'Email, subject and description are required' });

  try {
    const result = await dbRun(
      `INSERT INTO reports (user_id, email, subject, body, status)
       VALUES (?, ?, ?, ?, 'new')`,
      [req.user.id, email, subject, body]
    );
    const report = await dbGet('SELECT * FROM reports WHERE id = ?', [result.lastID]);
    await appendReportMessage(report, req.user, body, 'new');
    logAudit(req.user.id, 'report:create', subject);
    res.json({ id: result.lastID, status: 'new' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/:id/messages', authenticateToken, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!reportId) return res.status(400).json({ error: 'Invalid report id' });

  try {
    const report = await getReportWithAccess(reportId, req.user);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(await getReportMessages(reportId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reports/:id/messages', authenticateToken, async (req, res) => {
  const reportId = Number(req.params.id);
  const body = String(req.body.body || req.body.message || '').trim().slice(0, 4000);
  const status = ['new', 'reviewing', 'answered', 'closed'].includes(req.body.status) ? req.body.status : '';
  if (!reportId) return res.status(400).json({ error: 'Invalid report id' });
  if (!body) return res.status(400).json({ error: 'Message cannot be empty' });

  try {
    const report = await getReportWithAccess(reportId, req.user);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const message = await appendReportMessage(report, req.user, body, status);
    const updated = await dbGet('SELECT * FROM reports WHERE id = ?', [reportId]);
    logAudit(req.user.id, req.user.role === 'admin' ? 'admin:report:message' : 'report:message', `report:${reportId}`);

    if (req.user.role === 'admin' && report.user_id) {
      await sendAccountEvent(report.user_id, {
        type: 'support-response',
        reportId,
        subject: report.subject,
        status: updated.status,
        adminResponse: body
      });
    }

    res.json({ message, report: normalizeReport(updated) });
  } catch (error) {
    res.status(error.message === 'Message cannot be empty' ? 400 : 500).json({ error: error.message });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const search = (req.query.search || '').trim().toLowerCase();

  try {
    const settings = await dbGet(
      `SELECT presence_status AS presenceStatus,
              online_visibility AS onlineVisibility,
              profile_visibility AS profileVisibility,
              friend_request_policy AS friendRequestPolicy
       FROM users WHERE id = ?`,
      [userId]
    );

    const friendRows = await dbAll(
      `SELECT f.*,
              u.id AS friend_user_id,
              u.name AS friend_name,
              u.presence_status AS friend_presence_status,
              u.last_seen AS friend_last_seen,
              u.online_visibility AS friend_online_visibility,
              u.profile_visibility AS friend_profile_visibility
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.status = 'accepted'
         AND (f.user_id = ? OR f.friend_id = ?)
         AND (? = '' OR lower(u.name) LIKE ?)
       ORDER BY f.interactions DESC, u.name ASC`,
      [userId, userId, userId, search, `%${search}%`]
    );

    const friends = friendRows.map(row => mapFriendRow(row, userId));
    const incoming = await dbAll(
      `SELECT f.id AS relationId, u.id, u.name, f.created_at AS createdAt
       FROM friends f
       JOIN users u ON u.id = f.requested_by
       WHERE f.status = 'pending'
         AND f.requested_by != ?
         AND (f.user_id = ? OR f.friend_id = ?)
       ORDER BY f.created_at DESC`,
      [userId, userId, userId]
    );

    const outgoing = await dbAll(
      `SELECT f.id AS relationId,
              u.id,
              u.name,
              f.created_at AS createdAt
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.status = 'pending'
         AND f.requested_by = ?
       ORDER BY f.created_at DESC`,
      [userId, userId]
    );

    const blocked = await dbAll(
      `SELECT f.id AS relationId,
              u.id,
              u.name,
              f.updated_at AS blockedAt,
              CASE WHEN f.user_id = ? THEN f.blocked_by_user ELSE f.blocked_by_friend END AS blockedByMe,
              CASE WHEN f.user_id = ? THEN f.blocked_by_friend ELSE f.blocked_by_user END AS blockedMe
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.status = 'blocked'
         AND (f.user_id = ? OR f.friend_id = ?)
         AND (f.blocked_by_user = 1 OR f.blocked_by_friend = 1)
       ORDER BY f.updated_at DESC`,
      [userId, userId, userId, userId, userId]
    );

    res.json({
      friends,
      incoming,
      outgoing,
      blocked,
      ranking: friends.slice(0, 5),
      settings: settings || {
        presenceStatus: 'online',
        onlineVisibility: 'everyone',
        profileVisibility: 'everyone',
        friendRequestPolicy: 'everyone'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends/search', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const query = (req.query.q || '').trim().toLowerCase();
  if (query.length < 2) return res.json([]);

  try {
    const rows = await dbAll(
      `SELECT u.id, u.name, u.presence_status, u.last_seen, u.friend_request_policy,
              f.id AS relationId, f.status AS relationStatus, f.requested_by
       FROM users u
       LEFT JOIN friends f
         ON ((f.user_id = ? AND f.friend_id = u.id) OR (f.friend_id = ? AND f.user_id = u.id))
       WHERE u.id != ?
         AND lower(u.name) LIKE ?
       ORDER BY u.name ASC
       LIMIT 12`,
      [userId, userId, userId, `%${query}%`]
    );

    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      status: publicUserStatus(userId, row),
      lastSeen: row.last_seen || '',
      relationId: row.relationId || null,
      relationStatus: row.relationStatus || 'none',
      requestedByMe: Number(row.requested_by) === Number(userId),
      canRequest: !row.relationStatus && row.friend_request_policy !== 'nobody'
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/requests', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const username = normalizeUsername(req.body.username || req.body.nickname);
  if (!username) return res.status(400).json({ error: 'Nickname is required' });

  try {
    const target = await dbGet('SELECT id, name, friend_request_policy FROM users WHERE lower(name) = lower(?)', [username]);
    if (!target || target.id === userId) return res.status(404).json({ error: 'User not found' });
    if (target.friend_request_policy === 'nobody') return res.status(403).json({ error: 'This user does not accept friend requests' });

    const recentRequests = await dbGet(
      `SELECT COUNT(*) AS count
       FROM friends
       WHERE requested_by = ?
         AND status = 'pending'
         AND created_at >= datetime('now', '-1 hour')`,
      [userId]
    );
    if ((recentRequests?.count || 0) >= 5) {
      return res.status(429).json({ error: 'Too many friend requests. Try again later' });
    }

    if (target.friend_request_policy === 'friends') {
      const mutual = await dbGet(
        `SELECT 1
         FROM friends my
         JOIN friends their
           ON their.status = 'accepted'
          AND (CASE WHEN their.user_id = ? THEN their.friend_id ELSE their.user_id END) =
              (CASE WHEN my.user_id = ? THEN my.friend_id ELSE my.user_id END)
         WHERE my.status = 'accepted'
           AND (my.user_id = ? OR my.friend_id = ?)
           AND (their.user_id = ? OR their.friend_id = ?)
         LIMIT 1`,
        [target.id, userId, userId, userId, target.id, target.id]
      );
      if (!mutual) return res.status(403).json({ error: 'This user accepts requests only through mutual friends' });
    }

    const existing = await findFriendRelation(userId, target.id);
    if (existing?.status === 'accepted') return res.status(400).json({ error: 'You are already friends' });
    if (existing?.status === 'pending') return res.status(400).json({ error: 'Friend request already exists' });
    if (existing && isFriendBlocked(existing)) {
      const blockedByMe = Number(existing.user_id) === Number(userId) ? existing.blocked_by_user : existing.blocked_by_friend;
      return res.status(403).json({
        error: blockedByMe
          ? 'Спочатку розблокуйте користувача у списку заблокованих'
          : 'Цей користувач заблокував взаємодію з вами'
      });
    }

    const [leftId, rightId] = normalizeFriendPair(userId, target.id);
    if (existing) {
      await dbRun(
        `UPDATE friends
         SET status = 'pending', requested_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, existing.id]
      );
      await broadcastFriendEvent(target.id, { type: 'friend-request', from: { id: userId } });
      return res.json({ id: existing.id, status: 'pending' });
    }

    const result = await dbRun(
      `INSERT INTO friends (user_id, friend_id, status, requested_by)
       VALUES (?, ?, 'pending', ?)`,
      [leftId, rightId, userId]
    );
    await broadcastFriendEvent(target.id, { type: 'friend-request', from: { id: userId } });
    res.json({ id: result.lastID, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/requests/:id/accept', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const relation = await dbGet('SELECT * FROM friends WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!relation || (relation.user_id !== userId && relation.friend_id !== userId)) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (relation.requested_by === userId) return res.status(403).json({ error: 'You cannot accept your own request' });

    await dbRun(
      `UPDATE friends
       SET status = 'accepted',
           interactions = interactions + 1,
           streak_days = CASE WHEN streak_days = 0 THEN 1 ELSE streak_days END,
           last_interaction_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [relation.id]
    );
    await broadcastFriendEvent(relation.requested_by, { type: 'friend-accepted', relationId: relation.id });
    res.json({ status: 'accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/requests/:id/reject', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const relation = await dbGet('SELECT * FROM friends WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!relation || (relation.user_id !== userId && relation.friend_id !== userId)) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (relation.requested_by === userId) return res.status(403).json({ error: 'You cannot reject your own request' });

    await dbRun(`UPDATE friends SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [relation.id]);
    await broadcastFriendEvent(relation.requested_by, { type: 'friend-rejected', relationId: relation.id });
    res.json({ status: 'rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/requests/:id/cancel', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const relation = await dbGet('SELECT * FROM friends WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!relation || relation.requested_by !== userId) {
      return res.status(404).json({ error: 'Outgoing request not found' });
    }

    const targetId = relation.user_id === userId ? relation.friend_id : relation.user_id;
    await dbRun(`UPDATE friends SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [relation.id]);
    await broadcastFriendEvent(targetId, { type: 'friend-cancelled', relationId: relation.id });
    res.json({ status: 'cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation) return res.status(404).json({ error: 'Friend relation not found' });
    await dbRun('DELETE FROM friend_messages WHERE relation_id = ?', [relation.id]);
    await dbRun('DELETE FROM friends WHERE id = ?', [relation.id]);
    await broadcastFriendEvent(friendId, { type: 'friend-removed', userId });
    res.json({ removed: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/:friendId/mute', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  const muted = req.body.muted !== false;
  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation) return res.status(404).json({ error: 'Friend relation not found' });
    const column = relation.user_id === userId ? 'muted_by_user' : 'muted_by_friend';
    await dbRun(`UPDATE friends SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [muted ? 1 : 0, relation.id]);
    res.json({ muted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/:friendId/block', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation) return res.status(404).json({ error: 'Friend relation not found' });
    const column = relation.user_id === userId ? 'blocked_by_user' : 'blocked_by_friend';
    await dbRun(`UPDATE friends SET ${column} = 1, status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [relation.id]);
    await broadcastFriendEvent(friendId, { type: 'friend-blocked', userId });
    res.json({ blocked: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/:friendId/unblock', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation) return res.status(404).json({ error: 'Friend relation not found' });

    const column = relation.user_id === userId ? 'blocked_by_user' : 'blocked_by_friend';
    const nextBlockedByUser = column === 'blocked_by_user' ? 0 : relation.blocked_by_user ? 1 : 0;
    const nextBlockedByFriend = column === 'blocked_by_friend' ? 0 : relation.blocked_by_friend ? 1 : 0;
    const nextStatus = nextBlockedByUser || nextBlockedByFriend ? 'blocked' : 'accepted';
    await dbRun(
      `UPDATE friends
       SET ${column} = 0,
           status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStatus, relation.id]
    );
    await broadcastFriendEvent(friendId, { type: 'friend-unblocked', userId });
    res.json({ blocked: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/friends/privacy', authenticateToken, async (req, res) => {
  const allowedPresence = ['online', 'offline', 'dnd'];
  const allowedVisibility = ['everyone', 'friends', 'nobody'];
  const presenceStatus = allowedPresence.includes(req.body.presenceStatus) ? req.body.presenceStatus : 'online';
  const onlineVisibility = allowedVisibility.includes(req.body.onlineVisibility) ? req.body.onlineVisibility : 'everyone';
  const profileVisibility = allowedVisibility.includes(req.body.profileVisibility) ? req.body.profileVisibility : 'everyone';
  const friendRequestPolicy = allowedVisibility.includes(req.body.friendRequestPolicy) ? req.body.friendRequestPolicy : 'everyone';

  try {
    await dbRun(
      `UPDATE users
       SET presence_status = ?,
           online_visibility = ?,
           profile_visibility = ?,
           friend_request_policy = ?,
           last_seen = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [presenceStatus, onlineVisibility, profileVisibility, friendRequestPolicy, req.user.id]
    );
    await broadcastPresence(req.user.id);
    res.json({ presenceStatus, onlineVisibility, profileVisibility, friendRequestPolicy });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await dbAll(
      `SELECT f.id AS relationId,
              u.id,
              u.name,
              u.presence_status,
              u.last_seen,
              u.online_visibility,
              f.messages_count AS messagesCount,
              m.sender_id AS lastSenderId,
              m.body AS lastMessage,
              m.read_at AS lastReadAt,
              m.created_at AS lastMessageAt
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       LEFT JOIN friend_messages m ON m.id = (
         SELECT fm.id
         FROM friend_messages fm
         WHERE fm.relation_id = f.id
         ORDER BY fm.created_at DESC, fm.id DESC
         LIMIT 1
       )
       WHERE f.status = 'accepted'
         AND (f.user_id = ? OR f.friend_id = ?)
         AND f.blocked_by_user = 0
         AND f.blocked_by_friend = 0
       ORDER BY
         CASE WHEN m.created_at IS NULL THEN 1 ELSE 0 END,
         m.created_at DESC,
         lower(u.name) ASC`,
      [userId, userId, userId]
    );

    res.json(rows.map(row => ({
      relationId: row.relationId,
      id: row.id,
      name: row.name,
      status: publicUserStatus(userId, row),
      lastSeen: row.last_seen || '',
      messagesCount: row.messagesCount || 0,
      lastSenderId: row.lastSenderId || null,
      lastMessage: row.lastMessage || '',
      unread: row.lastSenderId && Number(row.lastSenderId) !== Number(userId) && !row.lastReadAt,
      lastMessageAt: row.lastMessageAt || ''
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends/:friendId/messages', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation || relation.status !== 'accepted' || isFriendBlocked(relation)) {
      return res.status(403).json({ error: 'Chat is not available' });
    }

    await dbRun(
      `UPDATE friend_messages
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE relation_id = ?
         AND receiver_id = ?`,
      [relation.id, userId]
    );

    const rows = await dbAll(
      `SELECT id, sender_id AS senderId, receiver_id AS receiverId, body,
              content_title AS contentTitle, content_url AS contentUrl,
              content_meta AS contentMeta, read_at AS readAt, created_at AS createdAt
       FROM friend_messages
       WHERE relation_id = ?
       ORDER BY created_at ASC
       LIMIT 100`,
      [relation.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/:friendId/messages', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const friendId = Number(req.params.friendId);
  const body = String(req.body.body || '').trim().slice(0, 1000);
  const contentTitle = String(req.body.contentTitle || '').trim().slice(0, 160);
  const contentUrl = String(req.body.contentUrl || '').trim().slice(0, 500);
  const contentMeta = String(req.body.contentMeta || '').trim().slice(0, 300);
  if (!body) return res.status(400).json({ error: 'Message cannot be empty' });

  try {
    const relation = await findFriendRelation(userId, friendId);
    if (!relation || relation.status !== 'accepted' || isFriendBlocked(relation)) {
      return res.status(403).json({ error: 'Chat is not available' });
    }

    const message = await dbRun(
      `INSERT INTO friend_messages (relation_id, sender_id, receiver_id, body, content_title, content_url, content_meta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [relation.id, userId, friendId, body, contentTitle, contentUrl, contentMeta]
    );
    await dbRun(
      `UPDATE friends
       SET messages_count = messages_count + 1,
           interactions = interactions + 1,
           streak_days = CASE
             WHEN date(last_interaction_at) = date('now', '-1 day') THEN streak_days + 1
             WHEN date(last_interaction_at) = date('now') THEN streak_days
             ELSE 1
           END,
           last_interaction_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [relation.id]
    );

    const payload = {
      id: message.lastID,
      senderId: userId,
      receiverId: friendId,
      body,
      contentTitle,
      contentUrl,
      contentMeta,
      readAt: '',
      createdAt: new Date().toISOString()
    };
    await broadcastFriendEvent(friendId, { type: 'chat-message', message: payload });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const teams = await dbAll(
      `SELECT t.id, t.name, t.description, t.owner_id AS ownerId, tm.role, t.created_at AS createdAt
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    const enriched = await Promise.all(teams.map(async team => {
      const [members, items] = await Promise.all([
        dbAll(
          `SELECT u.id, u.name, tm.role
           FROM team_members tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.team_id = ?
           ORDER BY CASE tm.role WHEN 'admin' THEN 0 ELSE 1 END, lower(u.name) ASC`,
          [team.id]
        ),
        dbAll(
          `SELECT ti.id, ti.title, ti.type, ti.status, ti.scheduled_at AS scheduledAt,
                  ti.created_at AS createdAt,
                  COALESCE(SUM(tv.value), 0) AS votes,
                  SUM(CASE WHEN tv.user_id = ? THEN 1 ELSE 0 END) AS votedByMe
           FROM team_items ti
           LEFT JOIN team_votes tv ON tv.item_id = ti.id
           WHERE ti.team_id = ?
           GROUP BY ti.id
           ORDER BY votes DESC, ti.created_at DESC`,
          [userId, team.id]
        )
      ]);
      return {
        ...team,
        members,
        items: items.map(item => ({ ...item, votedByMe: !!item.votedByMe }))
      };
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const name = String(req.body.name || '').trim().slice(0, 80);
  const description = String(req.body.description || '').trim().slice(0, 240);
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  try {
    const result = await dbRun(
      `INSERT INTO teams (name, description, owner_id)
       VALUES (?, ?, ?)`,
      [name, description, userId]
    );
    await dbRun(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES (?, ?, 'admin')`,
      [result.lastID, userId]
    );
    logAudit(userId, 'team:create', name);
    res.json({ id: result.lastID, name, description });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams/:id/invite', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const teamId = Number(req.params.id);
  const username = normalizeUsername(req.body.username);
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const membership = await dbGet('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only team admins can invite members' });
    const target = await dbGet('SELECT id, name FROM users WHERE lower(name) = lower(?)', [username]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    await dbRun(
      `INSERT OR IGNORE INTO team_members (team_id, user_id, role)
       VALUES (?, ?, 'member')`,
      [teamId, target.id]
    );
    logAudit(userId, 'team:invite', `${teamId}:${target.name}`);
    res.json({ added: true, user: { id: target.id, name: target.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams/:id/items', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const teamId = Number(req.params.id);
  const title = String(req.body.title || '').trim().slice(0, 160);
  const type = ['movie', 'series', 'game'].includes(req.body.type) ? req.body.type : 'movie';
  const scheduledAt = String(req.body.scheduledAt || '').trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const membership = await dbGet('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    if (!membership) return res.status(403).json({ error: 'You are not a member of this team' });
    const result = await dbRun(
      `INSERT INTO team_items (team_id, title, type, status, scheduled_at, created_by)
       VALUES (?, ?, ?, 'planned', ?, ?)`,
      [teamId, title, type, scheduledAt, userId]
    );
    logAudit(userId, 'team:item:create', title);
    res.json({ id: result.lastID, title, type, scheduledAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams/:teamId/items/:itemId/vote', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const teamId = Number(req.params.teamId);
  const itemId = Number(req.params.itemId);

  try {
    const membership = await dbGet('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    if (!membership) return res.status(403).json({ error: 'You are not a member of this team' });
    const item = await dbGet('SELECT id FROM team_items WHERE id = ? AND team_id = ?', [itemId, teamId]);
    if (!item) return res.status(404).json({ error: 'Team item not found' });
    await dbRun(
      `INSERT INTO team_votes (item_id, user_id, value)
       VALUES (?, ?, 1)
       ON CONFLICT(item_id, user_id) DO UPDATE SET value = 1, created_at = CURRENT_TIMESTAMP`,
      [itemId, userId]
    );
    logAudit(userId, 'team:item:vote', `item:${itemId}`);
    res.json({ voted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recommendations', async (req, res) => {
  const tmdb = await getTmdbRecommendations();
  if (tmdb) return res.json(tmdb);

  fs.readFile(RECOMMENDATIONS_FILE, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Could not load recommendations' });
    try {
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (parseError) {
      res.status(500).json({ error: 'Invalid recommendations file' });
    }
  });
});

wss.on('connection', async (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (!token) {
    socket.close(1008, 'Unauthorized');
    return;
  }

  try {
    const user = jwt.verify(token, SECRET_KEY);
    const userId = Number(user.id);
    const dbUser = await dbGet('SELECT account_status FROM users WHERE id = ?', [userId]);
    if (!dbUser || dbUser.account_status === 'blocked') {
      socket.close(1008, 'Account is blocked');
      return;
    }

    socket.userId = userId;

    if (!onlineClients.has(userId)) onlineClients.set(userId, new Set());
    onlineClients.get(userId).add(socket);

    await dbRun(
      `UPDATE users
       SET presence_status = CASE WHEN presence_status = 'dnd' THEN 'dnd' ELSE 'online' END,
           last_seen = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );
    await broadcastPresence(userId);

    socket.on('message', async raw => {
      try {
        const event = JSON.parse(String(raw));
        if (event.type === 'typing' && event.friendId) {
          const relation = await findFriendRelation(userId, Number(event.friendId));
          if (relation?.status === 'accepted' && !isFriendBlocked(relation)) {
            await broadcastFriendEvent(Number(event.friendId), { type: 'typing', userId });
          }
        }
      } catch (error) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid realtime payload' }));
      }
    });

    socket.on('close', async () => {
      const sockets = onlineClients.get(userId);
      if (sockets) {
        sockets.delete(socket);
        if (!sockets.size) {
          onlineClients.delete(userId);
          await dbRun(
            `UPDATE users
             SET presence_status = CASE WHEN presence_status = 'dnd' THEN 'dnd' ELSE 'offline' END,
                 last_seen = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [userId]
          );
          await broadcastPresence(userId);
        }
      }
    });

    socket.send(JSON.stringify({ type: 'ready' }));
  } catch (error) {
    socket.close(1008, 'Unauthorized');
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
