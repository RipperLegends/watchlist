import http from 'k6/http';
import { check, sleep } from 'k6';

// Конфігурація навантаження (режим "Spike Test" - пікове навантаження)
export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Швидкий розгін до 50 користувачів
    { duration: '30s', target: 50 },  // Утримання 50 користувачів
    { duration: '10s', target: 0 },   // Швидкий спад
  ],
  thresholds: {
    // Встановлюємо жорсткі рамки: 95% запитів мають відповідати швидше за 500мс
    http_req_duration: ['p(95)<500'],
    // Відсоток помилок не має перевищувати 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  // 1. Тест головної сторінки (каталог)
  const catalogRes = http.get(`${BASE_URL}/catalog`);
  check(catalogRes, {
    'catalog status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Тест сторінки Watchlist Plus (публічна, без аутентифікації)
  const plusRes = http.get(`${BASE_URL}/watchlist-plus`);
  check(plusRes, {
    'plus page status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
