'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentMember, supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import type { IdeaCategory, IdeaStatus } from '@/lib/types';

/**
 * Everything the HQ can change, in one place.
 *
 * Each of these runs as the signed-in person, so the database's own rules
 * are the last word: a contributor calling the approve action gets a
 * refusal from Postgres, not a polite message from a page that forgot to
 * hide a button.
 */

async function requireMember() {
  const member = await currentMember();
  if (!member) throw new Error('You are not signed in.');
  return member;
}

/** Write a line in the log so every decision has a trail. */
async function log(
  ideaId: string | null,
  actor: string,
  action: string,
  detail = '',
) {
  const supabase = await supabaseServer();
  await supabase
    .from('activity')
    .insert({ idea_id: ideaId, actor, action, detail });
}

export async function addIdea(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('An idea needs a title.');

  const dateOrNull = (key: string) => {
    const value = String(formData.get(key) ?? '').trim();
    return value === '' ? null : value;
  };

  const kind = formData.get('kind') === 'bug' ? 'bug' : 'feature';

  // A BUG is something already broken. Making a repair wait on an
  // approval only leaves it broken longer, so bugs go straight into the
  // work queue. A FEATURE changes what the game IS, so it waits for
  // David — including David's own, so the board shows what was actually
  // decided rather than who happened to type it.
  const status = kind === 'bug' ? 'approved' : 'pending';

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title,
      detail: String(formData.get('detail') ?? '').trim(),
      app: String(formData.get('app') ?? 'Dice Battles: Color Rush').trim(),
      category: (formData.get('category') as IdeaCategory) ?? 'game',
      kind,
      priority: Number(formData.get('priority') ?? 3),
      scheduled_for: dateOrNull('scheduled_for'),
      deadline: dateOrNull('deadline'),
      repeats_yearly: formData.get('repeats_yearly') === 'on',
      submitted_by: member.id,
      status,
      decision_note:
        kind === 'bug'
          ? 'Reported as broken — bugs are fixed without waiting for approval.'
          : '',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  await log(
    data.id,
    member.display_name,
    kind === 'bug' ? 'reported a bug' : 'added an idea',
    title,
  );
  revalidatePath('/admin');
}

