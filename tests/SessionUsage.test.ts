import { describe, expect, it } from 'vitest';
import { PlaylistService } from '../src/application/PlaylistService';
import { emptyState, migrateState, type PlaylistState } from '../src/domain/Playlist';
import { SessionReports, parseDuration } from '../src/application/SessionReports';
import { PlaybackMeter } from '../src/extension/PlaybackMeter';
import { durationFromText } from '../src/extension/DurationReader';

function setup(date = new Date(2026,8,2,12)) {
  let clock = date.getTime();
  let state = emptyState();
  const finished: string[] = [], opened: string[] = [];
  const repository = { load: async () => structuredClone(state), save: async (s: PlaylistState) => {state=structuredClone(s);} };
  const player = {open: async (_tab: number,url: string) => {opened.push(url);},finish: async (_tab: number,reason: string) => {finished.push(reason);} };
  const service = new PlaylistService(repository,player,() => new Date(clock));
  return {service,finished,opened, tick:(seconds: number) => {clock+=seconds*1000;} };
}
const url = 'https://www.disneyplus.com/es-es/play/bluey';

describe('Sesiones, límites e informes', () => {
  it('detecta duración textual y admite edición manual', () => {
    expect(durationFromText('00:20 / 07:30')).toBe(450);
    expect(durationFromText('20 de 100')).toBeNull();
    expect(durationFromText('00:20 / 07:90')).toBeNull();
    expect(parseDuration('7:30')).toBe(450);
    expect(parseDuration('60')).toBe(3600);
    expect(() => parseDuration('7:90')).toThrow();
  });
  it('conserva las colas antiguas y no inventa duraciones', () => {
    const old = migrateState({episodes:[{id:'1',title:'Bluey',url}]});
    expect(old.episodes).toHaveLength(1); expect(old.episodes[0].durationSeconds).toBeUndefined();
    expect(old.history).toEqual([]); expect(old.limitSeconds).toBeNull();
  });
  it('los pulsos repetidos no duplican tiempo y llegar al límite cierra una sola vez', async () => {
    const {service,tick,finished,opened} = setup();
    await service.add('Bluey',url,450); await service.add('Spidey',url.replace('bluey','spidey'),600);
    await service.setLimit(5); await service.start(42);
    const run = (await service.getState()).session!.runId;
    tick(3); await service.record(42,url,run,0,'doc',3,451);
    await service.record(42,url,run,0,'doc',3,451);
    expect((await service.getState()).session!.watchedSeconds).toBe(3);
    tick(3); await service.record(42,url,run,0,'doc',6,451);
    const state = await service.getState();
    expect(state.session!.watchedSeconds).toBe(5);
    expect(state.session!.reason).toBe('time-limit'); expect(state.history).toHaveLength(1);
    expect(state.history[0].entries[0].completed).toBe(false);
    expect(state.episodes[0].durationSeconds).toBe(451);
    await service.advance(42,url,run,0);
    expect(finished).toEqual(['time-limit']); expect(opened).toHaveLength(1);
  });
  it('una pestaña ajena no consume el límite', async () => {
    const {service,tick} = setup(); await service.add('Bluey',url); await service.start(42);
    tick(10); await service.record(99,url,(await service.getState()).session!.runId,0,'doc',10);
    expect((await service.getState()).session!.watchedSeconds).toBe(0);
  });
  it('el final natural archiva el tiempo real, sin inflarlo hasta la duración del capítulo', async () => {
    const {service,tick,finished} = setup(); await service.add('Bluey',url,450); await service.start(42);
    const run = (await service.getState()).session!.runId;
    tick(20); await service.record(42,url,run,0,'doc',20);
    await service.advance(42,url,run,0);
    const state = await service.getState();
    expect(state.history[0].entries[0].watchedSeconds).toBe(20);
    expect(state.history[0].entries[0].completed).toBe(true);
    expect(finished).toEqual(['list-completed']);
    await service.remove(state.episodes[0].id);
    expect((await service.getState()).history[0].entries[0].title).toBe('Bluey');
  });
  it('reparte el visionado entre meses al cruzar medianoche y exporta el mes seleccionado', async () => {
    const {service,tick} = setup(new Date(2026,7,31,23,59,58));
    await service.add('=FORMULA',url,60); await service.start(42);
    tick(4); await service.record(42,url,(await service.getState()).session!.runId,0,'doc',4);
    await service.stop(); const sessions = (await service.getState()).history;
    expect(SessionReports.monthSeconds(sessions,'2026-08')).toBe(2);
    expect(SessionReports.monthSeconds(sessions,'2026-09')).toBe(2);
    const csv=SessionReports.csv(sessions,'2026-09');
    expect(csv).toContain("'=FORMULA"); expect(csv).not.toContain('2026-08-31""');
    expect(SessionReports.json(sessions)).not.toContain('meters');
  });
  it('siguiente manual registra parcial y detener no muestra la despedida', async () => {
    const {service,finished} = setup();await service.add('Bluey',url);await service.add('Otro capítulo','https://www.disneyplus.com/play/other');
    await service.start(42);const run=(await service.getState()).session!.runId;
    await service.advance(42,url,run,0,false);await service.stop();
    expect((await service.getState()).history[0].entries[0].completed).toBe(false);
    expect(finished).toEqual([]);
  });
});

describe('Tiempo realmente reproducido', () => {
  it('excluye pausas, buffering y adelantos; cuenta tiempo de reloj a velocidad doble', () => {
    const meter=new PlaybackMeter();
    const sample = {currentTime:0,paused:false,seeking:false,ended:false,playbackRate:1,readyState:4};
    meter.sample(sample,0);
    expect(meter.sample({...sample,currentTime:1},1000)).toBe(1);
    expect(meter.sample({...sample,currentTime:1,paused:true},2000)).toBe(1);
    expect(meter.sample({...sample,currentTime:1,paused:true},10000)).toBe(1);
    expect(meter.sample({...sample,currentTime:1},11000)).toBe(1);
    expect(meter.sample({...sample,currentTime:400},12000)).toBe(1);
    expect(meter.sample({...sample,currentTime:401},13000)).toBe(2);
    expect(meter.sample({...sample,currentTime:401},14000)).toBe(2);
    meter.reset();meter.sample({...sample,playbackRate:2},0);
    expect(meter.sample({...sample,playbackRate:2,currentTime:2},1000)).toBe(1);
  });
});
