import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import TextField from '../components/common/TextField.jsx'
import { getPermissions, setPermissions } from '../lib/api.js'

const REASON_MAX = 120
const ENDING_MAX = 200

/** Kayıt sayfasında görünecek cümle; backend (formPermissionsService.closedMessage) aynısını kurar. */
const closedMessage = (reason, ending) =>
  `İlginiz için teşekkür ederiz, ${reason} için kaydınızı yapamıyoruz. ${ending}`.trim()

const clean = (value) => value.trim().replace(/\s+/g, ' ')

/** Katılımcıların neler yapabileceği. Hem açmak hem kapatmak onay ister. */
const PERMISSIONS = [
  {
    key: 'registration',
    title: 'Kayıtlar',
    on: 'Kayıt sayfası açık; yeni katılımcılar e-postalarını doğrulayıp başvurabilir.',
    off: 'Kayıt sayfasında başvuru formu yerine aşağıdaki metin görünür ve yeni başvuru alınmaz. Daha önce başvuranlar “Başvurum” sayfasına girmeye devam eder.',
    closeLabel: 'Kayıtları kapat',
    openLabel: 'Kayıtları aç',
    closeQuestion: 'Yeni kimse başvuramayacak. Kayıtları kapatmak istediğine emin misin?',
    openQuestion: 'Kayıt sayfası yeniden başvuru almaya başlayacak. Emin misin?',
    closedNotice: 'Kayıtlar kapatıldı. Kayıt sayfası artık kapanış metnini gösteriyor.',
    openedNotice: 'Kayıtlar açıldı. Yeni başvurular alınıyor.',
  },
  {
    key: 'teamChanges',
    title: 'Takım değişiklikleri',
    on: 'Katılımcılar takım kurabilir, takımlara katılabilir ve ayrılabilir. Kaptanlar istekleri onaylar, üye çıkarır, kaptanlığı devreder ve takımı dağıtabilir.',
    off: 'Kayıtlı katılımcılar takımlarını yalnızca görüntüleyebilir: takım kuramaz, katılamaz, ayrılamaz; kaptanlar üye çıkaramaz, kaptanlığı devredemez ve takımı dağıtamaz. Yeni kayıt olanlar kayıt formunda yine takım kurabilir veya katılma isteği gönderebilir; kaptanlar bu istekleri kabul edip reddedebilir. Takımlar sayfasındaki yönetici işlemleri çalışmaya devam eder.',
    closeLabel: 'Takım değişikliklerini kapat',
    openLabel: 'Takım değişikliklerini aç',
    closeQuestion: 'Kayıtlı katılımcılar takımlarını değiştiremeyecek; kaptanlar yalnızca gelen istekleri yanıtlayabilecek. Emin misin?',
    openQuestion: 'Katılımcılar takımlarını yeniden düzenleyebilecek. Emin misin?',
    closedNotice: 'Takım değişiklikleri kapatıldı. Katılımcılar takımlarını artık yalnızca görüntüleyebilir.',
    openedNotice: 'Takım değişiklikleri açıldı.',
  },
  {
    key: 'answerEditing',
    title: 'Bilgileri düzenleme',
    on: 'Başvuru yapanlar kontrol panelinde “Bilgilerimi değiştir” bölümünü görür ve başvuru bilgilerini güncelleyebilir; güncellenen başvuru yeniden yönetici onayına düşer.',
    off: 'Başvuru yapanlar “Bilgilerimi gör” bölümünü görür ve bilgilerini yalnızca görüntüleyebilir; güncelleme istekleri reddedilir.',
    closeLabel: 'Bilgi düzenlemeyi kapat',
    openLabel: 'Bilgi düzenlemeyi aç',
    closeQuestion: 'Başvuru yapanlar bilgilerini değiştiremeyecek. Emin misin?',
    openQuestion: 'Başvuru yapanlar bilgilerini yeniden değiştirebilecek. Emin misin?',
    closedNotice: 'Bilgi düzenleme kapatıldı. Başvuru yapanlar bilgilerini artık yalnızca görüntüleyebilir.',
    openedNotice: 'Bilgi düzenleme açıldı.',
  },
  {
    key: 'projectUpload',
    title: 'Proje yükleme',
    on: 'Takım üyeleri “Başvurum” sayfasındaki “Proje Yükleme” ile proje sitesine girip takımlarının GitHub linkini ekleyebilir ve değiştirebilir.',
    off: 'Proje sitesi açılmaya devam eder; takımlar eklenmiş linki ve commit geçmişini görür ama linki ekleyemez veya değiştiremez. Teslim süresi dolunca kapatın.',
    closeLabel: 'Proje yüklemeyi kapat',
    openLabel: 'Proje yüklemeyi aç',
    closeQuestion: 'Takımlar GitHub linklerini artık değiştiremeyecek. Proje yüklemeyi kapatmak istediğine emin misin?',
    openQuestion: 'Takımlar GitHub linklerini yeniden ekleyip değiştirebilecek. Emin misin?',
    closedNotice: 'Proje yükleme kapatıldı. Takımlar linklerini artık yalnızca görüntüleyebilir.',
    openedNotice: 'Proje yükleme açıldı.',
  },
  {
    key: 'projectEvaluation',
    title: 'Proje değerlendirme',
    on: 'Sahnede canlı oylama açık. Jürideki yarışan takımlar proje yükleme sırasına göre dizildi; sunum yapan takım hackathon sitesindeki Jüri yönetimi > “Sunum akışı” sekmesinden seçilir ve jüriler yalnız o takımı oylar. Katılımcılar “Başvurum” sayfasında sunum sırasını görür ve sunan takıma (kendi takımları hariç) anonim oy verir; nihai puan jüri %70 + katılımcı %30.',
    off: 'Canlı oylama kapalı. Açınca jürideki yarışan takımlar proje yükleme sırasına göre dizilir (sıra bir kez belirlenir, kapatıp açmak değiştirmez) ve sunum akışı yönetilebilir hâle gelir. Oylaması bitirilen takımlar kapalıyken de kilitli kalır.',
    closeLabel: 'Proje değerlendirmeyi kapat',
    openLabel: 'Proje değerlendirmeyi aç',
    closeQuestion: 'Canlı oylama duracak; jüriler oylaması bitmemiş takımları serbestçe puanlayabilecek. Emin misin?',
    openQuestion: 'Takımlar proje yükleme sırasına göre dizilecek; jüriler ve katılımcılar yalnız oylaması başlatılan takımı puanlayabilecek. Emin misin?',
    closedNotice: 'Proje değerlendirme kapatıldı.',
    openedNotice: 'Proje değerlendirme açıldı. Sunum sırası belirlendi; akışı Jüri yönetimindeki “Sunum akışı” sekmesinden yönetebilirsin.',
  },
]

