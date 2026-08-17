import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentMember, supabaseServer } from '@/lib/supabase/server';
import type { Member, Proposal, ProposalOption, Vote } from '@/lib/types';
import {
  castVote,
  decideProposal,
  deleteProposal,
  reopenProposal,
} from '../../actions';

/**
 * One vote, in full.
 *
 * Where an option has a picture it is shown twice: large, and again at
 * 56px. For an app icon the small one is the honest test — that is very
 * nearly the size it will be on a real home screen, and an icon that
 * turns to mush there is the wrong icon however good the big one looks.
 */
export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await currentMember();
  const supabase = await supabaseServer();

  const [{ data: proposal }, { data: options }, { data: votes }, { data: members }] =
    await Promise.all([
      supabase.from('proposals').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('proposal_options')
        .select('*')
        .eq('proposal_id', id)
        .order('position'),
      supabase.from('votes').select('*').eq('proposal_id', id),
      supabase.from('members').select('*'),
    ]);

  if (!proposal) notFound();

  const item = proposal as Proposal;
  const choices = (options ?? []) as ProposalOption[];
  const cast = (votes ?? []) as Vote[];
  const byId = new Map((members ?? []).map((m: Member) => [m.id, m]));
  const myVote = cast.find((v) => v.member_id === member?.id);
  const isOwner = member?.role === 'owner';
  const open = item.status === 'open';

  const votesFor = (optionId: string) =>
    cast.filter((v) => v.option_id === optionId);

  return (
    <>
      <Link href="/hq/vote" className="faint">
        ← back to the votes
      </Link>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>{item.title}</h2>
          <span className="pill pill-outline">
            {open ? 'open' : 'settled'}
          </span>
        </div>
        <p style={{ marginBottom: 6 }}>{item.question}</p>
        {item.detail && <p className="muted">{item.detail}</p>}
        <p className="faint">
          Raised by {item.raised_by} · {cast.length}{' '}
          {cast.length === 1 ? 'vote' : 'votes'} so far
        </p>
        {(isOwner || (item.raised_by_id === member?.id && cast.length === 0)) && (
          <form action={deleteProposal}>
            <input type="hidden" name="proposal_id" value={item.id} />
            <button className="button-quiet button-small" type="submit">
              🗑️ Delete this vote
            </button>
          </form>
        )}
        {!open && item.decided_note && (
          <div className="notice">{item.decided_note}</div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {choices.map((option) => {
          const supporters = votesFor(option.id);
          const isMine = myVote?.option_id === option.id;
          const won = item.chosen_option === option.id;
          const share = cast.length
            ? Math.round((supporters.length / cast.length) * 100)
            : 0;

          return (
            <div
              key={option.id}
              className="card"
              style={{
                borderColor: won ? '#33cc6b' : isMine ? '#ffe521' : undefined,
                borderWidth: won || isMine ? 2 : 1,
              }}
            >
              {option.image_url && (
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  {/* Full size, then the size it is really seen at. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={option.image_url}
                    alt={option.label}
                    width={168}
                    height={168}
                    style={{ borderRadius: 38, display: 'block' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={option.image_url}
                      alt={`${option.label}, home-screen size`}
                      width={56}
                      height={56}
                      style={{ borderRadius: 13, display: 'block' }}
                    />
                    <div className="faint" style={{ fontSize: 11 }}>
                      real size
                    </div>
                  </div>
                </div>
              )}

              <h3 style={{ marginTop: 12 }}>
                {option.label} {won ? '🏆' : ''}
              </h3>
              {option.detail && <p className="muted">{option.detail}</p>}

              {/* The tally, as a bar. */}
              <div
                style={{
                  height: 10,
                  borderRadius: 5,
                  background: 'rgba(255,255,255,0.14)',
                  overflow: 'hidden',
                  margin: '10px 0 6px',
                }}
              >
                <div
                  style={{
                    width: `${share}%`,
                    height: '100%',
                    background: won ? '#33cc6b' : '#ffe521',
                  }}
                />
              </div>
              <div className="faint">
                {supporters.length}{' '}
                {supporters.length === 1 ? 'vote' : 'votes'}
                {supporters.length > 0 &&
                  ` — ${supporters
                    .map((v) => byId.get(v.member_id)?.display_name ?? 'someone')
                    .join(', ')}`}
              </div>

              {open && (
                <form action={castVote} style={{ marginTop: 12 }}>
                  <input type="hidden" name="proposal_id" value={item.id} />
                  <input type="hidden" name="option_id" value={option.id} />
                  <button
                    type="submit"
                    className={isMine ? 'button-green' : 'button-quiet'}
                    disabled={isMine}
                  >
                    {isMine ? '✅ Your pick' : 'Vote for this'}
                  </button>
                </form>
              )}

              {open && isOwner && (
                <form action={decideProposal} style={{ marginTop: 8 }}>
                  <input type="hidden" name="proposal_id" value={item.id} />
                  <input type="hidden" name="option_id" value={option.id} />
                  <input
                    name="decided_note"
                    placeholder="Why this one? (optional)"
                    style={{ marginBottom: 8 }}
                  />
                  <button type="submit" className="button-small">
                    🏁 Settle it — go with this
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {open ? (
        <p className="faint">
          You can change your vote as many times as you like until David
          settles it. Everyone can see who voted for what — that is the
          point, so you can argue about it.
        </p>
      ) : (
        isOwner && (
          <form action={reopenProposal}>
            <input type="hidden" name="proposal_id" value={item.id} />
            <button type="submit" className="button-quiet button-small">
              ↩︎ Reopen this vote
            </button>
          </form>
        )
      )}
    </>
  );
}
