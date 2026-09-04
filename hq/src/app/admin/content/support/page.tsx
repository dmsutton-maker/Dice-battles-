import Link from 'next/link';
import { updateSupportContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { loadContent } from '../fields';

export default async function SupportContentPage() {
  const c = await loadContent();
  return (
    <>
      <Link href="/admin/content" className="faint">← all pages</Link>
      <h2 style={{ marginTop: 10 }}>✉️ Support</h2>
      <div className="notice">
        The questions shown on this page come from the{' '}
        <Link href="/admin/content/dice-battles">Dice Battles page&apos;s FAQ</Link> —
        edit them there and both pages change together.
      </div>
      <ContentForm action={updateSupportContent}>
        <label htmlFor="intro">THE LINE UNDER &quot;SUPPORT&quot;</label>
        <textarea id="intro" name="intro" defaultValue={c.text('support.intro')} />

        <label htmlFor="form_note">THE SMALL PRINT UNDER THE CONTACT FORM</label>
        <textarea id="form_note" name="form_note" defaultValue={c.text('support.form_note')} />
      </ContentForm>
    </>
  );
}