export async function decideIdea(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const id = String(formData.get('id'));
  const status = String(formData.get('status')) as IdeaStatus;
  const note = String(formData.get('decision_note') ?? '').trim();

  const { error } = await supabase
    .from('ideas')
    .update({
      status,
      decision_note: note,
      decided_by: member.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  await log(id, member.display_name, `marked it ${status}`, note);
  revalidatePath('/admin');
  revalidatePath(`/admin/ideas/${id}`);
}

export async function updateIdea(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const id = String(formData.get('id'));
  const phaseValue = String(formData.get('phase_id') ?? '');
  const dateOrNull = (key: string) => {
    const value = String(formData.get(key) ?? '').trim();
    return value === '' ? null : value;
  };

  const { error } = await supabase
    .from('ideas')
    .update({
      title: String(formData.get('title') ?? '').trim(),
      detail: String(formData.get('detail') ?? '').trim(),
      app: String(formData.get('app') ?? 'Dice Battles: Color Rush').trim(),
      category: formData.get('category') as IdeaCategory,
      priority: Number(formData.get('priority') ?? 3),
      phase_id: phaseValue === '' ? null : phaseValue,
      scheduled_for: dateOrNull('scheduled_for'),
      deadline: dateOrNull('deadline'),
      repeats_yearly: formData.get('repeats_yearly') === 'on',
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  await log(id, member.display_name, 'edited the idea');
  revalidatePath('/admin');
  revalidatePath(`/admin/ideas/${id}`);
}

export async function addComment(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const ideaId = String(formData.get('idea_id'));
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const { error } = await supabase
    .from('comments')
    .insert({ idea_id: ideaId, member_id: member.id, body });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ideas/${ideaId}`);
}

export async function addPhase(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const { error } = await supabase.from('phases').insert({
    name: String(formData.get('name') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    position: Number(formData.get('position') ?? 0),
    starts_on: String(formData.get('starts_on') ?? '') || null,
    ends_on: String(formData.get('ends_on') ?? '') || null,
  });

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'added a phase');
  revalidatePath('/admin/timeline');
}

export async function setPhaseStatus(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const id = String(formData.get('id'));
  const { error } = await supabase
    .from('phases')
    .update({ status: String(formData.get('status')) })
    .eq('id', id);

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'moved a phase along');
  revalidatePath('/admin/timeline');
}

/**
 * Cast or change your vote. One per person per proposal — voting again
 * replaces what you said before rather than stacking up.
 */
export async function castVote(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const proposalId = String(formData.get('proposal_id'));
  const optionId = String(formData.get('option_id'));

  const { error } = await supabase.from('votes').upsert(
    {
      proposal_id: proposalId,
      option_id: optionId,
      member_id: member.id,
    },
    { onConflict: 'proposal_id,member_id' },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/vote/${proposalId}`);
  revalidatePath('/admin/vote');
}

/**
 * Put a question to the family.
 *
 * Anyone can raise one — asking is open, the same way anyone can put an
 * idea on the board. Only David settles it. Blank option slots are
 * ignored so the form can offer more boxes than most questions need.
 */
export async function addProposal(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('A vote needs a question to answer.');

  const options = [0, 1, 2, 3, 4, 5]
    .map((i) => ({
      label: String(formData.get(`option_${i}`) ?? '').trim(),
      detail: String(formData.get(`option_detail_${i}`) ?? '').trim(),
    }))
    .filter((option) => option.label !== '');

  if (options.length < 2) {
    throw new Error('A vote needs at least two things to choose between.');
  }

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      title,
      question: String(formData.get('question') ?? '').trim(),
      detail: String(formData.get('detail') ?? '').trim(),
      raised_by: member.display_name,
      raised_by_id: member.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  const { error: optionError } = await supabase.from('proposal_options').insert(
    options.map((option, index) => ({
      proposal_id: proposal.id,
      label: option.label,
      detail: option.detail,
      position: index + 1,
    })),
  );

  if (optionError) {
    // Never leave a question standing with nothing to vote on.
    await supabase.from('proposals').delete().eq('id', proposal.id);
    throw new Error(optionError.message);
  }

  await log(null, member.display_name, 'put something up for a vote', title);
  revalidatePath('/admin/vote');
  redirect(`/admin/vote/${proposal.id}`);
}

/** Remove a vote entirely. Owner always; your own only before anyone votes. */
export async function deleteProposal(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', String(formData.get('proposal_id')));

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'deleted a vote');
  revalidatePath('/admin/vote');
  redirect('/admin/vote');
}

/** David closes a vote by picking the winner. Only he can. */
export async function decideProposal(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const proposalId = String(formData.get('proposal_id'));
  const optionId = String(formData.get('option_id'));

  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'decided',
      chosen_option: optionId,
      decided_note: String(formData.get('decided_note') ?? '').trim(),
      decided_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'settled a vote');
  revalidatePath(`/admin/vote/${proposalId}`);
  revalidatePath('/admin/vote');
}

/** Reopen a vote that was closed too early. */
export async function reopenProposal(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const proposalId = String(formData.get('proposal_id'));
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'open', chosen_option: null, decided_at: null })
    .eq('id', proposalId);

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'reopened a vote');
  revalidatePath(`/admin/vote/${proposalId}`);
  revalidatePath('/admin/vote');
}

/** Tick a player's message off, or put it back in the pile. */
export async function markHandled(formData: FormData) {
  await requireMember();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('messages')
    .update({ handled: String(formData.get('handled')) === 'true' })
    .eq('id', String(formData.get('id')));

  if (error) throw new Error(error.message);
  revalidatePath('/admin/support');
}

/**
 * Reply to a support message from right here — a real ticket thread,
 * not "open your own mail app and hope you remember what it was about."
 *
 * If the player left an email and an outbound mail service is
 * connected (RESEND_API_KEY), the reply actually goes out. If not, it's
 * still saved and visible to the family — just not delivered — and says
 * so honestly rather than pretending to have sent something it didn't.
 */
export async function replyToMessage(formData: FormData) {
  const member = await requireMember();
  const admin = supabaseAdmin();

  const messageId = String(formData.get('message_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) throw new Error('Write something before sending.');

  const { data: original, error: fetchError } = await admin
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!original) throw new Error('That message no longer exists.');

  let delivered = false;
  let deliveryNote = 'No reply address was given, so this stays here for the family to see.';

  if (original.email) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      deliveryNote = 'Saved here, but not emailed — no outbound email service is connected yet.';
    } else {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Paper Ship Studio <support@papershipstudio.com>',
            to: original.email,
            subject: `Re: ${original.subject || 'Your message to Paper Ship Studio'}`,
            text: body,
          }),
        });
        if (res.ok) {
          delivered = true;
          deliveryNote = '';
        } else {
          const errText = await res.text().catch(() => '');
          deliveryNote = `Saved here, but the email did not send: ${errText || res.status}`;
        }
      } catch (err) {
        deliveryNote = `Saved here, but the email did not send: ${
          err instanceof Error ? err.message : 'unknown error'
        }`;
      }
    }
  }

  const { error: insertError } = await admin.from('message_replies').insert({
    message_id: messageId,
    member_id: member.id,
    body,
    delivered,
    delivery_note: deliveryNote,
  });
  if (insertError) throw new Error(insertError.message);

  await admin.from('messages').update({ handled: true }).eq('id', messageId);

  await log(
    null,
    member.display_name,
    delivered ? 'replied to a support message and emailed the player' : 'replied to a support message',
  );
  revalidatePath(`/admin/support/${messageId}`);
  revalidatePath('/admin/support');
}

