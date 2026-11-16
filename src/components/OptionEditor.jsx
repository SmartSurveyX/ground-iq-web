import { useMemo, useState } from 'react'
import OptionPills from '../OptionPills'

/**
 * Answer-option editor.
 *
 * The pills are the source of truth: an option is added/edited/deleted as a
 * whole, so a comma inside it ("Yes, and it was already there") can never be
 * mistaken for a separator. For long lists there is a bulk editor that takes
 * exactly one option per line — again, no comma parsing.
 */
export default function OptionEditor({
  options = [],
  onChange,
  addLabel = '+ Add Option',
  addValue,
  accent = '#4f7dc6',
  disabled = false,
  selection = false,
}) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const list = useMemo(
    () => (Array.isArray(options) ? options.map((o) => String(o)).filter((o) => o.trim()) : []),
    [options],
  )

  const openBulk = () => {
    setBulkText(list.join('\n'))
    setBulkOpen(true)
  }

  const applyBulk = () => {
    const next = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    onChange?.(next)
    setBulkOpen(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', color: '#38bdf8' }}>
          {selection ? 'Active Option Pills' : 'Options'} · {list.length}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={bulkOpen ? () => setBulkOpen(false) : openBulk}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              color: '#4f7dc6',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {bulkOpen ? 'Cancel bulk edit' : 'Bulk paste (one per line)'}
          </button>
        )}
      </div>

      <OptionPills
        options={list.length > 0 ? list : []}
        onChange={onChange}
        addLabel={addLabel}
        addValue={addValue}
        accent={accent}
        disabled={disabled}
      />

      {bulkOpen && !disabled && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={Math.min(10, Math.max(3, bulkText.split('\n').length + 1))}
            placeholder={'One option per line\nYes, and it was already there\nNo it was removed'}
            style={{ width: '100%', fontSize: 12, fontFamily: 'inherit', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <button type="button" className="btn small primary" onClick={applyBulk}>
              Apply
            </button>
            <span className="muted" style={{ fontSize: 11 }}>
              Commas are kept inside a line — only line breaks split options.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
