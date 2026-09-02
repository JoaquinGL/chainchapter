# Chain Chapters — 0.3.3

Una extensión React + TypeScript con **panel lateral persistente**. Abres un capítulo en Disney+, pulsas **Capturar capítulo** y se añade directamente. Puedes seguir navegando con la lista al lado.

## Actualizar

```bash
cd chain-chapters
npm ci
npm run build
```

En `chrome://extensions`, recarga Chain Chapters y comprueba que muestra **0.3.3**. Si aún no está instalada: activa Modo de desarrollador → Cargar descomprimida → selecciona la carpeta `dist/` del proyecto.

**Recarga también la pestaña Disney+.** Pulsa el icono de Chain Chapters: ahora abre el panel lateral de Chrome, no el popup anterior. La versión requiere Chrome 116+ y añade el permiso `sidePanel`. El panel global permanece al cambiar de capítulo o pestaña; se puede cerrar con los controles de Chrome. Los datos existentes se conservan.

## Uso sencillo

1. Abre un capítulo de Disney+.
2. Pulsa **Capturar capítulo**: añade nombre, URL y tiempo disponible en un clic.
3. Sigue navegando hasta otro capítulo y vuelve a capturar.
4. Edita **nombre y tiempo en la propia fila**. Se guardan al salir de la fila o pulsar Enter. Despliega «Enlace» para corregir la URL. Usa las flechas para ordenar.
5. Arriba, pulsa **Sin límite** (o el límite actual) y escribe los minutos. Se guardan al salir del campo; **vacío = sin límite**. No hay casilla ni botón Guardar.
6. Pulsa **Reproducir lista** con Disney+ en la pestaña activa.

La despedida infantil se abre al terminar la lista o el tiempo. Las pausas no consumen tiempo y los saltos en la barra no suman minutos. «Detener cola» guarda la sesión y cancela el seguimiento; el vídeo continúa. Mantén desactivado el autoplay del perfil Disney+.

## Apuntar capítulos sin capturarlos

- **Escribir capítulo** abre un formulario pequeño con nombre, URL y duración.
- **Pegar lista** acepta una línea por capítulo: `Nombre | URL | Duración`.
- **Cargar .md** añade una lista guardada sin borrar lo que ya tienes. Se valida completa antes de modificar la cola.
- **Guardar .md** descarga la lista actual como tabla Markdown. Puedes editarla en cualquier editor de texto y enviarla por correo tú mismo.

Ejemplo de formato (los IDs son sólo marcadores de posición):

```markdown
# Mi lista de dibujos

| Nombre | URL | Duración |
| --- | --- | --- |
| Bluey | https://www.disneyplus.com/es-es/play/ID_BLUEY | 7:30 |
| SuperKitties | https://www.disneyplus.com/es-es/play/ID_KITTIES | |
```

La duración admite minutos (`7`), MM:SS (`7:30`) o HH:MM:SS. Un campo vacío queda pendiente. Las URLs reales admiten letras, números y guiones; el ejemplo usa marcadores que debes sustituir. El archivo no incluye estadísticas ni datos de cuenta. Importar conserva el orden y permite repetir episodios. Límite de importación: 500 capítulos y 1 MB.

## Duración visible en Disney+

El adaptador intenta leer:

1. La duración finita del vídeo.
2. Textos ARIA con transcurrido/total.
3. Los relojes visibles del reproductor, incluidos los repartidos entre elementos hijos y shadow roots abiertos.
4. Transcurrido + restante cuando el restante está identificado por signo negativo o etiqueta.
5. Un reloj identificado expresamente como duración total.

No usa porcentajes ambiguos ni el final del búfer como duración. Dos relojes positivos sin identificar total/restante se consideran ambiguos. Si no puede interpretarlo, el capítulo se añade y queda el campo MM:SS vacío para escribirlo directamente. El total de la lista avisa de tiempos pendientes. Una duración que aparezca durante reproducción también se aprende.

La investigación confirmó la limitación del lector anterior (sólo duración nativa y un patrón ARIA), pero no se ha inspeccionado la sesión privada del usuario. Los nuevos formatos se prueban con DOM simulado y la captura final debe comprobarse con Disney+. El diagnóstico está en **Más opciones → Comprobar reproductor**.

## Estadísticas, sólo como descarga

No hay tablas ni panel de estadísticas en la interfaz. **Descargar estadísticas** genera un Markdown con total medido, resumen por mes y detalle de cada sesión/capítulo. En **Más opciones** están las exportaciones CSV y JSON completo.

Sólo se contabilizan sesiones medidas por la extensión desde 0.2.0, no el historial anterior de Disney+. El reparto por días usa el huso local del navegador y permite sesiones que cruzan de mes. Los datos quedan en `chrome.storage.local`; la web de desarrollo utiliza localStorage independiente. Exporta JSON si quieres una copia antes de desinstalar o borrar datos.

## Por qué panel lateral y no iframe

El panel lateral mantiene nuestra interfaz junto al reproductor oficial y tiene acceso a las APIs de extensión. Un iframe en una web normal no concede acceso al DOM de Disney+: la política de mismo origen restringe esa comunicación; además, la incrustación depende de los permisos que permita el sitio. No se modifican cabeceras ni protecciones del navegador.

Referencias: [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [política de mismo origen](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy). Como contraste se revisó [Saskatoon](https://github.com/jack-e-tanner/saskatoon), que sigue usando la duración nativa y no resolvía por sí solo los relojes de la UI de esta sesión.

## Desarrollo y verificación

```bash
npm run dev       # Vista local
npm test          # Casos de negocio, listas y reproductor simulado
npm run build     # Tipado estricto + bundles de extensión en dist/
npm run check     # Tests y compilación
```

La vista local permite editar, importar/exportar y ver la despedida (`?view=end`). Para capturar y reproducir hay que usar el panel en Chrome. La web local y la extensión no comparten datos.

Prueba real: recarga extensión y Disney+, captura dos capítulos cambiando de serie sin cerrar el panel; comprueba la duración y exporta/reimporta el .md; pon un límite de un minuto y verifica corte, despedida e informe descargado.

## Límites de la PoC

Sólo Disney+ de escritorio. No hay backend ni API privada ni soporte de anuncios. El observador recorre documento, shadow roots abiertos y marcos del mismo origen; no accede a marcos ajenos ni shadow roots cerrados. La medición es aproximada a intervalos cercanos a un segundo; suspensión del equipo o throttling fuerte puede retrasar el límite. La pantalla final cierra la sesión, pero no bloquea el navegador ni impide iniciar otra.

Arquitectura y métodos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Botón derecho · Añadir a Chain Chapters

En Disney+, haz clic derecho y elige **Añadir a Chain Chapters**. Sobre la página/vídeo añade el capítulo abierto; sobre un enlace directo `/play/ID` o `/video/ID` añade ese episodio. La opción se limita a páginas de Disney+ y no interpreta fichas de series como episodios. Si no puede obtener título o duración del enlace, puedes corregirlos en la fila.

El panel lateral se abre para mostrar la lista y un mensaje de resultado. Con una cola en reproducción, se mantiene la regla de detenerla antes de editar. La actualización añade el permiso `contextMenus`; recarga la extensión y la pestaña Disney+.

Referencia: [API de menús contextuales de Chrome](https://developer.chrome.com/docs/extensions/reference/api/contextMenus).
