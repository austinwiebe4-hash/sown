import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function makeBlankExercise(text, difficulty = 'medium') {
  const words = text.split(/\s+/)
  if (words.length < 4) return null

  const difficultyMap = { easy: 0.15, medium: 0.25, hard: 0.4 }
  const percent = difficultyMap[difficulty] || 0.25

  const candidates = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.replace(/[^a-zA-Z]/g, '').length > 3)

  const blankCount = Math.max(2, Math.floor(candidates.length * percent))
  const step = Math.floor(candidates.length / blankCount)
  const blanked = new Set()
  for (let i = 0; i < blankCount; i++) {
    const idx = Math.min(i * step, candidates.length - 1)
    blanked.add(candidates[idx].i)
  }

  const parts = words.map((w, i) => ({
    word: w,
    blanked: blanked.has(i),
    userInput: '',
    correct: null,
  }))

  return parts
}

function clean(s) {
  return s.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

export default function MemorizationMode() {
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(null)
  const [parts, setParts] = useState(null)
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(null)
  const [difficulty, setDifficulty] = useState('medium')
  const [sessionStarted, setSessionStarted] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('verses').select('*').not('note', 'is', null).neq('note', '')
      setVerses(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const pickVerse = useCallback((pool, diff = 'medium') => {
    const pickVerseRecursive = (versePool) => {
      if (!versePool.length) return
      const v = versePool[Math.floor(Math.random() * versePool.length)]
      const exercise = makeBlankExercise(v.note, diff)
      if (!exercise) {
        const rest = versePool.filter(x => x.id !== v.id)
        if (rest.length) pickVerseRecursive(rest)
        return
      }
      setCurrent(v)
      setParts(exercise)
      setChecked(false)
      setScore(null)
    }
    pickVerseRecursive(pool)
  }, [])

  function startSession() {
    setSessionStarted(true)
    pickVerse(verses, difficulty)
  }

  function handleInput(i, val) {
    setParts(p => p.map((part, idx) => idx === i ? { ...part, userInput: val } : part))
  }

  function checkAnswers() {
    let correct = 0, total = 0
    const updated = parts.map(part => {
      if (!part.blanked) return part
      total++
      const isCorrect = clean(part.userInput) === clean(part.word)
      if (isCorrect) correct++
      return { ...part, correct: isCorrect }
    })
    setParts(updated)
    setChecked(true)
    setScore({ correct, total })
  }

  if (loading) return <div className="page"><div className="loading-row">Loading…</div></div>

  if (!verses.length) {
    return (
      <div className="page">
        <h1 className="page-title">Memorization Mode</h1>
        <p className="empty-state">
          No verses with text yet. In the Verse Bank, write the full verse text in the Note field to use this mode.
        </p>
      </div>
    )
  }

  if (!sessionStarted) {
    return (
      <div className="page">
        <h1 className="page-title">Memorization Mode</h1>
        <p className="page-subtitle">Choose your difficulty level.</p>

        <div className="difficulty-selector">
          <div className="difficulty-option">
            <input type="radio" id="easy" name="difficulty" value="easy" checked={difficulty === 'easy'} onChange={e => setDifficulty(e.target.value)} />
            <label htmlFor="easy">
              <span className="diff-name">Easy</span>
              <span className="diff-desc">15% of words blanked</span>
            </label>
          </div>
          <div className="difficulty-option">
            <input type="radio" id="medium" name="difficulty" value="medium" checked={difficulty === 'medium'} onChange={e => setDifficulty(e.target.value)} />
            <label htmlFor="medium">
              <span className="diff-name">Medium</span>
              <span className="diff-desc">25% of words blanked</span>
            </label>
          </div>
          <div className="difficulty-option">
            <input type="radio" id="hard" name="difficulty" value="hard" checked={difficulty === 'hard'} onChange={e => setDifficulty(e.target.value)} />
            <label htmlFor="hard">
              <span className="diff-name">Hard</span>
              <span className="diff-desc">40% of words blanked</span>
            </label>
          </div>
        </div>

        <button className="btn-primary" onClick={startSession} style={{ width: '100%', marginTop: '20px' }}>Start practice</button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Memorization Mode</h1>
      <p className="page-subtitle">Fill in the missing words.</p>

      {current && (
        <div className="memo-card">
          <div className="memo-ref">{current.book} {current.chapter}:{current.verse}</div>
          {current.theme && <div className="memo-theme">{current.theme}</div>}

          <div className="memo-text">
            {parts.map((part, i) =>
              part.blanked ? (
                <span key={i} className="blank-wrap">
                  <input
                    className={`blank-input ${checked ? (part.correct ? 'correct' : 'incorrect') : ''}`}
                    type="text"
                    value={part.userInput}
                    onChange={e => handleInput(i, e.target.value)}
                    disabled={checked}
                    size={Math.max(part.word.length, 4)}
                    style={{ width: `${Math.max(part.word.length * 0.65 + 1, 3)}em` }}
                  />
                  {checked && !part.correct && (
                    <span className="correct-word">{part.word}</span>
                  )}
                </span>
              ) : (
                <span key={i} className="word-span">{part.word} </span>
              )
            )}
          </div>

          {checked && score && (
            <div className="score-row">
              {score.correct === score.total
                ? `Perfect — ${score.correct}/${score.total}`
                : `${score.correct} of ${score.total} correct`}
            </div>
          )}

          <div className="memo-actions">
            {!checked ? (
              <button className="btn-primary" onClick={checkAnswers}>Check answers</button>
            ) : (
              <button className="btn-primary" onClick={() => pickVerse(verses, difficulty)}>Next verse →</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
