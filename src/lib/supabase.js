import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidSupabaseUrl(value) {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return ['https:', 'http:'].includes(parsed.protocol)
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password
  } catch {
    return false
  }
}

function isPublicSupabaseKey(value) {
  if (!value || value.startsWith('sb_secret_')) return false
  if (value.startsWith('sb_publishable_')) return /^sb_publishable_[A-Za-z0-9_-]+$/.test(value)

  const parts = value.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')))
    return claims.role === 'anon'
  } catch {
    return false
  }
}

const isValidConfiguration = isValidSupabaseUrl(url) && isPublicSupabaseKey(anonKey)

export const supabase = isValidConfiguration ? createClient(url, anonKey) : null
export const isSupabaseConfigured = Boolean(supabase)
