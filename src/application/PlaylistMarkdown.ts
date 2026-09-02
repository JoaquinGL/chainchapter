import { createEpisode, type Episode } from '../domain/Episode';
import { formatClock, parseDuration } from './SessionReports';
export type EpisodeDraft = Pick<Episode, 'title' | 'url' | 'durationSeconds'>;

/** Tabla Markdown legible y editable: nombre, URL y duración. No contiene estadísticas. */
export class PlaylistMarkdown {
  static stringify(episodes: EpisodeDraft[]): string {
    const escape = (value: string) => value.replaceAll('\\','\\\\').replaceAll('|','\\|').replaceAll('\n',' ');
    return ['# Mi lista de dibujos', '', '| Nombre | URL | Duración |', '| --- | --- | --- |',
      ...episodes.map(e => `| ${escape(e.title)} | ${e.url} | ${e.durationSeconds ? formatClock(e.durationSeconds) : ''} |`), ''].join('\n');
  }
  /** Valida toda la lista antes de importarla. Un error no modifica la cola existente. */
  static parse(markdown: string): EpisodeDraft[] {
    if (markdown.length > 1_000_000) throw new Error('La lista supera 1 MB.');
    const result: EpisodeDraft[] = [];
    const lines = markdown.replace(/^\uFEFF/,'').split(/\r?\n/);
    for (const [index,line] of lines.entries()) {
      const text = line.trim();
      if (!text || text.startsWith('#') || text.startsWith('```')) continue;
      const cells = this.cells(text);
      if (cells.length === 3 && ((cells[0].toLowerCase() === 'nombre' && cells[1].toLowerCase() === 'url') || cells.every(c => /^:?-{3,}:?$/.test(c)))) continue;
      if (cells.length !== 3) throw new Error(`Línea ${index+1}: usa Nombre | URL | Duración.`);
      try {
        const episode = createEpisode(cells[0],cells[1].replace(/^<|>$/g,''),'import');
        result.push({title:episode.title,url:episode.url,durationSeconds:parseDuration(cells[2])});
      } catch(e) {throw new Error(`Línea ${index+1}: ${(e as Error).message}`);}
    }
    if (!result.length) throw new Error('La lista no contiene capítulos.');
    if (result.length > 500) throw new Error('Importa como máximo 500 capítulos cada vez.');
    return result;
  }
  /** Divide celdas respetando barras escapadas en los nombres. */
  private static cells(line: string): string[] {
    const text=line.startsWith('|') ? line.slice(1).replace(/(?<!\\)\|$/,'') : line;
    const cells: string[]=[];let current='',escaped=false;
    for(const char of text){
      if(escaped){current+=char;escaped=false;}
      else if(char==='\\') escaped=true;
      else if(char==='|'){cells.push(current.trim());current='';}
      else current+=char;
    }
    if(escaped) current+='\\';
    cells.push(current.trim());return cells;
  }
}
