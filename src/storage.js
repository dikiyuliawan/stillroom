// Local-only persistence. Nothing is uploaded; if the browser refuses storage
// the editor simply works without remembering the session.

const SESSION_KEY = 'stillroom.session.v1'
const PRESETS_KEY = 'stillroom.presets.v1'

// Browsers cap localStorage near 5 MB. Keep the photo well under that so the
// settings always fit, and fall back to settings-only for big imports.
const MAX_PHOTO_BYTES = 3_200_000

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadSession() {
  const session = read(SESSION_KEY, null)
  if (!session || typeof session !== 'object') return null
  return session
}

export function saveSession(session) {
  return write(SESSION_KEY, session)
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function loadPresets() {
  const presets = read(PRESETS_KEY, [])
  return Array.isArray(presets) ? presets : []
}

export function savePresets(presets) {
  return write(PRESETS_KEY, presets)
}

// Read a dropped/imported file as a data URL when it is small enough to persist.
export function fileToPersistableUrl(file) {
  if (!file || file.size > MAX_PHOTO_BYTES) return Promise.resolve(null)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
