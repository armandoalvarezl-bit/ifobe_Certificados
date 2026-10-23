# Estructura de Gen10

Gen10 utiliza gen10.html como entrada compartida; las secciones se cargan desde archivos independientes:

- gen10-soporte.js: solicitudes, conversaciones y seguimiento PQRS.
- gen10-expedientes.js: datos y documentos, filtros y listado.
- gen10-archivos.js: adjuntos, miniaturas, visor y descargas.
- gen10-perfil.js: perfil y foto del usuario.
- gen10-pdf.js: exportacion de notas.
- gen10-menu.js y gen10-slider.js: navegacion y presentacion.
- gen10.js: sesion, coordinacion y secciones academicas restantes.

Publica los modulos junto con gen10.html y sus estilos. La separacion facilita mantener cada seccion, pero no sustituye copias de seguridad o control de versiones. Los registros y archivos siguen almacenados en Sheets y Drive, no en gen10.html.

Para bloquear respuestas a casos cerrados en el servidor, actualiza Apps Script con backend/Code-para-Apps-Script.txt y publica una nueva version de la implementacion existente.

## Paginas independientes

Cada seccion tiene su documento HTML: gen10.html (inicio y acceso), gen10-cursos.html, gen10-curso.html, gen10-tareas.html, gen10-examenes.html, gen10-notas.html, gen10-soporte.html, gen10-perfil.html, gen10-documentos.html y gen10-administracion.html. Publicar todas junto con los archivos JS y CSS.

gen10-rutas.js define los destinos. El menu cambia la direccion y muestra la seccion sin recargar la sesion. Atras y Adelante restauran la seccion; abrir un enlace directo carga su documento HTML. Los datos se mantienen en memoria durante la navegacion y no se copian al almacenamiento local. El curso se identifica con ?curso=ID y su pestana con &tab=tareas, por ejemplo. Recargar conserva el destino. La sesion existente se comparte en la misma pestana; el servidor sigue verificando permisos. Los HTML comparten estructura visual y gen10.js conserva la logica academica comun; no contienen copias de registros. No requiere cambiar Apps Script.
