# Política de privacidad de Chain Chapters

Última actualización: 3 de septiembre de 2026. Aplicable a la versión 0.4.0.

Chain Chapters es una extensión independiente mantenida por el propietario de la cuenta de GitHub [JoaquinGL](https://github.com/JoaquinGL). Permite organizar episodios de Disney+ y gestionar sesiones de reproducción. No está afiliada a Disney.

## Datos que utiliza

La extensión accede localmente a títulos, enlaces, duraciones y texto de las tarjetas y controles del reproductor de Disney+ para capturar los episodios elegidos y detectar su reproducción. Utiliza el identificador de la pestaña de reproducción y registra las sesiones iniciadas con la extensión: fechas, episodios, tiempo visto, estado de finalización y motivo de cierre. Guarda también la lista, el límite de tiempo y los mensajes de resultado de la captura.

Estos datos se utilizan exclusivamente para crear y reproducir listas, aplicar el límite de sesión y generar los informes que solicita el usuario. No accede al historial general del navegador ni recupera el historial previo de Disney+.

La extensión no solicita nombres, edades ni perfiles de menores; no lee contraseñas, cookies de autenticación ni información de pago. El acceso a Disney+ se realiza en la propia web del servicio con la sesión del usuario.

## Almacenamiento y transmisión

Los datos de la extensión se guardan en `chrome.storage.local`, en el perfil local de Chrome. La extensión no utiliza sincronización de Chrome para estos datos, un servidor propio, publicidad ni servicios externos de analítica. El desarrollador no recibe los datos de reproducción ni los informes de la extensión.

La navegación y reproducción de capítulos conecta el navegador con Disney+, sujeto a las condiciones y política de privacidad de ese servicio. Visitar el repositorio o solicitar soporte en GitHub está sujeto a las políticas de GitHub.

Las exportaciones Markdown, CSV y JSON generan archivos en el dispositivo a petición del usuario. Si el usuario comparte esos archivos, decide su destino y destinatarios. Los informes pueden incluir títulos, URLs y hábitos de reproducción; no deben publicarse si se desea mantenerlos privados.

## Conservación y eliminación

Los datos se conservan localmente hasta que el usuario los elimina o desinstala la extensión. El usuario puede eliminar episodios o vaciar la lista desde el panel. Vaciar la lista no elimina el historial de sesiones. Para eliminar todos los datos de la extensión, puede desinstalarla desde `chrome://extensions`. Los archivos exportados deben eliminarse por separado desde el dispositivo; desinstalar no los borra.

No ofrecemos restauración del historial desde JSON ni copias de seguridad en un servidor. El desarrollador no puede recuperar ni borrar remotamente datos que sólo están guardados en el dispositivo.

## Uso limitado

El uso de los datos se limita a las funciones descritas de la extensión. No se venden, no se transfieren para publicidad y no se utilizan para determinar solvencia o conceder préstamos. El uso de los datos cumple los requisitos de uso limitado de las políticas de datos de usuario de Chrome Web Store.

## Contacto y cambios

Para preguntas o incidencias, utiliza [el soporte del proyecto](https://github.com/JoaquinGL/chainchapter/issues). Las incidencias de GitHub son públicas: no incluyas credenciales ni informes personales. Esta política se actualizará si cambia el tratamiento de datos, indicando una nueva fecha.
