import { isSameEpisode, normalizeEpisodeUrl } from '../domain/Episode';
import type { EpisodeDraft } from '../application/PlaylistMarkdown';

/** Limpia etiquetas de navegación sin inventar nombres para capítulos desconocidos. */
export function cleanEpisodeTitle(text: string): string {
  const title=text.replace(/\s*[|–-]\s*Disney\+.*$/i,'').replace(/^\s*(?:reproducir|ver|play|watch)\s*[:：-]?\s+/i,'').replace(/\s+/g,' ').trim();
  return /^(?:Disney\+|inicio|home|reproducir|ver|play|watch)$/i.test(title) ? '' : title.slice(0,180);
}

/** Lee únicamente tiempos de una tarjeta de catálogo, nunca el reproductor de fondo. */
export function cardDuration(text: string): number | null {
  const units=[...text.matchAll(/\b(\d+)\s*(h(?:oras?)?|hours?|min(?:utos?|utes?)?|m|segundos?|seconds?|s)\b/gi)];
  if(units.length) {
    const values=new Map<number,number>();
    for(const match of units) {
      const factor=/^h/i.test(match[2])?3600:/^(?:m)/i.test(match[2])?60:1;
      // Repetir una unidad suele indicar versiones visual/accesible o varias duraciones.
      if(values.has(factor))return null;
      values.set(factor,Number(match[1]));
    }
    const total=[...values].reduce((sum,[factor,value])=>sum+factor*value,0);
    return total>0 && total<=86400 ? total : null;
  }
  const clocks=[...text.matchAll(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g)];
  if(clocks.length!==1)return null;
  const [,a,b,c]=clocks[0];
  if(Number(b)>=60 || (c && Number(c)>=60))return null;
  const total=c ? Number(a)*3600+Number(b)*60+Number(c) : Number(a)*60+Number(b);
  return total>0 && total<=86400 ? total : null;
}

/** Extrae metadatos de una tarjeta; no depende de las clases privadas de Disney+. */
export class EpisodeMetadataReader {
  /** Incluye enlaces de componentes con shadow DOM abierto. */
  private links(root: Document | ShadowRoot): HTMLAnchorElement[] {
    const links=Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    for(const node of root.querySelectorAll('*')) {
      if(node.shadowRoot)links.push(...this.links(node.shadowRoot));
    }
    return links;
  }

  /** Lee el capítulo abierto aunque el reproductor no contenga un enlace a sí mismo. */
  currentTitle(root: Document): string {
    const titles=Array.from(root.querySelectorAll('main h1,[role="main"] h1,video[aria-label]'))
      .filter(e=>e.getClientRects().length>0)
      .map(e=>cleanEpisodeTitle(e.getAttribute('aria-label') || e.textContent || ''));
    return titles.find(Boolean) || cleanEpisodeTitle(root.title);
  }

  /** Captura el enlace antes de que abrir el panel provoque un cambio de diseño. */
  fromClick(root: Document, path: EventTarget[]): EpisodeDraft | null {
    const anchor=path.find(node=>node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if(!anchor)return null;
    try { return this.read(root,normalizeEpisodeUrl(anchor.href),anchor); }
    catch { return null; }
  }

  /** Disney publica el tiempo redondeado y el accesible exacto en nodos hermanos. */
  private disneyCard(anchor: HTMLAnchorElement, url: string): EpisodeDraft | null {
    const titleNode=anchor.querySelector('[data-testid="standard-regular-list-item-title"]');
    if(!titleNode)return null;
    const title=cleanEpisodeTitle(titleNode.textContent??'');
    const metadata=anchor.querySelector('[data-testid="standard-regular-list-metadata"]');
    let durationSeconds:number|null=null;
    if(metadata) {
      const accessible=metadata.cloneNode(true) as Element;
      for(const hidden of accessible.querySelectorAll('[aria-hidden="true"]'))hidden.remove();
      durationSeconds=cardDuration(accessible.textContent??'');
      if(durationSeconds===null) {
        for(const node of metadata.querySelectorAll('[aria-hidden="true"]')) {
          durationSeconds=cardDuration(node.textContent??'');
          if(durationSeconds!==null)break;
        }
      }
    }
    return {url,title,durationSeconds};
  }

  read(root: Document, url: string, clicked: Element | null = null): EpisodeDraft {
    const links=this.links(root).filter(a=>isSameEpisode(a.href,url));
    const anchor=links.find(a=>clicked && a.contains(clicked)) ?? links[0];
    if(!anchor)return {url,title:'',durationSeconds:null};
    const disney=this.disneyCard(anchor,url);
    if(disney?.title)return disney;
    let card:Element=anchor;
    let title='',durationSeconds:number|null=null;
    let hasHeading=false;
    // Acumula datos del contenedor más cercano; los niveles posteriores sólo rellenan huecos.
    for(let depth=0;depth<9;depth++) {
      const headings=Array.from(card.querySelectorAll('h1,h2,h3,h4,[data-testid*="title"],[class*="title"]'))
        .map(e=>cleanEpisodeTitle(e.textContent??'')).filter(Boolean);
      if(!hasHeading && headings.length){title=[...new Set(headings)].join(' · ');hasHeading=true;}
      const labels=[card.getAttribute('aria-label'),card.getAttribute('title'),card.querySelector('img')?.alt];
      const text=(card as HTMLElement).innerText || card.textContent || '';
      const shortLines=text.split(/\n+/).map(line=>line.trim()).filter(line=>line.length>2 && line.length<120 && /[a-záéíóúñ]/i.test(line) && cardDuration(line)===null);
      title ||= [[...new Set(headings)].join(' · '),...labels,...shortLines].map(t=>cleanEpisodeTitle(t??'')).find(Boolean)??'';
      durationSeconds ??= cardDuration(text) ?? cardDuration(card.getAttribute('aria-label')??'');
      const parent=card.parentElement;
      if(!parent || ['BODY','MAIN'].includes(parent.tagName) || (parent.textContent?.length??0)>1500)break;
      const others=Array.from(parent.querySelectorAll<HTMLAnchorElement>('a[href]')).some(a=>{
        try {normalizeEpisodeUrl(a.href);return !isSameEpisode(a.href,url);}catch{return false;}
      });
      if(others)break;
      card=parent;
    }
    return {url,title,durationSeconds};
  }
}
