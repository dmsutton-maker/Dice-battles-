import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The HQ token: how a build session proves it is allowed to read the
 * work queue, raise a question for the family, or send a push.
 *
 * One check, shared by /api/queue, /api/proposals and /api/push/announce,
 * which used to carry three copies of it. The token arrives in an
 * `x-hq-token` header, or as `Authorization: Bearer`, and is compared in
 * constant time — and only when the lengths already match, because
 * timingSafeEqual throws on a length mismatch.
 *
 * With no HQ_API_TOKEN set on the server, nothing is authorised: a
 * missing secret fails closed.
 */
export function hqTokenAuthorised(request: NextRequest): boolean {
  const expected = process.env.HQ_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied =
    request.headers.get('x-hq-token') ??
    (header.startsWith('Bearer ') ? header.slice(7) : '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The 401 every HQ-token route answers with. */
export function hqTokenDenied(): NextResponse {
  return NextResponse.json(
    { error: 'Send the HQ token in an x-hq-token header.' },
    { status: 401 },
  );
}