/**
 * Change your own password.
 *
 * Runs as you, so Supabase itself checks it is really your account being
 * changed — nothing here trusts the page.
 */
export async function changeMyPassword(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const password = String(formData.get('password') ?? '');
  if (password.length < 8) {
    throw new Error('Passwords need to be at least 8 characters.');
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);

  // The wall comes down — but through the SERVICE ROLE, not as the
  // signed-in person. Members deliberately have no update policy on their
  // own row: giving them one to flip this flag would also let them set
  // their own role to owner. So the server does it on their behalf.
  const wasForced = member.must_change_password;
  const { error: clearError } = await supabaseAdmin()
    .from('members')
    .update({ must_change_password: false })
    .eq('id', member.id);

  // If the flag could not be cleared, do NOT send them onward: /admin would
  // bounce them straight back here, forever. Say so instead.
  if (clearError) {
    throw new Error(
      `Your password was changed, but the account could not be unlocked: ${clearError.message}`,
    );
  }

  revalidatePath('/admin/people');
  revalidatePath('/admin');
  if (wasForced) redirect('/admin');
}

/**
 * David setting someone else's password — because a ten year old WILL
 * forget theirs, and the alternative is a password-reset email, which is
 * the same fragile link that failed on a phone in the first place.
 */
export async function setSomeonesPassword(formData: FormData) {
  const member = await requireMember();
  if (member.role !== 'owner') {
    throw new Error('Only an owner can set someone else’s password.');
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) {
    throw new Error('Passwords need to be at least 8 characters.');
  }

  const admin = supabaseAdmin();

  // Find the login, or make one if this person has never signed in.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(listError.message);

  const existing = list.users.find(
    (u) => (u.email ?? '').toLowerCase() === email,
  );

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  }

  // A password handed to someone is temporary by definition: they have
  // to choose their own before the HQ opens for them.
  await admin
    .from('members')
    .update({ must_change_password: true })
    .eq('email', email);

  await log(null, member.display_name, 'set a temporary password for someone');
  revalidatePath('/admin/people');
}

export async function invitePerson(formData: FormData) {
  const member = await requireMember();
  const supabase = await supabaseServer();

  const { error } = await supabase.from('allowed_emails').insert({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    display_name: String(formData.get('display_name') ?? '').trim(),
    role: String(formData.get('role') ?? 'contributor'),
  });

  if (error) throw new Error(error.message);
  await log(null, member.display_name, 'invited someone');
  revalidatePath('/admin/people');
}

/**
 * Move someone's login to a new address — e.g. switching the family from
 * personal Gmail addresses to @papershipstudio.com ones. Owner-only,
 * same as setting someone's password: this changes what someone signs
 * in with, not something to hand to a form a kid could submit by mistake.
 *
 * Three places know an email and all three have to agree: the actual
 * login (Supabase Auth), the members row, and the allowed_emails gate
 * that decides who is even allowed to sign in. Their password is not
 * touched — only the address they use to enter it.
 */
