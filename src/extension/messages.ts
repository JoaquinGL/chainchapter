import type { PlaylistState } from '../domain/Playlist';
import type { EpisodeDraft } from '../application/PlaylistMarkdown';
export type Command =
  | { type: 'GET' } | { type: 'ADD'; title: string; url: string; durationSeconds?: number | null }
  | { type: 'IMPORT'; episodes: EpisodeDraft[] }
  | { type: 'UPDATE'; id: string; episode: EpisodeDraft }
  | { type: 'DURATION'; id: string; seconds: number | null }
  | { type: 'LIMIT'; seconds: number | null }
  | { type: 'REMOVE'; id: string } | { type: 'MOVE'; id: string; direction: -1 | 1 }
  | { type: 'START' } | { type: 'STOP' } | { type: 'NEXT' }
  | { type: 'PULSE'; url: string; runId: string; index: number; sourceId: string; totalSeconds: number; durationSeconds: number | null }
  | { type: 'ENDED'; url: string; runId: string; index: number };
export type Reply = { ok: true; state: PlaylistState } | { ok: false; error: string };
