import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
import base from '../data/event.json'
import { choices, clearDraft, isEventShape, readDraft, typeLabels, writeDraft } from '../lib/content.js'
import './Admin.css'

const labels = {
  organizer: 'Organizatör',
  name: 'Ad',
  tagline: 'Slogan',
  theme: 'Tema',
  startsAt: 'Başlangıç (ISO tarih, örn. 2026-12-12T09:00:00+03:00)',
  location: 'Konum',
  about: 'Hakkında kartları',
  marquee: 'Kayan yazı',
  prizes: 'Ödüller',
  days: 'Günler',
  items: 'Program öğeleri',
  jury: 'Jüri',
  mentors: 'Mentorlar',
  sponsors: 'Sponsorlar',
  socials: 'Sosyal medya',
  title: 'Başlık',
  text: 'Metin',
  color: 'Renk',
  place: 'Sıra',
  description: 'Açıklama',
  label: 'Etiket',
  date: 'Tarih',
  time: 'Saat',
  type: 'Tür',
  photo: 'Fotoğraf URL',
  tier: 'Seviye',
  logo: 'Logo URL',
  url: 'Bağlantı URL',
}
// Dizi öğelerinin başlığı için tekil ad.
const one = {
  about: 'Kart',
  marquee: 'Kelime',
  prizes: 'Ödül',
  days: 'Gün',
  items: 'Program öğesi',
  jury: 'Jüri üyesi',
  mentors: 'Mentor',
  sponsors: 'Sponsor',
  socials: 'Bağlantı',
}
const person = { name: '', title: '', photo: null }
const blank = {
  about: { title: '', text: '', color: 'blue' },
  marquee: '',
  prizes: { place: '', title: '', description: '', color: 'blue' },
  days: { label: '', date: '', items: [] },
  items: { time: '', title: '', description: '', type: Object.keys(typeLabels)[0] },
  jury: person,
  mentors: person,
  sponsors: { name: '', tier: 'support', logo: null, url: null },
  socials: { label: '', url: '' },
}
const longText = new Set(['text', 'description', 'tagline'])
const nullable = new Set(['photo', 'logo', 'url'])
const tabs = [
  ['Genel', ['organizer', 'name', 'tagline', 'theme', 'startsAt', 'location']],
  ['Hakkında', ['about']],
  ['Kayan yazı', ['marquee']],
  ['Ödüller', ['prizes']],
  ['Program', ['days']],
  ['Ekip', ['people']],
  ['Sponsorlar', ['sponsors']],
  ['Sosyal', ['socials']],
]
// shortcut: client-side check, the value ships in the bundle; replace with real auth when the backend exists
const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '123'
const UNLOCK_KEY = 'hackathon-admin-unlocked'

// Kart başlığı öğenin kendi alanlarından gelir; boşsa sıra adı kullanılır.
const cardLabel = (item) => [item.time, item.name || item.title || item.label].filter(Boolean).join(' ')

function setIn(obj, [k, ...rest], value) {
  const copy = Array.isArray(obj) ? [...obj] : { ...obj }
  copy[k] = rest.length ? setIn(obj[k], rest, value) : value
  return copy
}

// Kartın kimliği dizideki konumu değil kendi anahtarıdır; taşıma ve kaldırmada açık/kapalı durumu öğeyle gider.
// slots, ilk taşıma/ekleme/kaldırmaya kadar boştur ve o zamana dek kimlik konumdur.
function ArrayNode({ name, title, path, value, update }) {
  const [slots, setSlots] = useState([])
  const added = useRef(0)
  const rows = value.map((_, i) => slots[i] ?? { key: `x${i}`, open: false })

  const move = (i, to) => {
    const next = [...rows]
    ;[next[i], next[to]] = [next[to], next[i]]
    setSlots(next)
    update(path, (list) => {
      const copy = [...list]
      ;[copy[i], copy[to]] = [copy[to], copy[i]]
      return copy
    })
  }
  const remove = (i) => {
    setSlots(rows.filter((_, j) => j !== i))
    update(path, (list) => list.filter((_, j) => j !== i))
  }
  // Yeni eklenen kart açık gelir.
  const add = () => {
    setSlots([...rows, { key: `a${added.current++}`, open: true }])
    update(path, (list) => [...list, blank[name]])
  }

  return (
    <fieldset className="admin__group">
      <legend>{title ?? labels[name] ?? name}</legend>
      {value.map((item, i) => {
        const itemTitle = `${one[name]} ${i + 1}`
        const isText = typeof item === 'string'
        const node = <Node name={name} title={itemTitle} path={[...path, i]} value={item} update={update} />
        return (
          <div className={`admin__item admin__item--${isText ? 'row' : 'card'}`} key={rows[i].key}>
            {isText ? (
              node
            ) : (
              <details open={rows[i].open}>
                <summary>{cardLabel(item) || itemTitle}</summary>
                {node}
              </details>
            )}
            <div className="admin__controls">
              <Button variant="ghost" disabled={i === 0} aria-label={`${itemTitle} yukarı taşı`} onClick={() => move(i, i - 1)}>
                Yukarı
              </Button>
              <Button variant="ghost" disabled={i === value.length - 1} aria-label={`${itemTitle} aşağı taşı`} onClick={() => move(i, i + 1)}>
                Aşağı
              </Button>
              <Button variant="ghost" aria-label={`${itemTitle} kaldır`} onClick={() => remove(i)}>
                Kaldır
              </Button>
            </div>
          </div>
        )
      })}
      <Button variant="secondary" onClick={add}>
        {one[name]} ekle
      </Button>
    </fieldset>
  )
}

