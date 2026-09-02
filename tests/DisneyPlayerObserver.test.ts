import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '../src/extension/messages';
import type { PlaylistState } from '../src/domain/Playlist';

class FakeVideo extends EventTarget {
  paused = false; playbackRate = 1;
  pause() { this.paused = true; }
  currentTime = 10; duration = 100; ended = false; seeking = false; readyState = 4;
}
let video: FakeVideo;
let endMessages: number;
let failOnce: boolean;

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  video = new FakeVideo(); endMessages = 0; failOnce = false;
  const url = 'https://www.disneyplus.com/es-es/play/bluey';
  const state: PlaylistState = { episodes: [{ id: '1', title: 'Bluey', url }], session: { runId: 'run', index: 0, tabId: 42, status: 'playing', startedAt: new Date().toISOString(), endedAt: null, reason: null, limitSeconds: null, watchedSeconds: 0, meters: {}, entries: [{ id: '1', title: 'Bluey', url, watchedSeconds: 0, completed: false, byDay: {} }] }, history: [], limitSeconds: null };
  vi.stubGlobal('location', { href: url });
  vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === 'video' ? [video] : [], title: 'Bluey' });
  vi.stubGlobal('window', { setInterval });
  vi.stubGlobal('chrome', { runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(async (command: Command) => {
      if (command.type === 'ENDED') {
        endMessages++;
        if (failOnce) { failOnce = false; throw new Error('Fallo temporal'); }
        state.session!.status = 'completed';
      }
      return { ok: true, state: structuredClone(state) };
    }),
  } });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Observador con un reproductor simulado', () => {
  it('encuentra el vídeo del shadow DOM aunque el primero esté vacío', async () => {
    const placeholder = new FakeVideo();
    placeholder.currentTime = 0; placeholder.duration = NaN; placeholder.readyState = 0; placeholder.paused = true;
    const shadowRoot = { querySelectorAll: (selector: string) => selector === 'video' ? [video] : [] };
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === 'video' ? [placeholder] : [{ shadowRoot }], title: 'Bluey' });
    await import('../src/extension/content');
    video.currentTime = 99.6;
    await vi.advanceTimersByTimeAsync(2000);
    expect(endMessages).toBe(1);
  });

  it('adelantar hasta el final sin ended avanza una vez después de soltar la barra', async () => {
    await import('../src/extension/content');
    video.currentTime = 99.6; video.seeking = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(endMessages).toBe(0);
    video.seeking = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(endMessages).toBe(1);
    video.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(endMessages).toBe(1);
  });
  it('reconoce un vídeo que ya terminó antes de instalar el listener', async () => {
    video.ended = true; video.currentTime = 100;
    await import('../src/extension/content');
    await vi.advanceTimersByTimeAsync(1000);
    expect(endMessages).toBe(1);
  });
  it('reintenta un envío fallido en lugar de bloquear el documento', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    failOnce = true; video.ended = true; video.currentTime = 100;
    await import('../src/extension/content');
    await vi.advanceTimersByTimeAsync(2000);
    expect(endMessages).toBe(2);
  });
});
