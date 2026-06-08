import bibleData from './niv1984.json'

/**
 * Fetch a Bible verse by reference (e.g., "Genesis 1:1" or "Gen 1:1")
 * Returns the verse text or null if not found
 */
export async function fetchVerse(book, chapter, verse) {
  try {
    // Normalize book name
    const normalizedBook = normalizeBookName(book)

    if (!bibleData[normalizedBook]) {
      return null
    }

    // Try to find the chapter - it might be stored with different chapter numbers
    // due to PDF parsing issues
    const bookData = bibleData[normalizedBook]

    // First try exact chapter match
    if (bookData[chapter]) {
      const verseText = bookData[chapter][verse]
      if (verseText) {
        return verseText
      }
    }

    // If not found, try to find in any chapter (fallback for parsing issues)
    for (const ch in bookData) {
      if (bookData[ch][verse]) {
        return bookData[ch][verse]
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching verse:', error)
    return null
  }
}

/**
 * Normalize book names to match the Bible data structure
 * Handles common abbreviations and variations
 */
function normalizeBookName(name) {
  if (!name) return null

  // Map of common abbreviations to full names
  const bookAbbreviations = {
    'Gen': 'Genesis',
    'Ex': 'Exodus',
    'Lev': 'Leviticus',
    'Num': 'Numbers',
    'Deut': 'Deuteronomy',
    'Josh': 'Joshua',
    'Judg': 'Judges',
    'Sam': 'Samuel',
    'Kg': 'Kings',
    'Chr': 'Chronicles',
    'Ps': 'Psalms',
    'Prov': 'Proverbs',
    'Ecc': 'Ecclesiastes',
    'Isa': 'Isaiah',
    'Jer': 'Jeremiah',
    'Lam': 'Lamentations',
    'Ezek': 'Ezekiel',
    'Dan': 'Daniel',
    'Hos': 'Hosea',
    'Obad': 'Obadiah',
    'Mic': 'Micah',
    'Nah': 'Nahum',
    'Hab': 'Habakkuk',
    'Zeph': 'Zephaniah',
    'Hag': 'Haggai',
    'Zech': 'Zechariah',
    'Mal': 'Malachi',
    'Matt': 'Matthew',
    'Mk': 'Mark',
    'Lk': 'Luke',
    'Jn': 'John',
    'Rom': 'Romans',
    'Cor': 'Corinthians',
    'Gal': 'Galatians',
    'Eph': 'Ephesians',
    'Phil': 'Philippians',
    'Col': 'Colossians',
    'Thess': 'Thessalonians',
    'Tim': 'Timothy',
    'Titus': 'Titus',
    'Phlm': 'Philemon',
    'Heb': 'Hebrews',
    'Jas': 'James',
    'Pet': 'Peter',
    'Jn': 'John',
    'Jude': 'Jude',
    'Rev': 'Revelation',
  }

  // Remove whitespace and convert to title case
  let normalized = name.trim()

  // Check if it's an abbreviation
  for (const [abbr, fullName] of Object.entries(bookAbbreviations)) {
    if (normalized.toLowerCase().startsWith(abbr.toLowerCase())) {
      normalized = fullName
      break
    }
  }

  // Handle number prefixes (1 Samuel, 2 Kings, etc.)
  const numberMatch = normalized.match(/^(\d+)\s*(.+)/)
  if (numberMatch) {
    const num = numberMatch[1]
    const rest = numberMatch[2]
    // Convert to "1st Samuel" format
    const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th'
    normalized = `${num}${suffix} ${rest}`
  }

  // Ensure title case
  normalized = normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return normalized
}

/**
 * Get all verses for a reference range (e.g., "Genesis 1:1-5")
 */
export async function fetchVerseRange(book, chapter, startVerse, endVerse) {
  const verses = []
  const start = parseInt(startVerse)
  const end = parseInt(endVerse)

  for (let v = start; v <= end; v++) {
    const text = await fetchVerse(book, chapter, v.toString())
    if (text) {
      verses.push(`${v} ${text}`)
    }
  }

  return verses.join(' ')
}
