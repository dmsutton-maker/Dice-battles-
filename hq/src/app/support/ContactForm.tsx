'use client';

import { useActionState } from 'react';
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
            placeholder="you@example.com"
            style={fieldInput}
          />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={fieldLabel}>What&apos;s this about?</span>
        <select className={siteStyles.field} name="subject" style={fieldInput} defaultValue={TOPICS[0]}>
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
        <p style={{ font: `700 13.5px ${fonts.body}`, color: colors.orangeDeep, margin: 0 }}>{result.message}</p>
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
        one, your email address are stored so we can read and reply. Nothing else, and nothing
        is passed on to anyone.
      </span>
    </form>
  );
}
