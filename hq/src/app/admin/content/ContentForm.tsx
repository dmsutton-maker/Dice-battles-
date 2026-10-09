'use client';

import { useActionState, useEffect, useState } from 'react';
import type { SaveResult } from '../actions';

/**
 * A content form with its Save button pinned to the bottom of the window.
 *
 * Two things this fixes. The button used to sit at the very end of a long
 * list of fields, so saving meant scrolling past everything to find it —
 * now it follows you down the page. And a save used to happen in silence,
 * which is indistinguishable from a save that did not happen; now it says
 * so, with the time.
 *
 * `destructive` is the third thing. Deleting a news post went through
 * this same form, so the only button on it said "Save changes" while the
 * small print above it said "saving below deletes this post for good" —
 * a destructive action behind a Save button, on a page the children use.
 * A destructive form says what it does, in red, and asks twice.
 */
export function ContentForm({
  action,
  children,
  destructive,
}: {
  action: (prev: SaveResult | null, formData: FormData) => Promise<SaveResult>;
  children: React.ReactNode;
  /**
   * Names the destructive action, e.g. "Delete this post". Given this,
   * the button is red, says that, and needs a second press to confirm.
   */
  destructive?: string;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const [armed, setArmed] = useState(false);

  // The second press has to be deliberate, not the tail of a double
  // click, so an armed button disarms itself after a few seconds.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <form action={formAction}>
      {children}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 20,
          padding: '14px 0',
          background: 'var(--bg)',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {destructive ? (
          <button
            type={armed ? 'submit' : 'button'}
            disabled={pending}
            onClick={armed ? undefined : () => setArmed(true)}
            style={{
              background: armed ? 'var(--red)' : 'transparent',
              color: armed ? '#fff' : 'var(--red)',
              border: '2px solid var(--red)',
              fontWeight: 800,
            }}
          >
            {pending
              ? 'Deleting…'
              : armed
                ? `Yes — ${destructive.toLowerCase()}`
                : destructive}
          </button>
        ) : (
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        )}

        {destructive && armed && !pending && (
          <span className="faint">Press again to confirm, or wait a moment to cancel.</span>
        )}

        {result?.ok && (
          <span style={{ color: '#1b8f47', fontWeight: 800 }}>✓ {result.message}</span>
        )}
        {result && !result.ok && (
          <span style={{ color: 'var(--red)', fontWeight: 800 }}>⚠ {result.message}</span>
        )}
        {!result && !pending && !destructive && (
          <span className="faint">Nothing is live until you press Save.</span>
        )}
      </div>
    </form>
  );
}
