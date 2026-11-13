const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const loadApp = env => spawnSync(process.execPath, ['-e', "require('./src/app')"], {
  cwd: path.join(__dirname, '..'),
  env: { PATH: process.env.PATH, JWT_SECRET: 'x'.repeat(40), PARTICIPANT_JWT_SECRET: 'y'.repeat(40), ...env },
  encoding: 'utf8',
});

test('production refuses to boot without CLIENT_URLS instead of allowing only localhost', () => {
  const missing = loadApp({ NODE_ENV: 'production' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /CLIENT_URLS tanımlanmalıdır/);
  const set = loadApp({ NODE_ENV: 'production', CLIENT_URLS: 'https://gdgocpamukkale.com' });
  assert.equal(set.status, 0, set.stderr);
});