// name: dizi öğelerinde dizinin anahtarı; başlık ve şablon bununla seçilir.
function Node({ name, title, path, value, update }) {
  const id = `f-${path.join('-')}`
  const heading = title ?? labels[name] ?? name

  if (Array.isArray(value)) return <ArrayNode name={name} title={title} path={path} value={value} update={update} />

  if (value !== null && typeof value === 'object') {
    return (
      <div>
        {Object.keys(value).map((k) => (
          <Node key={k} name={k} path={[...path, k]} value={value[k]} update={update} />
        ))}
      </div>
    )
  }

  // Boş metin null'a döner; sosyal bağlantının url'si ise her zaman metindir.
  const onChange = (e) => {
    const v = e.target.value
    update(path, () => (v === '' && nullable.has(name) && path[0] !== 'socials' ? null : v))
  }
  const shared = { id, value: value ?? '', onChange }
  const options = choices[name]
  return (
    <Field id={id} label={heading}>
      {options ? (
        <select {...shared}>
          {[...new Set([value, ...options])].map((o) => (
            <option key={o} value={o}>
              {typeLabels[o] ?? o}
            </option>
          ))}
        </select>
      ) : longText.has(name) ? (
        <textarea rows={3} {...shared} />
      ) : (
        <input type="text" {...shared} />
      )}
    </Field>
  )
}

function Gate({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (password === PASSWORD) return onUnlock()
    setPassword('')
    setWrong(true)
  }

  return (
    <form className="admin__gate" onSubmit={submit}>
      <h1>İçerik paneli</h1>
      <Field id="password" label="Şifre">
        <input id="password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {wrong && <p role="alert" className="admin__status">Şifre yanlış.</p>}
      <Button type="submit">Giriş</Button>
    </form>
  )
}

function Editor() {
  const [draft, setDraft] = useState(() => readDraft(base) ?? base)
  // readDraft taslak yoksa base'i döndürür; kimlik karşılaştırması "kayıtlı taslak var mı"yı verir.
  const [saved, setSaved] = useState(() => draft !== base)
  const [note, setNote] = useState(null)
  const [tab, setTab] = useState(0)

  const update = (path, fn) => setDraft((d) => setIn(d, path, fn(path.reduce((o, k) => o[k], d))))
  const save = () => {
    // Geçersiz taslak okunurken sessizce yok sayılırdı; kaydetmeden önce reddet.
    if (!isEventShape(base, draft)) {
      return setNote({
        text: 'Kaydedilmedi: bir alan geçersiz. Başlangıç tarihi geçerli olmalı, bağlantılar / veya http(s) ile başlamalı.',
        bad: true,
      })
    }
    if (!writeDraft(base, draft)) return setNote({ text: 'Kaydedilemedi: tarayıcı depolamaya izin vermiyor.', bad: true })
    setSaved(true)
    setNote({ text: 'Taslak kaydedildi. Değişiklikler yalnızca bu tarayıcıda, siteyi açtığında görünür.' })
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
    a.download = 'event.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const upload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const value = JSON.parse(await file.text())
      if (!isEventShape(base, value)) throw new Error('shape')
      setDraft(value)
      setNote({ text: 'Dosya yüklendi. Siteye uygulamak için Kaydet\'e bas.' })
    } catch {
      setNote({ text: 'Dosya geçersiz: etkinlik JSON biçimine uymuyor. Mevcut taslak korundu.', bad: true })
    }
  }

  const reset = () => {
    clearDraft()
    setSaved(false)
    setDraft(base)
    setNote({ text: 'Taslak silindi, form site verisine döndü.' })
  }

  return (
    <>
      <div className="admin__bar">
        <div className="admin__actions">
          <h1>İçerik paneli</h1>
          <Button onClick={save}>Kaydet</Button>
          <Button variant="ghost" href="/">
            Siteyi gör
          </Button>
        </div>
        <details className="admin__files">
          <summary>Dosya işlemleri</summary>
          <div className="admin__actions">
            <Button variant="ghost" onClick={download}>
              JSON indir
            </Button>
            <Button variant="ghost" onClick={reset}>
              Taslağı sıfırla
            </Button>
          </div>
          <Field id="import" label="JSON yükle">
            <input id="import" type="file" accept=".json,application/json" onChange={upload} />
          </Field>
        </details>
      </div>
      <p className="admin__status" role="status">
        {note?.bad ? '' : note?.text}
      </p>
      {note?.bad && (
        <p className="admin__status" role="alert">
          {note.text}
        </p>
      )}
      <details className="admin__note">
        <summary>Nasıl çalışır?</summary>
        <p>
          Kaydet yalnızca bu tarayıcıdaki önizlemeyi günceller. Ziyaretçiler değişikliği, indirdiğin event.json
          src/data/event.json ile değiştirilip site yeniden yayınlandıktan sonra görür.
        </p>
      </details>
      {saved && <p className="admin__banner">Kayıtlı bir taslak bu tarayıcıda siteye uygulanıyor.</p>}
      <div className="admin__tabs" role="group" aria-label="Bölümler">
        {tabs.map(([label], i) => (
          <button key={label} type="button" aria-pressed={i === tab} className="admin__tab" onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
      </div>
      {tabs[tab][1].map((k) => (
        <Node key={k} name={k} path={[k]} value={draft[k]} update={update} />
      ))}
    </>
  )
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return window.sessionStorage.getItem(UNLOCK_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const prev = document.title
    document.title = 'İçerik paneli'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => {
      document.title = prev
      meta.remove()
    }
  }, [])

  const unlock = () => {
    try {
      window.sessionStorage.setItem(UNLOCK_KEY, '1')
    } catch {
      // Hatırlanamazsa bu oturumda yine açılır; yenilemede şifre tekrar sorulur.
    }
    setUnlocked(true)
  }

  return <main className="admin container">{unlocked ? <Editor /> : <Gate onUnlock={unlock} />}</main>
}
