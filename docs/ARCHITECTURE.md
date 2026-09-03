# Arquitectura 0.3.7

El dominio y los casos de uso no importan React ni Chrome. El worker compone dependencias y serializa todas las escrituras. Los adaptadores aíslan DOM, almacenamiento y navegación.

```text
React → PlaylistClient → mensajes → BackgroundController
                                      → PlaylistService → dominio/puertos
                                      ← StorageRepository / ChromePlaybackGateway
DisneyPlayerObserver → PULSE / ENDED ──┘
```

## Dominio

- `Episode`: entrada de cola con ID, título, URL y `durationSeconds` opcional/null.
- `PlaybackSession`: sesión, límite fijado al inicio, tiempo visto, copia de entradas y medidores por documento.
- `EpisodeUsage`: snapshot del episodio, segundos vistos, indicador completed y reparto por día.
- `PlaylistState`: cola editable, límite por defecto, sesión actual e historial de sesiones cerradas.
- `migrateState()`: conserva colas antiguas y añade campos nuevos; descarta una sesión anterior sin estadísticas.
- `normalizeEpisodeUrl()` y `isSameEpisode()`: validación e identidad pese a prefijos de idioma.

## Casos de uso: PlaylistService

| Método | Función |
|---|---|
| `getState()` | Leer el estado. |
| `add(title,url,duration)` | Validar, rechazar episodios ya presentes y añadir. |
| `setDuration(id,seconds)` | Corregir duración conocida o pendiente. |
| `setLimit(seconds)` | Guardar límite o null. |
| `clear()` | Vaciar episodios conservando historial y configuración; sólo con sesión inactiva. |
| `remove(id)` / `move(id,direction)` | Editar cola inactiva. |
| `start(tabId)` | Copiar la cola a una nueva sesión y abrir primer episodio. |
| `record(tabId,url,runId,index,sourceId,totalSeconds,duration)` | Validar identidad, deduplicar muestras acumuladas, actualizar días/tiempo/duración y aplicar límite. |
| `advance(...,naturalEnd)` | Marcar final natural o salto manual; abrir siguiente o cerrar sesión. |
| `stop(reason)` | Archivar parada, cierre de pestaña o reinicio. |
| `close(state,reason,showEnd)` | Persistir/archivar una vez y solicitar despedida. |
| `navigate(state)` | Guardar antes de navegar; archivar errores. |
| `editableState()` / `matches()` / `duration()` | Reglas internas. |

Recibe `PlaylistRepository`, `PlaybackGateway` y reloj inyectado (los tests controlan el tiempo y los cambios de mes). `record()` no suma segundos deducidos de la duración prevista: únicamente mediciones. Cada PULSE es acumulativo por fuente e índice; repetirlo no duplica estadísticas. El total se acota al tiempo desde el inicio y al límite elegido.

`SessionReports` calcula sesiones visibles y totales por mes, y genera CSV/JSON. El CSV evita que los títulos se ejecuten como fórmulas en una hoja de cálculo. La UI se ocupa de descargar mediante Blob; no se añade permiso `downloads`.

## Adaptadores de reproducción

| Clase | Métodos principales |
|---|---|
| `VideoLocator` | `scan()` inventaría candidatos; `select()` prioriza metadatos y progreso. |
| `PlaybackEndDetector` | `isFinished()` detecta final; `reset()` reinicia muestras. |
| `PlaybackMeter` | `sample(video,nowMs)` mide reloj con progreso real; `reset()` cambia de fuente. |
| `DurationReader` | `read(video,root)` busca duración finita, textos ARIA y relojes visibles de total o transcurrido/restante. `durationFromText()` parsea relojes, no porcentajes. |
| `PlayerDiagnostics` | `seconds()`, `ranges()`, `controls()` producen un informe de sólo lectura. |
| `DisneyPlayerObserver` | `start()` instala escucha/sondeo; `refresh()` asocia vídeo y sesión; `recordUsage()` envía PULSE; `reportEnd()` envía ENDED con token; `describe()` diagnostica. |
| `ChromePlaybackGateway` | `open()` navega a Disney+; `finish()` pide pausa y navega a `index.html?view=end`. |

`timeupdate` respalda el temporizador, con sondeo limitado aproximadamente a una vez por segundo. Las pausas y saltos no consumen minutos; hay margen de medición en cambios de estado. El observador no lee bytes de vídeo ni APIs privadas.

## Interfaz React

