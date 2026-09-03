import { withTimeout } from './withTimeout';
import type { PlaybackGateway } from '../application/ports';
import type { FinishReason } from '../domain/Playlist';
/** Sustituye la pestaña de Disney+ por la despedida al terminar, deteniendo el vídeo. */
export class ChromePlaybackGateway implements PlaybackGateway {
  async open(tabId: number, url: string): Promise<void> { await chrome.tabs.update(tabId, { url }); }
  async finish(tabId: number, reason: FinishReason): Promise<void> {
    // Pausa antes de navegar; una página que ya no tiene content script puede no responder.
    try { await withTimeout(chrome.tabs.sendMessage(tabId, { type: 'PAUSE_FOR_END' }),1500,'El reproductor no confirmó la pausa.'); } catch { /* La navegación también detiene el vídeo. */ }
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`index.html?view=end&reason=${reason}`) });
  }
}
