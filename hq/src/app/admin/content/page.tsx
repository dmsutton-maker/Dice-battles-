import { supabaseServer } from '@/lib/supabase/server';
import {
  updateDiceBattlesContent,
  updateHomeContent,
  updatePrivacyContent,
  updateSupportContent,
  updateTermsContent,
} from '../actions';

/**
 * Every editable word on the public site, in one place. A page reads
 * its copy from `site_content` at request time and falls back to what
 * is baked into its own code if a key is ever missing — so nothing here
 * can take a page blank, only out of date.
 */

interface QA {
  q: string;
  a: string;
}
interface Highlight {
  title: string;
  body: string;
}
interface Section {
  heading: string;
  body: string;
}

function padded<T>(rows: T[], total: number, blank: T): T[] {
  const out = rows.slice(0, total);
  while (out.length < total) out.push(blank);
  return out;
}

export default async function ContentPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('site_content').select('key, value');
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));

  const text = (key: string): string => (byKey.get(key) as string) ?? '';
  const faqRows = (key: string, slots: number): QA[] =>
    padded((byKey.get(key) as QA[]) ?? [], slots, { q: '', a: '' });
  const highlightRows = (key: string, slots: number): Highlight[] =>
    padded((byKey.get(key) as Highlight[]) ?? [], slots, { title: '', body: '' });
  const sectionRows = (key: string, slots: number): Section[] =>
    padded((byKey.get(key) as Section[]) ?? [], slots, { heading: '', body: '' });

  return (
    <>
      <p className="faint">
        What's on the public site — the home page, the Dice Battles app page,
        Support, Privacy and Terms. Save a section and it's live right away.
        There's room to grow every list below — leave a box blank to remove
        that item, or fill in an empty one to add a new one.
      </p>

      <details className="card" open>
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>🏠 Home</summary>
        <form action={updateHomeContent}>
          <label htmlFor="hero_tagline">HERO TAGLINE</label>
          <input id="hero_tagline" name="hero_tagline" defaultValue={text('home.hero_tagline')} />
          <label htmlFor="hero_subhead">HERO SUBHEAD</label>
          <textarea id="hero_subhead" name="hero_subhead" defaultValue={text('home.hero_subhead')} />
          <label htmlFor="about_body">WHO WE ARE</label>
          <textarea id="about_body" name="about_body" defaultValue={text('home.about_body')} />
          <label htmlFor="apps_card_tagline">DICE BATTLES CARD — TAGLINE</label>
          <input
            id="apps_card_tagline"
            name="apps_card_tagline"
            defaultValue={text('home.apps_card_tagline')}
          />
          <label htmlFor="apps_card_note">DICE BATTLES CARD — NOTE</label>
          <input id="apps_card_note" name="apps_card_note" defaultValue={text('home.apps_card_note')} />
          <div style={{ marginTop: 16 }}>
            <button type="submit">Save Home</button>
          </div>
        </form>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>🎲 Dice Battles: Color Rush</summary>
        <form action={updateDiceBattlesContent}>
          <label htmlFor="description">DESCRIPTION</label>
          <textarea id="description" name="description" defaultValue={text('dice_battles.description')} />

          <label>HIGHLIGHTS (the tiles)</label>
          {highlightRows('dice_battles.highlights', 10).map((h, i) => (
            <div key={i} className="grid" style={{ marginBottom: 6 }}>
              <input
                name={`highlight_title_${i}`}
                defaultValue={h.title}
                placeholder={`Highlight ${i + 1} title`}
              />
              <input
                name={`highlight_body_${i}`}
                defaultValue={h.body}
                placeholder={`Highlight ${i + 1} text`}
              />
            </div>
          ))}

          <label>FAQ</label>
          {faqRows('dice_battles.faq', 20).map((item, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                name={`faq_q_${i}`}
                defaultValue={item.q}
                placeholder={`Question ${i + 1}`}
                style={{ marginBottom: 4 }}
              />
              <textarea name={`faq_a_${i}`} defaultValue={item.a} placeholder="Answer" />
            </div>
          ))}

          <label>EXTRA SECTIONS — a place for whole new categories, not just FAQ</label>
          <p className="faint" style={{ marginTop: -4 }}>
            Each one gets its own heading and text, shown between the FAQ and
            the contact box. Use this for anything that doesn't fit the
            Highlights or FAQ shape — a "What's new" note, a how-to-play
            section, whatever the page needs next.
          </p>
          {sectionRows('dice_battles.extra_sections', 12).map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                name={`extra_heading_${i}`}
                defaultValue={s.heading}
                placeholder={`Section ${i + 1} heading`}
                style={{ marginBottom: 4, fontWeight: 800 }}
              />
              <textarea name={`extra_body_${i}`} defaultValue={s.body} placeholder="Section text" />
            </div>
          ))}

          <label htmlFor="cta_subhead">CONTACT BAND SUBHEAD</label>
          <input id="cta_subhead" name="cta_subhead" defaultValue={text('dice_battles.cta_subhead')} />
          <div style={{ marginTop: 16 }}>
            <button type="submit">Save Dice Battles</button>
          </div>
        </form>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>✉️ Support</summary>
        <form action={updateSupportContent}>
          <label htmlFor="intro">INTRO LINE</label>
          <input id="intro" name="intro" defaultValue={text('support.intro')} />

          <label>FAQ BY GAME — Dice Battles</label>
          {faqRows('support.game_faq', 15).map((item, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                name={`game_faq_q_${i}`}
                defaultValue={item.q}
                placeholder={`Question ${i + 1}`}
                style={{ marginBottom: 4 }}
              />
              <textarea name={`game_faq_a_${i}`} defaultValue={item.a} placeholder="Answer" />
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <button type="submit">Save Support</button>
          </div>
        </form>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>🔒 Privacy Policy</summary>
        <p className="faint" style={{ marginTop: -4 }}>
          This is what Apple checks against what the app actually does — edit
          it, but make sure it stays true.
        </p>
        <form action={updatePrivacyContent}>
          {sectionRows('privacy.sections', 16).map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                name={`section_heading_${i}`}
                defaultValue={s.heading}
                placeholder={`Section ${i + 1} heading`}
                style={{ marginBottom: 4, fontWeight: 800 }}
              />
              <textarea name={`section_body_${i}`} defaultValue={s.body} placeholder="Section text" />
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <button type="submit">Save Privacy Policy</button>
          </div>
        </form>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>📜 Terms of Use</summary>
        <form action={updateTermsContent}>
          {sectionRows('terms.sections', 16).map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                name={`section_heading_${i}`}
                defaultValue={s.heading}
                placeholder={`Section ${i + 1} heading`}
                style={{ marginBottom: 4, fontWeight: 800 }}
              />
              <textarea name={`section_body_${i}`} defaultValue={s.body} placeholder="Section text" />
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <button type="submit">Save Terms of Use</button>
          </div>
        </form>
      </details>
    </>
  );
}
