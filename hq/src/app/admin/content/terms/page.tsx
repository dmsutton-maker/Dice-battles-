import Link from 'next/link';
import { updateTermsContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { ListHint, SearchFields, legalFormCopy, loadContent } from '../fields';
import { TERMS } from '@/lib/legalCopy';

export default async function TermsContentPage() {
  const c = await loadContent();
  const legal = legalFormCopy(c, 'terms', TERMS);
  return (
    <>
      <Link href="/admin/content" className="faint">← all pages</Link>
      <h2 style={{ marginTop: 10 }}>📜 Terms of Use</h2>
      <div className="notice">
        Apple checks this against what the app actually does. Edit it freely
        — just keep it true.
      </div>
      {legal.fromCode && (
        <div className="notice">
          This is the wording written on {TERMS.written}, which is newer than
          anything saved here. Saving stores it as it stands below.
        </div>
      )}
      <ContentForm action={updateTermsContent}>
        <label htmlFor="intro">THE OPENING PARAGRAPH</label>
        <textarea id="intro" name="intro" defaultValue={legal.intro} style={{ minHeight: 110 }} />

        <label style={{ marginTop: 18 }}>THE SECTIONS</label>
        <ListHint what="a section" />
        {legal.sections.map((s, i) => (
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
        <SearchFields
          title={c.text('terms.metaTitle')}
          description={c.text('terms.metaDescription')}
        />
      </ContentForm>
    </>
  );
}
