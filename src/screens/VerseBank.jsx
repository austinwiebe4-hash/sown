import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_BOOK_NAMES } from '../lib/bibleData'
import { fetchVerse } from '../lib/bibleAPI'
import Toast from '../components/Toast'

function AddVerseForm({ onAdded, existingVerses }) {
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [theme, setTheme] = useState('')
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [verseText, setVerseText] = useState('')

  async function handleFetchVerse() {
    if (!reference.trim()) { setError('Enter verse reference (e.g., John 3:16)'); return }

    setFetching(true)
    setError('')

    // Parse reference: "John 3:16" or "John 3:16-18"
    const match = reference.match(/^([\d\w\s]+?)\s+(\d+):(\d+.*)$/)
    if (!match) { setError('Format: Book Chapter:Verse (e.g., John 3:16)'); setFetching(false); return }

    const book = match[1].trim()
    const chapter = match[2]
    const verse = match[3]

    const text = await fetchVerse(book, chapter, verse)
    setFetching(false)

    if (text) {
      setVerseText(text)
      setNote(text)
    } else {
      setError('Verse not found. Check spelling or enter text manually.')
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!reference.trim() || !note.trim()) { setError('Verse reference and text required'); return }

    const match = reference.match(/^([\d\w\s]+?)\s+(\d+):(\d+.*)$/)
    if (!match) { setError('Invalid reference format'); return }

    const book = match[1].trim()
    const chapter = parseInt(match[2])
    const verse = match[3]

    // Check for duplicates
    const duplicate = existingVerses?.some(v => v.book === book && v.chapter === chapter && v.verse === verse)
    if (duplicate) {
      setError('This verse is already saved! View it in your verse bank.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error: err } = await supabase.from('verses').insert({
        book,
        chapter,
        verse,
        theme: theme.trim() || null,
        note,
      })

      if (err) throw err

      setReference('')
      setNote('')
      setTheme('')
      setVerseText('')
      setSaving(false)
      onAdded()
    } catch (error) {
      setError(`✕ Failed to save: ${error.message}`)
      setSaving(false)
    }
  }

  return (
    <form className="add-verse-form" onSubmit={submit}>
      <h3 className="form-title">Add a Verse</h3>

      <div className="form-group">
        <label>Verse reference</label>
        <input
          type="text"
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder="e.g., John 3:16 or John 3:16-18"
        />
      </div>

      <button className="btn-secondary" type="button" onClick={handleFetchVerse} disabled={fetching} style={{ marginBottom: '12px', width: '100%' }}>
        {fetching ? 'Searching…' : 'Search NIV 1984'}
      </button>

      {verseText && <p className="verse-preview">{verseText}</p>}

      <div className="form-group">
        <label>Verse text (edit if needed)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Retrieved verse text will appear here"
          rows={4}
        />
      </div>

      <div className="form-group">
        <label>Theme (optional)</label>
        <input
          type="text"
          value={theme}
          onChange={e => setTheme(e.target.value)}
          placeholder="e.g., faith, grace, hope"
        />
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
        {saving ? 'Saving…' : 'Save Verse'}
      </button>
    </form>
  )
}

function VerseCard({ verse, onDelete }) {
  return (
    <div className="verse-card">
      <div className="verse-card-header">
        <span className="verse-ref">{verse.book} {verse.chapter}:{verse.verse}</span>
        {verse.theme && <span className="theme-tag">{verse.theme}</span>}
        <button className="delete-btn" onClick={() => onDelete(verse.id)}>×</button>
      </div>
      {verse.note && <p className="verse-note">{verse.note}</p>}
    </div>
  )
}

export default function VerseBank() {
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bookFilter, setBookFilter] = useState('')
  const [themeFilter, setThemeFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)

  async function load() {
    try {
      const { data, error } = await supabase.from('verses').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setVerses(data ?? [])
    } catch (error) {
      setToast({ message: `✕ Failed to load verses: ${error.message}`, type: 'error' })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this verse?')) return
    try {
      const { error } = await supabase.from('verses').delete().eq('id', id)
      if (error) throw error
      setVerses(v => v.filter(x => x.id !== id))
      setToast({ message: '✓ Verse deleted', type: 'success' })
    } catch (error) {
      setToast({ message: `✕ Failed to delete: ${error.message}`, type: 'error' })
    }
  }

  const books = [...new Set(verses.map(v => v.book))].sort()
  const themes = [...new Set(verses.map(v => v.theme).filter(Boolean))].sort()

  let filtered = verses.filter(v => {
    const matchBook = !bookFilter || v.book === bookFilter
    const matchTheme = !themeFilter || v.theme === themeFilter
    const q = search.toLowerCase().trim()

    let matchSearch = true
    if (q) {
      const verseRef = `${v.book} ${v.chapter}:${v.verse}`.toLowerCase()
      const verseText = (v.note || '').toLowerCase()
      const bookName = v.book.toLowerCase()
      const theme = (v.theme || '').toLowerCase()
      matchSearch = verseRef.includes(q) || verseText.includes(q) || bookName.includes(q) || theme.includes(q)
    }

    return matchBook && matchTheme && matchSearch
  })

  if (sortBy === 'newest') {
    filtered = [...filtered].reverse()
  } else if (sortBy === 'oldest') {
    // already sorted
  } else if (sortBy === 'alphabetical') {
    filtered = [...filtered].sort((a, b) => `${a.book} ${a.chapter}`.localeCompare(`${b.book} ${b.chapter}`))
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Verse Bank</h1>
        <button className="btn-secondary small" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <AddVerseForm onAdded={() => { setShowForm(false); load(); setToast({ message: '✓ Verse saved!', type: 'success' }) }} existingVerses={verses} />
      )}

      <div className="search-box">
        <input
          className="search-input"
          type="text"
          placeholder="Search verse, book, or keyword…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {verses.length > 0 && (
        <div className="filter-row">
          <select value={bookFilter} onChange={e => setBookFilter(e.target.value)}>
            <option value="">All books</option>
            {books.map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={themeFilter} onChange={e => setThemeFilter(e.target.value)}>
            <option value="">All themes</option>
            {themes.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alphabetical">By book</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="loading-row">Loading…</div>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No verses found. {verses.length === 0 ? 'Add your first verse above.' : 'Try adjusting your filters.'}</p>
      ) : (
        <div className="verse-list">
          {filtered.map(v => <VerseCard key={v.id} verse={v} onDelete={handleDelete} />)}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
