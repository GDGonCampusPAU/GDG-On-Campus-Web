const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e', timeout: 45000, workers: 1,
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/server.cjs', url: 'http://127.0.0.1:5010/ready', timeout: 60000 },
    { command: 'npm run dev --prefix frontend/hackaton -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', env: { VITE_API_URL: 'http://127.0.0.1:5010', VITE_GOOGLE_CLIENT_ID: '' } },
    { command: 'npm run dev --prefix frontend -- --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174', env: { VITE_API_URL: 'http://127.0.0.1:5010' } },
  ],
});
