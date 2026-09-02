import { EpisodeMetadataReader } from './EpisodeMetadataReader';
import { isSameEpisode } from '../domain/Episode';
import type { Reply } from './messages';
import { PlaybackEndDetector } from './PlaybackEndDetector';
import { PlayerDiagnostics } from './PlayerDiagnostics';
import { PlaybackMeter } from './PlaybackMeter';
import { DurationReader } from './DurationReader';
import { VideoLocator, type VideoInventory } from './VideoLocator';

type PlaybackToken = { runId: string; index: number; url: string };

/** Adapta el DOM de Disney+ a señales de reproducción; singleton por documento. */
export class DisneyPlayerObserver {
  private static instance: DisneyPlayerObserver;
  private currentVideo: HTMLVideoElement | null = null;
  private currentUrl = '';
  private token: PlaybackToken | null = null;
  private refreshing = false;
  private sending = false;
  private endedInDocument = false;
  private lastError = '';
  private readonly locator = new VideoLocator();
  private inventory: VideoInventory = { videos: [], inaccessibleFrames: 0 };
  private readonly meter = new PlaybackMeter();
  private sourceId = crypto.randomUUID();
  private readonly durationReader = new DurationReader();
  private lastRefresh = 0;
  private contextTarget: Element | null = null;
  private contextSnapshot: ReturnType<EpisodeMetadataReader['fromClick']> = null;
  private contextSnapshotAt = 0;
  private readonly metadataReader = new EpisodeMetadataReader();
  private readonly detector = new PlaybackEndDetector();
  private constructor() {}
  /** Devuelve un observador único para evitar listeners duplicados. */
  static getInstance(): DisneyPlayerObserver { return this.instance ??= new DisneyPlayerObserver(); }

