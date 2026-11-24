import { useEffect, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { LINK_FIELDS, isValidLink, move, weightTotal } from '../lib/jurySetup.js'

const replace = (list, index, changes) => list.map((item, i) => (i === index ? { ...item, ...changes } : item))

function MoveButtons({ list, index, name, onMove }) {
  return (
    <>
      <Button variant="ghost" size="sm" disabled={index === 0} aria-label={`${name} yukarı taşı`} onClick={() => onMove(move(list, index, index - 1))}>
        Yukarı
      </Button>
      <Button variant="ghost" size="sm" disabled={index === list.length - 1} aria-label={`${name} aşağı taşı`} onClick={() => onMove(move(list, index, index + 1))}>
        Aşağı
      </Button>
    </>
  )
}

/** @param {{ criteria: any[], hasCards: boolean, onChange: (criteria: any[]) => void }} props */
export function CriteriaEditor({ criteria, hasCards, onChange }) {
  const total = weightTotal(criteria)
  return (
    <section aria-labelledby="criteria-title">
      <h2 id="criteria-title">Kriterler</h2>
      <p className={`jury-admin__total${total === 100 ? '' : ' jury-admin__total--bad'}`}>{`Ağırlık toplamı: ${total} / 100`}</p>
      {hasCards && <p className="jury-admin__hint">Puan kartı var: ağırlık değişirse gönderilmiş puanların toplamı da yeniden hesaplanır.</p>}
      {criteria.map((criterion, index) => {
        const id = `criterion-${criterion.key}`
        const update = (changes) => onChange(replace(criteria, index, changes))
        return (
          <div key={criterion.key} className="jury-admin__card jury-admin__criterion">
            <Field id={`${id}-label`} label="Ad">
              <input id={`${id}-label`} type="text" maxLength={80} value={criterion.label} onChange={(e) => update({ label: e.target.value })} />
            </Field>
            <Field id={`${id}-weight`} label="Ağırlık">
              <input id={`${id}-weight`} type="number" min={1} max={100} step={1} value={criterion.weight ?? ''} onChange={(e) => update({ weight: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            <Field id={`${id}-description`} label="Açıklama">
              <textarea id={`${id}-description`} rows={2} maxLength={300} value={criterion.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
          </div>
        )
      })}
    </section>
  )
}

/** @param {{ categories: any[], criteria: any[], savedKeys: string[], onChange: (categories: any[]) => void }} props */
export function CategoriesEditor({ categories, criteria, savedKeys, onChange }) {
  const add = () =>
    onChange([...categories, { key: `ek_${Date.now().toString(36)}_${categories.length}`, name: '', icon: '', criterionKeys: [], active: true }])

  return (
    <section aria-labelledby="categories-title">
      <h2 id="categories-title">Kategoriler</h2>
      <p className="jury-admin__hint">Yukarıdaki kategori önce dağıtılır. Bir takım en fazla bir ödül alır.</p>
      {categories.map((category, index) => {
        const id = `category-${category.key}`
        const name = category.name || `Kategori ${index + 1}`
        const update = (changes) => onChange(replace(categories, index, changes))
        const toggle = (key) =>
          update({ criterionKeys: category.criterionKeys.includes(key) ? category.criterionKeys.filter((item) => item !== key) : [...category.criterionKeys, key] })
        return (
          <fieldset key={category.key} className={`jury-admin__card${category.active ? '' : ' jury-admin__card--inactive'}`}>
            <legend>{`${index + 1}. öncelik: ${name}`}</legend>
            <div className="jury-admin__category">
              <Field id={`${id}-name`} label="Ad">
                <input id={`${id}-name`} type="text" maxLength={60} value={category.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field id={`${id}-icon`} label="İkon (emoji)">
                <input id={`${id}-icon`} type="text" maxLength={16} value={category.icon} onChange={(e) => update({ icon: e.target.value })} />
              </Field>
            </div>
            <fieldset className="jury-admin__checks">
              <legend>Sıralama kriterleri</legend>
              {criteria.map((criterion) => (
                <label key={criterion.key}>
                  <input type="checkbox" checked={category.criterionKeys.includes(criterion.key)} onChange={() => toggle(criterion.key)} />
                  {criterion.label}
                </label>
              ))}
            </fieldset>
            {category.criterionKeys.length === 0 && <p className="jury-admin__hint">Yalnızca adaylıkla sıralanır. Aday yoksa öneri gösterilmez, jüri karar verir.</p>}
            <div className="jury-admin__actions">
              <label className="jury-admin__switch">
                <input type="checkbox" checked={category.active} onChange={(e) => update({ active: e.target.checked })} />
                Aktif
              </label>
              <MoveButtons list={categories} index={index} name={name} onMove={onChange} />
              {!savedKeys.includes(category.key) && (
                <Button variant="ghost" size="sm" aria-label={`${name} kaldır`} onClick={() => onChange(categories.filter((_, i) => i !== index))}>
                  Kaldır
                </Button>
              )}
            </div>
          </fieldset>
        )
      })}
      <Button variant="secondary" onClick={add}>Kategori ekle</Button>
    </section>
  )
}

/** @param {{ entries: any[], savedEntries: any[], client: any, onError: (error: any) => void, onChange: (entries: any[]) => void }} props */
export function EntriesEditor({ entries, savedEntries, client, onError, onChange }) {
  const [teams, setTeams] = useState(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    let active = true
    client.teams()
      .then((list) => { if (active) setTeams(list) })
      .catch((error) => { if (active) onError(error) })
    return () => { active = false }
  }, [client, onError])

  const available = (teams ?? []).filter((team) => !entries.some((entry) => entry.team === team.id))
  const entryOf = (team) => ({ team: team.id, teamName: team.name, projectName: '', repoUrl: '', demoUrl: '', presentationUrl: '' })
  const add = () => {
    const team = available.find((item) => item.id === selected)
    if (!team) return
    onChange([...entries, entryOf(team)])
    setSelected('')
  }
  const remove = (entry, saved) => {
    if (saved?.scorecardCount && !window.confirm(`"${entry.teamName}" için ${saved.scorecardCount} puan kartı var. Çıkarılırsa sonuçlarda görünmez. Çıkarılsın mı?`)) return
    onChange(entries.filter((item) => item.team !== entry.team))
  }

  return (
    <section aria-labelledby="entries-title">
      <h2 id="entries-title">Yarışan takımlar</h2>
      <p className="jury-admin__hint">Liste sunum sırasıdır. Proje adı ve linkler boş kalabilir, jüri yine puanlar.</p>
      <div className="jury-admin__actions jury-admin__add">
        <Field id="entry-team" label="Takım">
          <select id="entry-team" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">{teams === null ? 'Yükleniyor…' : available.length ? 'Takım seç' : 'Eklenecek takım yok'}</option>
            {available.map((team) => (
              <option key={team.id} value={team.id}>{`${team.name} (${team.code}, ${team.memberCount} kişi)`}</option>
            ))}
          </select>
        </Field>
        <Button variant="secondary" disabled={!selected} onClick={add}>Takım ekle</Button>
        <Button variant="ghost" disabled={!available.length} onClick={() => onChange([...entries, ...available.map(entryOf)])}>
          Hepsini ekle
        </Button>
      </div>

      <ol>
        {entries.map((entry, index) => {
          const id = `entry-${entry.team}`
          const saved = savedEntries.find((item) => item.team === entry.team)
          const update = (changes) => onChange(replace(entries, index, changes))
          return (
            <li key={entry.team} className="jury-admin__card">
              <div className="jury-admin__actions">
                <h3>{`${index + 1}. ${entry.teamName}`}</h3>
                <MoveButtons list={entries} index={index} name={entry.teamName} onMove={onChange} />
                <Button variant="ghost" size="sm" aria-label={`${entry.teamName} çıkar`} onClick={() => remove(entry, saved)}>Çıkar</Button>
              </div>
              {saved?.teamMissing && <p className="jury-admin__warning">Bu takım kayıt sisteminde dağıtılmış. Adı ve puanları burada korunuyor.</p>}
              <div className="jury-admin__entry">
                <Field id={`${id}-project`} label="Proje adı">
                  <input id={`${id}-project`} type="text" maxLength={120} value={entry.projectName} onChange={(e) => update({ projectName: e.target.value })} />
                </Field>
                {LINK_FIELDS.map(([key, label]) => (
                  <Field key={key} id={`${id}-${key}`} label={label} error={isValidLink(entry[key]) ? '' : 'http:// veya https:// ile başlamalı'}>
                    <input id={`${id}-${key}`} type="text" inputMode="url" maxLength={500} value={entry[key]} onChange={(e) => update({ [key]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
