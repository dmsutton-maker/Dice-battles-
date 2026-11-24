import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMOB_TOKEN_KEY, admobSettings, exchangeCode, syncAdmob } from '@/lib/admob';
import { currentMember, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Where Google sends the owner back after "Connect AdMob". Keeps the refresh token (server only,
 * `studio_secrets`) and reads the last five weeks of AdMob earnings straight away.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: NextRequest) {
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`/admin/sales?admob=${result}`, request.url));
    response.cookies.delete({ name: 'admob_state', path: '/api/admob' });
    return response;
  };
  const member = await currentMember();
  if (!member || member.role !== 'owner') return back('owner-only');
  const settings = admobSettings();
  if (!settings) return back('not-set-up');

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return back('declined');
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  if (!same(state, request.cookies.get('admob_state')?.value ?? '') || !code) return back('expired');

  try {
    const refreshToken = await exchangeCode(settings, code);
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from('studio_secrets')
      .upsert({ key: ADMOB_TOKEN_KEY, value: refreshToken, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    const result = await syncAdmob(supabase, 'connect', 90);
    return back(result.ok ? 'connected' : 'connected-but-failed');
  } catch {
    return back('failed');
  }
}
