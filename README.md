<p align="center">
  <img src="public/icons/icon-128.png" width="96" height="96" alt="Icono de Chain Chapters">
</p>

# Chain Chapters

**Elige los capítulos, prepara una lista y decide cuánto dura la sesión de tele.**

Chain Chapters es una extensión de Chrome para crear listas de episodios de Disney+, incluso de distintas series, y reproducirlos en el orden elegido. Su panel lateral permanece abierto mientras navegas por el catálogo.

**Versión actual: 0.3.6 · Prueba de concepto · React + TypeScript · Manifest V3**

## Qué puedes hacer

- Añadir un episodio desde su tarjeta con **botón derecho → Añadir a Chain Chapters**, o capturar el capítulo abierto desde el panel.
- Obtener el título y la duración cuando estén disponibles en la página.
- Editar nombres y tiempos directamente en la lista, reordenar capítulos y eliminar entradas.
- Evitar duplicados al añadir capítulos individualmente, aunque cambie el prefijo de idioma de la URL.
- Ver la duración conocida de la lista y establecer un límite de tiempo de reproducción.
- Avanzar al siguiente episodio al terminar el anterior.
- Mostrar una despedida infantil cuando termina la lista o se alcanza el límite.
- Guardar y cargar listas Markdown, o pegar enlaces con nombre y duración.
- Descargar informes de sesiones y tiempo mensual sin llenar la interfaz de estadísticas.

## Instalación

Necesitas **Chrome de escritorio 116 o posterior**, **Node.js 22.12 o posterior** y npm para compilar. También necesitas acceso a Disney+ desde el navegador.

```bash
git clone git@github.com:JoaquinGL/chainchapter.git
cd chainchapter
npm ci
npm run build
```

Si no tienes SSH configurado en GitHub, puedes clonar con HTTPS:

```bash
git clone https://github.com/JoaquinGL/chainchapter.git
```

Después de compilar:

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta **`dist/`** del proyecto.
4. Fija el icono de Chain Chapters en la barra de Chrome.
5. Abre Disney+ y recarga cualquier pestaña que ya estuviera abierta.
6. Pulsa el icono de la extensión para abrir su panel lateral.

`dist/` se genera al compilar y no está incluido en Git. No hace falta mantener el servidor de desarrollo encendido para usar la extensión instalada.

### Actualizar una instalación

```bash
git pull
npm ci
npm run build
```

En `chrome://extensions`, pulsa **Recargar** en Chain Chapters. **Recarga también las pestañas de Disney+**: el observador que ya estaba cargado no se sustituye hasta recargar la página. Puedes comprobar la versión en la ficha de la extensión.

## Preparar y reproducir una lista

1. En Disney+, haz clic derecho sobre el enlace de un capítulo y elige **Añadir a Chain Chapters**. También puedes abrir el capítulo y pulsar **Capturar capítulo** en el panel.
2. Repite con los capítulos que quieras, incluso de otras series.
3. Revisa el nombre y el tiempo de cada fila. Puedes editarlos directamente; se guardan al salir del campo o pulsar Enter. Despliega **Enlace** para corregir la URL y usa las flechas para ordenar.
4. Para limitar la sesión, pulsa **Sin límite** en la parte superior y escribe los minutos, por ejemplo `60`. Dejarlo vacío elimina el límite.
5. Con Disney+ en la pestaña activa, pulsa **Reproducir lista**.

Mantén desactivada la reproducción automática del perfil de Disney+ para que la extensión gestione el orden. Durante la sesión, detén la lista antes de editarla.

El límite cuenta el tiempo medido de reproducción: las pausas no consumen minutos y adelantar el vídeo no suma el tramo saltado. Al alcanzar el límite, puede cortar el episodio en curso. Al terminar, sustituye la página del reproductor por la pantalla de despedida.

**Detener cola** cierra el registro y cancela el seguimiento; no pausa el vídeo que esté reproduciéndose.

### Cómo se capturan el nombre y la duración

La captura del menú contextual conserva los datos al hacer clic, antes de que abrir el panel cambie la disposición de la página. En las tarjetas compatibles lee el título del episodio y prefiere la duración accesible exacta a la etiqueta visual redondeada: por ejemplo, `27 minutos,41 s` se guarda como **27:41**, sin sumarle el texto `(27 min)`.

En el reproductor intenta leer la duración del vídeo o interpretar sus controles de tiempo. Si no encuentra el nombre, conserva el enlace como **Capítulo pendiente de nombre** para que puedas editarlo. Si falta la duración, queda pendiente; no se inventa. El total de la lista sólo incluye las duraciones conocidas. Durante una sesión puede aprender una duración que aparezca más tarde.

Los enlaces admitidos son URLs directas de episodios de Disney+: `/play/ID` o `/video/ID`, con prefijo de idioma opcional como `/es-es/`. Una ficha de serie no equivale a un enlace de episodio.

## Guardar, compartir y cargar listas

**Guardar .md** descarga la lista como un archivo Markdown que puedes editar o compartir. **Cargar .md** añade sus capítulos a la lista existente. También puedes usar **Escribir capítulo** o **Pegar lista**.

Formato Markdown:

```markdown
# Dibujos de hoy

| Nombre | URL | Duración |
| --- | --- | --- |
| Mi primer capítulo | https://www.disneyplus.com/es-es/play/ID-DEL-EPISODIO | 7:30 |
| Mi segundo capítulo | https://www.disneyplus.com/es-es/play/OTRO-ID | |
```

