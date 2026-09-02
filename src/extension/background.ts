import { PlaylistService } from '../application/PlaylistService';
import { StorageRepository } from '../infrastructure/StorageRepository';
import { ChromePlaybackGateway } from '../infrastructure/ChromePlaybackGateway';
import type { Command, Reply } from './messages';
import { ContextMenuController } from './ContextMenuController';

/** Raíz de composición singleton: un coordinador y una cola de operaciones por worker. */
class BackgroundController {
  private static instance: BackgroundController;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly service = new PlaylistService(StorageRepository.getInstance(), new ChromePlaybackGateway());
  private constructor() {}
  static getInstance(): BackgroundController { return this.instance ??= new BackgroundController(); }

  /** Serializa mensajes para evitar escrituras perdidas y avances duplicados. */
  dispatch(command: Command, sender: chrome.runtime.MessageSender): Promise<Reply> {
    const operation = this.queue.then(() => this.handle(command, sender));
    this.queue = operation.catch(() => undefined);
    return operation.then(state => ({ ok: true, state }), error => ({ ok: false, error: String(error instanceof Error ? error.message : error) }));
  }

  /** Detiene una sesión cerrada o heredada de otro arranque, dentro de la cola. */
  stopForClosedTab(tabId?: number): void {
    const operation = this.queue.then(async () => {
      const { session } = await this.service.getState();
      if (session?.status === 'playing' && (tabId === undefined || session.tabId === tabId)) {
        await this.service.stop(tabId === undefined ? 'browser-restarted' : 'tab-closed');
      }
    });
    this.queue = operation.catch(error => console.warn('[Chain Chapters]', error));
  }

  /** Resuelve comandos de la UI y verifica los eventos originados en Disney+. */
  private async handle(command: Command, sender: chrome.runtime.MessageSender) {
    const fromPanel = sender.url === chrome.runtime.getURL('index.html');
    if (!fromPanel && !['GET', 'ENDED', 'PULSE'].includes(command.type)) throw new Error('Origen no permitido.');
    switch (command.type) {
      case 'GET': break;
      case 'ADD': await this.service.add(command.title, command.url, command.durationSeconds); break;
      case 'IMPORT': await this.service.importEpisodes(command.episodes); break;
      case 'UPDATE': await this.service.updateEpisode(command.id,command.episode); break;
      case 'DURATION': await this.service.setDuration(command.id, command.seconds); break;
      case 'LIMIT': await this.service.setLimit(command.seconds); break;
      case 'REMOVE': await this.service.remove(command.id); break;
      case 'MOVE':
        if (command.direction !== -1 && command.direction !== 1) throw new Error('Dirección inválida.');
        await this.service.move(command.id, command.direction); break;
      case 'STOP': await this.service.stop(); break;
      case 'START': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined || !tab.url || !/^https:\/\/(www\.)?disneyplus\.com\//.test(tab.url)) {
          throw new Error('Abre Disney+ en la pestaña activa antes de reproducir la cola.');
        }
        await this.service.start(tab.id); break;
      }
      case 'NEXT': {
        const { session, episodes } = await this.service.getState();
        if (session?.status === 'playing') {
          await this.service.advance(session.tabId, episodes[session.index].url, session.runId, session.index, false);
        }
        break;
      }
      case 'PULSE':
        if (sender.tab?.id === undefined || sender.frameId !== 0) throw new Error('Medición sin pestaña válida.');
        await this.service.record(sender.tab.id, command.url, command.runId, command.index, command.sourceId, command.totalSeconds, command.durationSeconds); break;
      case 'ENDED':
        if (sender.tab?.id === undefined || sender.frameId !== 0) throw new Error('Evento sin pestaña válida.');
        await this.service.advance(sender.tab.id, command.url, command.runId, command.index); break;
      default: throw new Error('Comando desconocido.');
    }
    return this.service.getState();
  }
}
const controller = BackgroundController.getInstance();
// Registro síncrono: Chrome puede despertar el worker para entregar el mensaje.
chrome.runtime.onMessage.addListener((command: Command, sender, sendResponse) => {
  void controller.dispatch(command, sender).then(sendResponse);
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => controller.stopForClosedTab(tabId));
chrome.runtime.onStartup.addListener(() => controller.stopForClosedTab());

// Panel global: el mismo documento permanece abierto al cambiar de capítulo o pestaña.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.warn('[Chain Chapters] No se pudo activar el panel lateral.', error));

const contextMenu = new ContextMenuController(async episode => {
  const reply = await controller.dispatch({type:'ADD',...episode},{url:chrome.runtime.getURL('index.html')});
  if(!reply.ok) throw new Error(reply.error);
});
contextMenu.listen();
chrome.runtime.onInstalled.addListener(() => contextMenu.install());