  /** Registra captura, diagnóstico y un sondeo independiente del evento ended. */
  start(): void {
    document.addEventListener('contextmenu', event => {
      const path=event.composedPath();
      this.contextTarget=path.find(node=>node instanceof Element) as Element | undefined ?? null;
      this.contextSnapshot=this.metadataReader.fromClick(document,path);
      this.contextSnapshotAt=Date.now();
    }, true);
    void this.refresh();
    window.setInterval(() => void this.refresh(), 1000);
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message?.type === 'CAPTURE') {
        respond({ title: this.metadataReader.currentTitle(document), url: location.href, durationSeconds: this.durationReader.read(this.locator.select(this.locator.scan(document).videos, this.currentVideo), document) });
      }
      if (message?.type === 'CAPTURE_CONTEXT' && typeof message.url === 'string') {
        const current=isSameEpisode(message.url,location.href);
        const fresh=this.metadataReader.read(document,message.url,this.contextTarget);
        const snapshot=this.contextSnapshot && Date.now()-this.contextSnapshotAt<300000 && isSameEpisode(this.contextSnapshot.url,message.url) ? this.contextSnapshot : null;
        const metadata={...fresh,title:snapshot?.title || fresh.title,durationSeconds:snapshot?.durationSeconds ?? fresh.durationSeconds};
        respond({url:message.url,title:metadata.title || (current ? this.metadataReader.currentTitle(document) : ''),
          durationSeconds:current ? this.durationReader.read(this.locator.select(this.locator.scan(document).videos,this.currentVideo),document) ?? metadata.durationSeconds : metadata.durationSeconds});
      }
      if (message?.type === 'PAUSE_FOR_END') {
        for (const video of this.locator.scan(document).videos) video.pause();
        respond({ ok: true });
      }
      if (message?.type === 'DIAGNOSTICS') respond(this.describe());
    });
  }

  /** Explica qué detecta esta pestaña, sin enviar datos a servicios externos. */
  private describe(): string {
    const video = this.currentVideo;
    const seconds = PlayerDiagnostics.seconds;
    return [
      `Observador 0.3.6: ${video ? 'vídeo detectado' : 'no se encuentra el vídeo'}.`,
      video ? `Tiempo ${seconds(video.currentTime)} / ${seconds(video.duration)} s. Final: ${video.ended ? 'sí' : 'no'}. Buscando: ${video.seeking ? 'sí' : 'no'}.` : '',
      `Candidatos: ${this.inventory.videos.length}. Marcos inaccesibles: ${this.inventory.inaccessibleFrames}.`,
      ...this.inventory.videos.map((candidate, index) => `Vídeo ${index + 1}${candidate === video ? ' (seleccionado)' : ''}: ${seconds(candidate.currentTime)} / ${seconds(candidate.duration)} s, readyState=${candidate.readyState}, pausado=${candidate.paused}, final=${candidate.ended}.`),
      video ? `Seekable: ${PlayerDiagnostics.ranges(video.seekable)}. Buffered: ${PlayerDiagnostics.ranges(video.buffered)}. Loop: ${video.loop}.` : '',
      `Controles: ${PlayerDiagnostics.controls(document)}`,
      this.token ? 'Episodio asociado a la cola.' : 'Sin episodio asociado a una cola activa.',
      this.endedInDocument ? 'Final enviado al coordinador.' : '',
      this.lastError,
    ].filter(Boolean).join(' ');
  }

  /** Actualiza la sesión y comprueba ended/tiempo incluso si se perdió el evento. */
  private async refresh(): Promise<void> {
    if (this.refreshing || this.sending || performance.now() - this.lastRefresh < 700) return;
    this.lastRefresh = performance.now();
    this.refreshing = true;
    try {
      this.inventory = this.locator.scan(document);
      const video = this.locator.select(this.inventory.videos, this.currentVideo);
      const url = location.href;
      if (video !== this.currentVideo || url !== this.currentUrl) {
        this.currentVideo?.removeEventListener('ended', this.onEnded);
        this.currentVideo?.removeEventListener('timeupdate', this.onTimeUpdate);
        this.currentVideo = video;
        this.currentUrl = url;
        this.token = null;
        this.endedInDocument = false;
        this.detector.reset();
        this.meter.reset(); this.sourceId = crypto.randomUUID();
        video?.addEventListener('ended', this.onEnded);
        video?.addEventListener('timeupdate', this.onTimeUpdate);
      }
      if (!video || this.endedInDocument) return;
      const reply: Reply = await chrome.runtime.sendMessage({ type: 'GET' });
      if (url !== location.href || video !== this.currentVideo) return;
      if (!reply.ok) throw new Error(reply.error);
      const session = reply.state.session;
      if (session?.status === 'playing'
        && isSameEpisode(reply.state.episodes[session.index]?.url ?? '', url)) {
        if (this.token?.runId !== session.runId || this.token?.index !== session.index) {
          this.detector.reset(); this.meter.reset(); this.sourceId = crypto.randomUUID();
        }
        this.token = { runId: session.runId, index: session.index, url };
        await this.recordUsage();
        if (this.detector.isFinished(video)) await this.reportEnd();
      } else {
        this.token = null;
        this.meter.reset();
        this.detector.reset();
      }
    } catch (error) {
      this.token = null;
      this.lastError = error instanceof Error ? error.message : String(error);
    } finally { this.refreshing = false; }
  }

  /** El evento de progreso también despierta el sondeo en pestañas con temporizadores lentos. */
  private onTimeUpdate = (): void => { void this.refresh(); };

  /** Persiste un acumulado idempotente y aprende la duración cuando aparece. */
  private async recordUsage(): Promise<void> {
    if (!this.currentVideo || !this.token) return;
    const totalSeconds = this.meter.sample(this.currentVideo, performance.now());
    const reply: Reply = await chrome.runtime.sendMessage({ type: 'PULSE', ...this.token,
      sourceId: this.sourceId, totalSeconds,
      durationSeconds: this.durationReader.read(this.currentVideo, document) });
    if (!reply.ok) throw new Error(reply.error);
    if (reply.state.session?.status === 'completed') {
      this.currentVideo.pause();
      this.endedInDocument = true;
    }
  }

  /** Atiende el evento nativo; el sondeo cubre eventos perdidos durante el arranque. */
  private onEnded = (): void => { void this.reportEnd(); };

  /** Envía una vez; permite reintentar si falla el transporte sin duplicar avances. */
  private async reportEnd(): Promise<void> {
    const token = this.token;
    if (!token || token.url !== location.href || this.endedInDocument || this.sending) return;
    this.sending = true;
    try {
      await this.recordUsage();
      if (this.endedInDocument) return;
      const reply: Reply = await chrome.runtime.sendMessage({ type: 'ENDED', ...token });
      if (!reply.ok) throw new Error(reply.error);
      const session = reply.state.session;
      // Una respuesta GET válida no implica que se haya aceptado el avance.
      if (session?.runId === token.runId
        && (session.index !== token.index || session.status === 'completed')) {
        this.endedInDocument = true;
        this.lastError = '';
      } else this.lastError = 'El coordinador no aceptó el final. Comprueba que esta es la pestaña de la cola.';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.warn('[Chain Chapters]', this.lastError);
    } finally { this.sending = false; }
  }
}
DisneyPlayerObserver.getInstance().start();
