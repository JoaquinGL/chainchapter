/** Datos del reproductor necesarios para detectar el final sin depender del DOM. */
export interface PlaybackSnapshot {
  currentTime: number;
  duration: number;
  ended: boolean;
  seeking: boolean;
  readyState: number;
}

/** Respaldo para reproductores que se detienen al final sin emitir `ended`. */
export class PlaybackEndDetector {
  private terminalSamples = 0;

  /** Reinicia el seguimiento al cambiar de vídeo, ruta o sesión. */
  reset(): void { this.terminalSamples = 0; }

  /** Exige dos lecturas terminales; nunca avanza mientras se está arrastrando la barra. */
  isFinished(video: PlaybackSnapshot): boolean {
    if (video.seeking) { this.reset(); return false; }
    if (video.ended) return true;
    const nearEnd = Number.isFinite(video.duration) && video.duration > 0
      && Number.isFinite(video.currentTime) && video.currentTime > 0
      && video.readyState >= 2 && video.duration - video.currentTime <= 0.75
      && video.currentTime <= video.duration + 0.75;
    this.terminalSamples = nearEnd ? this.terminalSamples + 1 : 0;
    return this.terminalSamples >= 2;
  }
}
