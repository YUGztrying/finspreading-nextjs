// src/lib/auth/require-user.ts
// Auth guard for API routes.
// Returns the authenticated user + a user-scoped Supabase client,
// or a 401 response if no valid session is present.
//
// Usage in every protected route:
//
//   const auth = await requireUser()
//   if (!auth.user) return auth.response
//   const { user, supabase } = auth
//   // ...use user.id — NEVER trust user_id from request body/query

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type AuthSuccess = {
  user: { id: string; email: string | null }
  supabase: SupabaseClient<Database>
  response: null
}

type AuthFailure = {
  user: null
  supabase: null
  response: NextResponse
}

export type RequireUserResult = AuthSuccess | AuthFailure

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    supabase: supabase as SupabaseClient<Database>,
    response: null,
  }
}
