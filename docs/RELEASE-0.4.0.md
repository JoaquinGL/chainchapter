# Chain Chapters 0.4.0

Versión estable de referencia: el usuario confirmó la validación del flujo completo en Disney+ el 3 de septiembre de 2026. No está publicada en Chrome Web Store.

## Cambios

- Nuevo icono de tren con dos vagones.
- Las acciones rápidas de la vista local se ejecutan en orden para evitar escrituras perdidas; un error no bloquea las operaciones posteriores.
- Editar una URL ya no permite introducir otro capítulo presente en la lista. Las importaciones mantienen sus repeticiones explícitas.
- Pausar cerca del final no provoca un salto automático. El evento nativo `ended` sigue indicando un final válido.
- Captura y diagnóstico dejan de esperar tras cuatro segundos sin respuesta.
- La despedida navega tras un máximo de 1,5 segundos de espera de confirmación de pausa, aunque el observador no responda.
- Errores al leer el mensaje del menú contextual se muestran en el panel.
- Dependencias fijadas a las versiones del lockfile; no se han actualizado librerías.
- Compilación alineada con el mínimo Chrome 116 indicado en el manifiesto.
- `npm run package` verifica y genera el ZIP con el manifiesto en su raíz.

## Verificado

- Flujo completo en Disney+ validado por el usuario (2026-09-03); esta confirmación no implica cobertura de todos los planes, equipos o versiones de Chrome.

- 54 pruebas automatizadas y comprobación TypeScript.
- Compilación de interfaz, observador y service worker.
- Regresiones de operaciones simultáneas, duplicados, pausas y mensajes sin respuesta.
- Prueba de navegador con el HTML de la tarjeta de Disney+ y el observador compilado (archivo `tests/fixtures/disney-card.html`).

## Instalar o actualizar

Para actualizar conservando los datos, compila en la misma carpeta de instalación y pulsa **Recargar** en `chrome://extensions`. Después recarga Disney+.

Para una instalación nueva, descomprime `chain-chapters-0.4.0.zip`, activa el modo de desarrollador y selecciona la carpeta descomprimida con **Cargar descomprimida**. No selecciones el ZIP directamente. Usar otra carpeta puede crear una instalación distinta con otros datos: exporta tu lista e informes si necesitas conservarlos.

## Lista de comprobación para futuras versiones

- Capturar dos episodios de series diferentes y comprobar título y duración.
- Repetir una captura y comprobar que no duplica el capítulo.
- Editar y reordenar, cerrar el panel y volver a abrirlo: la lista debe conservarse.
- Guardar una lista Markdown, vaciarla y volver a cargarla.
- Dejar terminar un episodio de forma natural y comprobar el salto.
- Pausar cerca del final y comprobar que no avanza mientras sigue pausado.
- Establecer un minuto de límite, reproducir y comprobar la pausa/navegación a la despedida y el informe.
- Cerrar la pestaña durante la sesión: el historial debe registrar el cierre y permitir comenzar otra sesión.

## Límites conocidos

No sustituye un control parental que bloquee el navegador. La suspensión del equipo y las restricciones de temporizadores pueden retrasar la medición o el corte. La detección de final sin evento nativo ahora es conservadora: si Disney+ queda pausado sin emitir `ended`, puede ser necesario pulsar Siguiente. Los formatos de página no reconocidos permiten guardar un enlace pendiente de completar. No se han validado planes con anuncios ni todas las versiones de Chrome admitidas.

Vaciar la lista conserva los informes. Los datos permanecen en el almacenamiento local existente; esta versión no cambia su clave ni su formato.
