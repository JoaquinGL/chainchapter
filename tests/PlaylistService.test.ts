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
  it('rechaza duplicados al editar una URL sin perder la entrada anterior', async () => {
    const {service}=await setup();
    const before=await service.getState();
    const entry=before.episodes[1];
    await expect(service.updateEpisode(entry.id,{title:'Duplicado',url:'https://www.disneyplus.com/es-es/play/bluey',durationSeconds:300})).rejects.toThrow('ya está');
    expect(await service.getState()).toEqual(before);
    await service.updateEpisode(entry.id,{...entry,title:'Nombre corregido'});
    expect((await service.getState()).episodes[1].title).toBe('Nombre corregido');
  });
  it('vacía la lista conservando el historial y el límite', async () => {
    const {service}=await setup();
    await service.setLimit(3600);
    await service.start(42);
    await service.stop();
    const before=await service.getState();
    await service.clear();
    const after=await service.getState();
    expect(after.episodes).toEqual([]);
    expect(after.history).toEqual(before.history);
    expect(after.session).toBeNull();
    expect(after.limitSeconds).toBe(3600);
    await service.clear();
    expect(await service.getState()).toEqual(after);
  });
  it('rechaza vaciar la lista durante una reproducción activa', async () => {
    const {service}=await setup();
    await service.start(42);
    const before=await service.getState();
    await expect(service.clear()).rejects.toThrow('Detén');
    expect(await service.getState()).toEqual(before);
  });
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
  it('rechaza duplicados aunque cambien el idioma y los parámetros de la URL', async () => {
    const { service } = await setup();
    await expect(service.add('Otro nombre', 'https://disneyplus.com/es-es/video/bluey?tracking=1')).rejects.toThrow('ya está en tu lista');
    expect((await service.getState()).episodes).toHaveLength(2);
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
