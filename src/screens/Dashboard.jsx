import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { OLD_TESTAMENT, NEW_TESTAMENT } from '../lib/bibleData'
import Toast from '../components/Toast'

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function last14Days() {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }))
  }
  return days
}

function SettingsModal({ onClose }) {
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem('sown_reminder_time') || '08:00')
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('sown_reminder_enabled') === 'true')

  function handleSave() {
    localStorage.setItem('sown_reminder_time', reminderTime)
    localStorage.setItem('sown_reminder_enabled', reminderEnabled)
    if (reminderEnabled) {
      setupNotifications()
    }
    onClose()
  }

  async function setupNotifications() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        scheduleReminder(reminderTime)
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          scheduleReminder(reminderTime)
        }
      }
    }
  }

  function scheduleReminder(time) {
    const [hours, minutes] = time.split(':')
    const now = new Date()
    const scheduledTime = new Date()
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const timeUntilReminder = scheduledTime - now
    localStorage.setItem('sown_next_reminder', scheduledTime.toISOString())

    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Time to read Scripture', {
          body: 'Open Sown to continue your reading plan',
          icon: '🌱'
        })
      }
      scheduleReminder(time)
    }, timeUntilReminder)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={e => setReminderEnabled(e.target.checked)}
            />
            Daily reading reminder
          </label>
        </div>
        {reminderEnabled && (
          <div className="form-group">
            <label>Reminder time</label>
            <input
              type="time"
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn-primary" onClick={handleSave}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function BookSelectionModal({ onSelect, onClose }) {
  const allBooks = [...OLD_TESTAMENT, ...NEW_TESTAMENT].map(b => b.book)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Choose a Book to Read</h2>
        <div className="book-selection-grid">
          {allBooks.map(book => (
            <button key={book} className="book-selection-btn" onClick={() => onSelect(book)}>
              {book}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ streak: 0, longestStreak: 0, totalChapters: 0, totalVerses: 0 })
  const [loading, setLoading] = useState(true)
  const [calendar, setCalendar] = useState({})
  const [verseOfDay, setVerseOfDay] = useState(null)
  const [currentBook, setCurrentBook] = useState(() => localStorage.getItem('sown_current_book'))
  const [currentBookProgress, setCurrentBookProgress] = useState({})
  const [showSettings, setShowSettings] = useState(false)
  const [showBookSelection, setShowBookSelection] = useState(false)
  const [allVerses, setAllVerses] = useState([])
  const [toast, setToast] = useState(null)
  const [loggingChapter, setLoggingChapter] = useState(false)

  async function load() {
    try {
      const [chaptersResult, versesResult, datesResult] = await Promise.all([
        supabase.from('chapters_read').select('*', { count: 'exact', head: true }),
        supabase.from('verses').select('*'),
        supabase.from('chapters_read').select('date_read, book, chapter').order('date_read', { ascending: false }),
      ])

      if (chaptersResult.error) throw new Error('Could not load reading progress')
      if (versesResult.error) throw new Error('Could not load verses')
      if (datesResult.error) throw new Error('Could not load calendar data')

      const totalChapters = chaptersResult.count || 0
      const versesData = versesResult.data || []
      const dates = datesResult.data || []

      setAllVerses(versesData)

        // Set verse of the day
        const today = todayStr()
        const cachedVerse = JSON.parse(localStorage.getItem('sown_verse_cache') || '{}')
        if (cachedVerse.date === today && cachedVerse.verse) {
          setVerseOfDay(cachedVerse.verse)
        } else if (versesData.length > 0) {
          const randomVerse = versesData[Math.floor(Math.random() * versesData.length)]
          setVerseOfDay(randomVerse)
          localStorage.setItem('sown_verse_cache', JSON.stringify({ date: today, verse: randomVerse }))
        }

        // Calculate book progress
        if (currentBook) {
          const bookProgress = {}
          const bookData = [...OLD_TESTAMENT, ...NEW_TESTAMENT].find(b => b.book === currentBook)
          if (bookData) {
            for (let ch = 1; ch <= bookData.chapters; ch++) {
              bookProgress[ch] = dates.some(d => d.book === currentBook && d.chapter === ch)
            }
            setCurrentBookProgress(bookProgress)
          }
        }

        const totalVerses = versesData.length
        const uniqueDates = [...new Set(dates.map(r => r.date_read))].sort((a, b) => b.localeCompare(a))

        // Build calendar
        const last14 = last14Days()
        const calMap = {}
        last14.forEach(d => { calMap[d] = false })
        uniqueDates.forEach(d => { if (Object.prototype.hasOwnProperty.call(calMap, d)) calMap[d] = true })
        setCalendar(calMap)

        // Calculate streaks
        let streak = 0
        if (uniqueDates.length > 0) {
          const today = todayStr()
          let cursor = today
          for (const d of uniqueDates) {
            if (d === cursor) {
              streak++
              const dt = new Date(cursor + 'T12:00:00')
              dt.setDate(dt.getDate() - 1)
              cursor = dt.toLocaleDateString('en-CA')
            } else if (d < cursor) {
              break
            }
          }
        }

        let longestStreak = 0
        if (uniqueDates.length > 0) {
          let tempStreak = 1
          for (let i = 0; i < uniqueDates.length - 1; i++) {
            const curr = new Date(uniqueDates[i] + 'T12:00:00')
            const next = new Date(uniqueDates[i + 1] + 'T12:00:00')
            const dayDiff = Math.floor((curr - next) / 86400000)
            if (dayDiff === 1) {
              tempStreak++
            } else if (dayDiff > 1) {
              longestStreak = Math.max(longestStreak, tempStreak)
              tempStreak = 1
            }
          }
          longestStreak = Math.max(longestStreak, tempStreak)
        }

      setStats({ streak, longestStreak, totalChapters, totalVerses })
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setToast({ message: `✕ ${error.message}`, type: 'error' })
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [currentBook])

  function handleSelectBook(book) {
    localStorage.setItem('sown_current_book', book)
    setCurrentBook(book)
    setShowBookSelection(false)
  }

  async function handleQuickLogChapter() {
    if (!currentBook || loggingChapter) return

    const bookData = [...OLD_TESTAMENT, ...NEW_TESTAMENT].find(b => b.book === currentBook)
    if (!bookData) return

    // Find next unread chapter
    let nextChapter = null
    for (let ch = 1; ch <= bookData.chapters; ch++) {
      if (!currentBookProgress[ch]) {
        nextChapter = ch
        break
      }
    }

    if (!nextChapter) {
      setToast({ message: '✓ Book complete! Choose your next book.', type: 'success' })
      setShowBookSelection(true)
      return
    }

    setLoggingChapter(true)
    try {
      const date = todayStr()
      const { error } = await supabase.from('chapters_read').insert({
        book: currentBook,
        chapter: nextChapter,
        date_read: date
      })

      if (error) throw error

      // Update local state
      setCurrentBookProgress(p => ({ ...p, [nextChapter]: true }))
      setToast({ message: `✓ Chapter ${nextChapter} logged!`, type: 'success' })

      // Refresh dashboard stats
      load()
    } catch (error) {
      setToast({ message: `✕ Failed to log chapter: ${error.message}`, type: 'error' })
    } finally {
      setLoggingChapter(false)
    }
  }

  function handleCompleteBook() {
    if (window.confirm(`Finished reading ${currentBook}? Choose your next book.`)) {
      localStorage.removeItem('sown_current_book')
      setCurrentBook(null)
      setCurrentBookProgress({})
      setShowBookSelection(true)
    }
  }

  const bookData = [...OLD_TESTAMENT, ...NEW_TESTAMENT].find(b => b.book === currentBook)
  const chaptersRead = currentBook ? Object.values(currentBookProgress).filter(Boolean).length : 0
  const totalBookChapters = bookData?.chapters || 0

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p className="sown-tagline">Sown</p>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙️</button>
      </div>

      <h1 className="page-title">{getGreeting()}.</h1>

      {loading ? (
        <div className="loading-row">Loading…</div>
      ) : (
        <>
          {/* Verse of the Day */}
          {verseOfDay && (
            <div className="verse-of-day">
              <p className="verse-of-day-label">Verse of the day</p>
              <p className="verse-of-day-ref">{verseOfDay.book} {verseOfDay.chapter}:{verseOfDay.verse}</p>
              <p className="verse-of-day-text">{verseOfDay.note || '(Add verse text in Verse Bank)'}</p>
              {verseOfDay.theme && <p className="verse-of-day-theme">{verseOfDay.theme}</p>}
            </div>
          )}

          {/* Current Book */}
          {currentBook ? (
            <div className="current-book">
              <h3 className="current-book-title">Currently reading: {currentBook}</h3>
              <div className="progress-bar-wrap large">
                <div className="progress-bar-fill" style={{ width: `${(chaptersRead / totalBookChapters) * 100}%` }} />
              </div>
              <p className="progress-label">{chaptersRead} of {totalBookChapters} chapters</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexDirection: 'column' }}>
                <button
                  className="btn-primary"
                  onClick={handleQuickLogChapter}
                  disabled={loggingChapter || chaptersRead >= totalBookChapters}
                  style={{ fontSize: '1rem', fontWeight: 500 }}
                >
                  {loggingChapter ? 'Saving...' : chaptersRead >= totalBookChapters ? '✓ Completed!' : `📖 Read Chapter ${chaptersRead + 1}`}
                </button>
                <button className="btn-secondary" onClick={handleCompleteBook}>Change book</button>
              </div>
            </div>
          ) : (
            <div className="empty-book-section">
              <p className="empty-book-text">No current book selected</p>
              <button className="btn-primary" onClick={() => setShowBookSelection(true)}>Start a book</button>
            </div>
          )}

          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-number">{stats.streak}</span>
              <span className="stat-label">Current streak</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.longestStreak}</span>
              <span className="stat-label">Longest streak</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.totalVerses}</span>
              <span className="stat-label">Verses saved</span>
            </div>
          </div>

          {/* Calendar */}
          <div className="calendar-section">
            <h2 className="calendar-title">Last 14 days</h2>
            <div className="calendar-grid">
              {last14Days().map(date => (
                <div
                  key={date}
                  className={`calendar-day ${calendar[date] ? 'active' : ''}`}
                  title={date}
                >
                  {new Date(date + 'T12:00:00').getDate()}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button className="btn-secondary" onClick={() => navigate('/verses')}>View verses</button>
            <button className="btn-secondary" onClick={() => navigate('/memorize')}>Memorize</button>
          </div>
        </>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showBookSelection && <BookSelectionModal onSelect={handleSelectBook} onClose={() => setShowBookSelection(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
