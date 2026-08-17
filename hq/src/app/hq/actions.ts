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
  revalidatePath('/hq');
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
  revalidatePath('/hq');
  revalidatePath(`/hq/ideas/${id}`);
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
  revalidatePath('/hq');
  revalidatePath(`/hq/ideas/${id}`);
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
  revalidatePath(`/hq/ideas/${ideaId}`);
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
  revalidatePath('/hq/timeline');
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
  revalidatePath('/hq/timeline');
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
  revalidatePath(`/hq/vote/${proposalId}`);
  revalidatePath('/hq/vote');
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
  revalidatePath('/hq/vote');
  redirect(`/hq/vote/${proposal.id}`);
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
  revalidatePath('/hq/vote');
  redirect('/hq/vote');
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
  revalidatePath(`/hq/vote/${proposalId}`);
  revalidatePath('/hq/vote');
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
  revalidatePath(`/hq/vote/${proposalId}`);
  revalidatePath('/hq/vote');
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
  revalidatePath('/hq/inbox');
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

  // If the flag could not be cleared, do NOT send them onward: /hq would
  // bounce them straight back here, forever. Say so instead.
  if (clearError) {
    throw new Error(
      `Your password was changed, but the account could not be unlocked: ${clearError.message}`,
    );
  }

  revalidatePath('/hq/people');
  revalidatePath('/hq');
  if (wasForced) redirect('/hq');
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
  revalidatePath('/hq/people');
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
  revalidatePath('/hq/people');
}
