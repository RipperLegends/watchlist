require('dotenv').config();
const path = require('path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { createDatabase } = require('../lib/database');

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_FILE = process.env.DB_FILE || path.join(PROJECT_ROOT, 'watchlist.db');
const ADMIN_LOGIN = process.env.SMOKE_ADMIN_LOGIN || 'Admin';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin';
const USER_LOGIN = process.env.SMOKE_USER_LOGIN || '123123';
const USER_PASSWORD = process.env.SMOKE_USER_PASSWORD || '123123';

const db = createDatabase({ projectRoot: PROJECT_ROOT, dbFile: DB_FILE });

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      error ? reject(error) : resolve(this);
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loginViaUi(browser, identifier, password) {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-identifier', identifier);
  await page.fill('#login-password', password);
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL(/index\.html$/, { timeout: 5000 });
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('watchlist_session') || 'null'));
  assert(session?.token, `Не вдалося авторизувати ${identifier}`);
  return { page, session };
}

async function openPageWithSession(browser, session, route = '/index.html') {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    localStorage.setItem('watchlist_session', JSON.stringify(value));
  }, session);
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  return page;
}

async function adminSessionFromDatabase() {
  const admin = await dbGet(
    `SELECT id, name, email, role, preferred_language AS preferredLanguage
       FROM users
      WHERE role = ?
      ORDER BY id
      LIMIT 1`,
    ['admin']
  );
  assert(admin, 'У базі має бути хоча б один адміністратор');
  assert(process.env.SECRET_KEY, 'Для smoke-аудиту потрібен SECRET_KEY');
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.SECRET_KEY,
    { expiresIn: '10m' }
  );
  return {
    token,
    id: admin.id,
    name: admin.name,
    username: admin.name,
    email: admin.email,
    role: admin.role,
    preferredLanguage: admin.preferredLanguage || 'UK'
  };
}

