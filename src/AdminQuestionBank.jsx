import { useCallback, useEffect, useState } from 'react'
import Icon from './Icons'
import OptionEditor from './components/OptionEditor'
import {
  copyQuestionBank,
  createQuestionBank,
  deleteQuestionBank,
  getStoredUser,
  listQuestionBank,
  updateQuestionBank,
} from './api'
import { isQuestionVisible, labelPatch, nextQuestionId, teluguFields } from './questionKey'
import { PortalSkeleton } from './PortalUI'

const EMPTY_Q = {
  id: '',
  label: '',
  type: 'text',
  options: [],
  required: false,
  visible: true,
  speak: '',
}

const defaultOptionsForType = (t) => {
  if (t === 'yesno') return ['Yes', 'No']
  if (t === 'abc') return ['A', 'B', 'C', 'D']
  if (t === 'sentiment' || t === 'sentiment_text') return ['Positive', 'Neutral', 'Negative']
  if (t === 'range' || t === 'numeric_range' || t === 'age') return ['10-20', '21-30', '31-40', '41-50', '50+']
  if (t === 'choice') return ['Option 1', 'Option 2', 'Option 3']
  return []
}

const TYPE_OPTIONS = [
  ['range', '🔢 Numeric Range Buttons (e.g. 10-20, 21-30, 50+)'],
  ['yesno', '✓ Yes / ✕ No Buttons'],
  ['sentiment_text', '📝 Text + Sentiment Fillers'],
  ['choice', '🔘 Choice / Custom Options'],
  ['abc', '🔤 A · B · C · D Choice Buttons'],
  ['sentiment', '⭐ Sentiment Rating Scale'],
  ['meter', '🎚️ Sentiment Meter (tap-o-meter 1–100%)'],
  ['text', '✏️ Open Text Input'],
  ['age', '🔢 Age / Numeric Field'],
]

const STARTERS = [
  {
    name: 'Quick yes / no check',
    questions: [
      { label: 'Respondent name', type: 'text', required: true },
      { label: 'Are you satisfied with the current service?', type: 'yesno', required: true },
      { label: 'Any comments?', type: 'text' },
    ],
  },
  {
    name: 'Feedback survey',
    questions: [
      { label: 'How would you rate your experience?', type: 'sentiment', required: true },
      { label: 'What did you like most?', type: 'text' },
      { label: 'What should we improve?', type: 'text' },
    ],
  },
  {
    name: 'Household basics',
    questions: [
      { label: 'Respondent name', type: 'text', required: true },
      { label: 'Age', type: 'age', required: true },
      { id: 'phone', label: 'Phone number', type: 'text' },
      { label: 'Village / area', type: 'text' },
    ],
  },
]

// "1. Do you own land? | Yes, No"  →  { label, type, options }
function parseQuestionLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawLabel, rawOpts = ''] = line.split('|')
      const label = rawLabel.replace(/^\s*\d+[.)]\s*/, '').trim()
      const options = rawOpts.split(',').map((o) => o.trim()).filter(Boolean)
      const isYesNo = options.length === 2 && options.map((o) => o.toLowerCase()).join() === 'yes,no'
      const type = options.length ? (isYesNo ? 'yesno' : 'choice') : 'text'
      return { label, type, options }
    })
    .filter((q) => q.label)
}

