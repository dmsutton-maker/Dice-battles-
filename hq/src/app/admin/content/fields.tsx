import { supabaseServer } from '@/lib/supabase/server';
import { storedIsNewer, type LegalCopy } from '@/lib/legalCopy';

/** Reading the stored copy, shaped for the editor forms. */

export interface QA {
  q: string;
  a: string;
}
export interface Pair {
  title: string;
  body: string;
}
export interface Section {
  heading: string;
  body: string;
}
export interface Label {
  label: string;
}

function padded<T>(rows: T[], total: number, blank: T): T[] {
  const out = rows.slice(0, total);
  while (out.length < total) out.push(blank);
  return out;
}

export async function loadContent() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('site_content').select('key, value, updated_at');
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));

  return {
    text: (key: string): string => (byKey.get(key) as string) ?? '',
    qa: (key: string, slots: number): QA[] =>
      padded((byKey.get(key) as QA[]) ?? [], slots, { q: '', a: '' }),
    pairs: (key: string, slots: number): Pair[] =>
      padded((byKey.get(key) as Pair[]) ?? [], slots, { title: '', body: '' }),
    sections: (key: string, slots: number): Section[] =>
      padded((byKey.get(key) as Section[]) ?? [], slots, { heading: '', body: '' }),
    labels: (key: string, slots: number): Label[] =>
      padded((byKey.get(key) as Label[]) ?? [], slots, { label: '' }),
    /** When anything under a key prefix was last saved, or null. */
    savedAt: (prefix: string): Date | null => {
      const times = (data ?? [])
        .filter((row) => row.key.startsWith(prefix) && row.updated_at)
        .map((row) => new Date(row.updated_at as string).getTime())
        .filter((ms) => Number.isFinite(ms));
      return times.length ? new Date(Math.max(...times)) : null;
    },
  };
}

/**
 * The legal pages' editor opens on whichever copy the public page is
 * showing (lib/legalCopy.ts): the saved copy if it is newer than the
 * code's, the code's otherwise. Saving then stores what was on screen,
 * never an older policy than the live one.
 */
export function legalFormCopy(
  c: Awaited<ReturnType<typeof loadContent>>,
  prefix: 'privacy' | 'terms',
  copy: LegalCopy,
): { intro: string; sections: Section[]; fromCode: boolean } {
  if (storedIsNewer(copy, c.savedAt(`${prefix}.`))) {
    return { intro: c.text(`${prefix}.intro`), sections: c.sections(`${prefix}.sections`, 16), fromCode: false };
  }
  return { intro: copy.intro, sections: padded(copy.sections, 16, { heading: '', body: '' }), fromCode: true };
}

/** The note every list carries, so the add/remove rule is never a guess. */
export function ListHint({ what }: { what: string }) {
  return (
    <p className="faint" style={{ marginTop: -2 }}>
      Fill an empty box to add {what}. Clear one out to remove it.
    </p>
  );
}

/**
 * The title and the sentence a search result or a link preview shows.
 *
 * Every public page has these two, they are what Google and every chat
 * app quote, and until 7 Sep 2026 they were the one thing on the site
 * nobody could edit — hard-coded in the page files while this admin's
 * own index promised "everything written on the public site".
 */
export function SearchFields({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <label style={{ marginTop: 22 }}>SEARCH AND LINK PREVIEWS</label>
      <p className="faint" style={{ marginTop: -2 }}>
        What Google shows, and what appears when somebody pastes a link to
        this page into a message. Leave a box empty to keep the wording
        that ships with the site.
      </p>
      <input
        name="metaTitle"
        defaultValue={title}
        placeholder="Page title — about 60 characters"
        maxLength={70}
        style={{ fontWeight: 800 }}
      />
      <textarea
        name="metaDescription"
        defaultValue={description}
        placeholder="One sentence — about 155 characters"
        maxLength={200}
        style={{ minHeight: 70, marginTop: 4 }}
      />
    </>
  );
}
