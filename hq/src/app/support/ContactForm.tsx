'use client';

import { useActionState, useEffect, useState } from 'react';
import { colors, fonts } from '@/components/site/tokens';
import siteStyles from '../site.module.css';
import { sendMessage, type ContactResult } from './actions';

const TOPICS = ['Report a problem', 'Question about a game', 'Feedback or idea', 'Something else'];

const fieldLabel: React.CSSProperties = { font: `700 13px ${fonts.body}`, color: colors.ink };
const fieldInput: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${colors.fieldBorder}`,
  font: `600 14px ${fonts.body}`,
  background: '#fff',
  color: colors.ink,
};

/**
 * The contact form. No email address appears anywhere on the public site
 * — an address on a privacy policy is harvested within days, and this
 * game is made by one family using their own accounts.
 */
export function ContactForm() {
  const [result, action, pending] = useActionState<ContactResult | null, FormData>(
    sendMessage,
    null,
  );

  /*
    CONTROLLED fields, so a rejected message keeps what was typed.

    React 19 resets a <form action={…}> as soon as the action resolves.
    With uncontrolled inputs that wiped the name, the address and the
    whole body on every validation failure, leaving somebody staring at
    "that email address does not look right" above three empty boxes —
    and nobody types it all out again. `defaultValue` is not enough
    either: a second identical failure would not change any prop, so
    React would leave the emptied DOM alone.

    So the values live in state here, and the server hands them back on
    a failure for the effect below to restore.
  */
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: TOPICS[0],
    body: '',
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (result && !result.ok && result.values) setForm(result.values);
  }, [result]);

  if (result?.ok) {
    return (
      <div style={{ padding: 32, borderRadius: 20, background: colors.offWhite }}>
        <p style={{ font: `800 15px ${fonts.body}`, color: colors.ink, margin: 0 }}>Message sent.</p>
        <p style={{ font: `600 14px/1.6 ${fonts.body}`, color: colors.secondary, margin: '6px 0 0' }}>
          {result.message}
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      style={{ padding: 32, borderRadius: 20, background: colors.offWhite, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>Name</span>
          <input
            className={siteStyles.field}
            type="text"
            name="name"
            maxLength={80}
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="Your name"
            style={fieldInput}
          />
        </label>
        <label style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>Email</span>
          <input
            className={siteStyles.field}
            type="email"
            name="email"
            maxLength={160}
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            placeholder="you@example.com"
            style={fieldInput}
          />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={fieldLabel}>What&apos;s this about?</span>
        <select
          className={siteStyles.field}
          name="subject"
          style={fieldInput}
          value={form.subject}
          onChange={(e) => set('subject')(e.target.value)}
        >
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={fieldLabel}>Message</span>
        <textarea
          className={siteStyles.field}
          name="body"
          required
          rows={5}
          maxLength={4000}
          value={form.body}
          onChange={(e) => set('body')(e.target.value)}
          placeholder="Tell us what's going on..."
          style={{ ...fieldInput, resize: 'vertical' }}
        />
      </label>

      {/* Hidden from people, catnip to bots. Anything typed here is a bot. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {result && !result.ok && (
        <p style={{ font: `700 13.5px ${fonts.body}`, color: colors.orangeText, margin: 0 }}>{result.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={siteStyles.pillButton}
        style={{
          alignSelf: 'flex-start',
          padding: '13px 26px',
          background: colors.ink,
          color: '#fff',
          font: `800 14px ${fonts.body}`,
          borderRadius: 999,
          border: 'none',
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Sending…' : 'Send message'}
      </button>

      <span style={{ font: `600 12.5px ${fonts.body}`, color: colors.muted }}>
        We read every message ourselves — usually pretty quickly. Your message and, if you give
        one, your email address are stored so we can read and reply. Nothing else.
      </span>
    </form>
  );
}
