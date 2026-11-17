# GDG On Campus PAU Hackathon Websitesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GDG On Campus PAU hackathonu için, hareketli 4 renk geometri hero'suna sahip, çok sayfalı (Ana sayfa, Kayıt, Program, Ekip) Türkçe bir React sitesi kurmak.

**Architecture:** Vite ile derlenen tek sayfalık React 18 uygulaması; `react-router-dom` ile 4 rota, ortak `Layout` (Navbar, Footer, mobil sabit CTA). Tüm içerik tek dosyada (`src/data/event.js`), saf mantık (geri sayım, form doğrulama/gönderim) bileşenlerden ayrı küçük modüllerde ve Vitest ile test edilir. Stil düz CSS: `tokens.css` marka değişkenleri, her bileşenin yanında kendi `.css` dosyası.

**Tech Stack:** React 18, Vite, react-router-dom, Vitest + React Testing Library + user-event (jsdom), düz CSS.

**Spec:** `/Users/heath/Python/Hackathon/Docs/superpowers/specs/2026-10-11-hackathon-website-design.md`

## Global Constraints

- Proje konumu: `/Users/heath/Python/Hackathon/web/`; tüm `npm` komutları bu klasörde çalışır.
- React 18 + Vite + react-router-dom, düz CSS; UI kütüphanesi yok.
- Yalnızca Türkçe, i18n yok.
- Renkler yalnızca `src/styles/tokens.css` içindeki CSS değişkenleriyle kullanılır; bileşen CSS'lerinde ham hex yok.
- Çekirdek renkler: Blue `#4285f4`, Green `#34a853`, Yellow `#f9ab00`, Red `#ea4335`; halftone `#57caff` `#5cdb6d` `#ffd427` `#ff7daf`; pastel `#c3ecf6` `#ccf6c5` `#ffe7a5` `#f8d8d8`; Off White `#f0f0f0`; Black `#1e1e1e`.
- Metin rengi: sarı dahil tüm çekirdek renk yüzeylerinde **yalnızca siyah** (`--black`); beyaz metin yalnızca siyah veya beyaz zeminde. AA kontrast.
- Fontlar: Google Sans (ana), Google Sans Mono (ikincil); `font-display: swap`; fallback `system-ui` / `ui-monospace`.
- Marka adı "GDG On Campus PAU" tam adı veya "GDG" kısaltması.
- Mobile-first; kırılımlar 375 / 768 / 1440 px; sayfa genelinde yatay kaydırma yok; yan boşluk 16 px.
- Sürekli ve scroll animasyonları yalnızca `transform` / `opacity` ile yapılır; `prefers-reduced-motion: reduce` altında tüm animasyon ve parallax kapalı. (Spec §5'teki buton hover köşe yarıçapı değişimi tek seferlik durum geçişi sayılır ve bu kuralın istisnasıdır.)
- Tüm sayfa içeriği (ad, tarih, ödül, program, kişi, sponsor, sosyal bağlantı) yalnızca `src/data/event.js` içinde tutulur.
- Kapsam dışı: backend/veritabanı, kullanıcı hesabı, i18n, CMS, e-posta gönderimi, ödeme, admin paneli.

## Review Focus

Spec'in ima ettiği ama açıkça saymadığı, kullanıcıyı en olası ısıracak durumlar (en olası önce). Her satırın testi sahibi görevde yazılır.

1. **Geçersiz veya geçmiş `startsAt`:** geri sayım `NaN` göstermemeli; geçmişse "Başladı!", bozuksa "Tarih yakında açıklanacak". (Görev 4)
2. **Kayıt gönderiminde sunucu 4xx/5xx veya ağ hatası:** hata mesajı görünür, girilen veriler kaybolmaz, buton "Tekrar dene" olur, başarı ekranı açılmaz. (Görev 9, 10)
3. **Gönder butonuna çift tıklama:** tek bir istek gider. (Görev 10)
4. **Kirli girdi:** baş/son boşluklu veya büyük harfli e-posta, `0 (555) 123-45-67` biçiminde telefon, Türkçe karakterli isim (`İlker Şahin`) geçerli sayılır ve normalize edilir. (Görev 9)
5. **Boş veri koleksiyonları:** `people`, `sponsors`, `days` boşken sayfalar çökmez, başlıksız boş bölüm göstermez; "yakında açıklanacak" metni gösterir. Bilinmeyen rota 404 sayfası gösterir. (Görev 3, 6, 7, 8)

---

## Dosya Yapısı

```
/Users/heath/Python/Hackathon/
  .gitignore
  web/
    index.html, package.json, vite.config.js, .env.example, README.md
    public/fonts/, public/logos/
    src/
      main.jsx, App.jsx, App.test.jsx
      test/setup.js, test/registrationHelpers.js
      styles/tokens.css, fonts.css, base.css
      data/event.js, event.test.js
      lib/registration.js, registration.test.js
      hooks/useReveal.js, useParallax.js
      components/
        Button.jsx/.css            SectionHeading.jsx/.css
        Navbar.jsx/.css/.test.jsx  Footer.jsx/.css
        StickyCta.jsx/.css         Layout.jsx/.css/.test.jsx
        Countdown.jsx/.css/.test.jsx
        Reveal.jsx/.css            Marquee.jsx/.css       HeroShapes.jsx/.css
        PersonCard.jsx/.css        SponsorGrid.jsx/.css
        Timeline.jsx/.css          Field.jsx/.css         StepForm.jsx/.css
      pages/
        Home.jsx/.css/.test.jsx    Register.jsx/.css/.test.jsx
        Schedule.jsx/.css/.test.jsx Team.jsx/.css/.test.jsx
        NotFound.jsx
```

Sorumluluklar: `data/` içerik; `lib/` saf mantık (DOM yok); `hooks/` tarayıcı API'si saran küçük hook'lar; `components/` yeniden kullanılan UI; `pages/` rota başına bir dosya, veriyi `data` prop'u (varsayılan `event`) olarak alır ki test edilebilsin.

---

### Task 1: Node, git ve Vite iskeleti

**Files:**
- Create: `/Users/heath/Python/Hackathon/.gitignore`
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`
- Create: `web/src/main.jsx`, `web/src/App.jsx`, `web/src/test/setup.js`
- Create: `web/src/pages/Home.jsx`, `Register.jsx`, `Schedule.jsx`, `Team.jsx` (geçici tek başlıklı iskelet; sonraki görevlerde tamamen yeniden yazılır)
- Test: `web/src/App.test.jsx`

**Interfaces:**
- Produces: `App` (default export, `<Routes>` içerir, Router dışarıdan sağlanır); rotalar `/`, `/kayit`, `/program`, `/ekip`. Her sayfa tam bir `h1` render eder. Test kurulumu `jsdom` + `@testing-library/jest-dom` matcher'ları + `window.matchMedia` stub'ı.

- [ ] **Step 1: Node'u kur ve doğrula**

Bu makinede Node yok; Homebrew var.

```bash
brew install node
node -v && npm -v
```
Expected: `v20` veya üstü bir sürüm ve npm sürümü yazdırılır.

- [ ] **Step 2: Git deposunu başlat**

```bash
cd /Users/heath/Python/Hackathon
git init
```

`/Users/heath/Python/Hackathon/.gitignore`:

```gitignore
node_modules/
dist/
.DS_Store
.env
.env.*.local
.claude/
Docs/*.pdf
```

- [ ] **Step 3: `web/package.json` yaz ve bağımlılıkları kur**

`web/package.json`:

```json
{
  "name": "gdg-pau-hackathon",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```bash
cd /Users/heath/Python/Hackathon/web
npm install react@18 react-dom@18 react-router-dom
npm install -D vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: hatasız biter, `node_modules/` ve `package-lock.json` oluşur.

- [ ] **Step 4: Yapılandırma ve giriş dosyalarını yaz**

`web/vite.config.js`:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    css: false,
  },
})
```

`web/index.html`:

```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="GDG On Campus PAU Hackathon: kayıt ol, takımını kur, birlikte üret." />
    <title>GDG On Campus PAU Hackathon</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`web/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  })
}
```

`web/src/main.jsx`:

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Başarısız testi yaz**

`web/src/App.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

const paths = ['/', '/kayit', '/program', '/ekip']

describe('App rotaları', () => {
  it.each(paths)('%s rotası tam bir h1 render eder', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Testin başarısız olduğunu doğrula**

```bash
npm test
```
Expected: FAIL, `App.jsx` çözümlenemiyor.

- [ ] **Step 7: İskelet sayfaları ve `App` yaz**

`web/src/pages/Home.jsx`:

```jsx
export default function Home() {
  return <h1>Ana sayfa</h1>
}
```

`web/src/pages/Register.jsx`:

```jsx
export default function Register() {
  return <h1>Kayıt</h1>
}
```

`web/src/pages/Schedule.jsx`:

```jsx
export default function Schedule() {
  return <h1>Program</h1>
}
```

`web/src/pages/Team.jsx`:

```jsx
export default function Team() {
  return <h1>Ekip</h1>
}
```

`web/src/App.jsx`:

```jsx
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Register from './pages/Register.jsx'
import Schedule from './pages/Schedule.jsx'
import Team from './pages/Team.jsx'

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="kayit" element={<Register />} />
      <Route path="program" element={<Schedule />} />
      <Route path="ekip" element={<Team />} />
    </Routes>
  )
}
```

- [ ] **Step 8: Test ve derleme geçiyor mu doğrula**

```bash
npm test && npm run build
```
Expected: 4 test PASS; build `dist/` üretir.

- [ ] **Step 9: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add .gitignore web Docs/superpowers
git commit -m "chore: Vite + React iskeleti, test kurulumu ve rotalar"
```

---

### Task 2: Etkinlik verisi (`data/event.js`)

**Files:**
- Create: `web/src/data/event.js`
- Test: `web/src/data/event.test.js`

**Interfaces:**
- Produces: `event` ve `typeLabels` named export'ları.
  - `event: { organizer, name, tagline, theme, startsAt, location, about: [{title,text,color}], marquee: string[], prizes: [{place,title,description,color}], days: [{label,date,items:[{time,title,description,type}]}], people: { jury: Person[], mentors: Person[] }, sponsors: [{name,tier,logo,url}], socials: [{label,url}] }`
  - `Person = { name: string, title: string, photo: string | null }`
  - `color ∈ 'blue'|'green'|'yellow'|'red'`; `type ∈ 'opening'|'workshop'|'coding'|'submission'|'jury'|'awards'`; `tier ∈ 'main'|'support'`
  - `typeLabels: Record<type, string>` Türkçe etiketler.

- [ ] **Step 1: Başarısız testi yaz**

`web/src/data/event.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { event, typeLabels } from './event.js'

const colors = ['blue', 'green', 'yellow', 'red']

describe('event verisi', () => {
  it('startsAt geçerli bir tarihtir', () => {
    expect(Number.isNaN(new Date(event.startsAt).getTime())).toBe(false)
  })

  it('3 ödül vardır ve her biri bilinen bir renk taşır', () => {
    expect(event.prizes).toHaveLength(3)
    event.prizes.forEach((p) => expect(colors).toContain(p.color))
  })

  it('tanıtım kartları bilinen bir renk taşır', () => {
    expect(event.about).toHaveLength(3)
    event.about.forEach((a) => expect(colors).toContain(a.color))
  })

  it('program öğelerinin türü typeLabels içinde tanımlıdır', () => {
    const items = event.days.flatMap((d) => d.items)
    expect(items.length).toBeGreaterThan(0)
    items.forEach((i) => expect(typeLabels[i.type]).toBeTruthy())
  })

  it('sponsor seviyeleri main veya support olur', () => {
    event.sponsors.forEach((s) => expect(['main', 'support']).toContain(s.tier))
  })

  it('her kişi ad ve unvan taşır', () => {
    const all = [...event.people.jury, ...event.people.mentors]
    expect(all.length).toBeGreaterThan(0)
    all.forEach((p) => {
      expect(p.name).toBeTruthy()
      expect(p.title).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/data/event.test.js
```
Expected: FAIL, `event.js` yok.

- [ ] **Step 3: Veriyi yaz**

`web/src/data/event.js`:

```js
// Tüm değerler PLACEHOLDER'dır. Gerçek bilgiler gelince yalnızca bu dosya güncellenir.

export const typeLabels = {
  opening: 'Açılış',
  workshop: 'Workshop',
  coding: 'Kodlama',
  submission: 'Teslim',
  jury: 'Jüri',
  awards: 'Ödül',
}

export const event = {
  organizer: 'GDG On Campus PAU',
  name: 'PAU Hackathon 2026',
  tagline: 'Fikrini bir hafta sonunda çalışan bir ürüne dönüştür.',
  theme: 'Kampüs için Yapay Zeka',
  startsAt: '2026-12-12T09:00:00+03:00',
  location: 'Konum yakında açıklanacak',

  about: [
    { title: 'Ne?', text: 'Takımlar halinde 2 gün boyunca bir fikri prototipe dönüştürdüğümüz hackathon.', color: 'blue' },
    { title: 'Kim için?', text: 'Bölümü ve seviyesi fark etmez; kod yazan, tasarlayan ve fikri olan herkes.', color: 'green' },
    { title: 'Neden?', text: 'Mentorlardan geri bildirim, ödüller ve yeni bir takım arkadaşı kazanırsın.', color: 'yellow' },
  ],

  marquee: ['Kodla', 'Tasarla', 'Paylaş', 'Yapay Zeka', 'Takım Kur', 'Prototiple', 'GDG On Campus PAU'],

  prizes: [
    { place: '1.', title: 'Birincilik', description: 'Ödül detayları yakında açıklanacak.', color: 'yellow' },
    { place: '2.', title: 'İkincilik', description: 'Ödül detayları yakında açıklanacak.', color: 'blue' },
    { place: '3.', title: 'Üçüncülük', description: 'Ödül detayları yakında açıklanacak.', color: 'green' },
  ],

  days: [
    {
      label: '1. Gün',
      date: '12 Aralık 2026',
      items: [
        { time: '09:00', title: 'Açılış ve tanışma', description: 'Etkinliğin tanıtımı, kurallar ve takım eşleşmeleri.', type: 'opening' },
        { time: '10:30', title: 'Yapay Zeka workshop', description: 'Başlangıç seviyesinde uygulamalı oturum.', type: 'workshop' },
        { time: '13:00', title: 'Kodlama başlıyor', description: 'Takımlar projelerine başlar, mentorlar sahada.', type: 'coding' },
      ],
    },
    {
      label: '2. Gün',
      date: '13 Aralık 2026',
      items: [
        { time: '12:00', title: 'Proje teslimi', description: 'Son commit ve sunum dosyalarının yüklenmesi.', type: 'submission' },
        { time: '14:00', title: 'Jüri sunumları', description: 'Her takım 5 dakikada projesini anlatır.', type: 'jury' },
        { time: '17:00', title: 'Ödül töreni', description: 'Sonuçların açıklanması ve kapanış.', type: 'awards' },
      ],
    },
  ],

  people: {
    jury: [
      { name: 'Jüri Üyesi Bir', title: 'Unvan yakında', photo: null },
      { name: 'Jüri Üyesi İki', title: 'Unvan yakında', photo: null },
      { name: 'Jüri Üyesi Üç', title: 'Unvan yakında', photo: null },
    ],
    mentors: [
      { name: 'Mentor Bir', title: 'Unvan yakında', photo: null },
      { name: 'Mentor İki', title: 'Unvan yakında', photo: null },
    ],
  },

  sponsors: [
    { name: 'Ana Sponsor', tier: 'main', logo: null, url: null },
    { name: 'Destek Sponsor 1', tier: 'support', logo: null, url: null },
    { name: 'Destek Sponsor 2', tier: 'support', logo: null, url: null },
  ],

  socials: [
    { label: 'Instagram', url: 'https://www.instagram.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
    { label: 'X', url: 'https://x.com/' },
  ],
}
```

- [ ] **Step 4: Geçtiğini doğrula**

```bash
npm test -- src/data/event.test.js
```
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/data
git commit -m "feat: etkinlik verisi (placeholder) ve şema testi"
```

---

### Task 3: Marka stilleri, Layout, Navbar, Footer, sabit CTA, 404

**Files:**
- Create: `web/src/styles/tokens.css`, `fonts.css`, `base.css`
- Create: `web/src/components/Button.jsx`, `Button.css`, `SectionHeading.jsx`, `SectionHeading.css`
- Create: `web/src/components/Navbar.jsx`, `Navbar.css`, `Footer.jsx`, `Footer.css`, `StickyCta.jsx`, `StickyCta.css`, `Layout.jsx`, `Layout.css`
- Create: `web/src/pages/NotFound.jsx`
- Modify: `web/src/main.jsx`, `web/src/App.jsx`, `web/src/App.test.jsx`
- Test: `web/src/components/Navbar.test.jsx`, `web/src/components/Layout.test.jsx`

**Interfaces:**
- Consumes: `event.organizer`, `event.socials` (Görev 2).
- Produces:
  - `Button({ to?, href?, variant = 'primary' | 'secondary' | 'ghost', children, ...rest })`: `to` varsa `<Link>`, `href` varsa `<a>`, yoksa `<button type="button">`; `rest` içindeki `type` varsayılanı ezer.
  - `SectionHeading({ eyebrow?, title, children? })`: eyebrow Mono, başlık `h2`.
  - `Layout`: `<Outlet />` saran kabuk; `<main id="main">` içerir.
  - CSS yardımcıları (`base.css`): `.container`, `.visually-hidden`, `.tone--blue|green|yellow|red` (`--tone`, `--tone-pastel` tanımlar).

- [ ] **Step 1: Başarısız testleri yaz**

`web/src/components/Navbar.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Navbar from './Navbar.jsx'

function renderNav() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  )
}

describe('Navbar', () => {
  it('marka adını ve sayfa bağlantılarını gösterir', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /GDG On Campus PAU/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Program' })).toHaveAttribute('href', '/program')
    expect(screen.getByRole('link', { name: 'Ekip' })).toHaveAttribute('href', '/ekip')
    expect(screen.getByRole('link', { name: 'Kayıt Ol' })).toHaveAttribute('href', '/kayit')
  })

  it('menü düğmesi aria-expanded değerini değiştirir ve bağlantıya tıklayınca kapanır', async () => {
    const user = userEvent.setup()
    renderNav()
    const toggle = screen.getByRole('button', { name: 'Menü' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Program' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
```

`web/src/components/Layout.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Layout from './Layout.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>içerik</p>} />
          <Route path="kayit" element={<p>form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it('içeriği main içinde gösterir', () => {
    renderAt('/')
    expect(screen.getByRole('main')).toHaveTextContent('içerik')
  })

  it('sabit CTA ana sayfada vardır (navbar + sabit çubuk)', () => {
    renderAt('/')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(2)
  })

  it('sabit CTA /kayit sayfasında yoktur', () => {
    renderAt('/kayit')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(1)
  })
})
```

`web/src/App.test.jsx` (tamamını değiştir):

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

const paths = ['/', '/kayit', '/program', '/ekip']

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App rotaları', () => {
  it.each(paths)('%s rotası tam bir h1 render eder', (path) => {
    renderAt(path)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('bilinmeyen rota 404 sayfası gösterir', () => {
    renderAt('/yok-boyle-bir-sayfa')
    expect(screen.getByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Başarısız olduklarını doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test
```
Expected: FAIL, `Navbar.jsx`, `Layout.jsx` yok; 404 testi başarısız.

- [ ] **Step 3: Stil temellerini yaz**

`web/src/styles/tokens.css`:

```css
:root {
  --blue: #4285f4;
  --green: #34a853;
  --yellow: #f9ab00;
  --red: #ea4335;

  --blue-half: #57caff;
  --green-half: #5cdb6d;
  --yellow-half: #ffd427;
  --red-half: #ff7daf;

  --blue-pastel: #c3ecf6;
  --green-pastel: #ccf6c5;
  --yellow-pastel: #ffe7a5;
  --red-pastel: #f8d8d8;

  --off-white: #f0f0f0;
  --black: #1e1e1e;
  --white: #ffffff;

  --font-sans: 'Google Sans', 'Google Sans Text', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Google Sans Mono', 'Google Sans Code', ui-monospace, 'SF Mono', Menlo, monospace;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 28px;
  --radius-pill: 999px;

  --container: 1120px;
  --gutter: 16px;
  --nav-h: 64px;
}
```

`web/src/styles/fonts.css`:

```css
/* Font dosyaları public/fonts/ içine konmalı (README'ye bak). Yoksa fallback fontlar kullanılır. */
@font-face {
  font-family: 'Google Sans';
  src: local('Google Sans'), url('/fonts/GoogleSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Google Sans';
  src: local('Google Sans Bold'), url('/fonts/GoogleSans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Google Sans Mono';
  src: local('Google Sans Mono'), url('/fonts/GoogleSansMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Google Sans Mono';
  src: local('Google Sans Mono Bold'), url('/fonts/GoogleSansMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

`web/src/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--black);
  background: var(--white);
  overflow-x: hidden;
}

img,
svg {
  display: block;
  max-width: 100%;
}

h1,
h2,
h3,
p,
ol,
ul,
dl,
dd {
  margin: 0;
}

h1,
h2,
h3 {
  line-height: 1.1;
}

ol,
ul {
  padding: 0;
  list-style: none;
}

a {
  color: inherit;
}

:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 3px;
}

.container {
  width: min(100% - 2 * var(--gutter), var(--container));
  margin-inline: auto;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: 8px;
  top: -64px;
  z-index: 100;
  padding: 12px 16px;
  background: var(--black);
  color: var(--white);
  border-radius: var(--radius-sm);
}
.skip-link:focus {
  top: 8px;
}

.tone--blue {
  --tone: var(--blue);
  --tone-pastel: var(--blue-pastel);
}
.tone--green {
  --tone: var(--green);
  --tone-pastel: var(--green-pastel);
}
.tone--yellow {
  --tone: var(--yellow);
  --tone-pastel: var(--yellow-pastel);
}
.tone--red {
  --tone: var(--red);
  --tone-pastel: var(--red-pastel);
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 4: `Button` ve `SectionHeading` yaz**

`web/src/components/Button.jsx`:

```jsx
import { Link } from 'react-router-dom'
import './Button.css'

export default function Button({ to, href, variant = 'primary', children, ...rest }) {
  const className = `btn btn--${variant}`
  if (to) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  )
}
```

`web/src/components/Button.css`:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 24px;
  border: 2px solid var(--black);
  border-radius: var(--radius-pill);
  font: 700 1rem/1 var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition: border-radius 0.2s ease, transform 0.2s ease;
}

.btn:hover {
  border-radius: var(--radius-sm);
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn--primary {
  background: var(--yellow);
  color: var(--black);
}

.btn--secondary {
  background: var(--black);
  color: var(--white);
}

.btn--ghost {
  background: transparent;
  color: var(--black);
}
```

`web/src/components/SectionHeading.jsx`:

```jsx
import './SectionHeading.css'

export default function SectionHeading({ eyebrow, title, children }) {
  return (
    <header className="section-heading">
      {eyebrow && <p className="section-heading__eyebrow">{eyebrow}</p>}
      <h2 className="section-heading__title">{title}</h2>
      {children && <p className="section-heading__text">{children}</p>}
    </header>
  )
}
```

`web/src/components/SectionHeading.css`:

```css
.section-heading {
  margin-bottom: 32px;
  max-width: 640px;
}

.section-heading__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.section-heading__title {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 700;
}

.section-heading__text {
  margin-top: 12px;
}
```

- [ ] **Step 5: Navbar, Footer, StickyCta, Layout, NotFound yaz**

`web/src/components/Navbar.jsx`:

```jsx
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Button from './Button.jsx'
import { event } from '../data/event.js'
import './Navbar.css'

const links = [
  { to: '/', label: 'Ana Sayfa', end: true },
  { to: '/program', label: 'Program' },
  { to: '/ekip', label: 'Ekip' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand" onClick={close}>
          <span className="navbar__dots" aria-hidden="true">
            <i className="tone--blue" />
            <i className="tone--red" />
            <i className="tone--yellow" />
            <i className="tone--green" />
          </span>
          {event.organizer}
        </Link>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="visually-hidden">Menü</span>
          <span className="navbar__bars" aria-hidden="true" />
        </button>

        <nav id="nav-menu" className={`navbar__menu${open ? ' is-open' : ''}`} aria-label="Ana menü">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="navbar__link" onClick={close}>
              {l.label}
            </NavLink>
          ))}
          <Button to="/kayit" onClick={close}>
            Kayıt Ol
          </Button>
        </nav>
      </div>
    </header>
  )
}
```

`web/src/components/Navbar.css`:

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--white);
  border-bottom: 1px solid var(--off-white);
}

.navbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--nav-h);
  gap: 16px;
}

.navbar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  text-decoration: none;
}

