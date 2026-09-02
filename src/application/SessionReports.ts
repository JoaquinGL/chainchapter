import type { PlaybackSession, PlaylistState } from '../domain/Playlist';
/** Fechas locales: el mes coincide con el huso horario del navegador que mide la sesión. */
export function currentMonth(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value/3600), minutes = Math.floor(value%3600/60), rest = value%60;
  return hours ? `${hours} h ${minutes} min` : minutes ? `${minutes} min ${rest ? `${rest} s` : ''}`.trim() : `${rest} s`;
}
export function formatClock(seconds: number): string {
  return `${Math.floor(seconds/60)}:${String(Math.round(seconds)%60).padStart(2,'0')}`;
}
export function parseDuration(text: string): number | null {
  if (!text.trim()) return null;
  if (!/^\d+(?::[0-5]\d){0,2}$/.test(text.trim())) throw new Error('Duración: escribe minutos (7), MM:SS (7:30) o HH:MM:SS.');
  const parts = text.trim().split(':').map(Number);
  const seconds = parts.length === 1 ? parts[0]*60 : parts.reduce((sum,n) => sum*60+n,0);
  if (seconds <= 0 || seconds > 86400) throw new Error('La duración debe estar entre 1 segundo y 24 horas.');
  return seconds;
}
export const reasonLabel: Record<string, string> = {
  'list-completed': 'Lista terminada', 'time-limit': 'Límite alcanzado', stopped: 'Parada manual',
  'tab-closed': 'Pestaña cerrada', 'browser-restarted': 'Navegador reiniciado', 'navigation-error': 'Error de navegación',
};
/** Consultas y exportaciones independientes de React/Chrome. */
export class SessionReports {
  static sessions(state: PlaylistState): PlaybackSession[] {
    return state.session?.status === 'playing' ? [...state.history, state.session] : state.history;
  }
  static monthSeconds(sessions: PlaybackSession[], month: string): number {
    return sessions.reduce((sum,s) => sum + s.entries.reduce((total,e) => total + Object.entries(e.byDay)
      .filter(([day]) => day.startsWith(month+'-')).reduce((n,[,seconds]) => n+seconds,0),0),0);
  }
  /** CSV compatible con hojas de cálculo. Protege títulos que se interpretarían como fórmulas. */
  static csv(sessions: PlaybackSession[], month?: string): string {
    const cell = (input: unknown) => {
      let text = String(input ?? '');
      if (/^[\s]*[=+@-]/.test(text)) text = "'"+text;
      return `"${text.replaceAll('"','""')}"`;
    };
    const rows: unknown[][] = [['sesion','inicio','fin','motivo','episodio','url','duracion_prevista_segundos','visto_segundos','completado','visto_por_dia']];
    for (const s of sessions) for (const e of s.entries) {
      const days = Object.fromEntries(Object.entries(e.byDay).filter(([day]) => !month || day.startsWith(month+'-')));
      const seconds = month ? Object.values(days).reduce((sum,n) => sum+n,0) : e.watchedSeconds;
      if (month && seconds === 0) continue;
      rows.push([s.runId,s.startedAt,s.endedAt,reasonLabel[s.reason ?? ''] ?? 'En curso',e.title,e.url,e.durationSeconds ?? '',
        Math.round(seconds*100)/100,e.completed ? 'sí' : 'no',JSON.stringify(days)]);
    }
    return '\uFEFF'+rows.map(row => row.map(cell).join(';')).join('\r\n');
  }
  /** Informe descargable con meses y sesiones; no requiere panel de estadísticas. */
  static markdown(sessions: PlaybackSession[]): string {
    const escape=(text:string)=>text.replaceAll('|','\\|').replaceAll('\n',' ');
    const months=[...new Set(sessions.flatMap(s=>s.entries.flatMap(e=>Object.keys(e.byDay).map(day=>day.slice(0,7)))))].sort().reverse();
    const lines=['# Uso de Chain Chapters', '', `Exportado: ${new Date().toLocaleString('es-ES')}`, '',
      `Tiempo total medido: **${formatTime(sessions.reduce((n,s)=>n+s.watchedSeconds,0))}**`, '',
      '## Por mes', '', '| Mes | Tiempo visto |', '| --- | --- |',
      ...months.map(month=>`| ${month} | ${formatTime(this.monthSeconds(sessions,month))} |`), '', '## Sesiones', ''];
    for(const s of [...sessions].reverse()) {
      lines.push(`### ${new Date(s.startedAt).toLocaleString('es-ES')}`, '',
        `Estado: ${s.status==='playing'?'En curso':reasonLabel[s.reason??'']}. Tiempo visto: **${formatTime(s.watchedSeconds)}**.`, '',
        '| Capítulo | Tiempo visto | Estado |', '| --- | --- | --- |',
        ...s.entries.map(e=>`| ${escape(e.title)} | ${formatTime(e.watchedSeconds)} | ${e.completed?'Terminado':e.watchedSeconds?'Parcial':'Sin ver'} |`), '');
    }
    lines.push('Medición aproximada de las sesiones iniciadas con esta extensión; no incluye historial anterior de Disney+.','');
    return lines.join('\n');
  }
  /** Copia legible del historial sin identificadores internos de pestaña ni medidores. */
  static json(sessions: PlaybackSession[]): string {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions: sessions.map(({ meters: _meters, tabId: _tab, ...s }) => s) }, null, 2);
  }
}
