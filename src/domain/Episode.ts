/** Episodio elegido por el usuario; el ID identifica su posición, incluso si se repite. */
export interface Episode { id: string; title: string; url: string; durationSeconds?: number | null }

/** Valida exclusivamente enlaces de reproducción admitidos por esta PoC. */
export function normalizeEpisodeUrl(input: string): string {
  const url = new URL(input.trim());
  // Disney+ antepone el mercado del usuario (por ejemplo, /es-es/) a /play/ID.
  const playbackPath = /^\/(?:[a-z]{2}-[a-z]{2}\/)?(?:play|video)\/[a-zA-Z0-9-]+\/?$/i;
  if (url.protocol !== 'https:' || !['www.disneyplus.com', 'disneyplus.com'].includes(url.hostname)
    || url.username || url.password || url.port
    || !playbackPath.test(url.pathname)) {
    throw new Error('Usa la URL del episodio mientras se reproduce: https://www.disneyplus.com/es-es/play/ID');
  }
  return `https://www.disneyplus.com${url.pathname.replace(/\/$/, '')}`;
}

/** Construye un episodio válido sin depender de React ni del navegador. */
export function createEpisode(title: string, url: string, id: string): Episode {
  if (!title.trim()) throw new Error('Escribe un nombre para el episodio.');
  return { id, title: title.trim().slice(0, 180), url: normalizeEpisodeUrl(url) };
}

/** Compara la identidad del episodio aunque Disney redirija a otro prefijo de idioma. */
export function isSameEpisode(first: string, second: string): boolean {
  try {
    const id = (url: string) => new URL(normalizeEpisodeUrl(url)).pathname.split('/').at(-1);
    return id(first) === id(second);
  } catch { return false; }
}
