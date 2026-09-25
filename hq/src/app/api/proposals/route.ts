import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Proposal, ProposalOption, Vote } from '@/lib/types';

/**
 * How Claude puts a question to the family, and reads back what they
 * said.
 *
 * POST creates a proposal with its options. GET returns every proposal
 * with the running tally and, once David has settled it, which option
 * won — so a later session can pick up the decision and act on it.
 *
 * Same rule as the ideas queue: this token can ASK, never DECIDE. There
 * is no way from here to settle a vote or to cast one, because a builder
 * that could vote on its own proposals is not asking anybody anything.
 */

export const dynamic = 'force-dynamic';

function authorised(request: NextRequest): boolean {
  const expected = process.env.HQ_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied =
    request.headers.get('x-hq-token') ??
    (header.startsWith('Bearer ') ? header.slice(7) : '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function deny() {
  return NextResponse.json(
    { error: 'Send the HQ token in an x-hq-token header.' },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return deny();

  const supabase = supabaseAdmin();
  const [{ data: proposals, error }, { data: options }, { data: votes }] =
    await Promise.all([
      supabase.from('proposals').select('*').order('created_at'),
      supabase.from('proposal_options').select('*').order('position'),
      supabase.from('votes').select('*'),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allOptions = (options ?? []) as ProposalOption[];
  const allVotes = (votes ?? []) as Vote[];

  return NextResponse.json({
    proposals: ((proposals ?? []) as Proposal[]).map((proposal) => {
      const choices = allOptions.filter((o) => o.proposal_id === proposal.id);
      const chosen = choices.find((o) => o.id === proposal.chosen_option);
      return {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        chose: chosen?.label ?? null,
        decided_note: proposal.decided_note || null,
        options: choices.map((option) => ({
          id: option.id,
          label: option.label,
          votes: allVotes.filter((v) => v.option_id === option.id).length,
        })),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return deny();

  let body: {
    title?: string;
    question?: string;
    detail?: string;
    options?: { label: string; detail?: string; image_url?: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
  }

  const { title, question, detail, options } = body;
  if (!title || !options || options.length < 2) {
    return NextResponse.json(
      { error: 'A proposal needs a title and at least two options.' },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      title,
      question: question ?? '',
      detail: detail ?? '',
      raised_by: 'Claude',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: optionError } = await supabase.from('proposal_options').insert(
    options.map((option, index) => ({
      proposal_id: proposal.id,
      label: option.label,
      detail: option.detail ?? '',
      image_url: option.image_url ?? null,
      position: index + 1,
    })),
  );

  if (optionError) {
    // Do not leave a question standing with nothing to vote on.
    await supabase.from('proposals').delete().eq('id', proposal.id);
    return NextResponse.json({ error: optionError.message }, { status: 500 });
  }

  await supabase.from('activity').insert({
    actor: 'Claude',
    action: 'put something up for a vote',
    detail: title,
  });

  return NextResponse.json({ ok: true, id: proposal.id });
}