export default function AdminQuestionBankScreen({ onToast, user, onNav }) {
  const me = getStoredUser()
  const isSuper = me?.role === 'super_admin'
  // FR-QB-02: CRUD requires the Super-Admin-granted power; viewing/using ★ global templates is open
  const canCrud = isSuper || !!user?.can_manage_questions || !!me?.can_manage_questions
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // template object being edited, null = list view
  const [name, setName] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [useCounts, setUseCounts] = useState({})
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  // Super-Admin-set per-survey question cap for this Client Admin (0 = unlimited)
  const maxQsPerSurvey = Number(user?.max_questions_per_survey || me?.max_questions_per_survey) || 0
  const capFor = (qs) => (maxQsPerSurvey > 0 ? Math.min(maxQsPerSurvey, qs.length) : qs.length)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listQuestionBank()
      setTemplates(data.templates || [])
    } catch (e) {
      onToast?.(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void load()
  }, [load])

  function startCreate() {
    setEditing({ id: null })
    setName('')
    setIsGlobal(false)
    setQuestions([])
    setBulkText('')
    setShowBulk(true) // empty template: offer "paste a list" straight away
  }

  function startFromStarter(st) {
    setEditing({ id: null })
    setName(st.name)
    setIsGlobal(false)
    setBulkText('')
    setShowBulk(false)
    setQuestions(
      st.questions.map((q, i) => ({
        ...EMPTY_Q,
        ...q,
        options: defaultOptionsForType(q.type),
        _uid: `s-${Date.now()}-${i}`,
      })),
    )
  }

  function startDuplicate(t) {
    setEditing({ id: null })
    setName(`${t.name} (copy)`)
    setIsGlobal(false)
    setBulkText('')
    setShowBulk(false)
    setQuestions((Array.isArray(t.questions) ? t.questions : []).map((q, i) => ({ ...q, _uid: `d-${Date.now()}-${i}` })))
  }

  function addBulk() {
    const parsed = parseQuestionLines(bulkText)
    if (!parsed.length) {
      onToast?.('Type one question per line first', 'error')
      return
    }
    setQuestions((list) => [
      ...list,
      ...parsed.map((q, i) => ({
        ...EMPTY_Q,
        label: q.label,
        type: q.type,
        options: q.options.length ? q.options : defaultOptionsForType(q.type),
        speak: q.label,
        _uid: `b-${Date.now()}-${i}`,
      })),
    ])
    setBulkText('')
    setShowBulk(false)
    onToast?.(`${parsed.length} question${parsed.length === 1 ? '' : 's'} added`, 'ok')
  }

  function startEdit(t) {
    setShowBulk(false)
    setEditing(t)
    setName(t.name || '')
    setIsGlobal(!!t.is_global)
    setQuestions(Array.isArray(t.questions) ? t.questions.map((q) => ({ ...q })) : [])
  }

  function updateQ(i, patch) {
    setQuestions((list) => list.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  function handleTypeChange(i, newType) {
    const defaults = defaultOptionsForType(newType)
    updateQ(i, { type: newType, options: defaults })
  }

  function addQ() {
    setQuestions((list) => [
      ...list,
      {
        ...EMPTY_Q,
        id: '',
        label: '',
        speak: '',
        _uid: `n-${Date.now()}`,
      },
    ])
  }

  function removeQ(i) {
    setQuestions((list) => list.filter((_, idx) => idx !== i))
  }

  function cleanQuestions() {
    const used = new Set()
    return questions.map((q, idx) => {
      const qIndex = idx + 1
      const optsFromText =
        null
      const finalOptions =
        optsFromText && optsFromText.length > 0
          ? optsFromText
          : Array.isArray(q.options) && q.options.length > 0
            ? q.options
            : undefined
      return {
        id: nextQuestionId(q.label, q.id, used, qIndex),
        label: String(q.label || '').trim() || `Question ${qIndex}`,
        type: String(q.type || 'text'),
        options: finalOptions,
        required: !!q.required,
        visible: q.visible !== false,
        speak: String(q.speak || q.label || '').trim(),
        ...teluguFields(q),
      }
    })
  }


  async function save() {
    if (!name.trim()) {
      onToast?.('Template name required', 'error')
      return
    }
    setSaving(true)
    try {
      const cleaned = cleanQuestions()
      if (editing?.id) {
        await updateQuestionBank(editing.id, { name, questions: cleaned, is_global: isGlobal })
        onToast?.('Template updated', 'ok')
      } else {
        await createQuestionBank({ name, questions: cleaned, is_global: isGlobal })
        onToast?.(isSuper && isGlobal ? 'Global template created — all tenants can use it' : 'Template created', 'ok')
      }
      setEditing(null)
      await load()
    } catch (e) {
      onToast?.(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(t) {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    setBusyId(t.id)
    try {
      await deleteQuestionBank(t.id)
      onToast?.('Template deleted', 'ok')
      await load()
    } catch (e) {
      onToast?.(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function useTemplate(t) {
    const qs = Array.isArray(t.questions) ? t.questions : []
    const cap = maxQsPerSurvey > 0 ? Math.min(maxQsPerSurvey, qs.length) : qs.length
    const rawCount = useCounts[t.id]
    const questionCount = rawCount ? Math.min(rawCount, cap) : undefined
    const n = questionCount || cap
    if (!window.confirm(`Create a new survey from “${t.name}” with ${n} question${n === 1 ? '' : 's'}?`)) return
    setBusyId(t.id)
    try {
      const d = await copyQuestionBank(t.id, {
        question_count: questionCount && questionCount < cap ? questionCount : undefined,
      })
      onToast?.(`Survey "${d.survey?.title || 'created'}" created from template`, 'ok')
      onNav?.('surveys')
    } catch (e) {
      onToast?.(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (editing) {
    return (
      <div className="screen">
        <header className="screen-head">
          <h2>{editing?.id ? `Edit template · ${name || '…'}` : 'New question-bank template'}</h2>
          <p>
            {isSuper
              ? 'Global templates (★) are available to every client; Client Admins can also save private templates.'
              : 'Private templates are visible only to you — Super Admin templates appear with a ★.'}
          </p>
        </header>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field compact" style={{ flex: 2, minWidth: 220 }}>
              <span>Template name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assembly Election 2026" />
            </label>
            {isSuper && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isGlobal ? 'rgba(245,158,11,0.15)' : 'rgba(15,23,42,0.05)',
                  border: isGlobal ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '9px 14px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                />
                <span style={{ fontSize: 13, fontWeight: 'bold', color: isGlobal ? '#d97706' : '#475569' }}>
                  {isGlobal ? <><Icon name="star" size={12} /> Global (all tenants)</> : 'Publish as Global template'}
                </span>
              </label>
            )}
            {!isSuper && <span className="muted" style={{ fontSize: 12 }}>Private to your portal</span>}
          </div>
        </div>

        {questions.map((q, i) => {
          const type = q.type || 'text'
          const hasOptions = ['choice', 'yesno', 'abc', 'sentiment', 'sentiment_text', 'range', 'numeric_range', 'age'].includes(type)
          const currentOpts = Array.isArray(q.options) && q.options.length > 0
            ? q.options
            : []

          return (
            <div key={q._uid || `qi-${i}`} className="card" style={{ marginBottom: 14, borderLeft: '4px solid #38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="pill ok" style={{ fontSize: 11, fontWeight: 'bold' }}>
                  Q{i + 1} · {type.toUpperCase().replace('_', ' ')}
                </span>
                <button type="button" className="btn small danger" onClick={() => removeQ(i)}>
                  Delete Q{i + 1}
                </button>
              </div>
              <label className="field">
                <span>Question</span>
                <input value={q.label} onChange={(e) => updateQ(i, labelPatch(q, e.target.value))} placeholder="Type the question" />
              </label>
              <label className="field">
                <span>Voice Prompt (spoken by surveyor)</span>
                <input value={q.speak || ''} onChange={(e) => updateQ(i, { speak: e.target.value })} placeholder="Ask respondent…" />
              </label>
              <label className="field">
                <span>Question Type</span>
                <select value={type} onChange={(e) => handleTypeChange(i, e.target.value)} style={{ fontWeight: 'bold' }}>
                  {TYPE_OPTIONS.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </label>
              {hasOptions && (
                <div style={{ marginTop: 10, background: 'rgba(15,23,42,0.05)', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <OptionEditor
                    options={currentOpts.length > 0 ? currentOpts : defaultOptionsForType(type)}
                    onChange={(options) => updateQ(i, { options })}
                    addLabel="+ Add Option"
                    addValue={(n) => `Option ${n}`}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '10px 0 0' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: isQuestionVisible(q) ? 'rgba(79, 125, 198, 0.12)' : 'rgba(15, 23, 42, 0.05)',
                    border: isQuestionVisible(q) ? '1px solid #4f7dc6' : '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={isQuestionVisible(q)} onChange={(e) => updateQ(i, { visible: e.target.checked })} />
                  <span style={{ fontSize: 13, fontWeight: 'bold', color: isQuestionVisible(q) ? '#4f7dc6' : '#64748b' }}>
                    {isQuestionVisible(q) ? '✓ Visible on dashboard' : 'Hidden on dashboard'}
                  </span>
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: q.required ? 'rgba(79, 125, 198, 0.12)' : 'rgba(15, 23, 42, 0.05)',
                    border: q.required ? '1px solid #4f7dc6' : '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={!!q.required} onChange={(e) => updateQ(i, { required: e.target.checked })} />
                  <span style={{ fontSize: 13, fontWeight: 'bold', color: q.required ? '#4f7dc6' : '#64748b' }}>
                    {q.required ? '✓ Required' : 'Optional'}
                  </span>
                </label>
              </div>
            </div>
          )
        })}

        {showBulk && (
          <div className="card" style={{ marginBottom: 12 }}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
              Paste one question per line. For answer choices add a <strong>|</strong> and the options, for example:{' '}
              <em>Do you own land? | Yes, No</em>
            </p>
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Respondent name\nDo you own land? | Yes, No\nMain crop? | Rice, Cotton, Maize'}
              style={{ width: '100%', fontSize: 14 }}
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn small primary" onClick={addBulk}>
                Add these questions
              </button>
            </div>
          </div>
        )}

        <button type="button" className="btn small" onClick={addQ} style={{ marginRight: 8 }}>
          + Add Question
        </button>
        <button type="button" className="btn small" onClick={() => setShowBulk((v) => !v)} style={{ marginRight: 8 }}>
          Paste a list
        </button>
        <button type="button" className="btn small primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Create template'}
        </button>
        <button
          type="button"
          className="btn small"
          style={{ marginLeft: 8 }}
          onClick={() => {
            if (!saving) setEditing(null)
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{isSuper ? 'Super Admin · Global Question Bank' : 'Question Bank'}</h2>
        <p>
          Save a set of questions once, then start a new survey from it in one click.
          {isSuper ? ' ★ templates are global (all tenants).' : ' You see your own templates plus ★ global ones from the Super Admin.'}
          {' '}Starting a survey needs the Create surveys power.
        </p>
      </header>

      {!canCrud && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            border: '1px solid rgba(217,119,6,0.5)',
            background: 'rgba(217,119,6,0.08)',
            padding: '12px 14px',
            fontSize: 13,
          }}
        >
          <Icon name="lock" size={13} /> <strong>Question Bank is read-only for you.</strong> You can view and use the ★
          global templates, but creating or editing templates is locked until the Super Admin
          grants your account <strong>Question Bank CRUD</strong> (Surveyors page → your profile).
        </div>
      )}
      {canCrud && (
        <button type="button" className="btn small primary" onClick={startCreate} style={{ marginBottom: 12 }}>
          ＋ New Template
        </button>
      )}

      {loading ? (
        <PortalSkeleton rows={4} label="Loading question bank…" />
      ) : templates.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {canCrud
              ? isSuper
                ? 'No templates yet. Start from a ready-made set or build your own — mark it ★ global to share with every client.'
                : 'No templates yet. Start from a ready-made set below, or build your own. Your templates are private to your portal.'
              : 'No templates yet. Ask your Super Admin to publish ★ global templates, or to grant you Question Bank CRUD.'}
          </p>
          {canCrud && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {STARTERS.map((st) => (
                <button key={st.name} type="button" className="btn small" onClick={() => startFromStarter(st)}>
                  ＋ {st.name} ({st.questions.length} questions)
                </button>
              ))}
              <button type="button" className="btn small primary" onClick={startCreate}>
                ＋ Blank template
              </button>
            </div>
          )}
        </div>
      ) : (
        templates.map((t) => {
          const qs = Array.isArray(t.questions) ? t.questions : []
          const cap = capFor(qs)
          return (
            <div
              key={t.id}
              className="card"
              style={{
                marginBottom: 10,
                padding: '12px 14px',
                borderLeft: t.is_global ? '4px solid #f59e0b' : '4px solid #38bdf8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{t.name}</strong>
                  {t.is_global && (
                    <span className="pill" style={{ fontSize: 11, fontWeight: 'bold', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)', color: '#d97706' }}>
                      <Icon name="star" size={11} /> GLOBAL
                    </span>
                  )}
                  <span className="pill ok" style={{ fontSize: 11 }}>{qs.length} questions</span>
                </div>
                {qs.length > 0 && (
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                    {qs.slice(0, 6).map((q) => q.label).join(' · ')}
                    {qs.length > 6 ? ' …' : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {qs.length > 1 && (
                    <label className="field compact" style={{ margin: 0, width: 110 }}>
                      <span style={{ fontSize: 10 }}>
                        Questions{maxQsPerSurvey > 0 ? ` (max ${maxQsPerSurvey})` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn small"
                          style={{ fontSize: 11, padding: '2px 8px', minWidth: 0 }}
                          onClick={() =>
                            setUseCounts((c) => ({
                              ...c,
                              [t.id]: Math.max(1, (c[t.id] ?? cap) - 1),
                            }))
                          }
                          disabled={busyId === t.id}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 12, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                          {Math.min(useCounts[t.id] ?? cap, cap)} / {cap}
                        </span>
                        <button
                          type="button"
                          className="btn small"
                          style={{ fontSize: 11, padding: '2px 8px', minWidth: 0 }}
                          onClick={() =>
                            setUseCounts((c) => ({
                              ...c,
                              [t.id]: Math.min(cap, (c[t.id] ?? cap) + 1),
                            }))
                          }
                          disabled={busyId === t.id}
                        >
                          +
                        </button>
                      </div>
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn small primary"
                    disabled={busyId === t.id}
                    onClick={() => useTemplate(t)}
                  >
                    {busyId === t.id ? '…' : 'Use template → survey'}
                  </button>
                </div>
                {canCrud && (
                  <button type="button" className="btn small" onClick={() => startDuplicate(t)}>
                    Duplicate
                  </button>
                )}
                {canCrud && !(t.is_global && !isSuper) && (
                  <>
                    <button type="button" className="btn small" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <button type="button" className="btn small danger" disabled={busyId === t.id} onClick={() => void remove(t)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