Sustituye los identificadores del ejemplo por enlaces reales. Para pegar una lista, usa una línea por capítulo:

```text
Nombre del capítulo | https://www.disneyplus.com/es-es/play/ID-DEL-EPISODIO | 7:30
```

La duración admite minutos (`7`), `MM:SS` (`7:30`) o `HH:MM:SS` (`1:02:30`). Un valor vacío queda pendiente. La importación valida el archivo completo antes de añadirlo y admite hasta **500 capítulos y 1 MB**.

Las altas individuales rechazan duplicados. Las importaciones conservan las repeticiones explícitas y el orden del archivo. Una lista exportada no incluye estadísticas ni datos de cuenta.

## Estadísticas y almacenamiento

**Descargar estadísticas** genera un informe Markdown con el tiempo medido, el resumen mensual y el detalle de las sesiones y capítulos. En **Más opciones** puedes descargar CSV y JSON.

- La extensión almacena lista, configuración e historial en `chrome.storage.local`.
- No tiene backend propio ni envía informes a un servidor de Chain Chapters.
- El historial sólo incluye sesiones medidas por la extensión; no recupera el historial anterior de Disney+.
- El reparto por días y meses usa el huso horario local del navegador.
- Desinstalar la extensión o borrar sus datos puede eliminar el historial. Puedes exportarlo previamente; la interfaz importa listas Markdown, no restaura informes JSON.

## Desarrollo

```bash
npm run dev      # Vista web local; consulta la URL que muestra Vite
npm test         # Pruebas automatizadas con Vitest
npm run build    # Comprobación TypeScript y extensión compilada en dist/
npm run check    # Pruebas y compilación
```

La vista web permite trabajar en la interfaz, editar listas e importar/exportar archivos. **La captura y la reproducción requieren la extensión en Chrome**. La vista local usa `localStorage` y no comparte los datos de la extensión. Para previsualizar la despedida, añade `?view=end` a la URL local.

### Arquitectura

El proyecto separa las reglas de negocio de React, del almacenamiento y de las APIs de Chrome:

| Carpeta | Responsabilidad |
| --- | --- |
| `src/domain/` | Episodios, identidad de URLs y estado de listas y sesiones. |
| `src/application/` | Casos de uso, importación/exportación y estadísticas. |
| `src/infrastructure/` | Persistencia y navegación del reproductor. |
| `src/extension/` | Coordinador, menú contextual y observación del DOM de Disney+. |
| `src/presentation/` | Panel React, edición de listas y pantalla final. |
| `tests/` | Pruebas de negocio, captura, tiempos y reproducción simulada. |

Los adaptadores de infraestructura, el coordinador y el observador utilizan **Singleton** donde corresponde para compartir estado y evitar registros duplicados. Los casos de uso reciben sus dependencias mediante puertos para poder probarse sin Chrome.

Más detalles en [Arquitectura y métodos](docs/ARCHITECTURE.md).

### Verificación de la captura

La versión 0.3.6 cuenta con **46 pruebas automatizadas**. Incluye además una prueba en navegador basada en una tarjeta real facilitada durante el desarrollo:

1. Ejecuta `npm run build` y `npm run dev`.
2. Abre `/tests/fixtures/disney-card.html` en la URL local de Vite.
3. Debe mostrar **PASS**, el título del episodio y `durationSeconds: 1661` (**27:41**).

Esta prueba cubre la lectura del DOM, el clic sobre el icono SVG y la respuesta del observador compilado después de retirar la tarjeta. No sustituye la comprobación con una sesión real de Disney+.

Para comprobar el flujo completo, captura dos episodios de distintas series, reproduce la lista, verifica el salto y prueba un límite corto. Comprueba también la despedida y el informe descargado.

## Problemas habituales

| Problema | Qué comprobar |
| --- | --- |
| El menú no aparece o sigue el comportamiento antiguo | Recarga la extensión y después la pestaña de Disney+. |
| El observador no responde | Comprueba que estás en Disney+ y recarga esa pestaña tras actualizar. |
| Nombre o duración pendientes | Edita la fila; la estructura de la página puede no coincidir con los formatos reconocidos. |
| No avanza al siguiente episodio | Comprueba que la sesión se inició desde el panel y que la reproducción automática de Disney+ está desactivada. Consulta **Más opciones → Comprobar reproductor**. |
| Capturar no funciona en localhost | Esa vista es para desarrollo; usa el panel de la extensión en Chrome. |

## Alcance y limitaciones

Es una prueba de concepto para Disney+ en Chrome de escritorio. No incluye soporte para otras plataformas ni para reproducción con anuncios. Los cambios en la web de Disney+ pueden requerir actualizar el lector.

La medición es aproximada. La suspensión del equipo o la limitación de temporizadores del navegador pueden retrasar el corte. La pantalla final termina la sesión, pero **no bloquea el navegador ni impide iniciar otra reproducción**: no es un sistema de control parental resistente a manipulaciones.

La extensión trabaja junto al reproductor oficial, sin descargar los vídeos. El observador sólo accede al DOM permitido por el navegador, incluidos componentes con shadow DOM abierto y marcos del mismo origen.

Proyecto independiente, sin afiliación con Disney.
