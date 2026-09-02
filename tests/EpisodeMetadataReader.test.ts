import { describe, expect, it } from 'vitest';
import { cardDuration, cleanEpisodeTitle, EpisodeMetadataReader } from '../src/extension/EpisodeMetadataReader';
const url='https://www.disneyplus.com/play/bluey';
function fixture(title:string,text:string) {
  const anchor={href:url,textContent:'',parentElement:null as unknown,contains:(value:unknown)=>value===anchor,
    getAttribute:()=>null,querySelector:(selector:string)=>selector==='img'?{alt:title}:null,querySelectorAll:()=>[]};
  const parent={getAttribute:()=>null,querySelector:()=>null,tagName:'DIV',textContent:text,parentElement:null,
    querySelectorAll:(selector:string)=>selector==='a[href]'?[anchor]:[{textContent:title}]};
  anchor.parentElement=parent;
  const root={querySelectorAll:()=>[anchor]} as unknown as Document;
  return {anchor,parent,root};
}
describe('Metadatos de la tarjeta elegida',()=>{
  it('lee título y minutos de la tarjeta aunque el enlace sea sólo una imagen',()=>{
    const {root}=fixture('Bluey · T1 E2 · Hospital','Bluey · T1 E2 · Hospital 7 min');
    expect(new EpisodeMetadataReader().read(root,url)).toEqual({url,title:'Bluey · T1 E2 · Hospital',durationSeconds:420});
  });
  it('encuentra datos más allá de tres envoltorios y prefiere el título a la imagen de serie',()=>{
    const {root,anchor,parent}=fixture('Hospital','Hospital 7 min');
    anchor.querySelector=(selector:string)=>selector==='img'?{alt:'Bluey'}:null;
    let wrapper:unknown=parent;
    for(let i=0;i<5;i++)wrapper={parentElement:wrapper,tagName:'DIV',textContent:'',getAttribute:()=>null,querySelector:()=>null,querySelectorAll:(selector:string)=>selector==='a[href]'?[anchor]:[]};
    anchor.parentElement=wrapper;
    expect(new EpisodeMetadataReader().read(root,url)).toEqual({url,title:'Hospital',durationSeconds:420});
  });
  it('lee enlaces dentro de shadow DOM abierto',()=>{
    const {root}=fixture('Hospital','Hospital 7 min');
    const shadowHost={shadowRoot:root};
    const outer={querySelectorAll:(selector:string)=>selector==='a[href]'?[]:[shadowHost]} as unknown as Document;
    expect(new EpisodeMetadataReader().read(outer,url).durationSeconds).toBe(420);
  });
  it('lee el título del reproductor cuando document.title sólo dice Disney+',()=>{
    const root={title:'Disney+',querySelectorAll:()=>[{getClientRects:()=>[{}],getAttribute:()=>null,textContent:'Bluey · Hospital'}]} as unknown as Document;
    expect(new EpisodeMetadataReader().currentTitle(root)).toBe('Bluey · Hospital');
  });
  it('no toma metadatos de un contenedor con enlaces a otros capítulos',()=>{
    const {root,parent,anchor}=fixture('Hospital','Hospital 7 min Otro capítulo 22 min');
    parent.querySelectorAll=()=>[anchor,{...anchor,href:'https://www.disneyplus.com/play/other'}];
    expect(new EpisodeMetadataReader().read(root,url).durationSeconds).toBeNull();
  });
  it('prefiere el enlace pulsado cuando hay varias tarjetas de la misma URL',()=>{
    const first=fixture('Bluey','Bluey');const second=fixture('Hospital','Hospital 7 min');
    const root={querySelectorAll:()=>[first.anchor,second.anchor]} as unknown as Document;
    expect(new EpisodeMetadataReader().read(root,url,second.anchor as unknown as Element).title).toBe('Hospital');
  });
  it('deja vacíos los datos si el enlace no existe, sin usar texto de otro episodio',()=>{
    const {root}=fixture('Hospital','Hospital 7 min');
    expect(new EpisodeMetadataReader().read(root,'https://www.disneyplus.com/play/other').title).toBe('');
  });
  it('reconoce unidades y relojes, pero no números de temporada ni relojes ambiguos',()=>{
    expect(cardDuration('T1 E2 · 1 h 12 min')).toBe(4320);
    expect(cardDuration('T1 E2 · 07:30')).toBe(450);
    expect(cardDuration('27 minutos,41 s')).toBe(1661);
    expect(cardDuration('(27 min)27 minutos,41 s')).toBeNull();
    expect(cardDuration('T1 E2')).toBeNull();
    expect(cardDuration('00:20 / 07:30')).toBeNull();
    expect(cleanEpisodeTitle('Reproducir Hospital | Disney+')).toBe('Hospital');
    expect(cleanEpisodeTitle('Disney+')).toBe('');
  });
});