/** Kayıtları kapatırken doldurulan metin: neden + kapanış cümlesi, canlı önizlemeyle. */
function ClosingText({ reason, ending, onReason, onEnding, disabled }) {
  const preview = closedMessage(clean(reason) || '{neden}', clean(ending) || '{kapanış}')
  return (
    <div className="closing-text">
      <TextField
        label="Kapanma nedeni"
        name="closedReason"
        value={reason}
        onChange={(event) => onReason(event.target.value)}
        hint="Cümlenin “… için kaydınızı yapamıyoruz” kısmına girer. Örn. kontenjan dolduğu"
        maxLength={REASON_MAX}
        disabled={disabled}
        required
      />
      <TextField
        label="Kapanış cümlesi"
        name="closedEnding"
        value={ending}
        onChange={(event) => onEnding(event.target.value)}
        hint="Metnin sonuna eklenir. Örn. Bir sonraki etkinlikte görüşmek üzere!"
        maxLength={ENDING_MAX}
        disabled={disabled}
        required
      />
      <figure className="closing-text__preview">
        <figcaption>Kayıt sayfasında görünecek metin</figcaption>
        <p aria-live="polite">{preview}</p>
      </figure>
    </div>
  )
}

const closedAtFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' })

export default function Permissions({ session, onLogout, onUnauthorized }) {
  const { token, user } = session
  const [state, setState] = useState(/** @type {null | Record<string, any>} */ (null))
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  /** Onayı beklenen değişiklik: hangi izin ve yeni değeri. */
  const [asking, setAsking] = useState(/** @type {null | { key: string, next: boolean }} */ (null))
  const [reason, setReason] = useState('')
  const [ending, setEnding] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    getPermissions(token)
      .then((data) => active && setState(data))
      .catch((error) => {
        if (!active) return
        if (error.status === 401) onUnauthorized?.()
        else setLoadError(error.message)
      })
    return () => { active = false }
  }, [token, onUnauthorized])

  const ask = (key, next) => {
    setNotice('')
    setActionError('')
    setAsking({ key, next })
    // Kayıtları kapatırken son kullanılan metinle başla.
    if (key === 'registration' && !next) {
      setReason(state?.closedReason ?? '')
      setEnding(state?.closedEnding ?? '')
    }
  }

  const change = async (item, next) => {
    setBusy(true)
    setNotice('')
    setActionError('')
    try {
      const body = { [item.key]: next, ...(item.key === 'registration' && !next ? { closedReason: clean(reason), closedEnding: clean(ending) } : {}) }
      setState(await setPermissions(body, token))
      setAsking(null)
      setNotice(next ? item.openedNotice : item.closedNotice)
    } catch (error) {
      if (error.status === 401) onUnauthorized?.()
      else setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelLayout user={user} onLogout={onLogout} title="Katılımcı izinleri">
      {notice && (
        <p className="form-message form-message--success" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {actionError}
        </p>
      )}

      {loadError ? (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {loadError}
        </p>
      ) : !state ? (
        <p className="panel__state" role="status">
          İzinler yükleniyor…
        </p>
      ) : (
        <div className="permissions">
          {PERMISSIONS.map((item) => {
            const enabled = state[item.key] !== false
            const pending = asking?.key === item.key ? asking : null
            const closingRegistration = item.key === 'registration' && pending?.next === false
            const textReady = clean(reason).length >= 2 && clean(ending).length >= 2
            return (
              <section
                key={item.key}
                className={`maintenance-card${enabled ? '' : ' maintenance-card--on'}`}
                aria-labelledby={`permission-${item.key}`}
              >
                <span className={`panel__badge panel__badge--${enabled ? 'approved' : 'outline'}`}>{enabled ? 'Açık' : 'Kapalı'}</span>
                <h2 id={`permission-${item.key}`} className="maintenance-card__title">
                  {item.title}
                </h2>
                <p className="maintenance-card__text">{enabled ? item.on : item.off}</p>
                {item.key === 'projectUpload' && !enabled && state.projectUploadClosedAt && (
                  <p className="maintenance-card__text">
                    <strong>Kapatıldığı an: {closedAtFormat.format(new Date(state.projectUploadClosedAt))}.</strong> Jüri yönetimindeki
                    “Teslim kontrolü” bu andan sonra repolara push yapan takımları gösterir. Yeniden açılırsa bir sonraki kapatma yeni teslim zamanı olur.
                  </p>
                )}
                {item.key === 'registration' && !enabled && (
                  <figure className="closing-text__preview">
                    <figcaption>Kayıt sayfasında görünen metin</figcaption>
                    <p>{closedMessage(state.closedReason, state.closedEnding)}</p>
                  </figure>
                )}

                {closingRegistration && (
                  <ClosingText reason={reason} ending={ending} onReason={setReason} onEnding={setEnding} disabled={busy} />
                )}

                <div className="maintenance-card__actions">
                  {pending ? (
                    <span className="confirm" role="group" aria-label={pending.next ? item.openLabel : item.closeLabel}>
                      <span>{pending.next ? item.openQuestion : item.closeQuestion}</span>
                      <button
                        type="button"
                        className={`btn btn--sm${pending.next ? '' : ' btn--danger'}`}
                        disabled={busy || (closingRegistration && !textReady)}
                        onClick={() => change(item, pending.next)}
                      >
                        {pending.next ? 'Aç' : 'Kapat'}
                      </button>
                      <button type="button" className="btn btn--sm btn--outline" disabled={busy} onClick={() => setAsking(null)}>
                        Vazgeç
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn" disabled={busy} onClick={() => ask(item.key, !enabled)}>
                      {enabled ? item.closeLabel : item.openLabel}
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </PanelLayout>
  )
}
