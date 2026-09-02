import { describe, expect, it } from 'vitest';
import { PlaybackEndDetector, type PlaybackSnapshot } from '../src/extension/PlaybackEndDetector';
const snapshot = (overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot => ({ currentTime: 99.6, duration: 100, ended: false, seeking: false, readyState: 4, ...overrides });
describe('Detección del final', () => {
  it('reconoce ended aunque el evento ya haya pasado', () => {
    expect(new PlaybackEndDetector().isFinished(snapshot({ ended: true }))).toBe(true);
  });
  it('detecta dos lecturas finales sin evento ended', () => {
    const detector = new PlaybackEndDetector();
    expect(detector.isFinished(snapshot())).toBe(false);
    expect(detector.isFinished(snapshot())).toBe(true);
  });
  it('espera a terminar el seeking y reinicia las muestras si se vuelve atrás', () => {
    const detector = new PlaybackEndDetector();
    expect(detector.isFinished(snapshot({ seeking: true, ended: true }))).toBe(false);
    expect(detector.isFinished(snapshot())).toBe(false);
    expect(detector.isFinished(snapshot({ currentTime: 20 }))).toBe(false);
    expect(detector.isFinished(snapshot())).toBe(false);
    expect(detector.isFinished(snapshot())).toBe(true);
  });
  it('no confunde pausa intermedia, carga, duración desconocida ni stream infinito con el final', () => {
    for (const values of [{ currentTime: 20 }, { duration: NaN }, { duration: Infinity }, { duration: 0 }, { readyState: 1 }, { currentTime: 0 }, { currentTime: 105 }]) {
      const detector = new PlaybackEndDetector();
      expect(detector.isFinished(snapshot(values))).toBe(false);
      expect(detector.isFinished(snapshot(values))).toBe(false);
    }
  });
});
