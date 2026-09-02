import { describe, expect, it } from 'vitest';
import { PlaylistMarkdown } from '../src/application/PlaylistMarkdown';
import { PlaylistService } from '../src/application/PlaylistService';
import { emptyState, type PlaylistState } from '../src/domain/Playlist';
const url='https://www.disneyplus.com/es-es/play/bluey';
describe('Listas Markdown',()=>{
  it('exporta y carga nombres Unicode, barras y duraciones pendientes sin pérdida',()=>{
    const episodes=[{title:'Bluey | Juego \\ 🧸',url,durationSeconds:450},{title:'SuperKitties',url:url.replace('bluey','kitties'),durationSeconds:null}];
    expect(PlaylistMarkdown.parse(PlaylistMarkdown.stringify(episodes))).toEqual(episodes);
  });
  it('admite filas sin cabecera ni barras exteriores',()=>{
    expect(PlaylistMarkdown.parse(`Bluey | ${url} | 7:30`)[0].durationSeconds).toBe(450);
    expect(PlaylistMarkdown.parse(`Nombre | ${url} | 7`)[0].title).toBe('Nombre');
    expect(PlaylistMarkdown.parse(`Bluey | ${url} |`)[0].durationSeconds).toBeNull();
  });
  it('rechaza URLs ajenas y tiempos mal escritos indicando la línea',()=>{
    expect(()=>PlaylistMarkdown.parse('Bluey | https://evil.test/play/abc | 7:30')).toThrow('Línea 1');
    expect(()=>PlaylistMarkdown.parse(`Bluey | ${url} | 7:99`)).toThrow('Línea 1');
  });
  it('importa sin borrar lo existente y no importa parcialmente un lote inválido',async()=>{
    let state=emptyState();
    const service=new PlaylistService({load:async()=>structuredClone(state),save:async(s:PlaylistState)=>{state=structuredClone(s);}}, {open:async()=>{},finish:async()=>{}});
    await service.add('Existente',url,60);
    await service.importEpisodes(PlaylistMarkdown.parse(`Bluey | ${url} | 7:30`));
    expect(state.episodes.map(e=>e.title)).toEqual(['Existente','Bluey']);
    await expect(service.importEpisodes([{title:'Bueno',url,durationSeconds:60},{title:'Malo',url:'https://evil.test',durationSeconds:60}])).rejects.toThrow();
    expect(state.episodes).toHaveLength(2);
    await service.updateEpisode(state.episodes[1].id,{title:'Bluey editado',url,durationSeconds:460});
    expect(state.episodes[1].durationSeconds).toBe(460);
  });
});
