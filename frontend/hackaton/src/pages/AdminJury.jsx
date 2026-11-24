import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminGate from '../components/AdminGate.jsx'
import Button from '../components/Button.jsx'
import JuryAdminJurors from '../components/JuryAdminJurors.jsx'
import JuryAdminLog from '../components/JuryAdminLog.jsx'
import JuryAdminResults from '../components/JuryAdminResults.jsx'
import { CategoriesEditor, CriteriaEditor, EntriesEditor } from '../components/JuryAdminSetup.jsx'
import JuryResetPanel from '../components/JuryResetPanel.jsx'
import { useEditorSession } from '../hooks/useEditorSession.js'
import { usePrivatePage } from '../hooks/usePrivatePage.js'
import { juryAdminApi } from '../lib/juryApi.js'
import { bodyOf, draftOf, isDirty, setupProblem } from '../lib/jurySetup.js'
import './Admin.css'
import './AdminJury.css'

const REFRESH_MS = 10000
/** @type {[string, string][]} */
const TABS = [
  ['results', 'Sonuçlar'],
  ['criteria', 'Kriterler'],
  ['categories', 'Kategoriler'],
  ['entries', 'Yarışan takımlar'],
  ['jurors', 'Jüriler'],
  ['log', 'İşlem kaydı'],
]

/**
 * Sunucudan gelen ayarı işler. Kaydedilmemiş düzenleme varsa revision dahil hiçbir ayara dokunulmaz;
 * yoksa başkasının değişikliği fark edilmeden ezilirdi (409 alınmalı).
 */
function mergeConfig(setup, fresh) {
  if (!setup) return { config: fresh, draft: draftOf(fresh) }
  if (fresh.revision < setup.config.revision) return setup
  if (!isDirty(setup.config, setup.draft)) return { config: fresh, draft: draftOf(fresh) }
  const { locked, round, scorecardCount } = fresh
  return { ...setup, config: { ...setup.config, locked, round, scorecardCount } }
}

/** Yoklama ilk sayfayı getirir; "daha eski" ile açılmış sayfalar korunur. */
function mergeLog(current, page) {
  if (!current) return page
  const known = new Set(current.items.map((entry) => entry.id))
  return { items: [...page.items.filter((entry) => !known.has(entry.id)), ...current.items], next: current.next }
}

