import { withTimeout } from '../infrastructure/withTimeout';
import { cleanEpisodeTitle } from './EpisodeMetadataReader';
import { isSameEpisode, normalizeEpisodeUrl } from '../domain/Episode';
import type { EpisodeDraft } from '../application/PlaylistMarkdown';

export const CONTEXT_MENU_ID = 'mi-cola-add-episode';
export const CONTEXT_FEEDBACK_KEY = 'mi-cola-context-feedback';
export interface ContextFeedback { text: string; error: boolean; at: number }

/** Adaptador del menú contextual; reutiliza los casos de uso y la cola del worker. */
export class ContextMenuController {
  constructor(private readonly add: (episode: EpisodeDraft) => Promise<void>) {}

  /** Se llama al instalar/actualizar, evitando duplicar menús al despertar el worker. */
  install(): void {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_ID, title: 'Añadir a Chain Chapters',
        contexts: ['page','video','link','image','selection'],
        documentUrlPatterns: ['https://www.disneyplus.com/*','https://disneyplus.com/*'],
      }, () => { if(chrome.runtime.lastError) console.warn('[Chain Chapters]',chrome.runtime.lastError.message); });
    });
  }

  /** Registra el clic síncronamente para que Chrome pueda despertar el worker. */
  listen(): void {
    chrome.contextMenus.onClicked.addListener((info,tab) => {
      if(info.menuItemId!==CONTEXT_MENU_ID || tab?.id===undefined)return;
      // Abrir aquí conserva el gesto de usuario; después de un await podría perderse.
      void chrome.sidePanel.open({windowId:tab.windowId}).catch(error=>console.warn('[Chain Chapters] Panel:',error));
      void this.handle(info,tab).catch(error=>console.warn('[Chain Chapters] Menú contextual:',error));
    });
  }

  /** Prioriza el enlace pulsado; nunca toma su vídeo blob ni el capítulo de otra pestaña. */
  async handle(info: Pick<chrome.contextMenus.OnClickData,'linkUrl'|'pageUrl'>, tab: Pick<chrome.tabs.Tab,'id'|'url'|'title'>): Promise<void> {
    try {
      if(tab.id===undefined)throw new Error('No se encuentra la pestaña.');
      let url: string;
      try { url=normalizeEpisodeUrl(info.linkUrl ?? info.pageUrl ?? tab.url ?? ''); }
      catch {throw new Error('Abre el capítulo para añadirlo. Este enlace no es una URL directa de reproducción de Disney+.');}
      const current=isSameEpisode(url,tab.url??'');
      let episode:EpisodeDraft={url,title:current?cleanEpisodeTitle(tab.title??''):'',durationSeconds:null};
      let captureFailed=false;
      try {
        const captured:EpisodeDraft=await withTimeout(chrome.tabs.sendMessage(tab.id,{type:'CAPTURE_CONTEXT',url},{frameId:0}),4000,'El observador no responde.');
        if(captured && isSameEpisode(captured.url,url)) {
          episode={url,title:cleanEpisodeTitle(captured.title??'')||episode.title,durationSeconds:captured.durationSeconds??null};
        }
      }catch { captureFailed=true; }
      const missingTitle=!episode.title;
      if(missingTitle)episode.title='Capítulo pendiente de nombre';
      await this.add(episode);
      await this.feedback(missingTitle ? (captureFailed ? 'Enlace guardado. El observador de la extensión no ha respondido. Recarga esta pestaña después de actualizar la extensión.' : 'Enlace guardado. El lector no ha encontrado el título en esta tarjeta; puedes editarlo en la lista.') : `${episode.title} añadido a tu lista.${episode.durationSeconds?'':' Duración pendiente.'}`,false);
    }catch(error){await this.feedback(error instanceof Error?error.message:String(error),true);}
  }

  /** Persiste el resultado brevemente para que el panel recién abierto también lo reciba. */
  private async feedback(text:string,error:boolean):Promise<void>{
    await chrome.storage.local.set({[CONTEXT_FEEDBACK_KEY]:{text,error,at:Date.now()} satisfies ContextFeedback});
  }
}
