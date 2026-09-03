import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { emptyState, type PlaylistState } from '../domain/Playlist';
import { PlaylistClient, isExtension } from './PlaylistClient';
import type { Command } from '../extension/messages';
import { formatTime, parseDuration, SessionReports } from '../application/SessionReports';
import { PlaylistMarkdown } from '../application/PlaylistMarkdown';
import { EndScreen } from './EndScreen';
import { EpisodeRow } from './EpisodeRow';
import { download } from './download';
import { CONTEXT_FEEDBACK_KEY, type ContextFeedback } from '../extension/ContextMenuController';
import './styles.css';
const client=PlaylistClient.getInstance();
const example='| Nombre | URL | Duración |\n| --- | --- | --- |\n| Bluey | https://www.disneyplus.com/es-es/play/ID | 7:30 |';

/** Panel lateral: capturar, ordenar, reproducir. Los detalles permanecen plegados. */
function App(){
  const [state,setState]=useState<PlaylistState>(emptyState);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [limitOpen,setLimitOpen]=useState(false),[limit,setLimit]=useState('');
  const [manualOpen,setManualOpen]=useState(false),[pasteOpen,setPasteOpen]=useState(false);
  const [title,setTitle]=useState(''),[url,setUrl]=useState(''),[duration,setDuration]=useState(''),[markdown,setMarkdown]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const playing=state.session?.status==='playing';
  const known=state.episodes.reduce((n,e)=>n+(e.durationSeconds??0),0);
  const unknown=state.episodes.filter(e=>!e.durationSeconds).length;
  const sessions=SessionReports.sessions(state);
  useEffect(()=>{
    const refresh=()=>{void client.execute({type:'GET'}).then(setState).catch(e=>setError(e.message));};
    void client.execute({type:'GET'}).then(setState).catch(e=>setError(e.message)).finally(()=>setBusy(false));
    if(isExtension){
      const feedback=(value:ContextFeedback|undefined)=>{
        if(!value || Date.now()-value.at>90_000)return;
        if(value.error){setError(value.text);setNotice('');}else{setNotice(value.text);setError('');}
      };
      const changed=(changes:Record<string,chrome.storage.StorageChange>)=>{refresh();if(changes[CONTEXT_FEEDBACK_KEY])feedback(changes[CONTEXT_FEEDBACK_KEY].newValue as ContextFeedback);};
      chrome.storage.onChanged.addListener(changed);
      void chrome.storage.local.get<Record<string,ContextFeedback>>(CONTEXT_FEEDBACK_KEY).then(value=>feedback(value[CONTEXT_FEEDBACK_KEY]));
      return()=>chrome.storage.onChanged.removeListener(changed);
    }
  },[]);
  useEffect(()=>setLimit(state.limitSeconds==null?'':String(state.limitSeconds/60)),[state.limitSeconds]);

  async function run(command:Command):Promise<boolean>{
    setBusy(true);setError('');setNotice('');
    try{setState(await client.execute(command));return true;}
    catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
  }
  /** Guarda una fila sin desactivar botones ni interrumpir el foco al salir del campo. */
  async function updateRow(command:Command):Promise<boolean>{
    try{setState(await client.execute(command));setError('');return true;}
    catch(e){setError((e as Error).message);return false;}
  }
  /** Captura y añade con un solo clic. Nombre y tiempo se corrigen directamente en la fila. */
  async function capture(){
    setBusy(true);setError('');setNotice('');
    try{
      const e=await client.capture();
      setState(await client.execute({type:'ADD',title:e.title||'Capítulo de Disney+',url:e.url,durationSeconds:e.durationSeconds??null}));
      setNotice(e.durationSeconds?'Capítulo añadido. Ya puedes ir al siguiente.':'Capítulo añadido. Falta el tiempo: puedes escribirlo en su fila.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function saveLimit():Promise<boolean>{
    const seconds=limit.trim()?Number(limit)*60:null;
    if(seconds!=null&&(!Number.isFinite(seconds)||seconds<60||seconds>86400)){setError('Escribe de 1 a 1440 minutos, o deja vacío para no limitar.');return false;}
    if(seconds===state.limitSeconds)return true;
    return run({type:'LIMIT',seconds:seconds==null?null:Math.round(seconds)});
  }
  async function start(){if(await saveLimit())await run({type:'START'});}
  async function addManual(){
    try{if(await run({type:'ADD',title,url,durationSeconds:parseDuration(duration)})){setTitle('');setUrl('');setDuration('');setManualOpen(false);setNotice('Capítulo añadido.');}}
    catch(e){setError((e as Error).message);}
  }
  /** El archivo se valida completo antes de añadir: la cola existente nunca se borra. */
  async function importText(text:string){
    try{const episodes=PlaylistMarkdown.parse(text);if(await run({type:'IMPORT',episodes})){setPasteOpen(false);setMarkdown('');setNotice(`${episodes.length} capítulos añadidos a tu lista.`);}}
    catch(e){setError((e as Error).message);}
  }
  async function importFile(file:File|undefined){
    if(!file)return;
    if(file.size>1_000_000){setError('La lista supera 1 MB.');return;}
    try{await importText(await file.text());}catch(e){setError((e as Error).message);}
  }
  async function clearList(){if(await run({type:'CLEAR'}))setNotice('Lista vaciada.');}
  async function diagnose(){setBusy(true);try{setNotice(await client.diagnose());setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

  return <main className="queue-app">
    <header className="app-header"><div className="wordmark"><img src="./icons/icon-48.png" width="36" height="36" alt="" /><h1>Chain Chapters</h1></div>
      <button className={`limit-toggle ${state.limitSeconds?'is-set':''}`} disabled={playing} aria-expanded={limitOpen} onClick={()=>setLimitOpen(!limitOpen)}>◷ {state.limitSeconds?`${state.limitSeconds/60} min`:'Sin límite'}</button>
    </header>
    {limitOpen&&<div className="limit-editor"><label>Máximo de minutos<input autoFocus type="number" min="1" max="1440" step="1" value={limit} placeholder="Ej. 60" disabled={playing} onChange={e=>setLimit(e.target.value)} onBlur={()=>void saveLimit()} onKeyDown={e=>{if(e.key==='Enter'){void saveLimit();setLimitOpen(false);}}}/></label><button aria-label="Quitar límite" disabled={busy||playing} onClick={()=>{setLimit('');void run({type:'LIMIT',seconds:null});}}>Quitar</button><small>Vacío significa sin límite. Se guarda al salir del campo.</small></div>}
    {!isExtension&&<p className="local-note">Vista de prueba. En Chrome, abre Chain Chapters para capturar y reproducir.</p>}
    <section className="capture-area"><p className="eyebrow">ABRE UN CAPÍTULO EN DISNEY+ Y…</p>
      <button className="capture-button" disabled={!isExtension||busy||playing} onClick={()=>void capture()}><span aria-hidden="true">＋</span><span>Capturar capítulo<small>Añadir el que tienes abierto</small></span></button>
      <p className="capture-help">El panel se queda contigo mientras eliges el siguiente.</p>
    </section>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    <div className="list-heading"><h2>Tu lista <span>{state.episodes.length}</span></h2><strong>{unknown&&!known?'Tiempo pendiente':`${formatTime(known)}${unknown?' + ?':''}`}</strong></div>
    {unknown>0&&<p className="pending-time">{unknown} sin duración · puedes escribirla en su fila.</p>}
    {!state.episodes.length?<div className="empty-list"><div aria-hidden="true">♫</div><p>Aquí van sus próximos dibujos.</p><small>Captura uno, pega una lista o carga un archivo.</small></div>:<ol className="chapter-list">{state.episodes.map((e,index)=><EpisodeRow key={e.id} episode={e} index={index} total={state.episodes.length} playing={playing} current={playing&&state.session?.index===index}
      onSave={draft=>updateRow({type:'UPDATE',id:e.id,episode:draft})} onMove={direction=>void run({type:'MOVE',id:e.id,direction})} onRemove={()=>void run({type:'REMOVE',id:e.id})}/>)}</ol>}
    <div className="list-tools"><button disabled={busy||playing} onClick={()=>setManualOpen(!manualOpen)}>＋ Escribir capítulo</button><button disabled={busy||playing} onClick={()=>setPasteOpen(!pasteOpen)}>Pegar lista</button></div>
    {manualOpen&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void addManual();}}><label>Nombre<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Bluey · El xilófono mágico"/></label><label>URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} required placeholder="https://www.disneyplus.com/es-es/play/…"/></label><label>Duración<input value={duration} onChange={e=>setDuration(e.target.value)} placeholder="7:30 (opcional)"/></label><button className="primary" disabled={busy||playing}>Añadir</button></form>}
    {pasteOpen&&<section className="inline-form"><label>Nombre | URL | Duración<textarea autoFocus value={markdown} onChange={e=>setMarkdown(e.target.value)} placeholder={example} rows={6}/></label><p className="hint">Una línea por capítulo. También acepta la tabla del archivo .md.</p><button className="primary" disabled={busy||playing||!markdown.trim()} onClick={()=>void importText(markdown)}>Añadir lista</button></section>}
    <div className="file-tools"><button disabled={busy||playing||!state.episodes.length} onClick={()=>void clearList()}>Vaciar lista</button><button disabled={busy||playing} onClick={()=>fileInput.current?.click()}>↥ Cargar .md</button><button disabled={!state.episodes.length||busy} onClick={()=>download('mi-lista.md',PlaylistMarkdown.stringify(state.episodes),'text/markdown;charset=utf-8')}>↓ Guardar .md</button>
      <input ref={fileInput} type="file" accept=".md,.markdown,text/markdown,text/plain" hidden aria-label="Archivo de lista Markdown" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void importFile(file);}}/>
    </div>
    <div className="playback-bar">{playing?<><p className="live-status" role="status">{state.session!.limitSeconds!=null?`Quedan ${formatTime(Math.max(0,state.session!.limitSeconds-state.session!.watchedSeconds))}`:`${formatTime(state.session!.watchedSeconds)} vistos`}</p><div className="active-controls"><button disabled={busy} onClick={()=>void run({type:'NEXT'})}>Siguiente →</button><button disabled={busy} onClick={()=>void run({type:'STOP'})}>Detener cola</button></div></>:<button className="play-button" disabled={!isExtension||busy||!state.episodes.length} onClick={()=>void start()}>▶ Reproducir lista</button>}</div>
    <footer className="simple-footer"><button className="quiet-button" disabled={!sessions.length} onClick={()=>download('estadisticas-tele.md',SessionReports.markdown(sessions),'text/markdown;charset=utf-8')}>↓ Descargar estadísticas</button>
      <details><summary>Más opciones</summary><div className="extra-options"><button disabled={!sessions.length} onClick={()=>download('estadisticas.csv',SessionReports.csv(sessions),'text/csv;charset=utf-8')}>Estadísticas en CSV</button><button disabled={!sessions.length} onClick={()=>download('historial.json',SessionReports.json(sessions),'application/json')}>Historial en JSON</button>{isExtension&&<button disabled={busy} onClick={()=>void diagnose()}>Comprobar reproductor</button>}<a href="?view=end" target="_blank" rel="noreferrer">Ver despedida</a></div></details>
    </footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode>{new URLSearchParams(location.search).get('view')==='end'?<EndScreen/>:<App/>}</StrictMode>);
