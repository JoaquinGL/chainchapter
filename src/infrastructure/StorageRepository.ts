import { migrateState, type PlaylistState } from '../domain/Playlist';
import type { PlaylistRepository } from '../application/ports';
export const STORAGE_KEY = 'disney-playlist-v1';
/** Adaptador de persistencia. Singleton por contexto JS, nunca un almacén global en memoria. */
export class StorageRepository implements PlaylistRepository {
  private static instance: StorageRepository;
  private constructor() {}
  /** Devuelve la única instancia de este adaptador en el contexto actual. */
  static getInstance(): StorageRepository { return this.instance ??= new StorageRepository(); }
  /** Lee desde Chrome en la extensión y desde localStorage en la vista de desarrollo. */
  async load(): Promise<PlaylistState> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const value = await chrome.storage.local.get<Record<string, PlaylistState | undefined>>(STORAGE_KEY);
      return migrateState(value[STORAGE_KEY]);
    }
    const value = localStorage.getItem(STORAGE_KEY);
    return migrateState(value ? JSON.parse(value) : null);
  }
  /** Persiste toda la cola; el service worker serializa las escrituras de la extensión. */
  async save(state: PlaylistState): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