/** @param {{ session: any, onExpire: () => void, onExit: () => void }} props */
function Dashboard({ session, onExpire, onExit }) {
  const client = useMemo(() => juryAdminApi(session.token), [session.token])
  const [tab, setTab] = useState('results')
  const [setup, setSetup] = useState(null)
  const [results, setResults] = useState(null)
  const [jurors, setJurors] = useState(null)
  const [log, setLog] = useState(null)
  const [links, setLinks] = useState([])
  const [stale, setStale] = useState(false)
  const [note, setNote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const latest = useRef(0)
  const pending = useRef(0)
  const isAdmin = session.user?.role === 'ADMIN'

  const report = useCallback((error) => {
    if (error.status === 401) onExpire()
    else setNote({ text: error.message, bad: true })
  }, [onExpire])

  const refresh = useCallback(async () => {
    const request = ++latest.current
    pending.current += 1
    try {
      const [config, list] = await Promise.all([client.config(), tab === 'results' ? client.results() : tab === 'jurors' ? client.jurors() : tab === 'log' ? client.log() : null])
      // Geç gelen eski yanıt yeni veriyi ezmesin.
      if (request !== latest.current) return
      setSetup((current) => mergeConfig(current, config))
      if (tab === 'results') setResults(list)
      if (tab === 'jurors') setJurors(list)
      if (tab === 'log') setLog((current) => mergeLog(current, list))
      setStale(false)
    } catch (error) {
      if (request !== latest.current) return
      if (error.status === 401) onExpire()
      else setStale(true)
    } finally {
      pending.current -= 1
    }
  }, [client, tab, onExpire])

  useEffect(() => {
    void refresh()
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    // Yavaş bağlantıda yeni tur öncekini iptal etmesin; yoksa ekran hiç güncellenmez.
    const timer = setInterval(() => {
      if (!pending.current) whenVisible()
    }, REFRESH_MS)
    document.addEventListener('visibilitychange', whenVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', whenVisible)
    }
  }, [refresh])

  const dirty = setup ? isDirty(setup.config, setup.draft) : false
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const edit = (key) => (value) => {
    // Temiz hâlden başlayan düzenleme güncel revision'a dayanır.
    if (!dirty) setConflict(false)
    setNote(null)
    setSetup((current) => ({ ...current, draft: { ...current.draft, [key]: value } }))
  }
  const openTab = (key) => {
    setTab(key)
    setNote(null)
  }
  const exit = () => {
    if (!dirty || window.confirm('Kaydedilmemiş değişikliklerin silinecek. Çıkılsın mı?')) onExit()
  }
  const locked = Boolean(setup?.config.locked)
  const problem = !dirty ? '' : locked ? 'Puanlama kilitli, bu değişiklik kaydedilemez.' : setupProblem(setup.draft)

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const config = await client.saveConfig(bodyOf(setup.draft, setup.config.revision))
      latest.current += 1
      setSetup({ config, draft: draftOf(config) })
      setConflict(false)
      setNote({ text: 'Kaydedildi.' })
    } catch (error) {
      if (error.code === 'CONFIG_CONFLICT') setConflict(true)
      report(error)
    } finally {
      setSaving(false)
    }
  }
  const discard = async () => {
    if (!window.confirm('Kaydedilmemiş değişikliklerin silinecek ve güncel hâl yüklenecek. Devam edilsin mi?')) return
    try {
      const config = await client.config()
      latest.current += 1
      setSetup({ config, draft: draftOf(config) })
      setConflict(false)
      setNote(null)
    } catch (error) {
      report(error)
    }
  }

  const toggleLock = async () => {
    const locked = !setup.config.locked
    const question = locked
      ? `Puanlama kilitlensin mi? Jüriler puan değiştiremez. Taslaklar ve gönderilmemiş değişiklikler hesaba girmez.${isAdmin ? '' : ' Kilidi yalnız ADMIN açabilir, sen geri alamazsın.'}`
      : 'Puanlama açılsın mı? Jüriler puanlarını yeniden değiştirebilir.'
    if (!window.confirm(question)) return
    try {
      const config = await client.setLock(locked)
      latest.current += 1
      setSetup((current) => ({ ...current, config: { ...current.config, locked: config.locked } }))
      setNote({ text: config.locked ? 'Puanlama kilitlendi.' : 'Puanlama açıldı.' })
      void refresh()
    } catch (error) {
      report(error)
    }
  }

  const reset = async (confirmation) => {
    try {
      const { deleted, config } = await client.reset(confirmation)
      latest.current += 1
      setSetup((current) => ({ ...current, config: { ...current.config, round: config.round, scorecardCount: config.scorecardCount } }))
      setNote({ text: `${deleted} puan kartı silindi.` })
      void refresh()
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  const voidCard = async (juror, team, body) => {
    try {
      await client.voidCard(juror, team, body)
      setNote({ text: 'Puan kartı iptal edildi.' })
      void refresh()
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  const moreLog = async () => {
    try {
      const page = await client.log(log.next)
      setLog((current) => ({ items: [...current.items, ...page.items], next: page.next }))
    } catch (error) {
      report(error)
    }
  }

  const download = async () => {
    try {
      const url = URL.createObjectURL(await client.csv())
      const link = document.createElement('a')
      link.href = url
      link.download = 'juri_sonuclari.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      report(error)
    }
  }

  const addLink = ({ juror, token }) =>
    setLinks((current) => [
      ...current.filter((link) => link.id !== juror.id),
      { id: juror.id, name: juror.name, url: `${window.location.origin}/juri/${token}` },
    ])

  return (
    <>
      <div className="admin__bar">
        <div className="admin__actions">
          <h1>Jüri paneli</h1>
          {setup && (
            <>
              <span className={`jury-admin__state${setup.config.locked ? ' jury-admin__state--locked' : ''}`}>
                {setup.config.locked ? '🔒 Puanlama kilitli' : 'Puanlama açık'}
              </span>
              {locked && !isAdmin ? (
                <span className="jury-admin__unlock">Kilidi yalnız ADMIN açabilir.</span>
              ) : (
                <Button variant="secondary" onClick={toggleLock}>{locked ? 'Puanlamayı aç' : 'Puanlamayı kilitle'}</Button>
              )}
            </>
          )}
          <Button variant="ghost" href="/admin">İçerik paneli</Button>
          <Button variant="ghost" onClick={exit}>Çıkış</Button>
        </div>
        {dirty && (
          <div className="jury-admin__save">
            <strong>Kaydedilmemiş değişiklik var.</strong>
            {problem && <span role="alert">{problem}</span>}
            {conflict ? (
              <Button variant="secondary" onClick={discard}>Güncel hâli yükle</Button>
            ) : (
              <>
                <Button disabled={saving || Boolean(problem)} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
                <Button variant="ghost" disabled={saving} onClick={discard}>Vazgeç</Button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="admin__status" role="status">{note && !note.bad ? note.text : ''}</p>
      {note?.bad && <p className="admin__status" role="alert">{note.text}</p>}

      <div className="admin__tabs" role="group" aria-label="Bölümler">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className="admin__tab" aria-pressed={tab === key} onClick={() => openTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {!setup ? (
        <p>{stale ? 'Jüri ayarları alınamadı, yeniden deneniyor…' : 'Yükleniyor…'}</p>
      ) : (
        <>
          {tab === 'results' && <JuryAdminResults results={results} stale={stale} onDownload={download} onVoid={isAdmin && !locked ? voidCard : undefined} />}
          {tab === 'results' && isAdmin && <JuryResetPanel count={setup.config.scorecardCount} locked={locked} onReset={reset} />}
          {tab === 'jurors' && <JuryAdminJurors jurors={jurors} links={links} client={client} canIssueLinks={isAdmin} onIssued={addLink} onChanged={refresh} onError={report} />}
          {tab === 'log' && <JuryAdminLog log={log} criteria={setup.config.criteria} stale={stale} onMore={moreLog} />}
          {['criteria', 'categories', 'entries'].includes(tab) && locked && (
            <p className="jury-admin__warning">Puanlama kilitli: ayarlar değiştirilemez.</p>
          )}
          {['criteria', 'categories', 'entries'].includes(tab) && (
            <fieldset className="jury-admin__editor" disabled={saving || locked}>
              {tab === 'criteria' && <CriteriaEditor criteria={setup.draft.criteria} hasCards={setup.config.scorecardCount > 0} onChange={edit('criteria')} />}
              {tab === 'categories' && (
                <CategoriesEditor
                  categories={setup.draft.categories}
                  criteria={setup.draft.criteria}
                  savedKeys={setup.config.categories.map((category) => category.key)}
                  onChange={edit('categories')}
                />
              )}
              {tab === 'entries' && <EntriesEditor entries={setup.draft.entries} savedEntries={setup.config.entries} client={client} onError={report} onChange={edit('entries')} />}
            </fieldset>
          )}
        </>
      )}
    </>
  )
}

export default function AdminJury() {
  const { session, unlock, lock } = useEditorSession()
  const [expired, setExpired] = useState(false)
  const expire = useCallback(() => setExpired(true), [])
  usePrivatePage('Jüri paneli')

  const login = (value) => {
    unlock(value)
    setExpired(false)
  }
  const exit = () => {
    setExpired(false)
    lock()
  }

  return (
    <main className="admin container jury-admin">
      {(!session || expired) && (
        <AdminGate title="Jüri paneli" notice={expired ? 'Oturumun sona erdi. Giriş yapınca kaldığın yerden devam edersin.' : ''} onUnlock={login} />
      )}
      {/* Oturum düşünce panel gizlenir ama sökülmez: yarım düzenleme ve gösterilen linkler kaybolmaz. */}
      {session && (
        <div hidden={expired}>
          <Dashboard session={session} onExpire={expire} onExit={exit} />
        </div>
      )}
    </main>
  )
}
