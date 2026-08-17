import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Supabase, as seen from the server.
 *
 * Two doors, on purpose:
 *  - `supabaseServer()` acts AS THE SIGNED-IN PERSON, so the database's
 *    own row-level rules decide what they can see and change. A kid
 *    cannot approve their own idea even if the page let them click it.
 *  - `supabaseAdmin()` bypasses those rules and is used only by the
 *    machine-to-machine queue endpoint, which authenticates with its own
 *    token instead of a login.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy hq/.env.example to hq/.env.local (and set the same values in Vercel).`,
    );
  }
  return value;
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Service-role client. Never import this into anything a browser runs. */
export function supabaseAdmin() {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** The signed-in member, or null. Every HQ page starts here. */
export async function currentMember() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return data ?? null;
}
