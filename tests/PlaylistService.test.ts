import { describe, expect, it } from 'vitest';
import { PlaylistService } from '../src/application/PlaylistService';
import type { PlaylistRepository, PlaybackGateway } from '../src/application/ports';
import { emptyState, type PlaylistState } from '../src/domain/Playlist';
import { normalizeEpisodeUrl } from '../src/domain/Episode';

class MemoryRepository implements PlaylistRepository {
  state = emptyState();
  async load() { return structuredClone(this.state); }
  async save(state: PlaylistState) { this.state = structuredClone(state); }
}
class RecordingPlayer implements PlaybackGateway {
  calls: { tab: number; url: string }[] = [];
  fail = false;
  finishes: string[] = [];
  async finish(_tab: number, reason: string) { this.finishes.push(reason); }
  async open(tab: number, url: string) {
    if (this.fail) throw new Error('Pestaña cerrada');
    this.calls.push({ tab, url });
  }
}
async function setup() {
  const repository = new MemoryRepository();
  const player = new RecordingPlayer();
  const service = new PlaylistService(repository, player);
  await service.add('Bluey', 'https://www.disneyplus.com/play/bluey');
  await service.add('Spidey', 'https://www.disneyplus.com/play/spidey');
  return { repository, player, service };
}

describe('Cola de episodios', () => {
  it('guarda los dos enlaces es-es y avanza al segundo manteniendo el mercado', async () => {
    const player = new RecordingPlayer();
    const service = new PlaylistService(new MemoryRepository(), player);
    const urls = [
      'https://www.disneyplus.com/es-es/play/3cb91024-2d18-448d-9baf-e8f1dce42f51',
      'https://www.disneyplus.com/es-es/play/9e0edb81-af89-4da1-b362-b17e4cef51db',
    ];
    await service.add('Episodio 1', urls[0]);
    await service.add('Episodio 2', urls[1]);
    expect((await service.getState()).episodes.map(e => e.url)).toEqual(urls);
    await service.start(42);
    const { session } = await service.getState();
    await service.advance(42, urls[0].replace('/es-es/', '/'), session!.runId, 0);
    expect(player.calls.map(c => c.url)).toEqual(urls);
  });
  it('normaliza enlaces y rechaza dominios engañosos o fichas de series', () => {
    expect(normalizeEpisodeUrl('https://disneyplus.com/play/abc/?tracking=1')).toBe('https://www.disneyplus.com/play/abc');
    for (const url of ['https://disneyplus.com.evil.test/play/a', 'javascript:alert(1)', 'https://www.disneyplus.com/browse/entity-a', 'https://user@www.disneyplus.com/play/a']) {
      expect(() => normalizeEpisodeUrl(url)).toThrow();
    }
  });
  it('respeta el orden editado y conserva episodios repetidos', async () => {
    const { service } = await setup();
    await service.add('Bluey otra vez', 'https://www.disneyplus.com/play/bluey');
    const { episodes } = await service.getState();
    await service.move(episodes[2].id, -1);
    await service.remove(episodes[0].id);
    expect((await service.getState()).episodes.map(e => e.title)).toEqual(['Bluey otra vez', 'Spidey']);
  });
  it('pasa de Bluey a Spidey y termina sin abrir un tercer episodio', async () => {
    const { service, player } = await setup();
    await service.start(42);
    let { session, episodes } = await service.getState();
    expect(await service.advance(42, episodes[0].url, session!.runId, 0)).toBe(true);
    expect(player.calls.map(c => c.url)).toEqual(episodes.map(e => e.url));
    session = (await service.getState()).session;
    await service.advance(42, episodes[1].url, session!.runId, 1);
    expect((await service.getState()).session?.status).toBe('completed');
    expect(player.calls).toHaveLength(2);
  });
  it('ignora otras pestañas, rutas distintas, sesiones antiguas y eventos duplicados', async () => {
    const { service, player } = await setup();
    await service.start(42);
    const { session, episodes } = await service.getState();
    expect(await service.advance(99, episodes[0].url, session!.runId, 0)).toBe(false);
    expect(await service.advance(42, episodes[1].url, session!.runId, 0)).toBe(false);
    expect(await service.advance(42, episodes[0].url, 'old-run', 0)).toBe(false);
    await service.advance(42, episodes[0].url, session!.runId, 0);
    expect(await service.advance(42, episodes[0].url, session!.runId, 0)).toBe(false);
    expect(player.calls).toHaveLength(2);
  });
  it('sobrevive a recrear el servicio y no permite editar la cola activa', async () => {
    const { service, repository, player } = await setup();
    await service.start(42);
    const recreated = new PlaylistService(repository, player);
    const { session, episodes } = await recreated.getState();
    await expect(recreated.remove(episodes[0].id)).rejects.toThrow('Detén');
    await expect(recreated.start(77)).rejects.toThrow('Detén');
    await recreated.advance(42, episodes[0].url, session!.runId, 0);
    expect((await recreated.getState()).session?.index).toBe(1);
  });
  it('detener cancela cualquier evento de final pendiente', async () => {
    const { service, player } = await setup();
    await service.start(42);
    const { session, episodes } = await service.getState();
    await service.stop();
    expect(await service.advance(42, episodes[0].url, session!.runId, 0)).toBe(false);
    expect(player.calls).toHaveLength(1);
  });
  it('un fallo de navegación deja la cola detenida y editable', async () => {
    const { service, player } = await setup();
    player.fail = true;
    await expect(service.start(42)).rejects.toThrow('Pestaña cerrada');
    expect((await service.getState()).session?.status).toBe('stopped');
    await service.add('Mickey', 'https://www.disneyplus.com/play/mickey');
    expect((await service.getState()).episodes).toHaveLength(3);
  });
  it('rechaza una cola vacía', async () => {
    const service = new PlaylistService(new MemoryRepository(), new RecordingPlayer());
    await expect(service.start(1)).rejects.toThrow('Añade');
  });
});
