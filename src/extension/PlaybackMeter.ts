export interface MeterSnapshot {
  currentTime: number; paused: boolean; seeking: boolean; ended: boolean; playbackRate: number; readyState: number;
}
/** Mide segundos de reloj con reproducción comprobada. Adelantar la barra no suma minutos. */
export class PlaybackMeter {
  private previous: { time: number; media: MeterSnapshot } | null = null;
  totalSeconds = 0;
  reset(): void { this.previous = null; this.totalSeconds = 0; }
  sample(media: MeterSnapshot, nowMs: number): number {
    const before = this.previous;
    this.previous = { time: nowMs, media: { currentTime: media.currentTime, paused: media.paused,
      seeking: media.seeking, ended: media.ended, playbackRate: media.playbackRate, readyState: media.readyState } };
    if (!before) return this.totalSeconds;
    const elapsed = (nowMs - before.time) / 1000;
    const progress = media.currentTime - before.media.currentTime;
    const rate = Math.max(0.1, before.media.playbackRate || 1);
    if (elapsed <= 0 || elapsed > 120 || before.media.paused || before.media.seeking || media.seeking
      || before.media.readyState < 2 || !Number.isFinite(progress) || progress <= 0
      || progress > elapsed * rate + 0.75) return this.totalSeconds;
    this.totalSeconds += Math.min(elapsed, progress / rate);
    return this.totalSeconds;
  }
}
