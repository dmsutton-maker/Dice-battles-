import Link from 'next/link';
import { updateDiceBattlesContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { ListHint, loadContent } from '../fields';

export default async function DiceBattlesContentPage() {
  const c = await loadContent();
  return (
    <>
      <Link href="/admin/content" className="faint">
        ← all pages
      </Link>
      <h2 style={{ marginTop: 10 }}>🎲 Dice Battles: Color Rush</h2>

      <ContentForm action={updateDiceBattlesContent}>
        <label htmlFor="description">THE DESCRIPTION UNDER THE TITLE</label>
        <textarea
          id="description"
          name="description"
          defaultValue={c.text('dice_battles.description')}
          style={{ minHeight: 100 }}
        />

        <label>THE LITTLE BADGES — &quot;No ads&quot;, and so on</label>
        <p className="faint" style={{ marginTop: -2 }}>
          These are promises about what the game does, sitting right under
          the title. If any of them stops being true — the day advertising
          ships, say — change it here. Clear a box to drop that badge.
        </p>
        <div className="grid">
          {c.labels('dice_battles.pills', 8).map((p, i) => (
            <input
              key={i}
              name={`pill_label_${i}`}
              defaultValue={p.label}
              placeholder={`Badge ${i + 1}`}
            />
          ))}
        </div>

        <label style={{ marginTop: 22 }}>THE FOUR TILES</label>
        <ListHint what="a tile" />
        {c.pairs('dice_battles.highlights', 10).map((h, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <input
              name={`highlight_title_${i}`}
              defaultValue={h.title}
              placeholder={`Tile ${i + 1} — heading`}
              style={{ marginBottom: 4, fontWeight: 800 }}
            />
            <textarea name={`highlight_body_${i}`} defaultValue={h.body} placeholder="What it says" />
          </div>
        ))}

        <label style={{ marginTop: 22 }}>FAQ</label>
        <p className="faint" style={{ marginTop: -2 }}>
          Fill an empty box to add a question, clear one to remove it. The
          first three also appear on the Support page.
        </p>
        {c.qa('dice_battles.faq', 20).map((item, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <input
              name={`faq_q_${i}`}
              defaultValue={item.q}
              placeholder={`Question ${i + 1}`}
              style={{ marginBottom: 4, fontWeight: 800 }}
            />
            <textarea name={`faq_a_${i}`} defaultValue={item.a} placeholder="Answer" />
          </div>
        ))}

        <label style={{ marginTop: 22 }}>ANYTHING ELSE — your own sections</label>
        <p className="faint" style={{ marginTop: -2 }}>
          A heading and some text, shown between the FAQ and the contact
          box. For whatever does not fit the shapes above.
        </p>
        {c.sections('dice_battles.extra_sections', 12).map((s, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <input
              name={`extra_heading_${i}`}
              defaultValue={s.heading}
              placeholder={`Section ${i + 1} — heading`}
              style={{ marginBottom: 4, fontWeight: 800 }}
            />
            <textarea name={`extra_body_${i}`} defaultValue={s.body} placeholder="What it says" />
          </div>
        ))}

        <label htmlFor="cta_title" style={{ marginTop: 22 }}>
          THE DARK CONTACT BOX — HEADING
        </label>
        <input id="cta_title" name="cta_title" defaultValue={c.text('dice_battles.cta_title')} />

        <label htmlFor="cta_subhead">THE DARK CONTACT BOX — LINE UNDERNEATH</label>
        <input id="cta_subhead" name="cta_subhead" defaultValue={c.text('dice_battles.cta_subhead')} />
      </ContentForm>
    </>
  );
}
