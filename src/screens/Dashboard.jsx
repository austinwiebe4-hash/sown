import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ streak: 0, longestStreak: 0, totalChapters: 0, totalVerses: 0 })
  const [loading, setLoading] = useState(true)
  const [calendar, setCalendar] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const [chaptersResult, versesResult, datesResult] = await Promise.all([
          supabase.from('chapters_read').select('*', { count: 'exact', head: true }),
          supabase.from('verses').select('*', { count: 'exact', head: true }),
          supabase.from('chapters_read').select('date_read').order('date_read', { ascending: false }),
        ])

        const totalChapters = chaptersResult.count || 0
        const totalVerses = versesResult.count || 0
        const dates = datesResult.data || []

      // Build calendar for last 14 days
      const last14 = last14Days()
      const calMap = {}
      last14.forEach(d => { calMap[d] = false })
      const uniqueDates = [...new Set(dates?.map(r => r.date_read) || [])].sort((a, b) => b.localeCompare(a))
      uniqueDates.forEach(d => { if (Object.prototype.hasOwnProperty.call(calMap, d)) calMap[d] = true })
      setCalendar(calMap)

      // Calculate current streak (with 1-day grace)
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

      // Calculate longest streak
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
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="page">
      <p className="sown-tagline">Sown</p>
      <h1 className="page-title">{getGreeting()}.</h1>

      {loading ? (
        <div className="loading-row">Loading…</div>
      ) : (
        <>
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
              <span className="stat-number">{stats.totalChapters}</span>
              <span className="stat-label">Chapters read</span>
            </div>
          </div>

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

          <div className="quick-actions">
            <button className="btn-primary" onClick={() => navigate('/tracker')}>Log a chapter</button>
            <button className="btn-secondary" onClick={() => navigate('/verses')}>Add a verse</button>
          </div>
        </>
      )}
    </div>
  )
}
