import Link from 'next/link';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
import type { Proposal, ProposalOption, Vote } from '@/lib/types';
import { addProposal } from '../actions';

/**
 * Everything waiting on a family vote.
 *
 * These are the questions where there is no right answer to look up —
 * which icon, which name, which colour — so the way to settle them is
 * for everyone to say what they think and David to call it.
 */
export default async function VotesPage() {
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: proposals }, { data: options }, { data: votes }, { data: members }] =
    await Promise.all([
      supabase.from('proposals').select('*').order('created_at', { ascending: false }),
      supabase.from('proposal_options').select('*').order('position'),
      supabase.from('votes').select('*'),
      supabase.from('members').select('*'),
    ]);

  const all = (proposals ?? []) as Proposal[];
  const allOptions = (options ?? []) as ProposalOption[];
  const allVotes = (votes ?? []) as Vote[];
  const memberCount = (members ?? []).length;

  return (
    <>
      <p className="muted">
        Questions with more than one good answer. Everyone votes; David
        picks the winner. Anyone can put one up — Claude raises the ones
        where the right answer is a matter of taste rather than something
        to work out, and you can raise anything you like.
      </p>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
          ➕ Put something to a vote
        </summary>
        <form action={addProposal}>
          <label htmlFor="title">WHAT IS THE QUESTION?</label>
          <input
            id="title"
            name="title"
            required
            maxLength={140}
            placeholder="What should the winning sound be?"
          />

          <label htmlFor="question">HOW SHOULD PEOPLE DECIDE?</label>
          <input
            id="question"
            name="question"
            maxLength={400}
            placeholder="Pick the one you would want to hear every time you win."
          />

          <label htmlFor="detail">
            ANYTHING ELSE WORTH KNOWING (optional)
          </label>
          <textarea
            id="detail"
            name="detail"
            style={{ minHeight: 60 }}
            placeholder="Background, costs, anything that should be known before voting."
          />

          <label>THE CHOICES — fill in at least two, leave the rest empty</label>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
              <input
                name={`option_${i}`}
                maxLength={120}
                placeholder={`Choice ${i + 1}`}
                style={{ flex: '1 1 40%' }}
              />
              <input
                name={`option_detail_${i}`}
                maxLength={400}
                placeholder="Why this one? (optional)"
                style={{ flex: '1 1 50%' }}
              />
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <button type="submit">Put it to a vote</button>
          </div>
        </form>
      </details>

      {all.length === 0 && (
        <div className="notice">
          Nothing to vote on right now.
        </div>
      )}

      {all.map((proposal) => {
        const mine = allVotes.find(
          (v) => v.proposal_id === proposal.id && v.member_id === member?.id,
        );
        const cast = allVotes.filter((v) => v.proposal_id === proposal.id).length;
        const choices = allOptions.filter((o) => o.proposal_id === proposal.id);
        const winner = proposal.chosen_option
          ? choices.find((o) => o.id === proposal.chosen_option)
          : null;

        return (
          <Link
            key={proposal.id}
            href={`/hq/vote/${proposal.id}`}
            className="idea"
            style={{
              borderLeftColor:
                proposal.status === 'open' ? '#ffe521' : '#33cc6b',
            }}
          >
            <div className="spread">
              <h3>{proposal.title}</h3>
              <span className="pill pill-outline">
                {proposal.status === 'open' ? 'open' : 'settled'}
              </span>
            </div>
            <p className="muted" style={{ margin: '4px 0 6px' }}>
              {proposal.question}
            </p>
            <div className="faint">
              {choices.length} options · {cast} of {memberCount} voted
              {winner ? ` · chose ${winner.label}` : ''}
              {proposal.status === 'open' &&
                (mine ? ' · you voted ✅' : ' · you have not voted yet')}
            </div>
          </Link>
        );
      })}
    </>
  );
}
