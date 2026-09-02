import type { FinishReason, PlaylistState } from '../domain/Playlist';
/** Puerto de persistencia independiente de Chrome. */
export interface PlaylistRepository { load(): Promise<PlaylistState>; save(state: PlaylistState): Promise<void> }
/** Navegación del reproductor y pantalla final. */
export interface PlaybackGateway {
  open(tabId: number, url: string): Promise<void>;
  finish(tabId: number, reason: FinishReason): Promise<void>;
}
