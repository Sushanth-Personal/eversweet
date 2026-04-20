import { createClient } from '@supabase/supabase-js'

// ── Browser client (uses anon key — safe to expose) ──────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Server client (uses service role — API routes only) ──────────
// Never import this in client components (files without 'use client')
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
