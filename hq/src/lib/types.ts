/** The shapes the database hands back. Kept in one place so a column
 *  rename shows up as a type error rather than an empty box on a page. */

export type Role = 'owner' | 'contributor';

export type IdeaStatus =
  | 'pending'
  | 'approved'
  | 'building'
  | 'shipped'
  | 'parked'
  | 'declined';

export type IdeaCategory =
  | 'game'
  | 'revenue'
  | 'art'
  | 'sound'
  | 'website'
  | 'other';

/** A bug is already broken; a feature changes what the game is. */
export type IdeaKind = 'bug' | 'feature';

export type PhaseStatus = 'planned' | 'active' | 'done';

export interface Member {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  /** True while still using a password someone else chose. */
  must_change_password: boolean;
  created_at: string;
}

export interface Phase {
  id: string;
  name: string;
  summary: string;
  status: PhaseStatus;
  starts_on: string | null;
  ends_on: string | null;
  position: number;
  created_at: string;
}

export interface Idea {
  id: string;
  title: string;
  detail: string;
  category: IdeaCategory;
  kind: IdeaKind;
  status: IdeaStatus;
  priority: number;
  phase_id: string | null;
  submitted_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  shipped_version: string;
  /** Do not start before this date. Null means any time. */
  scheduled_for: string | null;
  /** Has to be finished by this date. */
  deadline: string | null;
  /** Seasonal work that comes round again every year. */
  repeats_yearly: boolean;
  created_at: string;
  updated_at: string;
}

/** Today, as a plain YYYY-MM-DD date with no timezone games. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether an idea's turn has come. Anything with no date is always due;
 * anything dated is due once that date arrives.
 */
export function isDue(idea: Pick<Idea, 'scheduled_for'>, now = today()): boolean {
  return !idea.scheduled_for || idea.scheduled_for <= now;
}

/** "in 3 months", "next week", "overdue by 2 days" — for humans. */
export function whenPhrase(date: string | null, now = today()): string {
  if (!date) return '';
  const days = Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${now}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** "November 2026" — the heading a scheduled idea is filed under. */
export function monthLabel(date: string): string {
  const [year, month] = date.split('-');
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[Number(month) - 1]} ${year}`;
}

export interface Comment {
  id: string;
  idea_id: string;
  member_id: string | null;
  body: string;
  created_at: string;
}

/** What each status means, in the words used on the board. */
export const STATUS_LABELS: Record<IdeaStatus, string> = {
  pending: 'Waiting on David',
  approved: 'Approved — queued',
  building: 'Being built',
  shipped: 'Shipped',
  parked: 'Parked for later',
  declined: 'Not doing',
};

export const STATUS_COLORS: Record<IdeaStatus, string> = {
  pending: '#fc8403',
  approved: '#33cc6b',
  building: '#043fe0',
  shipped: '#7c6bd8',
  parked: '#6d6a86',
  declined: '#cc2533',
};

export const CATEGORY_LABELS: Record<IdeaCategory, string> = {
  game: '🎲 Game',
  revenue: '💰 Money',
  art: '🎨 Art',
  sound: '🔊 Sound',
  website: '🌐 Website',
  other: '📦 Other',
};

/** 1 is most urgent — the order the approved queue is worked in. */
export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Drop everything',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Someday',
};

export interface Proposal {
  id: string;
  title: string;
  question: string;
  detail: string;
  raised_by: string;
  raised_by_id: string | null;
  status: 'open' | 'decided';
  chosen_option: string | null;
  decided_note: string;
  decided_at: string | null;
  created_at: string;
}

export interface ProposalOption {
  id: string;
  proposal_id: string;
  label: string;
  detail: string;
  image_url: string | null;
  position: number;
}

export interface Vote {
  id: string;
  proposal_id: string;
  option_id: string;
  member_id: string;
  created_at: string;
}

export const KIND_LABELS: Record<IdeaKind, string> = {
  bug: '🐞 Something is broken',
  feature: '💡 A new idea',
};

export const STATUS_ORDER: IdeaStatus[] = [
  'building',
  'approved',
  'pending',
  'shipped',
  'parked',
  'declined',
];
