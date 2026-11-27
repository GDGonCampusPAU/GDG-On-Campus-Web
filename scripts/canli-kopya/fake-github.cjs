// Yerel sahte GitHub (127.0.0.1:5199). Gerçek GitHub'a hiçbir istek gitmez.
// API: /repos/:o/:r, /repos/:o/:r/commits, /repos/:o/:r/activity (yükleme sitesi + teslim kontrolü)
// Kontrol sayfası: http://127.0.0.1:5199/  (repo oluştur, commit/push ekle, gizle/sil, GitHub'ı "çökert")
// Durum GDG_KOPYA_DIR/sahte-github.json içinde kalır.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILE = path.join(process.env.GDG_KOPYA_DIR || __dirname, 'sahte-github.json');
const PORT = Number(process.env.GDG_KOPYA_GITHUB_PORT || 5199);
let state = { mode: 'ok', repos: {} };
try { state = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* ilk çalıştırma */ }
const save = () => fs.writeFileSync(FILE, JSON.stringify(state, null, 1));
const key = (o, r) => `${o}/${r}`.toLowerCase();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(body === null ? '' : JSON.stringify(body));
};
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
const localNow = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
const fromLocal = (v) => (v ? new Date(`${v}:00+03:00`) : new Date());

const page = (note = '') => `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sahte GitHub</title>
<style>body{font:15px/1.45 system-ui,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;background:#fafafa;color:#111}
h1{font-size:22px}h2{font-size:17px;margin:0 0 8px}section{background:#fff;border:1px solid #222;border-radius:8px;padding:12px 14px;margin:12px 0}
form{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:6px 0}label{display:flex;flex-direction:column;font-size:13px;font-weight:600}
input,select,button{font:inherit;padding:5px 8px;border:1px solid #222;border-radius:6px}button{background:#111;color:#fff;cursor:pointer}
.ghost{background:#fff;color:#111}.note{background:#e6f4ea;padding:8px 12px;border-radius:6px}.warn{background:#fde7e7}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}
code{font-size:12px}.tag{display:inline-block;padding:0 6px;border-radius:4px;background:#ffe9a8;font-size:12px;margin-left:4px}</style>
<h1>Sahte GitHub <small style="font-weight:400">(yalnız bu bilgisayar)</small></h1>
<p>Yerel yükleme sitesi ve jüri ekranları buradan okur. Takımın linki: <code>https://github.com/&lt;sahip&gt;/&lt;repo&gt;</code> (repo önce burada oluşturulmalı).</p>
${note ? `<p class="note">${esc(note)}</p>` : ''}
<section${state.mode !== 'ok' ? ' class="warn"' : ''}><h2>GitHub durumu: ${esc(state.mode)}</h2>
<form method="post" action="/__ui/mode"><select name="mode">${['ok', 'down', '500', 'ratelimit'].map(m => `<option${m === state.mode ? ' selected' : ''}>${m}</option>`).join('')}</select><button>Uygula</button></form></section>
<section><h2>Yeni repo</h2><form method="post" action="/__ui/repo">
<label>sahip/repo<input name="name" placeholder="takim/proje" required pattern="[A-Za-z0-9-]+/[A-Za-z0-9._-]+"></label>
<label>Görünürlük<select name="visibility"><option value="public">public</option><option value="private">private</option></select></label><button>Oluştur</button></form></section>
${Object.entries(state.repos).map(([name, repo]) => `<section><h2>${esc(name)}${repo.private ? '<span class="tag">private</span>' : ''}${repo.gone ? '<span class="tag">silinmiş</span>' : ''}</h2>
<form method="post" action="/__ui/commit"><input type="hidden" name="repo" value="${esc(name)}">
<label>Commit mesajı<input name="message" required value="yeni özellik"></label>
<label>Commit tarihi (takımın yazdığı)<input type="datetime-local" name="date" value="${localNow()}"></label>
<label>GitHub'a push zamanı<input type="datetime-local" name="pushedAt" value="${localNow()}"></label>
<label>Kim<input name="author" value="Takım Üyesi" size="12"></label>
<label>Tür<select name="type"><option value="push">push</option><option value="force_push">force push (geçmişi sil)</option></select></label><button>Push ekle</button></form>
<form method="post" action="/__ui/toggle"><input type="hidden" name="repo" value="${esc(name)}">
<button class="ghost" name="what" value="private">${repo.private ? 'Public yap' : 'Private yap'}</button>
<button class="ghost" name="what" value="gone">${repo.gone ? 'Geri getir' : 'Sil'}</button>
<button class="ghost" name="what" value="remove">Bu sayfadan kaldır</button></form>
<table><tr><th>Push zamanı</th><th>Commit tarihi</th><th>Mesaj</th><th>Kim</th><th>Tür</th></tr>
${repo.activity.map(a => { const c = repo.allCommits.find(x => x.sha === a.after); return `<tr><td>${fmt(a.timestamp)}</td><td>${c ? fmt(c.date) : '—'}</td><td>${esc(c?.message || '')}</td><td>${esc(a.actor.login)}</td><td>${a.activity_type}</td></tr>`; }).join('') || '<tr><td colspan="5">Henüz push yok (boş repo)</td></tr>'}
</table></section>`).join('')}
</html>`;