- `App`: captura en un clic, lista, límite superior opcional, importación/exportación y reproducción. Todas las mutaciones van por `PlaylistClient`.
- `EpisodeRow`: edita nombre, enlace y duración in situ; guarda al salir de la fila o pulsar Enter.
- Las estadísticas se generan al descargar; no existe un panel de estadísticas en pantalla.
- `EndScreen`: despedida infantil sin controles de reproducción; utiliza CSS local y funciona sin red.
- `download()`: crea un archivo local desde un Blob.

La URL `?view=end` permite previsualizar la despedida en desarrollo. En la extensión se abre al terminar y sustituye el documento del reproductor para detenerlo.

## Singleton y persistencia

`StorageRepository`, `PlaylistClient`, `BackgroundController` y `DisneyPlayerObserver` usan constructor privado y `getInstance()`. El controlador posee una instancia de `PlaylistService`, que mantiene constructor público e inyección para poder probarla de forma aislada. Medidor, detector y lector pertenecen al observador; no necesitan un singleton global.

Los singletons son **por contexto JavaScript**. Panel, worker y página no comparten memoria; `chrome.storage.local` es la fuente de verdad y el worker es el único escritor en la extensión. Su cola de promesas evita escrituras perdidas. La UI local usa localStorage independiente. El historial se guarda al cerrar la sesión; mientras está activa, su estado también es exportable.

## Pruebas y límites

Tests de URLs, orden y duplicados, final/avance, navegación fallida, snapshots, migración, captura de duración, pausa/buffering/seeking/velocidad, límite exacto e idempotencia, exportación y cruce de mes. El observador se prueba con vídeos simulados. La integración real del reproductor requiere la prueba manual del README; no se afirma que los tests de DOM simulado verifiquen Disney+.

## Listas Markdown y panel lateral (0.3.0)

`PlaylistMarkdown.stringify()` exporta nombre, URL y duración en tabla. `parse()` admite tabla o líneas separadas por barras, respeta barras escapadas, valida tiempos/URLs e indica la línea que falla. No renderiza HTML ni ejecuta contenido del archivo.

`PlaylistService.importEpisodes()` valida el lote y lo añade en una única escritura. `updateEpisode()` valida los tres campos y sustituye una entrada. Los comandos `IMPORT` y `UPDATE` se procesan en la misma cola del worker que las otras mutaciones.

El manifiesto define `side_panel.default_path` y elimina `action.default_popup`. `setPanelBehavior({openPanelOnActionClick:true})` hace que el icono abra el panel global. Se usa el mismo documento al cambiar de pestaña; las operaciones de captura/reproducción consultan la pestaña activa de su ventana. No se añade acceso a nuevos dominios. El permiso nuevo es `sidePanel`.

`SessionReports.markdown()` genera un informe descargable con totales por mes y sesiones. `csv()` y `json()` siguen disponibles en Más opciones. No se muestra el historial en la pantalla principal.

## Menú contextual (0.3.1)

`ContextMenuController.install()` crea un único menú limitado a Disney+ al instalar/actualizar. `listen()` registra el listener al iniciar el worker y abre el panel dentro del gesto de usuario. `handle()` valida y prioriza `linkUrl`, solicita `CAPTURE_CONTEXT` al documento principal y llama al caso de uso ADD mediante la cola existente. Nunca utiliza `srcUrl` de un vídeo blob como enlace del episodio. Si el observador no responde, un enlace directo válido se guarda con título de respaldo y duración pendiente.

`feedback()` guarda brevemente el resultado fuera del estado de la cola; el panel lo muestra aunque se haya abierto después de la operación. No se amplían los dominios permitidos. El único permiso adicional es `contextMenus`.

## Captura de tarjetas (0.3.6)

`EpisodeMetadataReader` separa la lectura del catálogo del seguimiento del vídeo. `fromClick()` captura la tarjeta al abrir el menú contextual; `read()` busca el enlace exacto y `disneyCard()` lee los campos `data-testid` de título y metadatos. La duración accesible excluye los nodos `aria-hidden` para no sumar la versión redondeada y la exacta. `currentTitle()` lee el título del reproductor abierto.

El observador conserva temporalmente la captura y sólo la reutiliza para la misma identidad de episodio. El menú guarda una entrada editable si faltan metadatos y distingue un fallo de comunicación del observador de una tarjeta sin título reconocido. Las altas se serializan en el worker; la comprobación de duplicados pertenece a `PlaylistService.add()`. Las importaciones mantienen repeticiones explícitas.
