// Site maintenance mode ("Tadilattayız" page on the hackathon site).
//
// The single source of truth is a flag file on disk, not the database, so the page keeps
// working while the backend or MongoDB is down:
//   - local `npm run dev`: we start maintenance/server.mjs detached; it serves the page on
//     the site port even after the backend and Vite are stopped, and exits when the flag goes.
//   - Vite dev server: frontend/hackaton/maintenance-plugin.js reads the same flag.
//   - production: nginx checks the flag file (shared volume) and answers 503 with the page.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const stateDir = () => path.resolve(process.env.MAINTENANCE_DIR || path.join(repoRoot, '.maintenance'));
const flagFile = () => path.join(stateDir(), 'active.json');
const pidFile = () => path.join(stateDir(), 'server.pid');
const serverScript = path.join(repoRoot, 'maintenance', 'server.mjs');
/** Docker and production set MAINTENANCE_STANDALONE=false: there nginx / the site container serve the page. */
const standaloneEnabled = () => process.env.MAINTENANCE_STANDALONE !== 'false' && process.env.NODE_ENV !== 'test';

const isAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
};

const readFlag = () => {
  try { return JSON.parse(fs.readFileSync(flagFile(), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return null;
    return {}; // present but unreadable still means "on"
  }
};

const serverPid = () => {
  try {
    const pid = Number(fs.readFileSync(pidFile(), 'utf8'));
    return pid && isAlive(pid) ? pid : null;
  } catch { return null; }
};

const status = () => {
  const flag = readFlag();
  return {
    active: Boolean(flag),
    since: flag?.since || null,
    by: flag?.by || null,
    server: !standaloneEnabled() ? 'external' : serverPid() ? 'running' : 'stopped'
  };
};

/** Starts the standalone page server unless it is already running. */
const ensureServer = () => {
  if (!standaloneEnabled() || !readFlag() || serverPid()) return false;
  if (!fs.existsSync(serverScript)) {
    console.warn('[Bakım] maintenance/server.mjs bulunamadı; bağımsız bakım sunucusu başlatılmadı.');
    return false;
  }
  // --detach makes the server re-launch itself outside our process tree (see server.mjs),
  // so it survives the backend, nodemon and `npm run dev` shutting down.
  const result = spawnSync(process.execPath, [serverScript, '--detach'], {
    stdio: 'ignore',
    timeout: 5000,
    env: { ...process.env, MAINTENANCE_DIR: stateDir() }
  });
  if (result.status !== 0) {
    console.warn('[Bakım] Bağımsız bakım sunucusu başlatılamadı.');
    return false;
  }
  return true;
};

/** @param {{ _id: any, fullName?: string }} user */
const enable = async (user) => {
  if (!readFlag()) {
    fs.mkdirSync(stateDir(), { recursive: true });
    const flag = { since: new Date().toISOString(), by: { id: String(user._id), name: user.fullName || '' } };
    fs.writeFileSync(flagFile(), JSON.stringify(flag, null, 2));
  }
  if (ensureServer()) {
    // The detached copy writes its pid within a moment; wait so the panel shows the real state.
    for (let i = 0; i < 20 && !serverPid(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  }
  return status();
};

const disable = () => {
  fs.rmSync(flagFile(), { force: true });
  // The server also notices the missing flag within a second; the signal just makes it immediate.
  const pid = serverPid();
  if (pid) { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } }
  return { ...status(), server: standaloneEnabled() ? 'stopped' : 'external' };
};

module.exports = { status, enable, disable, ensureServer };
