/** Convierte un reloj completo en segundos. */
function clock(text: string): number | null {
  const parts=text.split(':').map(Number);
  if(parts.length<2 || parts.length>3 || parts.slice(1).some(n=>n>=60)) return null;
  const seconds=parts.reduce((sum,n)=>sum*60+n,0);
  return Number.isFinite(seconds) && seconds>=0 && seconds<=86400 ? seconds : null;
}
/** Lee transcurrido/total o transcurrido/restante; un restante aislado no es duración total. */
export function durationFromText(text: string): number | null {
  const normalized=text.replace(/\u2212/g,'-').replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/\s+/g,' ').trim();
  const clocks=[...normalized.matchAll(/(-?)(\d{1,3}:\d{2}(?::\d{2})?)/g)];
  if(clocks.length!==2 || normalized.length>160) return null;
  const first=clock(clocks[0][2]),second=clock(clocks[1][2]);
  if(first==null || second==null || clocks[0][1]==='-') return null;
  const rest=clocks[1][1]==='-' || /restante|remaining|left/i.test(normalized);
  const explicitTotal=/\/|\bde\b|\bof\b|total|duraci[oó]n|duration/i.test(normalized);
  if(!rest && !explicitTotal) return null;
  const total=rest ? first+second : second;
  return total>0 && total<=86400 && (rest || total>=first) ? total : null;
}

/** Lee duración finita y tiempos de interfaz, también repartidos entre elementos hijos. */
export class DurationReader {
  read(video: HTMLVideoElement | null, root: Document | ShadowRoot): number | null {
    if(video && Number.isFinite(video.duration) && video.duration>0 && video.duration<=86400) return Math.round(video.duration);
    const visited=new Set<Document|ShadowRoot>();
    const readRoot=(node: Document|ShadowRoot): number|null => {
      if(visited.has(node)) return null;visited.add(node);
      for(const element of node.querySelectorAll('*')) {
        const label=element.getAttribute('aria-label') ?? '';
        const aria=element.getAttribute('aria-valuetext') ?? '';
        let result=durationFromText(aria) ?? durationFromText(label);
        if(result) return result;
        // Texto corto de controles. No escanea bloques de catálogo ni toda la página.
        const text=element.textContent?.replace(/\s+/g,' ').trim() ?? '';
        const tag=element.tagName.toLowerCase();
        if(!['script','style','noscript','head','title'].includes(tag) && text.length<=160) {
          const visible=element.getClientRects().length>0;
          if(visible) {
            const hints=[element,...Array.from(element.children)].map(item=>[item.getAttribute('aria-label'),item.getAttribute('data-testid'),item.id,item.className].join(' ')).join(' ');
            const suffix=/remaining|restante/i.test(hints)?' remaining':/duration|duraci[oó]n|total[-_ ]?time/i.test(hints)?' total':'';
            result=durationFromText(text+suffix);
            if(result) return result;
            // Un tiempo aislado sólo se acepta si está identificado explícitamente como total.
            const semantic=[label,element.getAttribute('data-testid'),element.id,element.className].join(' ');
            if(/(?:duration|duraci[oó]n|total[-_ ]?time|tiempo total)/i.test(semantic)
              && !/remaining|restante/i.test(semantic)) {
              const match=text.match(/^(\d{1,3}:\d{2}(?::\d{2})?)$/);
              if(match){result=clock(match[1]);if(result) return result;}
            }
          }
        }
        if(element.shadowRoot){result=readRoot(element.shadowRoot);if(result)return result;}
        if(element.tagName==='IFRAME') {
          try {const doc=(element as HTMLIFrameElement).contentDocument;if(doc){result=readRoot(doc);if(result)return result;}} catch { /* Sin acceso al marco ajeno. */ }
        }
      }
      return null;
    };
    return readRoot(root);
  }
}
