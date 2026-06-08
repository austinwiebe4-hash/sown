import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OLD_TESTAMENT, NEW_TESTAMENT, TOTAL_CHAPTERS } from '../lib/bibleData'
import Toast from '../components/Toast'

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function BookSection({ title, books, readMap, onToggle }) {
  const [expanded, setExpanded] = useState({})

  const totalRead = books.reduce((sum, b) => {
    for (let c = 1; c <= b.chapters; c++) {
      if (readMap[`${b.book}-${c}`]) sum++
    }
    return sum
  }, 0)
  const totalChapters = books.reduce((sum, b) => sum + b.chapters, 0)

  return (
    <div className="book-section">
      <h2 className="section-heading">{title}</h2>
      <div className="section-progress-row">
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${(totalRead / totalChapters) * 100}%` }} />
        </div>
        <span className="progress-label">{totalRead} / {totalChapters}</span>
      </div>

      <div className="book-list">
        {books.map(({ book, chapters }) => {
          const bookRead = Array.from({ length: chapters }, (_, i) => readMap[`${book}-${i + 1}`]).filter(Boolean).length
          const isOpen = expanded[book]
          return (
            <div key={book} className="book-item">
              <button
                className="book-header"
                onClick={() => setExpanded(e => ({ ...e, [book]: !e[book] }))}
              >
                <span className="book-name">{book}</span>
                <span className="book-progress">{bookRead}/{chapters}</span>
                <span className="book-chevron">{isOpen ? '▲' : '▼'}</span>
              </button>
              {bookRead > 0 && (
                <div className="book-progress-bar-wrap">
                  <div className="book-progress-bar-fill" style={{ width: `${(bookRead / chapters) * 100}%` }} />
                </div>
              )}
              {isOpen && (
                <div className="chapter-grid">
                  {Array.from({ length: chapters }, (_, i) => {
                    const ch = i + 1
                    const key = `${book}-${ch}`
                    const entry = readMap[key]
                    return (
                      <label key={ch} className={`chapter-cell ${entry ? 'read' : ''}`} title={entry ? `Read ${entry}` : ''}>
                        <input
                          type="checkbox"
                          checked={!!entry}
                          onChange={() => onToggle(book, ch, !!entry)}
                        />
                        <span>{ch}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ReadingTracker() {
  const [readMap, setReadMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('chapters_read').select('book, chapter, date_read')
        if (error) throw error
        const map = {}
        data?.forEach(r => { map[`${r.book}-${r.chapter}`] = r.date_read })
        setReadMap(map)
      } catch (error) {
        setToast({ message: `✕ Failed to load: ${error.message}`, type: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleToggle(book, chapter, alreadyRead) {
    const key = `${book}-${chapter}`
    const previousMap = readMap

    try {
      if (alreadyRead) {
        setReadMap(m => { const n = { ...m }; delete n[key]; return n })
        const { error } = await supabase.from('chapters_read').delete().match({ book, chapter })
        if (error) throw error
        setToast({ message: '✓ Chapter removed', type: 'success' })
      } else {
        const date = todayStr()
        setReadMap(m => ({ ...m, [key]: date }))
        const { error } = await supabase.from('chapters_read').insert({ book, chapter, date_read: date })
        if (error) throw error
        setToast({ message: `✓ Chapter ${chapter} logged!`, type: 'success' })
      }
    } catch (error) {
      setReadMap(previousMap)
      setToast({ message: `✕ Failed: ${error.message}`, type: 'error' })
    }
  }

  const totalRead = Object.keys(readMap).length

  return (
    <div className="page">
      <h1 className="page-title">Reading Tracker</h1>
      <div className="overall-progress">
        <div className="progress-bar-wrap large">
          <div className="progress-bar-fill" style={{ width: `${(totalRead / TOTAL_CHAPTERS) * 100}%` }} />
        </div>
        <span className="progress-label">{totalRead} of {TOTAL_CHAPTERS} chapters — {((totalRead / TOTAL_CHAPTERS) * 100).toFixed(1)}%</span>
      </div>

      {loading ? (
        <div className="loading-row">Loading…</div>
      ) : (
        <>
          <BookSection title="Old Testament" books={OLD_TESTAMENT} readMap={readMap} onToggle={handleToggle} />
          <BookSection title="New Testament" books={NEW_TESTAMENT} readMap={readMap} onToggle={handleToggle} />
        </>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
