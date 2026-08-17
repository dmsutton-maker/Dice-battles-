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

export type PhaseStatus = 'planned' | 'active' | 'done';

export interface Member {
  id: string;
  email: string;
  display_name: string;
  role: Role;
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
  status: IdeaStatus;
  priority: number;
  phase_id: string | null;
  submitted_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  shipped_version: string;
  created_at: string;
  updated_at: string;
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

export const STATUS_ORDER: IdeaStatus[] = [
  'building',
  'approved',
  'pending',
  'shipped',
  'parked',
  'declined',
];
