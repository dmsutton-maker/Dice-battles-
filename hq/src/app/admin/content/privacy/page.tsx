import Link from 'next/link';
import { updatePrivacyContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { ListHint, loadContent } from '../fields';

export default async function PrivacyContentPage() {
  const c = await loadContent();
  return (
    <>
      <Link href="/admin/content" className="faint">← all pages</Link>
      <h2 style={{ marginTop: 10 }}>🔒 Privacy Policy</h2>
      <div className="notice">
        Apple checks this against what the app actually does. Edit it freely
        — just keep it true.
      </div>
      <ContentForm action={updatePrivacyContent}>
        <label htmlFor="intro">THE OPENING PARAGRAPH</label>
        <textarea id="intro" name="intro" defaultValue={c.text('privacy.intro')} style={{ minHeight: 110 }} />

        <label style={{ marginTop: 18 }}>THE SECTIONS</label>
        <ListHint what="a section" />
        {c.sections('privacy.sections', 16).map((s, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <input
              name={`section_heading_${i}`}
              defaultValue={s.heading}
              placeholder={`Section ${i + 1} — heading`}
              style={{ marginBottom: 4, fontWeight: 800 }}
            />
            <textarea name={`section_body_${i}`} defaultValue={s.body} placeholder="What it says" style={{ minHeight: 90 }} />
          </div>
        ))}
      </ContentForm>
    </>
  );
}
