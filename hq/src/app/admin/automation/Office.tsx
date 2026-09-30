'use client';

import { useEffect, useState } from 'react';

/**
 * The office.
 *
 * Every character here is doing something real: their state comes from
 * the actual board, not a decoration loop. Idle means genuinely nothing
 * to do, "waiting" means waiting on a person, "working" means there is
 * open work of that kind right now. A pretty animation that always looks
 * busy would be a lie told in CSS, so the scene sits still when the
 * board is quiet.
 */

export type WorkerState = 'idle' | 'working' | 'waiting' | 'alert';

export interface Worker {
  id: string;
  name: string;
  emoji: string;
  role: string;
  state: WorkerState;
  note: string;
  /** Desk position as a percentage of the room, so it scales with the box. */
  x: number;
  y: number;
}

const STATE_STYLE: Record<WorkerState, { label: string; color: string; ink: string }> = {
  idle: { label: 'nothing to do', color: '#ece9e5', ink: '#6b6763' },
  working: { label: 'working', color: '#0088b0', ink: '#ffffff' },
  waiting: { label: 'waiting on you', color: '#f2c53d', ink: '#4a3a06' },
  alert: { label: 'drop everything', color: '#e0503f', ink: '#ffffff' },
};

const BUBBLE: Partial<Record<WorkerState, { text: string; bg: string; ink: string; border: string }>> = {
  waiting: { text: 'got a minute?', bg: '#ffffff', ink: '#4a3a06', border: '1px solid #ece9e5' },
  alert: { text: 'on it right now', bg: '#e0503f', ink: '#ffffff', border: 'none' },
  working: { text: 'heads down', bg: '#0088b0', ink: '#ffffff', border: 'none' },
};

function Character({ worker, tick }: { worker: Worker; tick: number }) {
  const style = STATE_STYLE[worker.state];
  const busy = worker.state === 'working' || worker.state === 'alert';
  const bubble = BUBBLE[worker.state];

  // A busy character leans into the desk on a slow beat; an idle one sits
  // still. Movement comes off the shared tick so everybody in the room
  // stays on one clock rather than drifting apart.
  const lean = busy ? Math.sin((tick + worker.x) / 2) * 4 : 0;
  const bob = busy ? Math.abs(Math.sin((tick + worker.y) / 2)) * 3 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${worker.x}%`,
        top: `${worker.y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 150,
      }}
    >
      <div style={{ height: 26, display: 'flex', alignItems: 'flex-end' }}>
        {bubble && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              background: bubble.bg,
              border: bubble.border,
              borderRadius: 10,
              padding: '3px 8px',
              color: bubble.ink,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 10px rgba(32,30,29,0.12)',
            }}
          >
            {bubble.text}
          </div>
        )}
      </div>

      {/* The character, who moves. */}
      <div
        style={{
          fontSize: 42,
          lineHeight: 1,
          marginTop: 2,
          filter: worker.state === 'idle' ? 'grayscale(0.7) opacity(0.7)' : 'none',
          transform: `translateY(${-bob}px) rotate(${lean}deg)`,
          transition: 'transform 900ms ease-in-out',
        }}
      >
        {worker.emoji}
      </div>

      {/* The desk, drawn AFTER the character so it overlaps them from the
          front — which is what makes it read as sitting at a desk rather
          than hovering above one. */}
      <div
        aria-hidden="true"
        style={{
          width: 96,
          height: 22,
          marginTop: -7,
          borderRadius: '4px 4px 6px 6px',
          background: 'linear-gradient(#d8c6aa, #c9b79c)',
          boxShadow: '0 5px 0 #a8967d, 0 12px 16px rgba(32,30,29,0.16)',
        }}
      />

      <div style={{ fontSize: 12, fontWeight: 800, color: '#201e1d', marginTop: 12 }}>
        {worker.name}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          borderRadius: 999,
          padding: '2px 8px',
          marginTop: 3,
          background: style.color,
          color: style.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {style.label}
      </div>
    </div>
  );
}

export function Office({ workers }: { workers: Worker[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Nobody is animated unless somebody is actually working — a still
    // room is the honest picture of a quiet board, and it also means no
    // timer runs for nothing.
    if (!workers.some((w) => w.state === 'working' || w.state === 'alert')) return;
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, [workers]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 300,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #ece9e5',
        // Back wall, then the floor line at 46%.
        background:
          'linear-gradient(#eef8fb 0%, #e4f2f8 46%, #f3efe9 46%, #eae4db 100%)',
        marginBottom: 18,
      }}
    >
      {/* Window on the back wall, because every office has the one good view. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: 18,
          transform: 'translateX(-50%)',
          width: 132,
          height: 62,
          borderRadius: 8,
          background: 'linear-gradient(160deg, #bfe6f2, #8fd3ea)',
          border: '5px solid #ffffff',
          boxShadow: '0 6px 14px rgba(32,30,29,0.10)',
        }}
      />
      {/* A paper ship on the sill. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: 56,
          transform: 'translateX(-50%)',
          fontSize: 16,
        }}
      >
        ⛵
      </div>

      {workers.map((w) => (
        <Character key={w.id} worker={w} tick={tick} />
      ))}

      {workers.every((w) => w.state === 'idle') && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#79756f',
          }}
        >
          Quiet in here. Nothing needs doing.
        </div>
      )}
    </div>
  );
}
