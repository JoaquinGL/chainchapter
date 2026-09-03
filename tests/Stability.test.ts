import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromePlaybackGateway } from '../src/infrastructure/ChromePlaybackGateway';
import { withTimeout } from '../src/infrastructure/withTimeout';
import { PlaybackEndDetector } from '../src/extension/PlaybackEndDetector';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
describe('Regresiones de estabilidad',()=>{
  it('serializa altas locales rápidas y sigue funcionando tras rechazar un duplicado',async()=>{
    vi.stubGlobal('chrome',undefined);
    const storage=new Map<string,string>();
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
    const {PlaylistClient}=await import('../src/presentation/PlaylistClient');
    const client=PlaylistClient.getInstance();
    await Promise.all([
      client.execute({type:'ADD',title:'Bluey',url:'https://www.disneyplus.com/play/bluey'}),
      client.execute({type:'ADD',title:'Kitties',url:'https://www.disneyplus.com/play/kitties'}),
    ]);
    const state=await client.execute({type:'GET'});
    expect(state.episodes.map(e=>e.title)).toEqual(['Bluey','Kitties']);
    await expect(client.execute({type:'ADD',title:'Otra vez',url:state.episodes[0].url})).rejects.toThrow('ya está');
    await client.execute({type:'CLEAR'});
    expect((await client.execute({type:'GET'})).episodes).toEqual([]);
  });
  it('muestra la despedida aunque el mensaje de pausa nunca responda',async()=>{
    vi.useFakeTimers();
    const update=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome',{tabs:{sendMessage:()=>new Promise(()=>{}),update},runtime:{getURL:(path:string)=>'chrome-extension://test/'+path}});
    const finished=new ChromePlaybackGateway().finish(7,'time-limit');
    await vi.advanceTimersByTimeAsync(1500);
    await finished;
    expect(update).toHaveBeenCalledWith(7,{url:'chrome-extension://test/index.html?view=end&reason=time-limit'});
  });
  it('rechaza una espera agotada y absorbe un fallo tardío sin rechazo no controlado',async()=>{
    vi.useFakeTimers();
    let fail!:(error:Error)=>void;
    const pending=withTimeout(new Promise((_,reject)=>{fail=reject;}),100,'Tiempo agotado');
    const check=expect(pending).rejects.toThrow('Tiempo agotado');
    await vi.advanceTimersByTimeAsync(100);await check;
    fail(new Error('Respuesta tardía'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('libera el temporizador si la respuesta llega a tiempo',async()=>{
    vi.useFakeTimers();
    expect(await withTimeout(Promise.resolve('ok'),100,'error')).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('una pausa manual a medio segundo del final no provoca un salto',()=>{
    const detector=new PlaybackEndDetector();
    const video={currentTime:99.5,duration:100,paused:true,ended:false,seeking:false,readyState:4};
    expect(detector.isFinished(video)).toBe(false);
    expect(detector.isFinished(video)).toBe(false);
    expect(detector.isFinished({...video,ended:true})).toBe(true);
  });
});
