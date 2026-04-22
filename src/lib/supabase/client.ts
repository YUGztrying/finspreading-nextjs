// src/lib/supabase/client.ts
// Supabase client for Client Components (browser).
//
// IMPORTANT: uses @supabase/ssr's createBrowserClient (not the raw
// @supabase/supabase-js createClient). The SSR package stores the session
// in HTTP cookies so it's readable by the server-side middleware at
// src/middleware.ts. The raw client stores it in localStorage only, which
// the middleware cannot see — that mismatch caused an infinite redirect
// loop where login succeeded in Supabase but the middleware kept sending
// authenticated users back to /login.
//
// createBrowserClient is also idempotent per storage key, which eliminates
// the "Multiple GoTrueClient instances detected" console warning.

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}