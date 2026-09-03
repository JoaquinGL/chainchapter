# Materiales de Chrome Web Store — Chain Chapters 0.4.0

## Nombre
Chain Chapters

## Descripción breve
Organiza capítulos de Disney+ en listas, limita el tiempo de la sesión y descarga tus estadísticas de reproducción.

## Descripción completa
Prepara una lista de capítulos y decide cuánto dura la sesión de tele.

Chain Chapters permite encadenar episodios de Disney+, incluso de distintas series, desde un panel lateral que permanece abierto mientras navegas.

• Añade capítulos con el botón derecho sobre su enlace o captura el episodio abierto.
• Obtén el nombre y la duración cuando estén disponibles en la página.
• Edita los nombres y los tiempos, ordena los episodios y vacía la lista con un botón.
• Evita duplicados al añadir capítulos individualmente.
• Define un límite de reproducción y muestra una despedida infantil cuando termina la sesión.
• Guarda, comparte e importa listas Markdown.
• Descarga estadísticas de las sesiones y resúmenes mensuales en Markdown, CSV o JSON.

Los datos se almacenan localmente en el perfil del navegador. Chain Chapters no tiene un servidor propio ni envía tus estadísticas al desarrollador.

Requiere Chrome de escritorio y acceso a Disney+. Mantén desactivada la reproducción automática de Disney+ para que la extensión gestione el orden. Sólo admite enlaces directos de episodios de Disney+; no incluye vídeos, no descarga contenido y no ofrece acceso a una suscripción.

El límite de tiempo es una ayuda para organizar las sesiones: no bloquea el navegador ni impide iniciar otra reproducción. La medición es aproximada y puede verse afectada por la suspensión del equipo. Los cambios de la web pueden afectar a la captura. No se han validado planes con anuncios.

Proyecto independiente, sin afiliación con Disney.

## Enlaces
- Inicio: https://github.com/JoaquinGL/chainchapter
- Soporte: https://github.com/JoaquinGL/chainchapter/issues
- Privacidad: https://github.com/JoaquinGL/chainchapter/blob/main/PRIVACY.md

## Propósito único
Organizar y reproducir listas personales de capítulos de Disney+ con un límite opcional de sesión y un registro local del tiempo de reproducción.

## Justificación de permisos
- storage: conservar localmente listas, configuración y estadísticas de sesiones entre aperturas del panel y reinicios de Chrome.
- activeTab: identificar la pestaña seleccionada cuando el usuario captura un capítulo o inicia una lista.
- sidePanel: mostrar y mantener el panel de edición de la lista mientras se navega por Disney+.
- contextMenus: ofrecer la acción Añadir a Chain Chapters sobre enlaces y páginas de Disney+.
- Acceso a disneyplus.com y www.disneyplus.com: leer título, enlace y duración del episodio elegido, detectar el progreso/final del reproductor y gestionar el paso al siguiente episodio. El acceso está restringido a esos dominios.
- Código remoto: no se descarga ni ejecuta código remoto; el código de la extensión está incluido en el paquete.

## Instrucciones para revisión
Chrome 116 o posterior. Requiere una cuenta de Disney+ con acceso a reproducción; la extensión no suministra contenido ni credenciales.
1. Abrir Disney+ con una sesión válida y desactivar la reproducción automática del perfil.
2. Abrir el panel de Chain Chapters desde su icono.
3. En el catálogo, añadir dos capítulos mediante el menú contextual de sus enlaces de reproducción. Verificar nombre y duración cuando los publique la página.
4. Intentar añadir de nuevo uno de ellos y comprobar el aviso de duplicado.
5. Editar nombres/duraciones y ordenar la lista.
6. Con Disney+ activo, iniciar la lista y dejar terminar un episodio para comprobar el avance.
7. Detener la sesión; establecer un límite de un minuto e iniciar otra para verificar la despedida y el informe.
8. Exportar la lista Markdown, vaciarla e importarla.

Sin reproducir contenido también se puede verificar la edición manual, importación/exportación de listas y la pantalla final desde Más opciones → Ver despedida. Los informes incluyen únicamente sesiones medidas por la extensión.
