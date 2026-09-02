import { useEffect, useState, type FocusEvent } from 'react';
import type { Episode } from '../domain/Episode';
import type { EpisodeDraft } from '../application/PlaylistMarkdown';
import { formatClock, parseDuration } from '../application/SessionReports';
/** Nombre y tiempo editables in situ; la URL se despliega cuando hace falta. */
export function EpisodeRow({episode,index,total,playing,current,onSave,onMove,onRemove}: {
  episode:Episode;index:number;total:number;playing:boolean;current:boolean;
  onSave:(draft:EpisodeDraft)=>Promise<boolean>;onMove:(direction:-1|1)=>void;onRemove:()=>void;
}) {
  const [title,setTitle]=useState(episode.title),[url,setUrl]=useState(episode.url);
  const [duration,setDuration]=useState(episode.durationSeconds?formatClock(episode.durationSeconds):'');
  const [error,setError]=useState('');
  useEffect(()=>{setTitle(episode.title);setUrl(episode.url);setDuration(episode.durationSeconds?formatClock(episode.durationSeconds):'');},[episode.title,episode.url,episode.durationSeconds]);
  async function save(){
    try {
      const seconds=parseDuration(duration);
      if(title===episode.title && url===episode.url && seconds===(episode.durationSeconds??null))return;
      if(await onSave({title,url,durationSeconds:seconds}))setError('');
    }catch(e){setError((e as Error).message);}
  }
  function leave(event:FocusEvent<HTMLLIElement>){if(!event.currentTarget.contains(event.relatedTarget as Node|null))void save();}
  return <li className={`chapter-row ${current?'current':''}`} onBlur={leave}>
    <div className="chapter-top"><span className="chapter-index">{current?'▶':String(index+1).padStart(2,'0')}</span>
      <input className="chapter-name" aria-label={`Nombre del capítulo ${index+1}`} value={title} disabled={playing} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}}}/>
      <button className="icon-button remove" disabled={playing} aria-label={`Eliminar ${episode.title}`} onClick={onRemove}>×</button>
    </div>
    <div className="chapter-bottom"><input className="chapter-time" aria-label={`Duración de ${episode.title}`} placeholder="MM:SS" value={duration} disabled={playing} onChange={e=>setDuration(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}}}/>
      <span className="duration-caption">{episode.durationSeconds?'min:seg':'tiempo pendiente'}</span>
      <div className="reorder"><button className="icon-button" aria-label={`Subir ${episode.title}`} disabled={playing||index===0} onClick={()=>onMove(-1)}>↑</button><button className="icon-button" aria-label={`Bajar ${episode.title}`} disabled={playing||index===total-1} onClick={()=>onMove(1)}>↓</button></div>
    </div>
    <details className="chapter-link"><summary>Enlace</summary><input aria-label={`URL de ${episode.title}`} value={url} disabled={playing} onChange={e=>setUrl(e.target.value)}/></details>
    {error&&<p className="error" role="alert">{error}</p>}
  </li>;
}