.navbar__dots {
  display: flex;
  gap: 3px;
}

.navbar__dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tone);
}

.navbar__menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar__link {
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  font-weight: 500;
  text-decoration: none;
}

.navbar__link:hover {
  background: var(--off-white);
}

.navbar__link.active {
  background: var(--yellow-pastel);
}

.navbar__toggle {
  display: none;
  width: 48px;
  height: 48px;
  border: 0;
  background: transparent;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.navbar__bars,
.navbar__bars::before,
.navbar__bars::after {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--black);
  content: '';
}

.navbar__bars {
  position: relative;
}
.navbar__bars::before {
  position: absolute;
  top: -7px;
}
.navbar__bars::after {
  position: absolute;
  top: 7px;
}

@media (max-width: 767px) {
  .navbar__toggle {
    display: inline-flex;
  }

  .navbar__menu {
    position: absolute;
    top: var(--nav-h);
    left: 0;
    right: 0;
    display: none;
    flex-direction: column;
    align-items: stretch;
    padding: 16px var(--gutter) 24px;
    background: var(--white);
    border-bottom: 1px solid var(--off-white);
  }

  .navbar__menu.is-open {
    display: flex;
  }

  .navbar__link {
    padding: 14px 16px;
  }
}
```

`web/src/components/Footer.jsx`:

```jsx
import { event } from '../data/event.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <p className="footer__name">{event.organizer}</p>
        <ul className="footer__socials">
          {event.socials.map((s) => (
            <li key={s.label}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="footer__copy">
          © {new Date().getFullYear()} {event.organizer}
        </p>
      </div>
    </footer>
  )
}
```

`web/src/components/Footer.css`:

```css
.footer {
  margin-top: 64px;
  padding: 32px 0;
  background: var(--black);
  color: var(--white);
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.footer__name {
  font-weight: 700;
}

.footer__socials {
  display: flex;
  gap: 20px;
  font-family: var(--font-mono);
}

.footer__copy {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}
```

`web/src/components/StickyCta.jsx`:

```jsx
import { useLocation } from 'react-router-dom'
import Button from './Button.jsx'
import './StickyCta.css'

export default function StickyCta() {
  const { pathname } = useLocation()
  if (pathname === '/kayit') return null
  return (
    <div className="sticky-cta">
      <Button to="/kayit">Kayıt Ol</Button>
    </div>
  )
}
```

`web/src/components/StickyCta.css`:

```css
.sticky-cta {
  display: none;
}

@media (max-width: 767px) {
  .sticky-cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    padding: 12px var(--gutter);
    background: var(--white);
    border-top: 1px solid var(--off-white);
  }

  .sticky-cta .btn {
    width: 100%;
  }
}
```

`web/src/components/Layout.jsx`:

```jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import StickyCta from './StickyCta.jsx'
import './Layout.css'

export default function Layout() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Navbar />
      <main id="main" className="app__main">
        <Outlet />
      </main>
      <Footer />
      <StickyCta />
    </div>
  )
}
```

`web/src/components/Layout.css`:

```css
.app__main {
  min-height: 60vh;
}

