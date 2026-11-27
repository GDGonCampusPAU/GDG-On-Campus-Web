#!/usr/bin/env node
// Canlı verinin YEREL kopyasıyla test aracı.  Kullanım: npm run yerel -- <komut>
//
// Hiçbir şey dışarı gitmez: mail yakalanır, localhost dışı istekler engellenir, GitHub sahtedir.
// Sunucuya yalnız "veri-cek" bağlanır ve yalnız OKUR (döküm SSH üzerinden bu bilgisayara akar).
import { spawn, spawnSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const UPLOAD_ROOT = process.env.GDG_UPLOAD_DIR || path.resolve(ROOT, '../hackaton-proje-yukleme')
const DATA = process.env.GDG_KOPYA_DIR || path.join(os.homedir(), '.cache', 'gdg-canli-kopya')
const SSH_HOST = process.env.GDG_KOPYA_SSH || 'vds'
const require = createRequire(import.meta.url)

const PORTS = { api: 5010, site: 4173, panel: 4174, uploadApi: 5181, uploadWeb: 5180, github: 5199, mongo: 27099 }
const API = `http://127.0.0.1:${PORTS.api}`
const URLS = {
  site: `http://127.0.0.1:${PORTS.site}`,
  panel: `http://127.0.0.1:${PORTS.panel}`,
  upload: `http://localhost:${PORTS.uploadWeb}`,
  github: `http://127.0.0.1:${PORTS.github}`,
}
// Yerel uç noktalarla aynı sırlar; yükleme sitesiyle ana site arasında (yalnız bu bilgisayar).
const UPLOAD_SECRET = 'canli-kopya-project-upload-secret-0123456789'
const UPLOAD_KEY = 'canli-kopya-internal-key-0123456789abcdef0123'

const c = { b: (s) => `\x1b[1m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m` }
const die = (message) => { console.error(c.red(`✖ ${message}`)); process.exit(1) }
const ensureData = () => { fs.mkdirSync(DATA, { recursive: true, mode: 0o700 }); fs.chmodSync(DATA, 0o700) }

/** Wi-Fi/Ethernet IPv4 adresi (Docker, VPN ve loopback hariç). */
const lanAddress = () => {
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (/^(lo|docker|br-|veth|tun|tap|wg|virbr)/.test(name)) continue
    const v4 = (addresses || []).find((a) => a.family === 'IPv4' && !a.internal)
    if (v4) return v4.address
  }
  return null
}
const portFree = (port) => new Promise((resolve) => {
  const server = net.createServer().once('error', () => resolve(false)).once('listening', () => server.close(() => resolve(true)))
  server.listen(port, '127.0.0.1')
})
const harness = async (pathname, body) => {
  let res
  try {
    res = await fetch(`${API}${pathname}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  } catch {
    die(`Yerel backend çalışmıyor. Önce başka bir terminalde: ${c.b('npm run yerel -- baslat')}`)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) die(data.message || `Hata ${res.status}`)
  return data
}
const ask = async (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`${question} [e/H] `)).trim().toLowerCase()
  rl.close()
  return ['e', 'evet', 'y', 'yes'].includes(answer)
}

// ------------------------------------------------------------------------------------------------
const commands = {
  async yardim() {
    console.log(`
${c.b('Canlı verinin yerel kopyası')}  ${c.dim(`(veri: ${DATA})`)}

  ${c.b('npm run yerel -- veri-cek')}              Sunucudan canlı verinin dökümünü indir (yalnız okur)
  ${c.b('npm run yerel -- baslat')} ${c.dim('[--ag]')}         Bütün servisleri başlat (Ctrl+C ile durur); --ag: yerel IP'den başkaları da açar
  ${c.b('npm run yerel -- durum')}                 Servisler ayakta mı
  ${c.b('npm run yerel -- kisiler')} ${c.dim('[ara]')}         Yöneticiler, jüriler, takımlar, katılımcılar
  ${c.b('npm run yerel -- ac admin')} ${c.dim('[e-posta]')}    Panel + jüri yönetimi, giriş yapılmış
  ${c.b('npm run yerel -- ac katilimci')} ${c.dim('<e-posta>')} Başvurum (oy kartı burada), giriş yapılmış
  ${c.b('npm run yerel -- ac yukleme')} ${c.dim('<e-posta>')}   Proje yükleme sitesi, giriş yapılmış
  ${c.b('npm run yerel -- ac juri')} ${c.dim('[ad]')}          Jüri ekranı (ad yoksa yeni jüri oluşturur)
  ${c.b('npm run yerel -- ac github')}             Sahte GitHub (repo oluştur, push ekle)
  ${c.b('npm run yerel -- mail')}                  Yakalanan (gönderilmeyen) mailler ve kodlar
  ${c.b('npm run yerel -- sifirla')}               Yerel değişiklikleri sil, dökümden yeniden yükle

  ${c.dim('"ac" için --telefon: telefon ekranında açar. Her kişi kendi Chromium profilinde açılır,')}
  ${c.dim('aynı anda birden çok kişi (ör. admin + 3 katılımcı + jüri) açık tutulabilir.')}
`)
  },

  async 'veri-cek'() {
    ensureData()
    console.log(`Sunucuya (${c.b(`ssh ${SSH_HOST}`)}) bağlanıp veritabanının dökümü ${c.b('okunacak')}.`)
    console.log(c.dim('Sunucuda hiçbir şey değişmez, dosya bile oluşmaz: döküm doğrudan bu bilgisayara akar.'))
    if (!(await ask('Devam edilsin mi?'))) return console.log('Vazgeçildi.')
    const tmp = path.join(DATA, 'dump.archive.gz.indiriliyor')
    const out = fs.openSync(tmp, 'w', 0o600)
    const remote = 'cd /root/gdg-web && docker compose -f compose.prod.yaml exec -T mongo sh -c \'mongodump --quiet --archive --gzip $( [ -n "$MONGO_INITDB_ROOT_USERNAME" ] && echo --username $MONGO_INITDB_ROOT_USERNAME --password $MONGO_INITDB_ROOT_PASSWORD --authenticationDatabase admin )\''
    const dump = spawnSync('ssh', [SSH_HOST, remote], { stdio: ['ignore', out, 'inherit'] })
    fs.closeSync(out)
    if (dump.status !== 0 || fs.statSync(tmp).size < 1000) { fs.rmSync(tmp, { force: true }); die('Döküm alınamadı.') }
    fs.renameSync(tmp, path.join(DATA, 'dump.archive.gz'))
    fs.mkdirSync(path.join(DATA, 'uploads'), { recursive: true })
    spawnSync('rsync', ['-a', `${SSH_HOST}:/root/gdg-web/backend/uploads/`, path.join(DATA, 'uploads/')], { stdio: 'inherit' })
    fs.writeFileSync(path.join(DATA, 'dump.tarih'), new Date().toISOString())
    console.log(c.green(`✔ Döküm indirildi (${Math.round(fs.statSync(path.join(DATA, 'dump.archive.gz')).size / 1024)} KB).`))
    if (fs.existsSync(path.join(DATA, 'db'))) console.log(`Yerel kopya hâlâ eski veriyle. Yeni veriye geçmek için: ${c.b('npm run yerel -- sifirla')}`)
  },

  async sifirla() {
    if (!(await portFree(PORTS.api))) die('Önce "baslat" çalışan terminalde Ctrl+C ile durdur.')
    if (!(await ask('Yerel kopyadaki bütün değişiklikler silinip dökümden yeniden yüklenecek (sahte GitHub ve tarayıcı profilleri de). Emin misin?'))) return
    for (const name of ['db', 'sahte-github.json', 'profiller']) fs.rmSync(path.join(DATA, name), { recursive: true, force: true })
    console.log(c.green('✔ Silindi. Sonraki "baslat" dökümden yeniden yükler.'))
  },

  async baslat(...flags) {
    ensureData()
    // --ag: yerel ağdan (aynı Wi-Fi'daki telefon/bilgisayar) erişilsin. --ag=192.168.1.20 ile IP seçilir.
    const lanFlag = flags.find((flag) => flag === '--ag' || flag.startsWith('--ag='))
    const lanIp = lanFlag ? (lanFlag.split('=')[1] || lanAddress()) : null
    if (lanFlag && !lanIp) die('Yerel ağ IP adresi bulunamadı. --ag=<ip> ile ver.')
    if (lanIp) {
      console.log(c.yellow(`
! Yerel kopya ${lanIp} adresinden AĞA açılacak. Bu ağa bağlı herkes siteye ulaşabilir ve
  ortak giriş kodunu bilen herkes HERHANGİ BİR katılımcı olarak girip kişisel bilgilerini görebilir.
  Eduroam gibi ortak ağlarda kullanma; telefon hotspot'u ya da ev ağı kullan.`))
      if (!(await ask('Ağa açılsın mı?'))) return console.log('Vazgeçildi.')
    }
    const code = String(randomInt(100000, 1000000))
    const host = lanIp || '127.0.0.1'
    const pub = {
      api: `http://${host}:${PORTS.api}`,
      site: `http://${host}:${PORTS.site}`,
      panel: `http://${host}:${PORTS.panel}`,
      upload: lanIp ? `http://${lanIp}:${PORTS.uploadWeb}` : URLS.upload,
    }
    if (!fs.existsSync(path.join(DATA, 'dump.archive.gz'))) die(`Döküm yok. Önce: ${c.b('npm run yerel -- veri-cek')}`)
    for (const [name, port] of Object.entries(PORTS)) if (!(await portFree(port))) die(`Port ${port} (${name}) dolu. Zaten çalışıyor olabilir: npm run yerel -- durum`)
    const logs = path.join(DATA, 'logs')
    fs.mkdirSync(logs, { recursive: true })
    const withUpload = fs.existsSync(path.join(UPLOAD_ROOT, 'backend/src/server.js'))
    const noOutbound = path.join(HERE, 'no-outbound.cjs')
    const env = { ...process.env, GDG_KOPYA_DIR: DATA, NODE_PATH: path.join(ROOT, 'node_modules') }
    for (const key of Object.keys(env)) if (key.startsWith('BREVO_') || key === 'GITHUB_TOKEN') delete env[key]
    const services = [
      { name: 'github', cmd: 'node', args: [path.join(HERE, 'fake-github.cjs')], cwd: ROOT, show: true },
      { name: 'backend', cmd: 'node', args: ['--require', noOutbound, path.join(HERE, 'server.cjs')], cwd: ROOT, show: true,
        env: { PROJECT_UPLOAD_URL: withUpload ? pub.upload : '', PROJECT_UPLOAD_SECRET: UPLOAD_SECRET, PROJECT_UPLOAD_INTERNAL_KEY: UPLOAD_KEY,
          GDG_KOPYA_KOD: code, GDG_KOPYA_HOST: lanIp ? '0.0.0.0' : '127.0.0.1', GDG_KOPYA_ORIGINS: lanIp ? [pub.site, pub.panel].join(',') : '' } },
      { name: 'site', cmd: 'npx', args: ['vite', '--host', lanIp ? '0.0.0.0' : '127.0.0.1', '--port', String(PORTS.site), '--strictPort'], cwd: path.join(ROOT, 'frontend/hackaton'),
        env: { VITE_API_URL: pub.api, VITE_GOOGLE_CLIENT_ID: '' } },
      { name: 'panel', cmd: 'npx', args: ['vite', '--host', lanIp ? '0.0.0.0' : '127.0.0.1', '--port', String(PORTS.panel), '--strictPort'], cwd: path.join(ROOT, 'frontend'),
        env: { VITE_API_URL: pub.api } },
      ...(withUpload ? [
        { name: 'yukleme-api', cmd: 'node', args: ['--require', noOutbound, 'src/server.js'], cwd: path.join(UPLOAD_ROOT, 'backend'), show: true,
          env: { PORT: String(PORTS.uploadApi), MAIN_API_URL: API, PROJECT_UPLOAD_SECRET: UPLOAD_SECRET, PROJECT_UPLOAD_INTERNAL_KEY: UPLOAD_KEY,
            PANEL_URL: `${pub.site}/basvurum`, GITHUB_TOKEN: '', NODE_ENV: 'development' } },
        { name: 'yukleme-web', cmd: 'npx', args: ['vite', ...(lanIp ? ['--host', '0.0.0.0'] : []), '--port', String(PORTS.uploadWeb), '--strictPort'], cwd: path.join(UPLOAD_ROOT, 'frontend') },
      ] : []),
    ]
    if (!withUpload) console.log(c.yellow(`! Proje yükleme sitesi bulunamadı (${UPLOAD_ROOT}); o kısım çalışmayacak.`))

    const children = []
    let stopping = false
    const stopAll = () => {
      if (stopping) return
      stopping = true
      console.log('\nDurduruluyor…')
      for (const child of children) { try { process.kill(-child.pid, 'SIGTERM') } catch { /* zaten kapandı */ } }
      setTimeout(() => process.exit(0), 4000).unref()
    }
    process.on('SIGINT', stopAll)
    process.on('SIGTERM', stopAll)
    for (const service of services) {
      const log = fs.createWriteStream(path.join(logs, `${service.name}.log`), { flags: 'w' })
      const child = spawn(service.cmd, service.args, { cwd: service.cwd, env: { ...env, ...(service.env || {}) }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
      children.push(child)
      const relay = (chunk) => {
        log.write(chunk)
        if (!service.show) return
        for (const line of String(chunk).split('\n')) {
          if (!line.trim() || /GET \/|POST \/|PUT \/|PATCH \/|DELETE \/|"GET|"POST/.test(line)) continue
          console.log(`${c.dim(`[${service.name}]`)} ${line}`)
        }
      }
      child.stdout.on('data', relay)
      child.stderr.on('data', relay)
      child.on('exit', (code) => { if (!stopping) { console.log(c.red(`[${service.name}] kapandı (kod ${code}). Kayıt: ${path.join(logs, `${service.name}.log`)}`)); stopAll() } })
    }
    // Hazır olunca adresleri yaz.
    for (let i = 0; i < 120 && !stopping; i++) {
      try { if ((await fetch(`${API}/api/v1/health`)).ok) break } catch { /* henüz değil */ }
      await new Promise((r) => setTimeout(r, 1000))
    }
    if (stopping) return
    const since = fs.existsSync(path.join(DATA, 'dump.tarih')) ? new Date(fs.readFileSync(path.join(DATA, 'dump.tarih'), 'utf8')).toLocaleString('tr-TR') : '?'
    console.log(`
${c.green('✔ Yerel kopya hazır')} ${c.dim(`(döküm: ${since})`)} — mail gönderilmez, dışarı istek gitmez.${lanIp ? c.yellow(`  AĞA AÇIK: ${lanIp}`) : ''}
  Site          ${pub.site}        jüri yönetimi: ${pub.site}/admin/juri
  Panel         ${pub.panel}
  Proje yükleme ${withUpload ? pub.upload : c.dim('yok')}
  Sahte GitHub  ${URLS.github} ${c.dim('(yalnız bu bilgisayar)')}
  Yerel admin   yerel-admin@pau.edu.tr / yerel-admin-sifre

  ${c.b(`E-posta doğrulama kodu: ${code}`)}  ${c.dim('(mail gitmez; her e-posta için bu kodu yaz, her başlatmada değişir)')}

Başka bir terminalde: ${c.b('npm run yerel -- kisiler')}, ${c.b('npm run yerel -- ac admin')}, ${c.b('npm run yerel -- ac katilimci <e-posta>')} …
Durdurmak için Ctrl+C.
`)
  },

  async durum() {
    for (const [name, port] of Object.entries(PORTS)) {
      const up = !(await portFree(port))
      console.log(`${up ? c.green('●') : c.red('○')} ${name.padEnd(10)} ${port}`)
    }
    const since = path.join(DATA, 'dump.tarih')
    console.log(c.dim(`\nVeri: ${DATA}${fs.existsSync(since) ? ` · döküm ${new Date(fs.readFileSync(since, 'utf8')).toLocaleString('tr-TR')}` : ' · döküm yok'}`))
  },

  async kisiler(query = '') {
    const data = await harness(`/__yerel__/kisiler?q=${encodeURIComponent(query)}`)
    const yes = (v) => (v ? c.green('evet') : c.dim('hayır'))
    console.log(c.b('\nYöneticiler') + c.dim('  → npm run yerel -- ac admin <e-posta>'))
    for (const u of data.staff) console.log(`  ${u.email.padEnd(34)} ${u.role.padEnd(10)} ${u.fullName}`)
    console.log(c.b('\nJüriler') + c.dim('  → npm run yerel -- ac juri "<ad>"'))
    for (const j of data.jurors) console.log(`  ${j.name}${j.active ? '' : c.dim(' (pasif)')}`)
    if (!data.jurors.length) console.log(c.dim('  (yok — "ac juri" yeni bir tane oluşturur)'))
    console.log(c.b('\nTakımlar') + c.dim('  (yarışıyor = "Yarışan takımlar"da)'))
    for (const t of data.teams) {
      console.log(`  ${t.name.padEnd(26)} ${t.code}  ${String(t.members).padStart(2)} kişi  yarışıyor: ${yes(t.competing)}  ${t.link ? `${t.projectName ? `${t.projectName} · ` : ''}${t.link}` : c.dim('link yok')}`)
    }
    console.log(c.b('\nKatılımcılar') + c.dim('  → npm run yerel -- ac katilimci <e-posta>'))
    for (const p of data.participants) {
      const where = p.team ? `${p.team} · ${p.role}${p.competing ? '' : c.yellow(' · yarışmıyor')}` : c.dim('takımsız')
      console.log(`  ${p.email.padEnd(38)} ${where}${p.applied ? '' : c.dim(' · başvurusu yok')}`)
    }
    console.log()
  },

  async mail() {
    const list = await harness('/__yerel__/mail')
    if (!list.length) return console.log(c.dim('Yakalanan mail yok.'))
    for (const m of list) console.log(`${c.dim(new Date(m.at).toLocaleTimeString('tr-TR'))} ${m.fn.padEnd(28)} → ${m.to}${m.code ? `  kod ${c.b(m.code)}` : ''}`)
  },

  async ac(kind, ...rest) {
    const phone = rest.includes('--telefon')
    const who = rest.filter((arg) => arg !== '--telefon').join(' ').trim()
    const kinds = { admin: 'admin', katilimci: 'katilimci', 'katılımcı': 'katilimci', yukleme: 'yukleme', 'yükleme': 'yukleme', juri: 'juri', 'jüri': 'juri' }
    let plan
    if (kind === 'github') plan = { label: 'Sahte GitHub', storage: [], pages: [{ url: URLS.github }] }
    else if (kinds[kind]) {
      if (['katilimci', 'yukleme'].includes(kinds[kind]) && !who) die(`E-posta gerekli: npm run yerel -- ac ${kind} <e-posta>  (liste: npm run yerel -- kisiler)`)
      plan = await harness('/__yerel__/oturum', { tur: kinds[kind], kim: who || undefined })
    } else die(`Bilinmeyen tür "${kind ?? ''}". Seçenekler: admin, katilimci, yukleme, juri, github`)

    let playwright
    try { playwright = require(path.join(ROOT, 'node_modules/playwright')) } catch { die('Playwright yok: npm ci && npm run setup:browser') }
    const slug = `${kinds[kind] || kind}-${(who || 'varsayilan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}${phone ? '-telefon' : ''}`
    const profile = path.join(DATA, 'profiller', slug)
    fs.mkdirSync(profile, { recursive: true })
    const device = phone ? playwright.devices['Pixel 7'] : {}
    let context
    try {
      context = await playwright.chromium.launchPersistentContext(profile, { headless: process.env.GDG_KOPYA_HEADLESS === '1', ...(phone ? device : { viewport: null }),
        args: [`--window-name=${plan.label}`] })
    } catch (error) {
      die(`Chromium açılamadı (${String(error.message).split('\n')[0]}). Aynı kişi için zaten açık bir pencere olabilir.`)
    }
    let first = context.pages()[0]
    for (const [i, target] of plan.pages.entries()) {
      const page = i === 0 && first ? first : await context.newPage()
      first = null
      const origin = new URL(target.url).origin
      const store = plan.storage.find((s) => s.origin === origin)
      if (store || target.historyState) {
        // Önce aynı adreste boş bir sayfa: depolamaya oturumu yaz, sonra asıl sayfaya geç.
        await page.goto(`${origin}/__yerel__`, { waitUntil: 'domcontentloaded' })
        await page.evaluate((s) => {
          for (const [k, v] of Object.entries(s?.localStorage || {})) localStorage.setItem(k, v)
          for (const [k, v] of Object.entries(s?.sessionStorage || {})) sessionStorage.setItem(k, v)
        }, store || {})
      }
      if (target.historyState) {
        const { pathname } = new URL(target.url)
        // React Router sayfa geçişi durumunu history.state.usr içinde tutar; yenilemede de korunur.
        await page.evaluate(([state, to]) => history.replaceState({ usr: state, key: 'yerel', idx: 0 }, '', to), [target.historyState, pathname])
        await page.reload({ waitUntil: 'domcontentloaded' })
      } else {
        await page.goto(target.url, { waitUntil: 'domcontentloaded' })
      }
    }
    console.log(`${c.green('✔')} ${plan.label} için Chromium açıldı${phone ? ' (telefon)' : ''}. Pencereyi kapatınca bu komut biter.`)
    // Denetim için (GDG_KOPYA_HEADLESS=1): açılan sayfaların adresi ve başlığı yazılır, tarayıcı kapanır.
    if (process.env.GDG_KOPYA_HEADLESS === '1') {
      await new Promise((r) => setTimeout(r, 2500))
      for (const page of context.pages()) {
        const text = (await page.locator('main').first().innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)
        console.log(`  ${page.url()}\n    ${text}`)
      }
      return context.close()
    }
    await new Promise((resolve) => context.on('close', resolve))
  },
}

const [command = 'yardim', ...args] = process.argv.slice(2)
const run = commands[command] || commands[{ help: 'yardim', '-h': 'yardim', '--help': 'yardim', 'yardım': 'yardim', 'sıfırla': 'sifirla', 'veri-çek': 'veri-cek', 'kişiler': 'kisiler', 'aç': 'ac', 'başlat': 'baslat' }[command]]
if (!run) die(`Bilinmeyen komut "${command}". Yardım: npm run yerel`)
await run(...args)
