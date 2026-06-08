import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_BOOK_NAMES } from '../lib/bibleData'
import { fetchVerse } from '../lib/bibleAPI'

function AddVerseForm({ onAdded }) {
  const [form, setForm] = useState({ book: 'Genesis', chapter: '', verse: '', theme: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function fetchVerseText() {
    if (!form.chapter || !form.verse) { setError('Chapter and verse are required.'); return }
    setFetching(true)
    setError('')
    const verseText = await fetchVerse(form.book, form.chapter, form.verse)
    setFetching(false)
    if (verseText) {
      set('note', verseText)
    } else {
      setError('Verse not found. Try entering it manually.')
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.chapter || !form.verse) { setError('Chapter and verse are required.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('verses').insert({
      book: form.book,
      chapter: parseInt(form.chapter),
      verse: form.verse,
      theme: form.theme,
      note: form.note,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm({ book: 'Genesis', chapter: '', verse: '', theme: '', note: '' })
    setSaving(false)
    onAdded()
  }

  return (
    <form className="add-verse-form" onSubmit={submit}>
      <h3 className="form-title">Add a Verse</h3>
      <div className="form-row">
        <div className="form-group">
          <label>Book</label>
          <select value={form.book} onChange={e => set('book', e.target.value)}>
            {ALL_BOOK_NAMES.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="form-group narrow">
          <label>Chapter</label>
          <input type="number" min="1" value={form.chapter} onChange={e => set('chapter', e.target.value)} placeholder="1" />
        </div>
        <div className="form-group narrow">
          <label>Verse(s)</label>
          <input type="text" value={form.verse} onChange={e => set('verse', e.target.value)} placeholder="3 or 5-9" />
        </div>
      </div>
      <button className="btn-secondary" type="button" onClick={fetchVerseText} disabled={fetching} style={{ marginBottom: '12px' }}>
        {fetching ? 'Looking up…' : 'Auto-fetch NIV'}
      </button>
      <div className="form-group">
        <label>Theme</label>
        <input type="text" value={form.theme} onChange={e => set('theme', e.target.value)} placeholder="e.g. faith, grace, prayer" />
      </div>
      <div className="form-group">
        <label>Note / Verse text</label>
        <textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Paste or auto-fetch the full verse text here to use Memorization Mode later." rows={4} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Verse'}</button>
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

  async function load() {
    try {
      const { data, error } = await supabase.from('verses').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setVerses(data ?? [])
    } catch (error) {
      console.error('Error loading verses:', error)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this verse?')) return
    try {
      await supabase.from('verses').delete().eq('id', id)
      setVerses(v => v.filter(x => x.id !== id))
    } catch (error) {
      console.error('Error deleting verse:', error)
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

  // Sort
  if (sortBy === 'newest') {
    filtered = [...filtered].reverse()
  } else if (sortBy === 'oldest') {
    // already sorted this way from DB
  } else if (sortBy === 'alphabetical') {
    filtered = [...filtered].sort((a, b) => `${a.book} ${a.chapter}`.localeCompare(`${b.book} ${b.chapter}`))
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Verse Bank</h1>
        <button className="btn-secondary small" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ Add verse'}
        </button>
      </div>

      {showForm && (
        <AddVerseForm onAdded={() => { setShowForm(false); load() }} />
      )}

      <div className="search-box">
        <input
          className="search-input"
          type="text"
          placeholder="Search verse reference, text, or keyword… (e.g. 'John 3:16' or 'faith')"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

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
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="alphabetical">By book</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-row">Loading…</div>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No verses found. {verses.length === 0 ? 'Add your first verse above.' : 'Try adjusting your filters.'}</p>
      ) : (
        <div className="verse-list">
          {filtered.map(v => <VerseCard key={v.id} verse={v} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  )
}