const body = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', c => { data += c; if (data.length > 1e5) req.destroy(); });
  req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
});
const back = (res, note) => { res.writeHead(303, { location: `/?note=${encodeURIComponent(note)}` }); res.end(); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page(url.searchParams.get('note') || ''));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/__ui/')) {
      const f = await body(req);
      const action = url.pathname.slice(6);
      if (action === 'mode') { state.mode = f.mode; save(); return back(res, `GitHub durumu: ${f.mode}`); }
      if (action === 'repo') {
        if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(f.name || '')) return back(res, 'Geçersiz ad');
        state.repos[f.name.toLowerCase()] ||= { private: f.visibility === 'private', gone: false, commits: [], allCommits: [], activity: [] };
        save(); return back(res, `Oluşturuldu: https://github.com/${f.name}`);
      }
      const repo = state.repos[f.repo];
      if (!repo) return back(res, 'Repo yok');
      if (action === 'commit') {
        const sha = crypto.randomBytes(20).toString('hex');
        const commit = { sha, message: f.message || '(mesaj yok)', date: fromLocal(f.date).toISOString(), author: f.author || 'Takım Üyesi' };
        const before = repo.commits[0]?.sha || '0'.repeat(40);
        if (f.type === 'force_push') repo.commits = [];
        repo.commits.unshift(commit);
        repo.allCommits.unshift(commit);
        repo.activity.unshift({ id: repo.activity.length + 1, before, after: sha, ref: 'refs/heads/main', timestamp: fromLocal(f.pushedAt).toISOString(),
          activity_type: f.type === 'force_push' ? 'force_push' : 'push', actor: { login: commit.author.toLowerCase().replace(/\s+/g, '-') } });
        repo.activity.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        save(); return back(res, `${f.repo}: push eklendi`);
      }
      if (action === 'toggle') {
        if (f.what === 'private') repo.private = !repo.private;
        if (f.what === 'gone') repo.gone = !repo.gone;
        if (f.what === 'remove') delete state.repos[f.repo];
        save(); return back(res, `${f.repo}: güncellendi`);
      }
    }
    // --- GitHub API ---
    const m = /^\/repos\/([^/]+)\/([^/]+)(?:\/(commits|activity))?\/?$/.exec(url.pathname);
    if (!m) return send(res, 404, { message: 'Not Found' });
    if (state.mode === 'down') { req.socket.destroy(); return undefined; }
    if (state.mode === '500') return send(res, 502, { message: 'Bad gateway' });
    if (state.mode === 'ratelimit') return send(res, 403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
    const [, owner, name, sub] = m;
    const repo = state.repos[key(decodeURIComponent(owner), decodeURIComponent(name))];
    if (!repo || repo.gone || repo.private) return send(res, 404, { message: 'Not Found' });
    const perPage = Number(url.searchParams.get('per_page') || 30);
    if (!sub) return send(res, 200, { full_name: `${owner}/${name}`, private: false, visibility: 'public', default_branch: 'main' });
    if (sub === 'activity') return send(res, 200, repo.activity.slice(0, perPage));
    if (!repo.commits.length) return send(res, 409, { message: 'Git Repository is empty.' });
    const list = repo.commits.slice(0, perPage);
    const etag = `"${crypto.createHash('sha1').update(list.map(c => c.sha).join()).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) return send(res, 304, null, { etag });
    return send(res, 200, list.map(c => ({ sha: c.sha, html_url: `https://github.com/${owner}/${name}/commit/${c.sha}`,
      commit: { message: c.message, author: { name: c.author, date: c.date } }, author: null })), { etag });
  } catch (error) {
    console.error(error);
    send(res, 500, { message: 'fake error' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[sahte GitHub] http://127.0.0.1:${PORT}`));
