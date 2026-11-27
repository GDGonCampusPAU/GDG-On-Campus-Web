// The access log must hide a jury token and nothing else. CI has no nginx, so the map rules of
// nginx.conf are evaluated here (first matching regex wins, as in nginx).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const conf = fs.readFileSync(path.join(__dirname, '..', '..', 'nginx', 'nginx.conf'), 'utf8').replace(/\r\n/g, '\n');

/** @param {string} name variable the map defines */
const mapOf = name => {
  const block = conf.split('\nmap ').find(part => part.split('\n')[0].includes(`$${name} {`));
  assert.ok(block, `map ${name} not found`);
  const body = block.slice(block.indexOf('{') + 1, block.indexOf('\n}'));
  const rules = [...body.matchAll(/^\s+"~\*(.+?)"\s+"(.*?)";\s*$/gm)].map(([, pattern, output]) => ({ pattern: new RegExp(pattern, 'i'), output }));
  assert.ok(rules.length, `no rules in ${name}`);
  return value => {
    for (const { pattern, output } of rules) {
      const match = pattern.exec(value);
      if (match) return output.replace(/\$([a-z_]+)/g, (_, key) => match.groups?.[key] ?? '');
    }
    return value;
  };
};

const request = mapOf('jury_safe_request');
const referer = mapOf('jury_safe_referer');
const token = () => randomBytes(24).toString('base64url');

const ATTACKS = [
  'GET /juri/../api/v1/auth/login HTTP/1.1',
  'POST /juri/../api/v1/auth/login HTTP/1.1',
  'GET /juri/../../.env HTTP/1.1',
  'GET /juri/%3Cscript%3Ealert(1)%3C/script%3E HTTP/1.1',
  'GET /juri/../uploads/cv.pdf HTTP/1.1',
  'GET /juri/wp-login.php HTTP/1.1',
  'GET /juri/x?cmd=cat%20/etc/passwd HTTP/1.1',
  'POST /api/v1/auth/login?x=juri/ HTTP/1.1',
  'GET /kayit?next=/juri/abcdefghijklmnopqrstuvwxyz012345 HTTP/1.1',
];
for (const line of ATTACKS) {
  test(`attack stays readable: ${line}`, () => assert.equal(request(line), line));
}

test('whatever follows a token-shaped segment stays readable', () => {
  const decoy = 'A'.repeat(32);
  for (const tail of ['/../../api/v1/auth/login', '/../.env', '.php', '%2F..%2Fadmin', '?cmd=id']) {
    const masked = request(`GET /juri/${decoy}${tail} HTTP/1.1`);
    assert.ok(masked.includes(tail), masked);
    assert.ok(!masked.includes(decoy), masked);
  }
});

test('real links are hidden in every form a phone or chat app produces', () => {
  for (let i = 0; i < 2000; i += 1) {
    const secret = token();
    for (const target of [`/juri/${secret}`, `/JURI/${secret}`, `//juri/${secret}`, `/juri//${secret}`, `/juri/%20${secret}`, `/juri/${secret}/`,
      `/juri/${secret}?takim=abc`, `/juri/${secret}.`, `/juri/${secret})`, `/juri/${secret.slice(0, 31)}`, `/juri/${secret}${secret}`]) {
      const masked = request(`GET ${target} HTTP/1.1`);
      assert.ok(!masked.includes(secret.slice(0, 24)), `${target} -> ${masked}`);
      assert.ok(masked.includes('[hidden]'));
    }
  }
});

test('a Referer loses the token and nothing else', () => {
  const secret = token();
  assert.equal(referer(`https://gdgocpamukkale.com/juri/${secret}?takim=1`), 'https://gdgocpamukkale.com/juri/[hidden]?takim=1');
  for (const value of ['https://example.com/juri/../api/v1/auth/login', 'https://example.com/?x=/juri/1']) assert.equal(referer(value), value);
});
