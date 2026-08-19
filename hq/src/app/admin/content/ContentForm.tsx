'use client';

import { useActionState } from 'react';
import type { SaveResult } from '../actions';

/**
 * A content form with its Save button pinned to the bottom of the window.
 *
 * Two things this fixes. The button used to sit at the very end of a long
 * list of fields, so saving meant scrolling past everything to find it —
 * now it follows you down the page. And a save used to happen in silence,
 * which is indistinguishable from a save that did not happen; now it says
 * so, with the time.
 */
export function ContentForm({
  action,
  children,
}: {
  action: (prev: SaveResult | null, formData: FormData) => Promise<SaveResult>;
  children: React.ReactNode;
}) {
  const [result, formAction, pending] = useActionState(action, null);

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
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>

        {result?.ok && (
          <span style={{ color: '#1b8f47', fontWeight: 800 }}>✓ {result.message}</span>
        )}
        {result && !result.ok && (
          <span style={{ color: 'var(--red)', fontWeight: 800 }}>⚠ {result.message}</span>
        )}
        {!result && !pending && (
          <span className="faint">Nothing is live until you press Save.</span>
        )}
      </div>
    </form>
  );
}
