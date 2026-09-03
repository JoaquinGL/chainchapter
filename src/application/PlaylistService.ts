import { createEpisode, isSameEpisode } from '../domain/Episode';
import type { FinishReason, PlaylistState } from '../domain/Playlist';
import type { PlaybackGateway, PlaylistRepository } from './ports';
import type { EpisodeDraft } from './PlaylistMarkdown';

/** Casos de uso de cola, sesiones, límite y estadísticas. El worker serializa su ejecución. */
export class PlaylistService {
  constructor(private readonly repository: PlaylistRepository, private readonly player: PlaybackGateway,
    private readonly now: () => Date = () => new Date()) {}
  /** Recupera cola, historial y configuración. */
  getState(): Promise<PlaylistState> { return this.repository.load(); }
  /** Valida duración en segundos. null significa desconocida, nunca cero minutos. */
  private duration(value: number | null | undefined): number | null {
    if (value == null) return null;
    if (!Number.isFinite(value) || value <= 0 || value > 86400) throw new Error('Indica una duración entre 1 segundo y 24 horas.');
    return Math.round(value);
  }
  /** Añade un episodio con duración detectada o manual. */
  async add(title: string, url: string, durationSeconds?: number | null): Promise<void> {
    const state = await this.editableState();
    const duplicate=state.episodes.find(e=>isSameEpisode(e.url,url));
    if(duplicate)throw new Error(`«${duplicate.title}» ya está en tu lista. No se ha añadido otra vez.`);
    state.episodes.push({ ...createEpisode(title, url, crypto.randomUUID()), durationSeconds: this.duration(durationSeconds) });
    await this.repository.save(state);
  }
  /** Importa una lista completa de forma atómica, añadiéndola a la cola existente. */
  async importEpisodes(drafts: EpisodeDraft[]): Promise<void> {
    if (!Array.isArray(drafts) || !drafts.length || drafts.length > 500) throw new Error('La lista debe tener entre 1 y 500 capítulos.');
    const entries = drafts.map(e => ({...createEpisode(e.title,e.url,crypto.randomUUID()),durationSeconds:this.duration(e.durationSeconds)}));
    const state=await this.editableState();state.episodes.push(...entries);await this.repository.save(state);
  }
  /** Edita nombre, URL y tiempo en una sola operación. */
  async updateEpisode(id: string, draft: EpisodeDraft): Promise<void> {
    const entry={...createEpisode(draft.title,draft.url,id),durationSeconds:this.duration(draft.durationSeconds)};
    const state=await this.editableState();
    const index=state.episodes.findIndex(e=>e.id===id);
    if(index<0) throw new Error('Este capítulo ya no está en la lista.');
    state.episodes[index]=entry;await this.repository.save(state);
  }
  /** Corrige una duración sin volver a crear la entrada. */
  async setDuration(id: string, durationSeconds: number | null): Promise<void> {
    const state = await this.editableState();
    const episode = state.episodes.find(e => e.id === id);
    if (episode) episode.durationSeconds = this.duration(durationSeconds);
    await this.repository.save(state);
  }
  /** Guarda un límite de visionado real, o null para no limitar. */
  async setLimit(seconds: number | null): Promise<void> {
    const state = await this.editableState();
    state.limitSeconds = this.duration(seconds);
    await this.repository.save(state);
  }
  /** Elimina una entrada. */
  async remove(id: string): Promise<void> {
    const state = await this.editableState();
    state.episodes = state.episodes.filter(e => e.id !== id);
    await this.repository.save(state);
  }
  /** Vacía los episodios en una sola escritura, conservando historial y configuración. */
  async clear(): Promise<void> {
    const state = await this.editableState();
    state.episodes = [];
    await this.repository.save(state);
  }
  /** Mueve una entrada una posición. */
  async move(id: string, direction: -1 | 1): Promise<void> {
    const state = await this.editableState();
    const from = state.episodes.findIndex(e => e.id === id), to = from + direction;
    if (from < 0 || to < 0 || to >= state.episodes.length) return;
    [state.episodes[from], state.episodes[to]] = [state.episodes[to], state.episodes[from]];
    await this.repository.save(state);
  }
  /** Inicia una sesión con una copia de la cola, para que el historial nunca cambie al editarla. */
  async start(tabId: number): Promise<void> {
    const state = await this.repository.load();
    if (!state.episodes.length) throw new Error('Añade al menos un episodio.');
    if (state.session?.status === 'playing') throw new Error('Detén la cola antes de iniciarla otra vez.');
    state.session = { runId: crypto.randomUUID(), tabId, index: 0, status: 'playing', startedAt: this.now().toISOString(),
      endedAt: null, reason: null, limitSeconds: state.limitSeconds, watchedSeconds: 0, meters: {},
      entries: state.episodes.map(e => ({ ...e, watchedSeconds: 0, completed: false, byDay: {} })) };
    await this.navigate(state);
  }
  /** Cierra el registro; una parada manual cancela seguimiento pero no pausa Disney+. */
  async stop(reason: FinishReason = 'stopped'): Promise<void> {
    const state = await this.repository.load();
    if (state.session?.status === 'playing') await this.close(state, reason, false);
  }
  /** Verifica la identidad de una señal del reproductor. */
  private matches(state: PlaylistState, tabId: number, url: string, runId: string, index: number): boolean {
    const s = state.session;
    return !!s && s.status === 'playing' && s.tabId === tabId && s.runId === runId && s.index === index
      && !!s.entries[index] && isSameEpisode(s.entries[index].url, url);
  }
  /** Suma un contador acumulado por documento; duplicados/reintentos no suman dos veces. */
  async record(tabId: number, url: string, runId: string, index: number,
    sourceId: string, totalSeconds: number, durationSeconds?: number | null): Promise<void> {
    const state = await this.repository.load();
    if (!this.matches(state, tabId, url, runId, index)) return;
    if (!sourceId || !Number.isFinite(totalSeconds) || totalSeconds < 0) throw new Error('Medición inválida.');
    const s = state.session!, entry = s.entries[index], key = `${index}:${sourceId}`;
    const previous = s.meters[key] ?? 0;
    if (totalSeconds < previous) return;
    const measuredAt = this.now();
    let delta = totalSeconds - previous;
    // Nunca puede haber más tiempo de visionado que tiempo transcurrido desde el inicio.
    delta = Math.min(delta, Math.max(0, (measuredAt.getTime() - Date.parse(s.startedAt)) / 1000 - s.watchedSeconds));
    if (s.limitSeconds != null) delta = Math.min(delta, Math.max(0, s.limitSeconds - s.watchedSeconds));
    s.meters[key] = totalSeconds;
    s.watchedSeconds += delta;
    entry.watchedSeconds += delta;
    // Reparte un intervalo que cruce medianoche en días del huso local del navegador.
    let cursor = measuredAt.getTime() - delta * 1000;
    const end = measuredAt.getTime();
    while (cursor < end) {
      const date = new Date(cursor);
      const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1).getTime();
      const stop = Math.min(next, end);
      entry.byDay[day] = (entry.byDay[day] ?? 0) + (stop-cursor)/1000;
      cursor = stop;
    }
    if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 86400) {
      entry.durationSeconds = Math.round(durationSeconds);
      const queued = state.episodes.find(e => e.id === entry.id);
      if (queued) queued.durationSeconds = entry.durationSeconds;
    }
    if (s.limitSeconds != null && s.watchedSeconds >= s.limitSeconds) await this.close(state, 'time-limit', true);
    else await this.repository.save(state);
  }
  /** Avanza y marca completado sólo al recibir un final natural, no al pulsar Siguiente. */
  async advance(tabId: number, url: string, runId: string, index: number, naturalEnd = true): Promise<boolean> {
    const state = await this.repository.load();
    if (!this.matches(state, tabId, url, runId, index)) return false;
    const s = state.session!;
    s.entries[index].completed = naturalEnd;
    if (index + 1 === s.entries.length) await this.close(state, 'list-completed', true);
    else { s.index++; await this.navigate(state); }
    return true;
  }
  /** Archiva una sola vez antes de mostrar la despedida. */
  private async close(state: PlaylistState, reason: FinishReason, showEnd: boolean): Promise<void> {
    const s = state.session!;
    s.status = showEnd ? 'completed' : 'stopped'; s.reason = reason; s.endedAt = this.now().toISOString();
    if (!state.history.some(item => item.runId === s.runId)) state.history.push(structuredClone(s));
    await this.repository.save(state);
    if (showEnd) await this.player.finish(s.tabId, reason);
  }
  /** Bloquea la edición de una cola en marcha. */
  private async editableState(): Promise<PlaylistState> {
    const state = await this.repository.load();
    if (state.session?.status === 'playing') throw new Error('Detén la cola antes de editarla.');
    state.session = null;
    return state;
  }
  /** Persiste antes de navegar y archiva los errores de navegación. */
  private async navigate(state: PlaylistState): Promise<void> {
    const s = state.session!;
    await this.repository.save(state);
    try { await this.player.open(s.tabId, s.entries[s.index].url); }
    catch (error) { await this.close(state, 'navigation-error', false); throw error; }
  }
}
