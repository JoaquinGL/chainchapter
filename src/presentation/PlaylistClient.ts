import { PlaylistService } from '../application/PlaylistService';
import { StorageRepository } from '../infrastructure/StorageRepository';
import type { Command, Reply } from '../extension/messages';
export const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
/** Fachada singleton para React. Selecciona mensajería real o edición local. */
export class PlaylistClient {
  private static instance: PlaylistClient;
  private readonly local = new PlaylistService(StorageRepository.getInstance(), {
    open: async () => { throw new Error('La reproducción necesita la extensión instalada.'); },
    finish: async () => {},
  });
  private constructor() {}
  static getInstance(): PlaylistClient { return this.instance ??= new PlaylistClient(); }
  /** Ejecuta un caso de uso y devuelve el estado actualizado. */
  async execute(command: Command) {
    if (isExtension) {
      const reply: Reply = await chrome.runtime.sendMessage(command);
      if (!reply.ok) throw new Error(reply.error);
      return reply.state;
    }
    switch (command.type) {
      case 'GET': break;
      case 'ADD': await this.local.add(command.title, command.url, command.durationSeconds); break;
      case 'LIMIT': await this.local.setLimit(command.seconds); break;
      case 'IMPORT': await this.local.importEpisodes(command.episodes); break;
      case 'UPDATE': await this.local.updateEpisode(command.id,command.episode); break;
      case 'DURATION': await this.local.setDuration(command.id, command.seconds); break;
      case 'CLEAR': await this.local.clear(); break;
      case 'REMOVE': await this.local.remove(command.id); break;
      case 'MOVE': await this.local.move(command.id, command.direction); break;
      case 'STOP': await this.local.stop(); break;
      default: throw new Error('Carga la extensión para controlar Disney+.');
    }
    return this.local.getState();
  }
  /** Consulta el observador de la pestaña Disney+ activa para diagnosticar el final. */
  async diagnose(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Abre Disney+ en la pestaña activa.');
    try {
      const result: unknown = await chrome.tabs.sendMessage(tab.id, { type: 'DIAGNOSTICS' });
      if (typeof result !== 'string') throw new Error('Observador antiguo');
      return result;
    } catch { throw new Error('Recarga la extensión y después la pestaña Disney+ para activar el observador actualizado.'); }
  }
  /** Lee título y URL de la pestaña Disney+ activa para rellenar el formulario. */
  async capture(): Promise<{ title: string; url: string; durationSeconds?: number | null }> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !tab.url || !/^https:\/\/(www\.)?disneyplus\.com\//.test(tab.url)) {
      throw new Error('Abre un episodio en Disney+ primero.');
    }
    try { return await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE' }); }
    catch { throw new Error('Recarga Disney+ tras instalar la extensión e inténtalo otra vez.'); }
  }
}
