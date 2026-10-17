import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Where the emailed sign-in link lands. Trades the one-time code for a
 * session cookie, then sends the person on to whatever they were trying
 * to reach.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only same-site paths, checked here as well as at the login page.
  const requested = searchParams.get('next') ?? '/admin';
  const next = /^\/(?![\/\\])/.test(requested) ? requested : '/admin';

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Only ever redirect inside this site — an open redirect here would
      // turn our own login email into a link to anywhere.
      const target = next.startsWith('/') ? next : '/admin';
      return NextResponse.redirect(`${origin}${target}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login`);
}