async function api(token, route, options = {}) {
  const response = await fetch(`${BASE_URL}/api${route}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (error) { }
  return { ok: response.ok, status: response.status, body };
}

async function orphanTotal() {
  const rows = await Promise.all([
    dbGet(`SELECT COUNT(*) AS total FROM friends f
           WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
              OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)
              OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.requested_by)`),
    dbGet(`SELECT COUNT(*) AS total FROM friend_messages m
           WHERE NOT EXISTS (SELECT 1 FROM friends f WHERE f.id = m.relation_id)
              OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.sender_id)
              OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.receiver_id)`),
    dbGet(`SELECT COUNT(*) AS total FROM report_messages rm
           WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.id = rm.report_id)
              OR (rm.sender_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = rm.sender_id))`),
    dbGet(`SELECT COUNT(*) AS total FROM audit_logs a
           WHERE a.user_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)`)
  ]);
  return rows.reduce((sum, row) => sum + (row?.total || 0), 0);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const createdSubject = `Smoke звернення ${Date.now()}`;
  let createdReportId = null;

  try {
    const adminSession = await adminSessionFromDatabase();
    const admin = {
      session: adminSession,
      page: await openPageWithSession(browser, adminSession, '/admin.html')
    };
    const user = await loginViaUi(browser, USER_LOGIN, USER_PASSWORD);

    assert(admin.session.role === 'admin', 'Admin має мати роль admin');
    assert(user.session.role === 'user', 'Звичайний користувач має мати роль user');

    const userAdminStats = await api(user.session.token, '/admin/stats');
    assert(userAdminStats.status === 403, 'Звичайний користувач не повинен бачити admin stats');

    const guestPage = await browser.newPage();
    await guestPage.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
    const guestAddVisible = await guestPage.locator('#btn-add').isVisible().catch(() => false);
    assert(!guestAddVisible, 'Незареєстрований користувач не повинен бачити додавання записів');
    await guestPage.close();

    await admin.page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'domcontentloaded' });
    await admin.page.waitForSelector('[data-admin-view="overview"].active');
    await admin.page.click('[data-admin-view="users"]');
    await admin.page.waitForSelector('#users-tbody');
    const userDrawerButton = admin.page.locator('[data-view-user]').first();
    await userDrawerButton.waitFor({ timeout: 5000 });
    await userDrawerButton.click();
    await admin.page.waitForSelector('#user-drawer-overlay.active');
    await admin.page.click('#user-drawer-close');
    await admin.page.click('[data-admin-view="reports"]');
    await admin.page.waitForSelector('#report-status-filter');
    await admin.page.click('[data-admin-view="maintenance"]');
    await admin.page.waitForSelector('#btn-clean-orphans');

    await user.page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'domcontentloaded' });
    await user.page.waitForURL(/index\.html$/, { timeout: 5000 });

    const reportCreate = await api(user.session.token, '/reports', {
      method: 'POST',
      body: JSON.stringify({
        email: 'smoke@watchlist.local',
        subject: createdSubject,
        body: 'Перевірка звернення і відповіді адміністратора.'
      })
    });
    assert(reportCreate.ok, 'Користувач має створити звернення');
    createdReportId = reportCreate.body?.id;
    assert(createdReportId, 'API має повернути id нового звернення');

    const stats = await api(admin.session.token, '/admin/stats');
    assert(stats.ok, 'Адмін має бачити статистику');
    assert(stats.body?.maintenance && Array.isArray(stats.body.maintenance.tables), 'Maintenance summary має повертатись');
    const report = stats.body.reports.find(item => item.subject === createdSubject);
    assert(report, 'Нове звернення має бути в адмінці');
    assert(report.messageCount >= 1, 'Нове звернення має містити перше повідомлення користувача');

    const reply = await api(admin.session.token, `/reports/${report.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: 'Smoke-відповідь адміністратора.', status: 'answered' })
    });
    assert(reply.ok && reply.body?.report?.status === 'answered', 'Адмін має відповісти на звернення повідомленням');

    const supportReports = await api(user.session.token, '/support/reports');
    assert(
      supportReports.body?.some(item => item.subject === createdSubject && item.adminResponse && item.messageCount >= 2),
      'Користувач має бачити відповідь у повідомленнях підтримки'
    );

    const threadMessages = await api(user.session.token, `/reports/${report.id}/messages`);
    assert(
      threadMessages.ok && threadMessages.body?.some(item => item.senderRole === 'admin' && item.body.includes('Smoke-відповідь')),
      'Переписка звернення має віддавати повідомлення адміністратора'
    );

    const userFollowup = await api(user.session.token, `/reports/${report.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: 'Smoke-додаткове питання користувача.' })
    });
    assert(
      userFollowup.ok && userFollowup.body?.report?.status === 'reviewing',
      'Відповідь користувача після відповіді адміна має повертати тікет у роботу'
    );

    const statsAfterThread = await api(admin.session.token, '/admin/stats');
    const threadedReport = statsAfterThread.body.reports.find(item => item.id === report.id);
    assert(
      threadedReport?.messages?.length >= 3,
      'Адмінка має показувати історію переписки у зверненні'
    );

    await user.page.setViewportSize({ width: 390, height: 844 });
    await user.page.goto(`${BASE_URL}/messages.html`, { waitUntil: 'domcontentloaded' });
    const overflow = await user.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, 'Messages не має створювати горизонтальний overflow на мобільному');
    const reactionControls = await user.page.locator('[data-reaction], .message-reactions').count();
    assert(reactionControls === 0, 'У повідомленнях не повинно бути реакцій');

    const friendConversation = user.page.locator('.messages-conversation:not(.support)').first();
    if (await friendConversation.count()) {
      await friendConversation.click();
      await user.page.waitForFunction(() => {
        const input = document.querySelector('#messages-input');
        const activeName = document.querySelector('#messages-active-name');
        return input && !input.disabled && activeName?.textContent?.trim() && activeName.textContent.trim() !== 'Підтримка Watchlist';
      });
    }

    const deleteReport = await api(admin.session.token, `/admin/reports/${report.id}`, { method: 'DELETE' });
    assert(deleteReport.ok && deleteReport.body?.deleted >= 1, 'Адмін має видаляти звернення');

    const supportAfterDelete = await api(user.session.token, '/support/reports');
    assert(
      !supportAfterDelete.body?.some(item => item.id === report.id),
      'Видалене звернення не повинно залишатися у користувача'
    );
    createdReportId = null;

    console.log(JSON.stringify({
      ok: true,
      checked: [
        'admin/user login',
        'admin route guard',
        'guest cannot add entries',
        'maintenance API',
        'admin sidebar and user drawer',
        'support report thread',
        'support report delete',
        'messages without reactions',
        'messages mobile overflow',
        'friend conversation remains selectable when present'
      ],
      orphanTotal: await orphanTotal()
    }, null, 2));
  } finally {
    if (createdReportId) {
      await dbRun('DELETE FROM report_messages WHERE report_id = ?', [createdReportId]).catch(() => {});
      await dbRun('DELETE FROM reports WHERE id = ?', [createdReportId]).catch(() => {});
    }
    await browser.close();
    db.close();
  }
})().catch(error => {
  db.close();
  console.error(error.message);
  process.exit(1);
});
