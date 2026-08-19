import Link from 'next/link';
import { updateHomeContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { loadContent } from '../fields';

export default async function HomeContentPage() {
  const c = await loadContent();
  return (
    <>
      <Link href="/admin/content" className="faint">← all pages</Link>
      <h2 style={{ marginTop: 10 }}>🏠 Home</h2>
      <ContentForm action={updateHomeContent}>
        <label htmlFor="hero_tagline">THE BIG HEADLINE</label>
        <input id="hero_tagline" name="hero_tagline" defaultValue={c.text('home.hero_tagline')} />

        <label htmlFor="hero_subhead">THE LINE UNDER IT</label>
        <textarea id="hero_subhead" name="hero_subhead" defaultValue={c.text('home.hero_subhead')} />

        <label htmlFor="cta_label">THE BUTTON IN THE HEADLINE BOX</label>
        <input id="cta_label" name="cta_label" defaultValue={c.text('home.cta_label')} placeholder="See our apps →" />

        <label htmlFor="about_body">WHO WE ARE</label>
        <textarea id="about_body" name="about_body" defaultValue={c.text('home.about_body')} style={{ minHeight: 120 }} />

        <label htmlFor="apps_heading">HEADING ABOVE THE APPS</label>
        <input id="apps_heading" name="apps_heading" defaultValue={c.text('home.apps_heading')} placeholder="Our apps" />

        <label htmlFor="apps_card_tagline">DICE BATTLES CARD — TAGLINE</label>
        <input id="apps_card_tagline" name="apps_card_tagline" defaultValue={c.text('home.apps_card_tagline')} />

        <label htmlFor="apps_card_note">DICE BATTLES CARD — SMALL NOTE UNDERNEATH</label>
        <input id="apps_card_note" name="apps_card_note" defaultValue={c.text('home.apps_card_note')} />
        <p className="faint">Leave this empty to show nothing there at all.</p>
      </ContentForm>
    </>
  );
}
