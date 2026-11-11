'use client';

import { useId, useState } from 'react';

/**
 * A password box with a Show/Hide button.
 *
 * Typing a password you cannot see is a coin toss, and the people using
 * this are a family on phones, not typists. The button says the words
 * rather than only drawing an eye, and carries aria-pressed so a screen
 * reader announces which state it is in.
 *
 * Works both controlled (`value` + `onChange`, as the login form needs)
 * and uncontrolled with a plain server-action form (`name` alone).
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  required = true,
  minLength,
  autoFocus,
}: {
  id?: string;
  name?: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [shown, setShown] = useState(false);

  return (
    <>
      <label htmlFor={fieldId}>{label}</label>
      <div style={{ position: 'relative', display: 'flex' }}>
        <input
          id={fieldId}
          name={name}
          type={shown ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoFocus={autoFocus}
          {...(onChange
            ? { value: value ?? '', onChange: (e) => onChange(e.target.value) }
            : {})}
          style={{ flex: 1, paddingRight: 72 }}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 800,
            background: 'transparent',
            color: 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  );
}
