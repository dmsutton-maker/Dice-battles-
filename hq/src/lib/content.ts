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
  const { data, error } = await supabaseAdmin()
    .from('site_content')
    .select('key, value');

  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
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
