/** Resultado del recorrido, útil para diferenciar un vídeo auxiliar del reproductor. */
export interface VideoInventory {
  videos: HTMLVideoElement[];
  inaccessibleFrames: number;
}

/** Localiza candidatos en DOM, shadow roots abiertos y marcos del mismo origen. */
export class VideoLocator {
  /** Recorre todos los candidatos, sin terminar al encontrar el primero. */
  scan(root: Document | ShadowRoot): VideoInventory {
    const videos = new Set<HTMLVideoElement>();
    const visited = new Set<Document | ShadowRoot>();
    let inaccessibleFrames = 0;
    const visit = (node: Document | ShadowRoot): void => {
      if (visited.has(node)) return;
      visited.add(node);
      for (const video of node.querySelectorAll('video')) videos.add(video);
      for (const element of node.querySelectorAll('*')) {
        if (element.shadowRoot) visit(element.shadowRoot);
        if (element.tagName === 'IFRAME') {
          try {
            const document = (element as HTMLIFrameElement).contentDocument;
            if (document) visit(document);
            else inaccessibleFrames++;
          } catch { inaccessibleFrames++; }
        }
      }
    };
    visit(root);
    return { videos: [...videos], inaccessibleFrames };
  }

  /** Prioriza metadatos válidos y progreso frente a elementos vacíos de precarga. */
  select(videos: HTMLVideoElement[], previous: HTMLVideoElement | null): HTMLVideoElement | null {
    const score = (video: HTMLVideoElement): number => {
      const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
      return (hasDuration ? 1000 : 0) + (video.readyState >= 1 ? 300 : 0)
        + (video.currentTime > 0 ? 200 : 0) + (!video.paused && !video.ended ? 100 : 0)
        + (video === previous ? 1 : 0);
    };
    return videos.reduce<HTMLVideoElement | null>((best, video) => !best || score(video) > score(best) ? video : best, null);
  }
}
