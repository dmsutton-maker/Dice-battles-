import Link from 'next/link';
import { updateAppsContent } from '../../actions';
import { ContentForm } from '../ContentForm';
import { loadContent } from '../fields';

export default async function AppsContentPage() {
  const c = await loadContent();
  return (
    <>
      <Link href="/admin/content" className="faint">← all pages</Link>
      <h2 style={{ marginTop: 10 }}>📱 Apps</h2>
      <ContentForm action={updateAppsContent}>
        <label htmlFor="intro">THE LINE UNDER &quot;OUR APPS&quot;</label>
        <textarea id="intro" name="intro" defaultValue={c.text('apps.intro')} />

        <label htmlFor="card_kicker">SMALL LABEL ON THE GAME&apos;S CARD</label>
        <input id="card_kicker" name="card_kicker" defaultValue={c.text('apps.card_kicker')} placeholder="Dice game" />

        <label htmlFor="card_description">HOW THE GAME IS DESCRIBED ON THE CARD</label>
        <textarea id="card_description" name="card_description" defaultValue={c.text('apps.card_description')} />
      </ContentForm>
    </>
  );
}
