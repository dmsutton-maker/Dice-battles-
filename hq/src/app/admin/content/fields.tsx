import { supabaseServer } from '@/lib/supabase/server';

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
  const { data } = await supabase.from('site_content').select('key, value');
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
  };
}

/** The note every list carries, so the add/remove rule is never a guess. */
export function ListHint({ what }: { what: string }) {
  return (
    <p className="faint" style={{ marginTop: -2 }}>
      Fill an empty box to add {what}. Clear one out to remove it.
    </p>
  );
}
