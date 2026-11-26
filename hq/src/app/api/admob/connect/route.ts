import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { admobSettings, consentUrl } from '@/lib/admob';
import { currentMember } from '@/lib/supabase/server';

/**
 * "Connect AdMob" on /admin/sales: sends the owner to Google to allow read-only AdMob access.
 * The answer comes back to /api/admob/callback. See lib/admob.ts.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return NextResponse.redirect(new URL('/login?next=/admin/sales', request.url));
  if (member.role !== 'owner') return NextResponse.json({ error: 'Owner only.' }, { status: 403 });
  const settings = admobSettings();
  if (!settings) {
    return NextResponse.redirect(new URL('/admin/sales?admob=not-set-up', request.url));
  }
  const state = randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(consentUrl(settings, state));
  response.cookies.set('admob_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/admob',
    maxAge: 600,
  });
  return response;
}
