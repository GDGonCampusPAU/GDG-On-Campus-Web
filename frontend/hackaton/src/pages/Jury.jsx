import { useEffect, useState, useSyncExternalStore } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/Button.jsx'
import JuryScoreForm from '../components/JuryScoreForm.jsx'
import JuryTeamList from '../components/JuryTeamList.jsx'
import { usePrivatePage } from '../hooks/usePrivatePage.js'
import { juryApi } from '../lib/juryApi.js'
import { createJuryStore } from '../lib/juryStore.js'
import './Jury.css'

// Seçili takım adreste durur: telefonun geri tuşu listeye döner, yenileme aynı takımı açar.
const TEAM_PARAM = 'takim'

/** @param {{ token: string }} props */
function JuryApp({ token }) {
  const [store] = useState(() => createJuryStore(token, juryApi(token)))
  const { phase, error, offline, wasReset, me, teams } = useSyncExternalStore(store.subscribe, store.getState)
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    store.start()
    return store.stop
  }, [store])

  if (phase === 'loading') {
    return (
      <main className="jury">
        <h1 className="jury__message">Jüri puanlama</h1>
        <p role="status">Yükleniyor…</p>
      </main>
    )
  }
  if (phase === 'invalid') {
    return (
      <main className="jury">
        <h1 className="jury__message">Link geçersiz</h1>
        <p role="alert">Bu jüri linki geçersiz, organizasyon ekibiyle iletişime geçin.</p>
      </main>
    )
  }
  if (phase === 'error') {
    return (
      <main className="jury">
        <h1 className="jury__message">Sayfa açılamadı</h1>
        <p role="alert">{error}</p>
        <Button onClick={store.refresh}>Tekrar dene</Button>
      </main>
    )
  }

  const index = me.entries.findIndex((entry) => entry.team === params.get(TEAM_PARAM))
  const open = (team) => setParams(team ? { [TEAM_PARAM]: team } : {})
  const shown = index >= 0 ? me.entries[index] : null
  const current = me.live?.open ? me.live.current : null
  // Canlı oylama: bu takıma şu an yazılamıyorsa form genel kilitteki gibi salt okunur gösterilir.
  const formMe = shown && shown.writable === false && !me.locked ? { ...me, locked: true } : me

  return (
    <main className={`jury${index >= 0 ? ' jury--team' : ''}`}>
      {me.locked && (
        <p className="jury__banner jury__banner--locked" role="status">
          <strong>Puanlama kapatıldı.</strong> Puanlar salt okunur.
        </p>
      )}
      {offline && (
        <p className="jury__banner" role="status">
          Bağlantı yok. Puanlamaya devam edebilirsin, bağlantı gelince yeniden denenecek.
        </p>
      )}
      {wasReset && (
        <p className="jury__banner" role="status">
          Puan kartları organizasyon tarafından sıfırlandı.
        </p>
      )}
      {me.live?.open && !me.locked && (!shown || shown.team !== current?.team) && (
        <div className={`jury__banner jury__banner--live${current ? ' jury__banner--now' : ''}`} role="status">
          {current ? (
            <>
              <p><strong>🎤 Şu an sunuyor:</strong> {current.position}. {current.teamName}</p>
              <Button size="sm" onClick={() => open(current.team)}>Puanla</Button>
            </>
          ) : (
            <p>Sunum bekleniyor. Organizasyon oylamayı başlatınca sunan takım burada görünecek.</p>
          )}
        </div>
      )}
      {shown && !me.locked && shown.live === 'CLOSED' && (
        <p className="jury__banner jury__banner--locked" role="status">
          <strong>Bu takımın oylaması bitti.</strong> Puanlar artık değiştirilemez.
        </p>
      )}
      {shown && !me.locked && me.live?.open && shown.live === 'WAITING' && (
        <p className="jury__banner" role="status">
          <strong>Bu takımın oylaması henüz açılmadı.</strong> Takım sunum yapınca organizasyon oylamayı başlatacak.
        </p>
      )}
      {index >= 0 ? (
        <JuryScoreForm
          key={me.entries[index].team}
          me={formMe}
          summary={me.entries[index]}
          team={teams[me.entries[index].team]}
          store={store}
          onOpen={open}
        />
      ) : (
        <JuryTeamList me={me} teams={teams} onOpen={open} />
      )}
    </main>
  )
}

export default function Jury() {
  const { token } = useParams()
  usePrivatePage('Jüri puanlama')
  return <JuryApp key={token} token={token} />
}