@media (max-width: 767px) {
  .app {
    padding-bottom: 76px;
  }
}
```

`web/src/pages/NotFound.jsx`:

```jsx
import Button from '../components/Button.jsx'

export default function NotFound() {
  return (
    <section className="container" style={{ padding: '96px 0', textAlign: 'center' }}>
      <h1>Sayfa bulunamadı</h1>
      <p style={{ margin: '16px 0 32px' }}>Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
      <Button to="/">Ana sayfaya dön</Button>
    </section>
  )
}
```

- [ ] **Step 6: `App.jsx` ve `main.jsx`'i güncelle**

`web/src/App.jsx` (tamamını değiştir):

```jsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Register from './pages/Register.jsx'
import Schedule from './pages/Schedule.jsx'
import Team from './pages/Team.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="kayit" element={<Register />} />
        <Route path="program" element={<Schedule />} />
        <Route path="ekip" element={<Team />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
```

`web/src/main.jsx` içine stil import'larını ekle (diğer import'lardan sonra):

```jsx
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'
```

- [ ] **Step 7: Geçtiğini doğrula**

```bash
npm test && npm run build
```
Expected: tüm testler PASS; build başarılı (font dosyaları yok uyarısı olabilir, sorun değil).

- [ ] **Step 8: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web
git commit -m "feat: marka tokenları, Layout, Navbar, Footer, sabit CTA ve 404"
```

---

### Task 4: Geri sayım (`Countdown`)

**Files:**
- Create: `web/src/components/Countdown.jsx`, `Countdown.css`
- Test: `web/src/components/Countdown.test.jsx`

**Interfaces:**
- Produces:
  - `getTimeLeft(startsAt: string, now?: number): { status: 'invalid' } | { status: 'started' } | { status: 'counting', days, hours, minutes, seconds }` (named export, saf fonksiyon)
  - `Countdown({ startsAt })` (default export)

- [ ] **Step 1: Başarısız testi yaz**

`web/src/components/Countdown.test.jsx`:

```jsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import Countdown, { getTimeLeft } from './Countdown.jsx'

afterEach(() => vi.useRealTimers())

describe('getTimeLeft', () => {
  const base = new Date('2026-12-01T00:00:00Z').getTime()

  it('kalan süreyi gün/saat/dakika/saniyeye böler', () => {
    const startsAt = '2026-12-02T02:03:04Z'
    expect(getTimeLeft(startsAt, base)).toEqual({
      status: 'counting',
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
    })
  })

  it('tarih geçmişse started döner', () => {
    expect(getTimeLeft('2026-11-30T00:00:00Z', base)).toEqual({ status: 'started' })
  })

  it('tam şu an started döner', () => {
    expect(getTimeLeft('2026-12-01T00:00:00Z', base)).toEqual({ status: 'started' })
  })

  it('bozuk tarihte invalid döner', () => {
    expect(getTimeLeft('bozuk-tarih', base)).toEqual({ status: 'invalid' })
    expect(getTimeLeft(undefined, base)).toEqual({ status: 'invalid' })
  })
})

describe('Countdown', () => {
  it('değerleri iki haneli gösterir ve her saniye günceller', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'))
    render(<Countdown startsAt="2026-12-02T02:03:04Z" />)
    expect(screen.getByTestId('countdown-days')).toHaveTextContent('01')
    expect(screen.getByTestId('countdown-hours')).toHaveTextContent('02')
    expect(screen.getByTestId('countdown-minutes')).toHaveTextContent('03')
    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('04')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('03')
  })

  it('geçmiş tarihte "Başladı!" gösterir, NaN göstermez', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'))
    render(<Countdown startsAt="2026-01-01T00:00:00Z" />)
    expect(screen.getByText('Başladı!')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('NaN')
  })

  it('bozuk tarihte yedek metin gösterir, NaN göstermez', () => {
    render(<Countdown startsAt="bozuk" />)
    expect(screen.getByText('Tarih yakında açıklanacak')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('NaN')
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/components/Countdown.test.jsx
```
Expected: FAIL, `Countdown.jsx` yok.

- [ ] **Step 3: Uygula**

`web/src/components/Countdown.jsx`:

```jsx
import { useEffect, useState } from 'react'
import './Countdown.css'

export function getTimeLeft(startsAt, now = Date.now()) {
  const target = new Date(startsAt).getTime()
  if (Number.isNaN(target)) return { status: 'invalid' }
  const diff = target - now
  if (diff <= 0) return { status: 'started' }
  const total = Math.floor(diff / 1000)
  return {
    status: 'counting',
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const pad = (n) => String(n).padStart(2, '0')

const UNITS = [
  ['days', 'gün'],
  ['hours', 'saat'],
  ['minutes', 'dakika'],
  ['seconds', 'saniye'],
]

export default function Countdown({ startsAt }) {
  const [now, setNow] = useState(() => Date.now())
  const left = getTimeLeft(startsAt, now)

  useEffect(() => {
    if (left.status !== 'counting') return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [left.status])

  if (left.status === 'invalid') {
    return <p className="countdown countdown--text">Tarih yakında açıklanacak</p>
  }
  if (left.status === 'started') {
    return <p className="countdown countdown--text">Başladı!</p>
  }

  return (
    <div className="countdown" role="timer" aria-label="Etkinliğe kalan süre">
      {UNITS.map(([key, label]) => (
        <div className="countdown__unit" key={key}>
          <span className="countdown__value" data-testid={`countdown-${key}`}>
            {pad(left[key])}
          </span>
          <span className="countdown__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
```

`web/src/components/Countdown.css`:

```css
.countdown {
  display: flex;
  gap: 12px;
  font-family: var(--font-mono);
}

.countdown--text {
  font-size: 1.25rem;
  font-weight: 700;
}

.countdown__unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
  padding: 10px 8px;
  border: 2px solid var(--black);
  border-radius: var(--radius-md);
  background: var(--white);
}

.countdown__value {
  font-size: clamp(1.5rem, 6vw, 2.25rem);
  font-weight: 700;
  line-height: 1;
}

.countdown__label {
  margin-top: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

- [ ] **Step 4: Geçtiğini doğrula**

```bash
npm test -- src/components/Countdown.test.jsx
```
Expected: 7 test PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/components/Countdown.*
git commit -m "feat: geri sayım bileşeni ve süre hesabı"
```

---

### Task 5: Hero görselleri: `HeroShapes`, `Marquee`, `Reveal`

**Files:**
- Create: `web/src/hooks/useParallax.js`, `web/src/hooks/useReveal.js`
- Create: `web/src/components/HeroShapes.jsx`, `HeroShapes.css`, `Marquee.jsx`, `Marquee.css`, `Reveal.jsx`, `Reveal.css`
- Test: `web/src/components/Visuals.test.jsx`

**Interfaces:**
- Produces:
  - `useParallax(ref)`: `ref.current.parentElement` üzerindeki `pointermove`'u dinler, `ref.current`'a `--px`/`--py` (-1..1) yazar; reduced-motion'da hiçbir şey yapmaz.
  - `useReveal(): [ref, visible: boolean]`: `IntersectionObserver` yoksa veya reduced-motion varsa `visible` baştan `true`.
  - `HeroShapes()`: 4 `<g data-shape="circle|square|triangle|half">` içeren dekoratif `<svg aria-hidden>`; kapsayıcı `.hero-shapes` olarak, kendi üst öğesinin içine `position:absolute` yerleşir.
  - `Marquee({ items: string[] })`
  - `Reveal({ children, className? })`

- [ ] **Step 1: Başarısız testi yaz**

`web/src/components/Visuals.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroShapes from './HeroShapes.jsx'
import Marquee from './Marquee.jsx'
import Reveal from './Reveal.jsx'

describe('HeroShapes', () => {
  it('4 marka şeklini dekoratif olarak render eder', () => {
    const { container } = render(
      <section>
        <HeroShapes />
      </section>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const shapes = [...container.querySelectorAll('[data-shape]')].map((n) => n.dataset.shape)
    expect(shapes).toEqual(['circle', 'square', 'triangle', 'half'])
  })
})

describe('Marquee', () => {
  it('öğeleri iki kez (kesintisiz döngü için) ve ekran okuyucudan gizli render eder', () => {
    const { container } = render(<Marquee items={['Kodla', 'Tasarla']} />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByText('Kodla', { ignore: 'none' })).toHaveLength(2)
    expect(screen.getAllByText('Tasarla', { ignore: 'none' })).toHaveLength(2)
  })

  it('boş listede hiçbir şey render etmez', () => {
    const { container } = render(<Marquee items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Reveal', () => {
  it('IntersectionObserver yokken içeriği hemen görünür yapar', () => {
    const { container } = render(
      <Reveal>
        <p>kart</p>
      </Reveal>,
    )
    expect(screen.getByText('kart')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('is-visible')
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/components/Visuals.test.jsx
```
Expected: FAIL, modüller yok.

- [ ] **Step 3: Hook'ları yaz**

`web/src/hooks/useParallax.js`:

```js
import { useEffect } from 'react'

export function useParallax(ref) {
  useEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!el || !host) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frame = 0
    const onMove = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        el.style.setProperty('--px', (x * 2).toFixed(3))
        el.style.setProperty('--py', (y * 2).toFixed(3))
      })
    }

    host.addEventListener('pointermove', onMove)
    return () => {
      host.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
```

`web/src/hooks/useReveal.js`:

```js
import { useEffect, useRef, useState } from 'react'

function shouldShowImmediately() {
  return (
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(shouldShowImmediately)

  useEffect(() => {
    if (visible) return undefined
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return [ref, visible]
}
```

- [ ] **Step 4: Bileşenleri yaz**

`web/src/components/HeroShapes.jsx`:

```jsx
import { useRef } from 'react'
import { useParallax } from '../hooks/useParallax.js'
import './HeroShapes.css'

export default function HeroShapes() {
  const ref = useRef(null)
  useParallax(ref)

  return (
    <div className="hero-shapes" ref={ref}>
      <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <g className="shape" data-shape="circle" style={{ '--depth': 1.2 }}>
          <g className="shape__drift" style={{ '--dx': '18px', '--dy': '-24px', '--rot': '0deg', '--dur': '11s' }}>
            <circle cx="170" cy="170" r="110" fill="var(--blue)" />
          </g>
        </g>
        <g className="shape" data-shape="square" style={{ '--depth': 0.8 }}>
          <g className="shape__drift" style={{ '--dx': '-20px', '--dy': '16px', '--rot': '16deg', '--dur': '13s' }}>
            <rect x="370" y="90" width="150" height="150" fill="var(--red)" />
          </g>
        </g>
        <g className="shape" data-shape="triangle" style={{ '--depth': 1.5 }}>
          <g className="shape__drift" style={{ '--dx': '22px', '--dy': '-14px', '--rot': '-10deg', '--dur': '15s' }}>
            <polygon points="110,540 250,310 390,540" fill="var(--yellow)" />
          </g>
        </g>
        <g className="shape" data-shape="half" style={{ '--depth': 1 }}>
          <g className="shape__drift" style={{ '--dx': '-16px', '--dy': '-20px', '--rot': '8deg', '--dur': '12s' }}>
            <path d="M 390 480 A 100 100 0 0 1 590 480 Z" fill="var(--green)" />
          </g>
        </g>
      </svg>
    </div>
  )
}
```

`web/src/components/HeroShapes.css`:

```css
.hero-shapes {
  --px: 0;
  --py: 0;
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.hero-shapes svg {
  position: absolute;
  top: 50%;
  right: -120px;
  width: min(120vw, 600px);
  height: auto;
  opacity: 0.3;
  transform: translateY(-50%);
}

@media (min-width: 768px) {
  .hero-shapes svg {
    right: 2%;
    width: min(52vw, 620px);
    opacity: 1;
  }
}

.shape {
  transform: translate(calc(var(--px) * var(--depth) * 22px), calc(var(--py) * var(--depth) * 22px));
  transition: transform 0.25s ease-out;
}

.shape__drift {
  transform-box: fill-box;
  transform-origin: center;
  animation: shape-drift var(--dur, 12s) ease-in-out infinite alternate;
}

@keyframes shape-drift {
  from {
    transform: translate(0, 0) rotate(0deg);
  }
  to {
    transform: translate(var(--dx, 18px), var(--dy, -22px)) rotate(var(--rot, 12deg));
  }
}
```

`web/src/components/Marquee.jsx`:

```jsx
import './Marquee.css'

const DOT_TONES = ['blue', 'red', 'yellow', 'green']

export default function Marquee({ items }) {
  if (!items || items.length === 0) return null

  const group = (copy) => (
    <ul className="marquee__group" key={copy}>
      {items.map((text, i) => (
        <li key={`${copy}-${text}-${i}`} className="marquee__item">
          <span className={`marquee__dot tone--${DOT_TONES[i % DOT_TONES.length]}`} />
          {text}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {group('a')}
        {group('b')}
      </div>
    </div>
  )
}
```

`web/src/components/Marquee.css`:

```css
.marquee {
  overflow: hidden;
  background: var(--black);
  color: var(--white);
  padding: 14px 0;
}

.marquee__track {
  display: flex;
  width: max-content;
  animation: marquee-scroll 30s linear infinite;
}

.marquee__group {
  display: flex;
  flex-shrink: 0;
}

.marquee__item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-right: 32px;
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.marquee__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--tone);
}

@keyframes marquee-scroll {
  to {
    transform: translateX(-50%);
  }
}
```

`web/src/components/Reveal.jsx`:

```jsx
import { useReveal } from '../hooks/useReveal.js'
import './Reveal.css'

export default function Reveal({ children, className = '' }) {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
```

`web/src/components/Reveal.css`:

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal.is-visible {
  opacity: 1;
  transform: none;
}
```

- [ ] **Step 5: Geçtiğini doğrula**

```bash
npm test -- src/components/Visuals.test.jsx
```
Expected: 4 test PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/hooks web/src/components/HeroShapes.* web/src/components/Marquee.* web/src/components/Reveal.* web/src/components/Visuals.test.jsx
git commit -m "feat: hero geometrisi, marquee ve scroll reveal"
```

---

### Task 6: Ekip sayfası (`PersonCard`, `SponsorGrid`, `Team`)

**Files:**
- Create: `web/src/components/PersonCard.jsx`, `PersonCard.css`, `SponsorGrid.jsx`, `SponsorGrid.css`
- Modify: `web/src/pages/Team.jsx` (tamamen yeniden yaz)
- Create: `web/src/pages/Team.css`
- Test: `web/src/pages/Team.test.jsx`

**Interfaces:**
- Consumes: `event.people`, `event.sponsors` (Görev 2); `SectionHeading` (Görev 3).
- Produces:
  - `initials(name: string): string`: ilk iki kelimenin baş harfleri, `tr-TR` büyük harf; boş isimde `'?'` (named export, `PersonCard.jsx` içinde)
  - `PersonCard({ person, tone })`, `SponsorGrid({ sponsors, compact? })`
  - `Team({ data = event })`: `data.people` ve `data.sponsors` okur.

- [ ] **Step 1: Başarısız testi yaz**

`web/src/pages/Team.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Team from './Team.jsx'
import { initials } from '../components/PersonCard.jsx'
import { event } from '../data/event.js'

const renderTeam = (data) =>
  render(
    <MemoryRouter>
      <Team data={data} />
    </MemoryRouter>,
  )

describe('initials', () => {
  it('Türkçe büyük harf kuralını uygular', () => {
    expect(initials('ayşe yılmaz')).toBe('AY')
    expect(initials('ilker şahin')).toBe('İŞ')
  })

  it('tek kelime ve boş isimle çökmez', () => {
    expect(initials('Mentor')).toBe('M')
    expect(initials('   ')).toBe('?')
  })
})

describe('Team sayfası', () => {
  it('jüri, mentor ve sponsor bölümlerini gösterir', () => {
    renderTeam(event)
    expect(screen.getByRole('heading', { level: 2, name: 'Jüri' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Mentorlar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Sponsorlar' })).toBeInTheDocument()
    expect(screen.getByText('Jüri Üyesi Bir')).toBeInTheDocument()
  })

  it('logosu olmayan sponsorun adını metin olarak gösterir', () => {
    renderTeam(event)
    expect(screen.getByText('Ana Sponsor')).toBeInTheDocument()
  })

  it('boş koleksiyonlarda boş başlık göstermez, yedek metin gösterir', () => {
    renderTeam({ people: { jury: [], mentors: [] }, sponsors: [] })
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.getByText(/yakında açıklanacak/i)).toBeInTheDocument()
  })

  it('yalnızca dolu bölümü gösterir', () => {
    renderTeam({ people: { jury: [{ name: 'A B', title: 'T', photo: null }], mentors: [] }, sponsors: [] })
    expect(screen.getByRole('heading', { level: 2, name: 'Jüri' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Mentorlar' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/pages/Team.test.jsx
```
Expected: FAIL.

- [ ] **Step 3: Bileşenleri yaz**

`web/src/components/PersonCard.jsx`:

```jsx
import './PersonCard.css'

export function initials(name) {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr-TR'))
    .join('')
  return letters || '?'
}

export default function PersonCard({ person, tone = 'blue' }) {
  return (
    <article className={`person tone--${tone}`}>
      <div className="person__avatar">
        {person.photo ? (
          <img src={person.photo} alt="" />
        ) : (
          <span aria-hidden="true">{initials(person.name)}</span>
        )}
      </div>
      <h3 className="person__name">{person.name}</h3>
      <p className="person__title">{person.title}</p>
    </article>
  )
}
```

`web/src/components/PersonCard.css`:

```css
.person {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  text-align: center;
  background: var(--tone-pastel);
  border-radius: var(--radius-lg);
}

.person__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--tone);
  color: var(--black);
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 700;
}

.person__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.person__name {
  margin-top: 16px;
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
}

.person__title {
  font-size: 0.9375rem;
}
```

`web/src/components/SponsorGrid.jsx`:

```jsx
import './SponsorGrid.css'

function SponsorItem({ sponsor }) {
  const content = sponsor.logo ? (
    <img src={sponsor.logo} alt={sponsor.name} />
  ) : (
    <span>{sponsor.name}</span>
  )
  const className = `sponsor sponsor--${sponsor.tier}`
  if (sponsor.url) {
    return (
      <a className={className} href={sponsor.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }
  return <div className={className}>{content}</div>
}

export default function SponsorGrid({ sponsors, compact = false }) {
  if (!sponsors || sponsors.length === 0) return null
  const ordered = [...sponsors].sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'main' ? -1 : 1))
  return (
    <ul className={`sponsor-grid${compact ? ' sponsor-grid--compact' : ''}`}>
      {ordered.map((s) => (
        <li key={s.name}>
          <SponsorItem sponsor={s} />
        </li>
      ))}
    </ul>
  )
}
```

`web/src/components/SponsorGrid.css`:

```css
.sponsor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.sponsor {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 16px;
  border: 2px solid var(--black);
  border-radius: var(--radius-md);
  background: var(--white);
  font-family: var(--font-mono);
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.sponsor--main {
  min-height: 128px;
  background: var(--yellow-pastel);
}

.sponsor img {
  max-height: 64px;
  object-fit: contain;
}

.sponsor-grid--compact .sponsor {
  min-height: 72px;
}
```

- [ ] **Step 4: `Team` sayfasını yaz**

`web/src/pages/Team.jsx`:

```jsx
import PersonCard from '../components/PersonCard.jsx'
import SponsorGrid from '../components/SponsorGrid.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import Reveal from '../components/Reveal.jsx'
import { event } from '../data/event.js'
import './Team.css'

const TONES = ['blue', 'red', 'yellow', 'green']

function PeopleSection({ title, eyebrow, people }) {
  if (!people || people.length === 0) return null
  return (
    <section className="team__section">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="team__grid">
        {people.map((p, i) => (
          <Reveal key={p.name}>
            <PersonCard person={p} tone={TONES[i % TONES.length]} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export default function Team({ data = event }) {
  const jury = data.people?.jury ?? []
  const mentors = data.people?.mentors ?? []
  const sponsors = data.sponsors ?? []
  const empty = jury.length === 0 && mentors.length === 0 && sponsors.length === 0

  return (
    <div className="team container">
      <h1 className="team__title">Ekip</h1>
      {empty && <p>Jüri, mentor ve sponsor bilgileri yakında açıklanacak.</p>}
      <PeopleSection eyebrow="Değerlendirenler" title="Jüri" people={jury} />
      <PeopleSection eyebrow="Yanında olanlar" title="Mentorlar" people={mentors} />
      {sponsors.length > 0 && (
        <section className="team__section">
          <SectionHeading eyebrow="Bize güvenenler" title="Sponsorlar" />
          <SponsorGrid sponsors={sponsors} />
        </section>
      )}
    </div>
  )
}
```

`web/src/pages/Team.css`:

```css
.team {
  padding: 48px 0 0;
}

.team__title {
  margin-bottom: 40px;
  font-size: clamp(2.25rem, 8vw, 4rem);
}

.team__section {
  margin-bottom: 56px;
}

.team__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

- [ ] **Step 5: Geçtiğini doğrula**

```bash
npm test
```
Expected: tüm testler PASS (App rotası testi dahil: `Team` hâlâ tek `h1`).

- [ ] **Step 6: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/components/PersonCard.* web/src/components/SponsorGrid.* web/src/pages/Team.*
git commit -m "feat: Ekip sayfası (jüri, mentor, sponsor)"
```

---

### Task 7: Ana sayfa

**Files:**
- Modify: `web/src/pages/Home.jsx` (tamamen yeniden yaz)
- Create: `web/src/pages/Home.css`
- Test: `web/src/pages/Home.test.jsx`

**Interfaces:**
- Consumes: `event` (Görev 2); `Button`, `SectionHeading` (Görev 3); `Countdown` (Görev 4); `HeroShapes`, `Marquee`, `Reveal` (Görev 5); `SponsorGrid` (Görev 6).
- Produces: `Home({ data = event })`.

- [ ] **Step 1: Başarısız testi yaz**

`web/src/pages/Home.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Home from './Home.jsx'
import { event } from '../data/event.js'

const renderHome = (data) =>
  render(
    <MemoryRouter>
      <Home data={data} />
    </MemoryRouter>,
  )

describe('Home', () => {
  it('etkinlik adını h1 olarak gösterir', () => {
    renderHome(event)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(event.organizer)
    expect(h1).toHaveTextContent(event.name)
  })

  it('kayıt ve program CTA bağlantılarını içerir', () => {
    renderHome(event)
    // Hero ve kapanış bölümünde iki "Kayıt Ol" CTA'sı vardır; ikisi de /kayit'e gitmeli.
    const signUps = screen.getAllByRole('link', { name: 'Kayıt Ol' })
    expect(signUps).toHaveLength(2)
    signUps.forEach((link) => expect(link).toHaveAttribute('href', '/kayit'))
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })

  it('3 ödül kartı gösterir', () => {
    renderHome(event)
    event.prizes.forEach((p) => {
      expect(screen.getByRole('heading', { level: 3, name: p.title })).toBeInTheDocument()
    })
  })

  it('sponsor yokken sponsor bölümünü göstermez', () => {
    renderHome({ ...event, sponsors: [] })
    expect(screen.queryByRole('heading', { name: 'Sponsorlarımız' })).not.toBeInTheDocument()
  })

  it('bozuk tarihle çökmez', () => {
    renderHome({ ...event, startsAt: 'bozuk' })
    expect(screen.getByText('Tarih yakında açıklanacak')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/pages/Home.test.jsx
```
Expected: FAIL.

- [ ] **Step 3: Ana sayfayı yaz**

`web/src/pages/Home.jsx`:

```jsx
import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Countdown from '../components/Countdown.jsx'
import HeroShapes from '../components/HeroShapes.jsx'
import Marquee from '../components/Marquee.jsx'
import Reveal from '../components/Reveal.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SponsorGrid from '../components/SponsorGrid.jsx'
import { event } from '../data/event.js'
import './Home.css'

export default function Home({ data = event }) {
  const about = data.about ?? []
  const prizes = data.prizes ?? []
  const sponsors = data.sponsors ?? []

  return (
    <>
      <section className="hero">
        <HeroShapes />
        <div className="hero__content container">
          <p className="hero__eyebrow">{data.theme}</p>
          <h1 className="hero__title">
            <span className="hero__light">{data.organizer}</span> <strong>{data.name}</strong>
          </h1>
          <p className="hero__tagline">{data.tagline}</p>
          <Countdown startsAt={data.startsAt} />
          <p className="hero__meta">{data.location}</p>
          <div className="hero__actions">
            <Button to="/kayit">Kayıt Ol</Button>
            <Button to="/program" variant="ghost">
              Programı Gör
            </Button>
          </div>
        </div>
      </section>

      <Marquee items={data.marquee} />

      {about.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Tanıtım" title="Neden katılmalısın?" />
          <div className="home-grid">
            {about.map((card) => (
              <Reveal key={card.title}>
                <article className={`home-card tone--${card.color}`}>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {prizes.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Ödüller" title="Kazananları bekleyen ödüller" />
          <div className="home-grid">
            {prizes.map((prize) => (
              <Reveal key={prize.title}>
                <article className={`home-card home-card--prize tone--${prize.color}`}>
                  <span className="home-card__place">{prize.place}</span>
                  <h3>{prize.title}</h3>
                  <p>{prize.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {sponsors.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Destekçiler" title="Sponsorlarımız" />
          <SponsorGrid sponsors={sponsors} compact />
          <p className="home-section__more">
            <Link to="/ekip">Jüri, mentor ve tüm sponsorlar</Link>
          </p>
        </section>
      )}

      <section className="closing">
        <div className="closing__inner container">
          <h2>Takımını kur, yerini ayırt.</h2>
          <p>Kontenjan sınırlı. Kayıt yaklaşık 2 dakika sürer.</p>
          <Button to="/kayit" variant="secondary">
            Kayıt Ol
          </Button>
        </div>
      </section>
    </>
  )
}
```

`web/src/pages/Home.css`:

```css
.hero {
  position: relative;
  overflow: hidden;
  padding: 48px 0 64px;
  background: var(--off-white);
}

.hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
}

.hero__eyebrow {
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero__title {
  max-width: 14ch;
  font-size: clamp(2.5rem, 9vw, 5.5rem);
  font-weight: 400;
  letter-spacing: -0.02em;
}

.hero__title strong {
  display: block;
  font-weight: 700;
}

.hero__tagline {
  max-width: 36ch;
  font-size: clamp(1.125rem, 3vw, 1.5rem);
}

.hero__meta {
  font-family: var(--font-mono);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.home-section {
  padding: 64px 0 0;
}

.home-grid {
  display: grid;
  gap: 16px;
}

@media (min-width: 768px) {
  .hero {
    padding: 96px 0 112px;
  }
  .home-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.home-card {
  height: 100%;
  padding: 28px;
  border-radius: var(--radius-lg);
  background: var(--tone);
  color: var(--black);
}

.home-card h3 {
  margin-bottom: 8px;
  font-size: 1.5rem;
}

.home-card--prize {
  position: relative;
  padding-top: 64px;
}

.home-card__place {
  position: absolute;
  top: 16px;
  left: 24px;
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 700;
}

.home-section__more {
  margin-top: 20px;
  font-weight: 700;
}

.closing {
  margin-top: 80px;
  padding: 72px 0;
  background: var(--yellow);
  color: var(--black);
}

.closing__inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.closing h2 {
  font-size: clamp(2rem, 6vw, 3.5rem);
}
```

- [ ] **Step 4: Geçtiğini doğrula**

```bash
npm test
```
Expected: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/pages/Home.*
git commit -m "feat: ana sayfa (hero, tanıtım, ödül, sponsor, kapanış CTA)"
```

---

### Task 8: Program sayfası (`Timeline`, `Schedule`)

**Files:**
- Create: `web/src/components/Timeline.jsx`, `Timeline.css`
- Modify: `web/src/pages/Schedule.jsx` (tamamen yeniden yaz)
- Create: `web/src/pages/Schedule.css`
- Test: `web/src/pages/Schedule.test.jsx`

**Interfaces:**
- Consumes: `event.days`, `typeLabels` (Görev 2).
- Produces: `Timeline({ items })`; `Schedule({ data = event })`: `data.days` okur.

- [ ] **Step 1: Başarısız testi yaz**

`web/src/pages/Schedule.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Schedule from './Schedule.jsx'
import { event } from '../data/event.js'

describe('Schedule', () => {
  it('her gün için bir başlık ve program öğelerini gösterir', () => {
    render(<Schedule data={event} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(event.days.length)
    expect(screen.getByText('Açılış ve tanışma')).toBeInTheDocument()
    expect(screen.getByText('Ödül töreni')).toBeInTheDocument()
  })

  it('tür etiketini Türkçe gösterir', () => {
    render(<Schedule data={event} />)
    expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0)
  })

  it('ilk gün sekmesi seçili başlar ve sekme tıklaması seçimi değiştirir', async () => {
    const user = userEvent.setup()
    render(<Schedule data={event} />)
    const first = screen.getByRole('tab', { name: '1. Gün' })
    const second = screen.getByRole('tab', { name: '2. Gün' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveAttribute('aria-selected', 'false')
    await user.click(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
  })

  it('gün yokken yedek metin gösterir', () => {
    render(<Schedule data={{ days: [] }} />)
    expect(screen.getByText('Program yakında açıklanacak.')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/pages/Schedule.test.jsx
```
Expected: FAIL.

- [ ] **Step 3: Bileşenleri yaz**

`web/src/components/Timeline.jsx`:

```jsx
import { typeLabels } from '../data/event.js'
import './Timeline.css'

const typeTones = {
  opening: 'blue',
  workshop: 'green',
  coding: 'yellow',
  submission: 'red',
  jury: 'blue',
  awards: 'yellow',
}

export default function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li
          key={`${item.time}-${item.title}`}
          className={`timeline__item tone--${typeTones[item.type] ?? 'blue'}`}
        >
          <time className="timeline__time">{item.time}</time>
          <div className="timeline__body">
            <span className="timeline__tag">{typeLabels[item.type] ?? item.type}</span>
            <h3 className="timeline__title">{item.title}</h3>
            <p>{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
```

`web/src/components/Timeline.css`:

```css
.timeline {
  display: grid;
  gap: 16px;
  border-left: 3px solid var(--black);
  padding-left: 20px;
}

.timeline__item {
  display: grid;
  gap: 8px;
}

.timeline__time {
  font-family: var(--font-mono);
  font-size: 1.125rem;
  font-weight: 700;
}

.timeline__body {
  padding: 20px;
  border-radius: var(--radius-md);
  background: var(--tone-pastel);
}

.timeline__tag {
  display: inline-block;
  margin-bottom: 8px;
  padding: 2px 12px;
  border-radius: var(--radius-pill);
  background: var(--tone);
  color: var(--black);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
}

.timeline__title {
  font-size: 1.25rem;
}

@media (min-width: 768px) {
  .timeline__item {
    grid-template-columns: 96px 1fr;
    align-items: start;
  }
}
```

- [ ] **Step 4: `Schedule` sayfasını yaz**

`web/src/pages/Schedule.jsx`:

```jsx
import { useState } from 'react'
import Timeline from '../components/Timeline.jsx'
import { event } from '../data/event.js'
import './Schedule.css'

export default function Schedule({ data = event }) {
  const days = data.days ?? []
  const [active, setActive] = useState(0)

  return (
    <div className="schedule container">
      <h1 className="schedule__title">Program</h1>

      {days.length === 0 ? (
        <p>Program yakında açıklanacak.</p>
      ) : (
        <>
          <div className="schedule__tabs" role="tablist" aria-label="Günler">
            {days.map((day, i) => (
              <button
                key={day.label}
                type="button"
                role="tab"
                id={`tab-${i}`}
                aria-selected={i === active}
                aria-controls={`day-${i}`}
                className="schedule__tab"
                onClick={() => setActive(i)}
              >
                {day.label}
              </button>
            ))}
          </div>

          {days.map((day, i) => (
            <section
              key={day.label}
              id={`day-${i}`}
              role="tabpanel"
              aria-labelledby={`tab-${i}`}
              className={`schedule__day${i === active ? ' is-active' : ''}`}
            >
              <h2 className="schedule__day-title">
                {day.label} <span>{day.date}</span>
              </h2>
              <Timeline items={day.items} />
            </section>
          ))}
        </>
      )}
    </div>
  )
}
```

`web/src/pages/Schedule.css`:

```css
.schedule {
  padding: 48px 0 0;
}

.schedule__title {
  margin-bottom: 32px;
  font-size: clamp(2.25rem, 8vw, 4rem);
}

.schedule__tabs {
  display: none;
}

.schedule__day {
  margin-bottom: 48px;
}

.schedule__day-title {
  margin-bottom: 24px;
  font-size: clamp(1.5rem, 4vw, 2rem);
}

.schedule__day-title span {
  display: block;
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 400;
}

/* Masaüstünde gün sekmeleri; mobilde tüm günler alt alta. */
@media (min-width: 768px) {
  .schedule__tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 32px;
  }

  .schedule__tab {
    min-height: 48px;
    padding: 0 24px;
    border: 2px solid var(--black);
    border-radius: var(--radius-pill);
    background: var(--white);
    color: var(--black);
    font: 700 1rem/1 var(--font-sans);
    cursor: pointer;
  }

  .schedule__tab[aria-selected='true'] {
    background: var(--yellow);
  }

  .schedule__day:not(.is-active) {
    display: none;
  }
}
```

- [ ] **Step 5: Geçtiğini doğrula**

```bash
npm test
```
Expected: tüm testler PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/components/Timeline.* web/src/pages/Schedule.*
git commit -m "feat: Program sayfası (gün sekmeleri ve zaman çizelgesi)"
```

---

### Task 9: Kayıt mantığı (`lib/registration.js`)

**Files:**
- Create: `web/src/lib/registration.js`
- Test: `web/src/lib/registration.test.js`

**Interfaces:**
- Produces (hepsi named export):
  - `STEPS: [{ id: 'person'|'team'|'interest'|'confirm', title: string }]` (sırasıyla `Kişisel bilgiler`, `Takım`, `İlgi alanları`, `Onay`)
  - `initialValues: { fullName, email, phone, department, year, teamName, teamRole, teammates: string, interests: string[], level, consent: boolean }`
  - `YEAR_OPTIONS`, `ROLE_OPTIONS`, `INTEREST_OPTIONS`, `LEVEL_OPTIONS`: `[{ value, label }]`
  - `normalize(values): values`: yeni nesne döner; metinleri kırpar, ad/takım adındaki ardışık boşlukları teke indirir, e-postayı küçük harfe çevirir, telefondan boşluk/`()`/`-`/`.` siler.
  - `validateStep(stepId, values): Record<field, string>`: boş nesne = geçerli.
  - `submitRegistration(values, { endpoint?, fetchImpl? }): Promise<{ ok: true, skipped?: true } | { ok: false, error: string }>`

- [ ] **Step 1: Başarısız testi yaz**

`web/src/lib/registration.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { initialValues, normalize, validateStep, submitRegistration, STEPS } from './registration.js'

const valid = {
  ...initialValues,
  fullName: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0555 123 45 67',
  department: 'Bilgisayar Mühendisliği',
  year: '2',
  teamName: 'Kod Kurtları',
  teamRole: 'founder',
  interests: ['web'],
  level: 'beginner',
  consent: true,
}

describe('STEPS', () => {
  it('4 adım sırasıyla tanımlıdır', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['person', 'team', 'interest', 'confirm'])
  })
})

describe('normalize', () => {
  it('kirli girdiyi temizler', () => {
    const out = normalize({
      ...valid,
      fullName: '  İlker   Şahin ',
      email: '  ILKER@Example.COM ',
      phone: '0 (555) 123-45-67',
      teamName: '  Kod   Kurtları ',
      teammates: '  Ali, Veli ',
    })
    expect(out.fullName).toBe('İlker Şahin')
    expect(out.email).toBe('ilker@example.com')
    expect(out.phone).toBe('05551234567')
    expect(out.teamName).toBe('Kod Kurtları')
    expect(out.teammates).toBe('Ali, Veli')
  })

  it('girdi nesnesini değiştirmez', () => {
    const input = { ...valid, email: ' A@B.CO ' }
    normalize(input)
    expect(input.email).toBe(' A@B.CO ')
  })
})

describe('validateStep: person', () => {
  it('boş değerlerde tüm zorunlu alanlar hata verir', () => {
    const errors = validateStep('person', initialValues)
    expect(Object.keys(errors).sort()).toEqual(['department', 'email', 'fullName', 'phone', 'year'])
  })

  it('geçerli girdide hata yoktur', () => {
    expect(validateStep('person', valid)).toEqual({})
  })

  it('tek kelimelik ad hata verir', () => {
    expect(validateStep('person', { ...valid, fullName: 'Ayşe' }).fullName).toBe('Ad ve soyadını yaz.')
  })

  it('Türkçe karakterli isim geçerlidir', () => {
    expect(validateStep('person', { ...valid, fullName: 'İlker Şahin' })).toEqual({})
  })

  it('boşluklu ve büyük harfli e-posta geçerlidir, eksik olan değildir', () => {
    expect(validateStep('person', { ...valid, email: '  AYSE@Example.COM ' })).toEqual({})
    expect(validateStep('person', { ...valid, email: 'ayse@' }).email).toBe('Geçerli bir e-posta adresi yaz.')
  })

  it('telefon biçimlerini kabul eder, kısa numarayı reddeder', () => {
    expect(validateStep('person', { ...valid, phone: '0 (555) 123-45-67' })).toEqual({})
    expect(validateStep('person', { ...valid, phone: '+90 555 123 45 67' })).toEqual({})
    expect(validateStep('person', { ...valid, phone: '123' }).phone).toBe('Geçerli bir telefon numarası yaz.')
  })
})

describe('validateStep: team, interest, confirm', () => {
  it('takım adı ve rol zorunludur', () => {
    const errors = validateStep('team', initialValues)
    expect(errors.teamName).toBe('Takım adını yaz.')
    expect(errors.teamRole).toBe('Rolünü seç.')
    expect(validateStep('team', valid)).toEqual({})
  })

  it('bilinmeyen rol reddedilir', () => {
    expect(validateStep('team', { ...valid, teamRole: 'hacker' }).teamRole).toBe('Rolünü seç.')
  })

  it('en az bir ilgi alanı ve seviye zorunludur', () => {
    const errors = validateStep('interest', initialValues)
    expect(errors.interests).toBe('En az bir ilgi alanı seç.')
    expect(errors.level).toBe('Deneyim seviyeni seç.')
    expect(validateStep('interest', valid)).toEqual({})
  })

  it('onay kutusu işaretlenmeden geçilmez', () => {
    expect(validateStep('confirm', { ...valid, consent: false }).consent).toBe(
      'Devam etmek için onay vermelisin.',
    )
    expect(validateStep('confirm', valid)).toEqual({})
  })
})

describe('submitRegistration', () => {
  it('endpoint yoksa istek atmaz ve başarılı döner', async () => {
    const fetchImpl = vi.fn()
    const result = await submitRegistration(valid, { fetchImpl })
    expect(result).toEqual({ ok: true, skipped: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('endpoint varsa normalize edilmiş JSON POST eder', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const result = await submitRegistration(
      { ...valid, email: ' AYSE@Example.com ' },
      { endpoint: 'https://example.test/kayit', fetchImpl },
    )
    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.test/kayit')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body).email).toBe('ayse@example.com')
  })

  it('sunucu hatasında ok:false ve durum kodunu döner', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('500')
  })

  it('ağ hatasında fırlatmaz, ok:false döner', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/bağlantı/i)
  })
})
```

- [ ] **Step 2: Başarısız olduğunu doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/lib/registration.test.js
```
Expected: FAIL, `registration.js` yok.

- [ ] **Step 3: Uygula**

`web/src/lib/registration.js`:

```js
export const STEPS = [
  { id: 'person', title: 'Kişisel bilgiler' },
  { id: 'team', title: 'Takım' },
  { id: 'interest', title: 'İlgi alanları' },
  { id: 'confirm', title: 'Onay' },
]

export const YEAR_OPTIONS = [
  { value: 'prep', label: 'Hazırlık' },
  { value: '1', label: '1. sınıf' },
  { value: '2', label: '2. sınıf' },
  { value: '3', label: '3. sınıf' },
  { value: '4', label: '4. sınıf' },
  { value: 'grad', label: 'Yüksek lisans / Doktora' },
]

export const ROLE_OPTIONS = [
  { value: 'founder', label: 'Takım kurucusuyum' },
  { value: 'member', label: 'Bir takımın üyesiyim' },
  { value: 'looking', label: 'Takım arıyorum' },
]

export const INTEREST_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobil' },
  { value: 'ai', label: 'Yapay Zeka' },
  { value: 'game', label: 'Oyun' },
  { value: 'cloud', label: 'Bulut' },
]

export const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Yeni başlıyorum' },
  { value: 'intermediate', label: 'Orta seviye' },
  { value: 'advanced', label: 'İleri seviye' },
]

export const initialValues = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  year: '',
  teamName: '',
  teamRole: '',
  teammates: '',
  interests: [],
  level: '',
  consent: false,
}

const collapse = (s) => s.trim().replace(/\s+/g, ' ')

export function normalize(values) {
  return {
    ...values,
    fullName: collapse(values.fullName),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.replace(/[\s().-]/g, ''),
    department: collapse(values.department),
    teamName: collapse(values.teamName),
    teammates: values.teammates.trim(),
    interests: [...values.interests],
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{10,14}$/

const has = (options, value) => options.some((o) => o.value === value)

export function validateStep(stepId, values) {
  const v = normalize(values)
  const errors = {}

  if (stepId === 'person') {
    if (v.fullName.split(' ').filter(Boolean).length < 2) errors.fullName = 'Ad ve soyadını yaz.'
    if (!EMAIL_RE.test(v.email)) errors.email = 'Geçerli bir e-posta adresi yaz.'
    if (!PHONE_RE.test(v.phone)) errors.phone = 'Geçerli bir telefon numarası yaz.'
    if (v.department.length < 2) errors.department = 'Bölümünü yaz.'
    if (!has(YEAR_OPTIONS, v.year)) errors.year = 'Sınıfını seç.'
  }

  if (stepId === 'team') {
    if (v.teamName.length < 2) errors.teamName = 'Takım adını yaz.'
    if (!has(ROLE_OPTIONS, v.teamRole)) errors.teamRole = 'Rolünü seç.'
  }

  if (stepId === 'interest') {
    if (v.interests.length === 0) errors.interests = 'En az bir ilgi alanı seç.'
    if (!has(LEVEL_OPTIONS, v.level)) errors.level = 'Deneyim seviyeni seç.'
  }

  if (stepId === 'confirm') {
    if (v.consent !== true) errors.consent = 'Devam etmek için onay vermelisin.'
  }

  return errors
}

export async function submitRegistration(values, { endpoint, fetchImpl = (...args) => fetch(...args) } = {}) {
  if (!endpoint) return { ok: true, skipped: true }

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalize(values)),
    })
    if (!res.ok) return { ok: false, error: `Sunucu hatası (${res.status}). Biraz sonra tekrar dene.` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.' }
  }
}
```

- [ ] **Step 4: Geçtiğini doğrula**

```bash
npm test -- src/lib/registration.test.js
```
Expected: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/lib
git commit -m "feat: kayıt doğrulama, normalizasyon ve gönderim mantığı"
```

---

### Task 10: Kayıt formu UI (`Field`, `StepForm`, `Register`)

**Files:**
- Create: `web/src/components/Field.jsx`, `Field.css`, `StepForm.jsx`, `StepForm.css`
- Create: `web/src/test/registrationHelpers.js`
- Modify: `web/src/pages/Register.jsx` (tamamen yeniden yaz)
- Create: `web/src/pages/Register.css`
- Test: `web/src/components/StepForm.test.jsx`, `web/src/pages/Register.test.jsx`

**Interfaces:**
- Consumes: `STEPS`, `initialValues`, `validateStep`, `normalize`, `submitRegistration`, `*_OPTIONS` (Görev 9); `Button` (Görev 3).
- Produces:
  - `Field({ id, label, error?, hint?, required?, children })`
  - `StepForm({ onSubmit: (values) => Promise<{ ok: boolean, error?: string }>, onSuccess: () => void })`
  - `Register()`: `import.meta.env.VITE_REGISTER_ENDPOINT` ile `submitRegistration` çağırır; başarıda "Kaydın alındı!" gösterir.
  - Test yardımcıları: `fillPerson(user)`, `fillTeam(user)`, `fillInterest(user)`, `acceptConsent(user)`, `next(user)`.

- [ ] **Step 1: Test yardımcılarını yaz**

`web/src/test/registrationHelpers.js`:

```js
import { screen } from '@testing-library/react'

export async function fillPerson(user) {
  await user.type(screen.getByLabelText('Ad soyad'), 'Ayşe Yılmaz')
  await user.type(screen.getByLabelText('E-posta'), 'ayse@example.com')
  await user.type(screen.getByLabelText('Telefon'), '0555 123 45 67')
  await user.type(screen.getByLabelText('Bölüm'), 'Bilgisayar Mühendisliği')
  await user.selectOptions(screen.getByLabelText('Sınıf'), '2')
}

export async function fillTeam(user) {
  await user.type(screen.getByLabelText('Takım adı'), 'Kod Kurtları')
  await user.selectOptions(screen.getByLabelText('Rol'), 'founder')
}

export async function fillInterest(user) {
  await user.click(screen.getByLabelText('Web'))
  await user.selectOptions(screen.getByLabelText('Deneyim seviyesi'), 'beginner')
}

export async function acceptConsent(user) {
  await user.click(screen.getByLabelText(/katılım koşullarını/i))
}

export async function next(user) {
  await user.click(screen.getByRole('button', { name: 'İleri' }))
}

export async function fillUntilConfirm(user) {
  await fillPerson(user)
  await next(user)
  await fillTeam(user)
  await next(user)
  await fillInterest(user)
  await next(user)
}
```

- [ ] **Step 2: Başarısız testleri yaz**

`web/src/components/StepForm.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepForm from './StepForm.jsx'
import { fillPerson, fillUntilConfirm, acceptConsent, next } from '../test/registrationHelpers.js'

const setup = (onSubmit = vi.fn().mockResolvedValue({ ok: true })) => {
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(<StepForm onSubmit={onSubmit} onSuccess={onSuccess} />)
  return { user, onSubmit, onSuccess }
}

describe('StepForm', () => {
  it('ilk adımda Kişisel bilgiler başlığını gösterir', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Kişisel bilgiler' })).toBeInTheDocument()
  })

  it('zorunlu alan boşken ilerlemez ve hata gösterir', async () => {
    const { user } = setup()
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Kişisel bilgiler' })).toBeInTheDocument()
    expect(screen.getByText('Ad ve soyadını yaz.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ad soyad')).toHaveAttribute('aria-invalid', 'true')
  })

  it('geri dönüldüğünde girilen veri korunur', async () => {
    const { user } = setup()
    await fillPerson(user)
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Takım' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Geri' }))
    expect(screen.getByLabelText('Ad soyad')).toHaveValue('Ayşe Yılmaz')
    expect(screen.getByLabelText('Sınıf')).toHaveValue('2')
  })

  it('onay verilmeden gönderilmez', async () => {
    const { user, onSubmit } = setup()
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    expect(screen.getByText('Devam etmek için onay vermelisin.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('tüm adımlar tamamlanınca gönderir ve onSuccess çağırır', async () => {
    const { user, onSubmit, onSuccess } = setup()
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ fullName: 'Ayşe Yılmaz', consent: true })
  })

  it('sunucu hatasında mesaj ve "Tekrar dene" gösterir, veriyi korur, sonra başarır', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Sunucu hatası (500). Biraz sonra tekrar dene.' })
      .mockResolvedValueOnce({ ok: true })
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucu hatası (500)')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/katılım koşullarını/i)).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('Gönder butonuna çift tıklamada tek istek atar', async () => {
    let resolve
    const onSubmit = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.dblClick(screen.getByRole('button', { name: 'Gönder' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)

    resolve({ ok: true })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
```

`web/src/pages/Register.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Register from './Register.jsx'
import { fillUntilConfirm, acceptConsent } from '../test/registrationHelpers.js'

describe('Register sayfası', () => {
  it('h1 ve formu gösterir', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Kayıt' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ad soyad')).toBeInTheDocument()
  })

  it('endpoint yokken formu tamamlayınca başarı ekranını gösterir', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    )
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    expect(await screen.findByText('Kaydın alındı!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })
})
```

- [ ] **Step 3: Başarısız olduklarını doğrula**

```bash
cd /Users/heath/Python/Hackathon/web && npm test -- src/components/StepForm.test.jsx src/pages/Register.test.jsx
```
Expected: FAIL, `StepForm.jsx` yok.

- [ ] **Step 4: `Field` bileşenini yaz**

`web/src/components/Field.jsx`:

```jsx
import './Field.css'

export default function Field({ id, label, error, hint, required = false, children }) {
  return (
    <div className={`field${required ? ' field--required' : ''}${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <p className="field__error" id={`${id}-error`} aria-live="polite">
        {error}
      </p>
    </div>
  )
}
```

`web/src/components/Field.css`:

```css
.field {
  display: grid;
  gap: 6px;
  margin-bottom: 20px;
}

.field label {
  font-weight: 700;
}

.field--required label::after {
  content: ' *';
}

.field input[type='text'],
.field input[type='email'],
.field input[type='tel'],
.field select,
.field textarea {
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  border: 2px solid var(--black);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--black);
  font: 400 1rem/1.4 var(--font-sans);
}

.field--invalid input,
.field--invalid select {
  border-color: var(--red);
  background: var(--red-pastel);
}

.field__hint {
  font-size: 0.875rem;
}

.field__error {
  min-height: 1.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--black);
}
```

- [ ] **Step 5: `StepForm` bileşenini yaz**

`web/src/components/StepForm.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import {
  STEPS,
  initialValues,
  validateStep,
  normalize,
  YEAR_OPTIONS,
  ROLE_OPTIONS,
  INTEREST_OPTIONS,
  LEVEL_OPTIONS,
} from '../lib/registration.js'
import './StepForm.css'

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? ''

export default function StepForm({ onSubmit, onSuccess }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlight = useRef(false)
  const firstRender = useRef(true)
  const headingRef = useRef(null)
  const formRef = useRef(null)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [stepIndex])

  useEffect(() => {
    if (Object.keys(errors).length === 0) return
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errors])

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))

  const toggleInterest = (value) =>
    setValues((v) => ({
      ...v,
      interests: v.interests.includes(value)
        ? v.interests.filter((i) => i !== value)
        : [...v.interests, value],
    }))

  const describe = (name, withHint = false) => {
    const ids = [errors[name] ? `${name}-error` : null, withHint ? `${name}-hint` : null]
    return ids.filter(Boolean).join(' ') || undefined
  }

  const back = () => {
    setErrors({})
    setSubmitError('')
    setStepIndex((i) => i - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (inFlight.current) return

    const found = validateStep(step.id, values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (!isLast) {
      setStepIndex((i) => i + 1)
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setSubmitError('')
    const result = await onSubmit(values)
    inFlight.current = false
    setSubmitting(false)
    if (result.ok) onSuccess()
    else setSubmitError(result.error ?? 'Bir şeyler ters gitti. Tekrar dene.')
  }

  const summary = normalize(values)

  return (
    <form className="step-form" onSubmit={handleSubmit} noValidate ref={formRef}>
      <ol className="step-form__progress" aria-label="Kayıt adımları">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`step-form__dot${i === stepIndex ? ' is-current' : ''}${i < stepIndex ? ' is-done' : ''}`}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="step-form__num">{i + 1}</span>
            <span className="step-form__name">{s.title}</span>
          </li>
        ))}
      </ol>

      <h2 className="step-form__title" tabIndex={-1} ref={headingRef}>
        {step.title}
      </h2>

      {step.id === 'person' && (
        <>
          <Field id="fullName" label="Ad soyad" required error={errors.fullName}>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={values.fullName}
              onChange={set('fullName')}
              aria-invalid={errors.fullName ? 'true' : undefined}
              aria-describedby={describe('fullName')}
            />
          </Field>
          <Field id="email" label="E-posta" required error={errors.email}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set('email')}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={describe('email')}
            />
          </Field>
          <Field id="phone" label="Telefon" required error={errors.phone}>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              aria-invalid={errors.phone ? 'true' : undefined}
              aria-describedby={describe('phone')}
            />
          </Field>
          <Field id="department" label="Bölüm" required error={errors.department}>
            <input
              id="department"
              type="text"
              value={values.department}
              onChange={set('department')}
              aria-invalid={errors.department ? 'true' : undefined}
              aria-describedby={describe('department')}
            />
          </Field>
          <Field id="year" label="Sınıf" required error={errors.year}>
            <select
              id="year"
              value={values.year}
              onChange={set('year')}
              aria-invalid={errors.year ? 'true' : undefined}
              aria-describedby={describe('year')}
            >
              <option value="">Seç</option>
              {YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {step.id === 'team' && (
        <>
          <Field id="teamName" label="Takım adı" required error={errors.teamName}>
            <input
              id="teamName"
              type="text"
              value={values.teamName}
              onChange={set('teamName')}
              aria-invalid={errors.teamName ? 'true' : undefined}
              aria-describedby={describe('teamName')}
            />
          </Field>
          <Field id="teamRole" label="Rol" required error={errors.teamRole}>
            <select
              id="teamRole"
              value={values.teamRole}
              onChange={set('teamRole')}
              aria-invalid={errors.teamRole ? 'true' : undefined}
              aria-describedby={describe('teamRole')}
            >
              <option value="">Seç</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="teammates"
            label="Takım arkadaşları (isteğe bağlı)"
            hint="İsimleri virgülle ayırarak yazabilirsin."
          >
            <input
              id="teammates"
              type="text"
              value={values.teammates}
              onChange={set('teammates')}
              aria-describedby="teammates-hint"
            />
          </Field>
        </>
      )}

      {step.id === 'interest' && (
        <>
          <fieldset className="step-form__fieldset" aria-describedby={describe('interests')}>
            <legend>İlgi alanların</legend>
            {INTEREST_OPTIONS.map((o) => (
              <label key={o.value} className="step-form__check">
                <input
                  type="checkbox"
                  checked={values.interests.includes(o.value)}
                  onChange={() => toggleInterest(o.value)}
                  aria-invalid={errors.interests ? 'true' : undefined}
                />
                {o.label}
              </label>
            ))}
            <p className="field__error" id="interests-error" aria-live="polite">
              {errors.interests}
            </p>
          </fieldset>
          <Field id="level" label="Deneyim seviyesi" required error={errors.level}>
            <select
              id="level"
              value={values.level}
              onChange={set('level')}
              aria-invalid={errors.level ? 'true' : undefined}
              aria-describedby={describe('level')}
            >
              <option value="">Seç</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {step.id === 'confirm' && (
        <>
          <dl className="step-form__summary">
            <dt>Ad soyad</dt>
            <dd>{summary.fullName}</dd>
            <dt>E-posta</dt>
            <dd>{summary.email}</dd>
            <dt>Telefon</dt>
            <dd>{summary.phone}</dd>
            <dt>Bölüm / Sınıf</dt>
            <dd>
              {summary.department} / {labelOf(YEAR_OPTIONS, summary.year)}
            </dd>
            <dt>Takım</dt>
            <dd>
              {summary.teamName} ({labelOf(ROLE_OPTIONS, summary.teamRole)})
            </dd>
            <dt>İlgi alanları</dt>
            <dd>{summary.interests.map((i) => labelOf(INTEREST_OPTIONS, i)).join(', ')}</dd>
            <dt>Seviye</dt>
            <dd>{labelOf(LEVEL_OPTIONS, summary.level)}</dd>
          </dl>

          <label className="step-form__check step-form__consent">
            <input
              type="checkbox"
              checked={values.consent}
              onChange={(e) => setValues((v) => ({ ...v, consent: e.target.checked }))}
              aria-invalid={errors.consent ? 'true' : undefined}
              aria-describedby={describe('consent')}
            />
            Katılım koşullarını ve KVKK aydınlatma metnini okudum, kabul ediyorum.
          </label>
          <p className="field__error" id="consent-error" aria-live="polite">
            {errors.consent}
          </p>
        </>
      )}

      {submitError && (
        <p className="step-form__submit-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="step-form__actions">
        {stepIndex > 0 && (
          <Button variant="ghost" onClick={back} disabled={submitting}>
            Geri
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {!isLast ? 'İleri' : submitError ? 'Tekrar dene' : submitting ? 'Gönderiliyor…' : 'Gönder'}
        </Button>
      </div>
    </form>
  )
}
```

`web/src/components/StepForm.css`:

```css
.step-form {
  max-width: 560px;
}

.step-form__progress {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
}

.step-form__dot {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.step-form__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--black);
  border-radius: 50%;
  background: var(--white);
  font-weight: 700;
}

.step-form__dot.is-current .step-form__num {
  background: var(--yellow);
}

.step-form__dot.is-done .step-form__num {
  background: var(--green);
}

.step-form__name {
  display: none;
}

@media (min-width: 480px) {
  .step-form__name {
    display: block;
  }
}

.step-form__title {
  margin-bottom: 24px;
  font-size: 1.75rem;
}

.step-form__title:focus {
  outline: none;
}

.step-form__fieldset {
  margin: 0 0 20px;
  padding: 0;
  border: 0;
}

.step-form__fieldset legend {
  margin-bottom: 8px;
  padding: 0;
  font-weight: 700;
}

.step-form__check {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  cursor: pointer;
}

.step-form__check input {
  width: 22px;
  height: 22px;
  accent-color: var(--black);
}

.step-form__summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  margin-bottom: 24px;
  padding: 20px;
  border-radius: var(--radius-md);
  background: var(--off-white);
}

.step-form__summary dt {
  font-weight: 700;
}

.step-form__submit-error {
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 2px solid var(--black);
  border-radius: var(--radius-sm);
  background: var(--red-pastel);
  font-weight: 700;
}

.step-form__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
```

- [ ] **Step 6: `Register` sayfasını yaz**

`web/src/pages/Register.jsx`:

```jsx
import { useState } from 'react'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import { submitRegistration } from '../lib/registration.js'
import './Register.css'

const endpoint = import.meta.env.VITE_REGISTER_ENDPOINT

export default function Register() {
  const [done, setDone] = useState(false)

  return (
    <div className="register container">
      <h1 className="register__title">Kayıt</h1>

      {done ? (
        <section className="register__success" aria-live="polite">
          <div className="register__shapes" aria-hidden="true">
            <i className="tone--blue" />
            <i className="tone--red" />
            <i className="tone--yellow" />
            <i className="tone--green" />
          </div>
          <h2>Kaydın alındı!</h2>
          <p>Detaylar e-posta adresine gönderilecek. Programa göz atmayı unutma.</p>
          <Button to="/program">Programı Gör</Button>
        </section>
      ) : (
        <StepForm onSubmit={(values) => submitRegistration(values, { endpoint })} onSuccess={() => setDone(true)} />
      )}
    </div>
  )
}
```

`web/src/pages/Register.css`:

```css
.register {
  padding: 48px 0 0;
}

.register__title {
  margin-bottom: 32px;
  font-size: clamp(2.25rem, 8vw, 4rem);
}

.register__success {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  max-width: 560px;
}

.register__shapes {
  display: flex;
  gap: 10px;
}

.register__shapes i {
  width: 36px;
  height: 36px;
  background: var(--tone);
  animation: register-pop 0.5s ease-out backwards;
}

.register__shapes i:nth-child(1) {
  border-radius: 50%;
}
.register__shapes i:nth-child(2) {
  animation-delay: 0.1s;
}
.register__shapes i:nth-child(3) {
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  animation-delay: 0.2s;
}
.register__shapes i:nth-child(4) {
  border-radius: 36px 36px 0 0;
  animation-delay: 0.3s;
}

@keyframes register-pop {
  from {
    opacity: 0;
    transform: scale(0.4) translateY(12px);
  }
}
```

- [ ] **Step 7: Geçtiğini doğrula**

```bash
npm test
```
Expected: tüm testler PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web/src/components/Field.* web/src/components/StepForm.* web/src/pages/Register.* web/src/test
git commit -m "feat: 4 adımlı kayıt formu ve başarı ekranı"
```

---

### Task 11: Cila, dokümantasyon ve uçtan uca doğrulama

**Files:**
- Create: `web/README.md`, `web/.env.example`
- Modify: gerekirse görsel düzeltmeler (ilgili `.css` dosyaları)

**Interfaces:**
- Consumes: önceki tüm görevler.

- [ ] **Step 1: `.env.example` ve README yaz**

`web/.env.example`:

```bash
# Kayıt formunun JSON POST edeceği adres. Boş bırakılırsa istek atılmaz, yalnızca başarı ekranı gösterilir.
VITE_REGISTER_ENDPOINT=
```

`web/README.md`:

```markdown
# GDG On Campus PAU Hackathon Sitesi

React 18 + Vite. Türkçe, düz CSS.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm test         # birim testleri
npm run build    # üretim derlemesi (dist/)
```

## İçeriği değiştirme

Etkinlik adı, tarih, ödül, program, jüri/mentor ve sponsorlar yalnızca `src/data/event.js` içindedir.

## Font ve logo dosyaları

- Google Sans ve Google Sans Mono dosyalarını brand guide'daki Download bağlantılarından indirip
  `public/fonts/` içine şu adlarla koy: `GoogleSans-Regular.woff2`, `GoogleSans-Bold.woff2`,
  `GoogleSansMono-Regular.woff2`, `GoogleSansMono-Bold.woff2`. Yoksa `system-ui` / `ui-monospace` kullanılır.
- Sponsor logolarını `public/logos/` içine koyup `event.js` içindeki `logo: '/logos/dosya.png'` alanına yaz.
- Kişi fotoğrafları için `photo: '/logos/kisi.jpg'` benzeri bir yol kullan.

## Kayıt formu

`.env` dosyasında `VITE_REGISTER_ENDPOINT` tanımlıysa form JSON POST eder (gövde: normalize edilmiş form alanları).
Tanımlı değilse istek atılmaz ve başarı ekranı gösterilir.

## Yayınlama notu

Uygulama `BrowserRouter` kullanır; statik barındırmada tüm rotaların `index.html`'e düşmesi (SPA fallback) gerekir.
```

- [ ] **Step 2: Tüm testler ve derleme**

```bash
cd /Users/heath/Python/Hackathon/web
npm test && npm run build
```
Expected: tüm testler PASS; build hatasız tamamlanır.

- [ ] **Step 3: Geliştirme sunucusunu başlat ve rotaları gez**

```bash
npm run dev
```
Tarayıcıda `http://localhost:5173` adresini aç; sırasıyla `/`, `/kayit`, `/program`, `/ekip`, `/olmayan` sayfalarını kontrol et.
Expected: 4 sayfa ve 404 sayfası açılır, konsolda uygulama hatası yok (font 404 uyarısı kabul edilir).

- [ ] **Step 4: Görsel kontrol listesi (375 / 768 / 1440 px)**

Tarayıcının duyarlı modunda her genişlik için işaretle:
- [ ] Hiçbir sayfada yatay kaydırma çubuğu yok
- [ ] 375 px: hamburger menü açılıp kapanıyor; altta sabit "Kayıt Ol" çubuğu var ve içerik altında kalmıyor; `/kayit` sayfasında çubuk yok
- [ ] 768 px ve üzeri: navbar tek satır; Program sayfasında gün sekmeleri görünür ve yalnızca aktif gün gösterilir; 375 px'te tüm günler alt alta
- [ ] Hero şekilleri yazıyı örtmüyor (375 px'te soluk, okunaklı)
- [ ] Fare hero üzerinde gezerken şekiller hafifçe kayıyor
- [ ] Sarı, mavi, yeşil, kırmızı yüzeylerdeki tüm metinler siyah ve okunaklı
- [ ] Klavye ile Tab: odak halkası her etkileşimli öğede görünür; "İçeriğe geç" bağlantısı çalışıyor

- [ ] **Step 5: `prefers-reduced-motion` kontrolü**

Tarayıcı geliştirici araçlarında "Emulate CSS prefers-reduced-motion: reduce" aç.
Expected: hero şekilleri durur, marquee durur, kartlar anında görünür, fare parallax'ı çalışmaz.

- [ ] **Step 6: Kayıt formunu elle uçtan uca dene**

`/kayit` sayfasında:
1. Boş "İleri": hata mesajları görünür, ilk hatalı alana odak gider.
2. Tüm adımları doldur, "Gönder": "Kaydın alındı!" görünür.
3. `.env` içine `VITE_REGISTER_ENDPOINT=http://localhost:9/yok` yazıp `npm run dev`'i yeniden başlat; formu gönder: hata mesajı ve "Tekrar dene" görünür, veriler duruyor. Denemeden sonra `.env` dosyasını sil.

- [ ] **Step 7: Commit**

```bash
cd /Users/heath/Python/Hackathon
git add web
git commit -m "docs: README ve .env.example; uçtan uca doğrulama"
```

---

## Self-Review

**Spec kapsamı**

| Spec bölümü | Görev |
|---|---|
| §3 Marka (fontlar, renkler, ad) | 3 (tokens, fonts), Global Constraints |
| §4.1 Ana sayfa (hero, marquee, tanıtım, ödül, sponsor, kapanış) | 4, 5, 6, 7 |
| §4.2 Kayıt (4 adım, doğrulama, endpoint, hata, başarı) | 9, 10 |
| §4.3 Program (zaman çizelgesi, sekmeler/alt alta) | 8 |
| §4.4 Ekip (jüri, mentor, sponsor, baş harf yedeği) | 6 |
| §4.5 Hero geometrisi (4 şekil, parallax, reduced-motion) | 5 |
| §5 Navbar, sabit CTA, Footer, reveal, Button hover, geri sayım | 3, 4, 5 |
| §6 Veri modeli | 2 |
| §7 Erişilebilirlik/performans | 3 (skip-link, focus), 10 (label, aria-live, aria-invalid), 11 (elle kontrol) |
| §8 Dosya yapısı | Dosya Yapısı bölümü |
| §11 Doğrulama | 11 |

**Bilinçli sapmalar (spec'le tam örtüşmeyen noktalar)**
- Navbar: 3 metin bağlantısı + "Kayıt Ol" butonu (4. sayfa buton olarak), spec'teki "4 bağlantı + Kayıt Ol butonu" yinelemeyi önlemek için böyle yorumlandı.
- Spec §7 "yalnızca transform/opacity" ile §5 "hover'da köşe yarıçapı değişimi" çeliştiği için buton hover'ı tek seferlik durum geçişi sayıldı (Global Constraints'te yazılı).
- Spec'teki "başarı ekranı: marka şekillerinden kısa animasyon" 4 küçük şeklin giriş animasyonu olarak uygulandı.

**Placeholder taraması:** Plan içinde TBD/TODO yok; geçici iskelet sayfalar (Görev 1) açıkça belirtildi ve Görev 3, 6, 7, 8, 10'da tam içerikle değiştiriliyor.

**Tip/ad tutarlılığı:** `initials`, `getTimeLeft`, `STEPS`, `validateStep`, `normalize`, `submitRegistration`, `typeLabels`, `event.*` alan adları görevler arasında aynı. `StepForm` ham `values` verir, `submitRegistration` kendi içinde `normalize` eder (çift normalize yok). Sayfaların `data` prop'u yalnızca kendi okuduğu alanları kullanır (`Schedule`: `days`; `Team`: `people`, `sponsors`).

**Review Focus:** 5 madde de bir görevde test edilir (1 → Görev 4, 2 → Görev 9/10, 3 → Görev 10, 4 → Görev 9, 5 → Görev 3/6/7/8).

**Bilinen riskler:** Geri sayım testleri fake timers ile çalışır; `vitest` ve `@testing-library/react` sürümleri `npm install` ile en güncel gelir, bir API farkı çıkarsa ilgili görevde düzeltilir. Font ve logo dosyaları kullanıcıdan gelecek (README'de anlatıldı).
