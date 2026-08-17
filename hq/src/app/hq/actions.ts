'use server';

import { revalidatePath } from 'next/cache';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
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

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title,
      detail: String(formData.get('detail') ?? '').trim(),
      category: (formData.get('category') as IdeaCategory) ?? 'game',
      priority: Number(formData.get('priority') ?? 3),
      scheduled_for: dateOrNull('scheduled_for'),
      deadline: dateOrNull('deadline'),
      repeats_yearly: formData.get('repeats_yearly') === 'on',
      submitted_by: member.id,
      // Everything starts as pending, including David's own ideas — the
      // board should show what has actually been decided, not who typed it.
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  await log(data.id, member.display_name, 'added the idea', title);
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
