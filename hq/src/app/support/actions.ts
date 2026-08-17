'use server';

import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Receiving a message from a player.
 *
 * Runs on the server with the service role, so the messages table needs
 * no public insert policy — the only way in is through this function,
 * which can check what it is being given first.
 */

export interface ContactResult {
  ok: boolean;
  message: string;
}

const LIMITS = { name: 80, email: 160, subject: 120, body: 4000, device: 80 };

/** Cheap sanity check — enough to reject nonsense, not a validator. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function sendMessage(
  _previous: ContactResult | null,
  formData: FormData,
): Promise<ContactResult> {
  // Honeypot: a field hidden from people and irresistible to bots. If it
  // has anything in it, accept the message politely and drop it.
  if (String(formData.get('website') ?? '').trim() !== '') {
    return { ok: true, message: 'Thanks — your message has been sent.' };
  }

  const field = (key: keyof typeof LIMITS) =>
    String(formData.get(key) ?? '').trim().slice(0, LIMITS[key]);

  const name = field('name');
  const email = field('email');
  const body = field('body');

  if (body.length < 5) {
    return { ok: false, message: 'Please write a bit more about the problem.' };
  }
  if (email && !looksLikeEmail(email)) {
    return { ok: false, message: 'That email address does not look right.' };
  }

  try {
    const supabase = supabaseAdmin();

    // A soft brake on floods: same address, more than five in an hour.
    if (email) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .gte('created_at', hourAgo);
      if ((count ?? 0) >= 5) {
        return {
          ok: false,
          message:
            'That is a lot of messages in one hour — give us a chance to read the first ones.',
        };
      }
    }

    const { error } = await supabase.from('messages').insert({
      name,
      email,
      subject: field('subject'),
      body,
      device: field('device'),
    });

    if (error) throw new Error(error.message);

    return {
      ok: true,
      message: email
        ? 'Thanks — your message is in. A person reads every one, and you will get a reply.'
        : 'Thanks — your message is in. Without an email address we cannot reply, but it has been read.',
    };
  } catch {
    return {
      ok: false,
      message:
        'Something went wrong sending that. Please try again in a moment.',
    };
  }
}
