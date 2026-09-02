import type { Episode } from './Episode';
export type FinishReason = 'list-completed' | 'time-limit' | 'stopped' | 'tab-closed' | 'browser-restarted' | 'navigation-error';
/** Estadísticas de una entrada concreta, incluso si se repite el mismo episodio. */
export interface EpisodeUsage extends Episode {
  watchedSeconds: number;
  completed: boolean;
  byDay: Record<string, number>;
}
/** Sesión persistida y medidores acumulados para hacer idempotentes los mensajes. */
export interface PlaybackSession {
  runId: string; tabId: number; index: number;
  status: 'playing' | 'stopped' | 'completed';
  startedAt: string; endedAt: string | null;
  reason: FinishReason | null;
  limitSeconds: number | null;
  watchedSeconds: number;
  entries: EpisodeUsage[];
  meters: Record<string, number>;
}
export interface PlaylistState {
  episodes: Episode[];
  session: PlaybackSession | null;
  history: PlaybackSession[];
  limitSeconds: number | null;
}
export const emptyState = (): PlaylistState => ({ episodes: [], session: null, history: [], limitSeconds: null });

/** Migra la PoC antigua conservando episodios; una sesión antigua no tenía estadísticas. */
export function migrateState(raw: Partial<PlaylistState> | null | undefined): PlaylistState {
  const state = { ...emptyState(), ...raw };
  if (state.session && !state.session.entries) state.session = null;
  return state;
}
