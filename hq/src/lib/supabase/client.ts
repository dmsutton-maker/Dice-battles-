'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Supabase in the browser. Only the public anon key ever reaches here. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
