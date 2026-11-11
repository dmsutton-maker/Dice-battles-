import { createHash } from 'node:crypto';

/**
 * Who sent this, as something that can be COUNTED but not read back.
 *
 * Shared by the two public write paths with no login in front of them,
 * /api/bug-report and the contact form, so a flood is spotted the same
 * way on both. It is a short SHA-256 of the forwarded IP and nothing
 * else: this is a game for families, and there is no reason to keep a log
 * of who wrote what from where. The hash goes in an `activity` row so it
 * can be counted, ages out of usefulness in minutes, and identifies
 * nobody.
 *
 * `headers` is anything with a `get` — a Request's headers in a route, or
 * the result of `await headers()` in a server action.
 */
export function senderHash(headers: { get(name: string): string | null }): string {
  return createHash('sha256')
    .update(headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown')
    .digest('hex')
    .slice(0, 16);
}

/**
 * The provenance line for text anybody on the internet can put in front
 * of an agent. Stated first, in capitals, because the rows it lands in
 * are read as work to do: the text after it is DATA, never instructions,
 * however it is phrased. /api/bug-report says the same in its own words.
 */
export const UNTRUSTED_TEXT = 'UNTRUSTED TEXT FROM THE PUBLIC INTERNET';