export async function updatePersonEmail(formData: FormData) {
  const member = await requireMember();
  if (member.role !== 'owner') {
    throw new Error('Only an owner can change someone’s email.');
  }

  const oldEmail = String(formData.get('old_email') ?? '').trim().toLowerCase();
  const newEmail = String(formData.get('new_email') ?? '').trim().toLowerCase();
  if (!oldEmail || !newEmail) {
    throw new Error('Both the current and the new email are needed.');
  }
  if (oldEmail === newEmail) return;

  const admin = supabaseAdmin();

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(listError.message);

  const existingAuthUser = list.users.find(
    (u) => (u.email ?? '').toLowerCase() === oldEmail,
  );
  if (existingAuthUser) {
    const { error } = await admin.auth.admin.updateUserById(existingAuthUser.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  }

  const { error: memberError } = await admin
    .from('members')
    .update({ email: newEmail })
    .eq('email', oldEmail);
  if (memberError) throw new Error(memberError.message);

  const { error: allowedError } = await admin
    .from('allowed_emails')
    .update({ email: newEmail })
    .eq('email', oldEmail);
  if (allowedError) throw new Error(allowedError.message);

  await log(null, member.display_name, 'changed someone’s email', `${oldEmail} → ${newEmail}`);
  revalidatePath('/admin/people');
}

/**
 * The editable text on the public pages — every field here is a row in
 * site_content, upserted by key. Anyone signed in can edit copy (it is
 * words, not a decision), same as anyone can add an idea; only actually
 * approving work stays owner-only.
 */
async function setContent(key: string, value: unknown, editor: string) {
  const admin = supabaseAdmin();
  const { error } = await admin
    .from('site_content')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  await log(null, editor, 'edited the website copy', key);
}

/** Blank rows in a repeatable field (a 6th FAQ slot nobody filled in) are dropped, not saved as empty. */
function collectRows<T extends Record<string, string>>(
  formData: FormData,
  count: number,
  fields: Record<keyof T, string>,
  requiredField: keyof T,
): T[] {
  const rows: T[] = [];
  for (let i = 0; i < count; i++) {
    const row = {} as T;
    for (const key of Object.keys(fields) as (keyof T)[]) {
      row[key] = String(formData.get(`${fields[key]}_${i}`) ?? '').trim() as T[typeof key];
    }
    if (row[requiredField] !== '') rows.push(row);
  }
  return rows;
}

export async function updateHomeContent(formData: FormData) {
  const member = await requireMember();
  await Promise.all([
    setContent('home.hero_tagline', String(formData.get('hero_tagline') ?? '').trim(), member.display_name),
    setContent('home.hero_subhead', String(formData.get('hero_subhead') ?? '').trim(), member.display_name),
    setContent('home.about_body', String(formData.get('about_body') ?? '').trim(), member.display_name),
    setContent('home.apps_card_tagline', String(formData.get('apps_card_tagline') ?? '').trim(), member.display_name),
    setContent('home.apps_card_note', String(formData.get('apps_card_note') ?? '').trim(), member.display_name),
  ]);
  revalidatePath('/');
  revalidatePath('/admin/content');
}

export async function updateDiceBattlesContent(formData: FormData) {
  const member = await requireMember();
  const highlights = collectRows(formData, 10, { title: 'highlight_title', body: 'highlight_body' }, 'title');
  const faq = collectRows(formData, 20, { q: 'faq_q', a: 'faq_a' }, 'q');
  const extraSections = collectRows(
    formData,
    12,
    { heading: 'extra_heading', body: 'extra_body' },
    'heading',
  );

  await Promise.all([
    setContent('dice_battles.description', String(formData.get('description') ?? '').trim(), member.display_name),
    setContent('dice_battles.cta_subhead', String(formData.get('cta_subhead') ?? '').trim(), member.display_name),
    setContent('dice_battles.highlights', highlights, member.display_name),
    setContent('dice_battles.faq', faq, member.display_name),
    setContent('dice_battles.extra_sections', extraSections, member.display_name),
  ]);
  revalidatePath('/apps/dice-battles-color-rush');
  revalidatePath('/admin/content');
}

export async function updateSupportContent(formData: FormData) {
  const member = await requireMember();
  const gameFaq = collectRows(formData, 15, { q: 'game_faq_q', a: 'game_faq_a' }, 'q');

  await Promise.all([
    setContent('support.intro', String(formData.get('intro') ?? '').trim(), member.display_name),
    setContent('support.game_faq', gameFaq, member.display_name),
  ]);
  revalidatePath('/support');
  revalidatePath('/admin/content');
}

export async function updatePrivacyContent(formData: FormData) {
  const member = await requireMember();
  const sections = collectRows(formData, 16, { heading: 'section_heading', body: 'section_body' }, 'heading');
  await setContent('privacy.sections', sections, member.display_name);
  revalidatePath('/privacy');
  revalidatePath('/admin/content');
}

export async function updateTermsContent(formData: FormData) {
  const member = await requireMember();
  const sections = collectRows(formData, 16, { heading: 'section_heading', body: 'section_body' }, 'heading');
  await setContent('terms.sections', sections, member.display_name);
  revalidatePath('/terms');
  revalidatePath('/admin/content');
}
