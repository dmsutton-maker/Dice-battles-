import { supabaseAdmin } from './supabase/server';

/**
 * The editable text on the public pages — taglines, FAQ entries, legal
 * sections. Public pages fetch this through the service role (same
 * pattern as the queue API and the bug-report endpoint), never as a
 * signed-in user, since a visitor is never signed in.
 *
 * A missing key is never a broken page: every call site falls back to
 * the copy baked into that page's own code.
 */
export type ContentMap = Record<string, unknown>;

export async function getSiteContent(): Promise<ContentMap> {
  /*
    A THROW here takes the whole public site down, so it cannot escape.

    `supabaseAdmin()` throws outright when SUPABASE_SERVICE_ROLE_KEY or
    the project URL is unset — a missing environment variable on a new
    deployment, or a key rotated without redeploying. Every caller
    already falls back to the copy in its own page file through text(),
    faqList() and the rest, so an empty map renders the complete site
    from code. A 500 renders nothing.
  */
  try {
    const { data, error } = await supabaseAdmin()
      .from('site_content')
      .select('key, value');

    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.key, row.value]));
  } catch {
    return {};
  }
}

export function text(content: ContentMap, key: string, fallback: string): string {
  const value = content[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export interface QA {
  q: string;
  a: string;
}

export function faqList(content: ContentMap, key: string, fallback: QA[]): QA[] {
  const value = content[key];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .filter((v): v is QA => typeof v?.q === 'string' && typeof v?.a === 'string')
    .filter((v) => v.q.trim() !== '');
}

export interface Highlight {
  title: string;
  body: string;
}

export function highlightList(
  content: ContentMap,
  key: string,
  fallback: Highlight[],
): Highlight[] {
  const value = content[key];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .filter((v): v is Highlight => typeof v?.title === 'string' && typeof v?.body === 'string')
    .filter((v) => v.title.trim() !== '');
}

export interface Section {
  heading: string;
  body: string;
}

export function sectionList(
  content: ContentMap,
  key: string,
  fallback: Section[],
): Section[] {
  const value = content[key];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .filter((v): v is Section => typeof v?.heading === 'string' && typeof v?.body === 'string')
    .filter((v) => v.heading.trim() !== '');
}

export interface LabelItem {
  label: string;
}

/** A list of short badge labels — the "No ads" pills and the like. */
export function labelList(
  content: ContentMap,
  key: string,
  fallback: string[],
): string[] {
  const value = content[key];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .map((v) => (typeof v === 'string' ? v : (v as LabelItem)?.label))
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/**
 * When the copy under a key prefix was last edited.
 *
 * The legal pages carried "Last updated August 2026" as a literal, so
 * every edit David makes in the admin changes the policy and leaves the
 * date claiming otherwise — on the two pages where the date is part of
 * what the page is FOR. Wrapped like getSiteContent, because a missing
 * service key must not take a page down: null falls back to the literal.
 */
export async function getContentUpdatedAt(prefix: string): Promise<Date | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('site_content')
      .select('updated_at')
      .like('key', `${prefix}%`)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const when = new Date(data[0].updated_at as string);
    return Number.isNaN(when.getTime()) ? null : when;
  } catch {
    return null;
  }
}

/** "August 2026", from a date or from the fallback when there is none. */
export function monthYear(when: Date | null, fallback: string): string {
  if (!when) return fallback;
  return when.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
