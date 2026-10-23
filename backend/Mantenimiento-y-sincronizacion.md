# Mantenimiento y sincronización

La página `mantenimiento.html?vistaPrevia` permite revisar el aviso sin cerrar el sitio. Utiliza los iconos de Bootstrap locales del proyecto.

Para mostrar el aviso en todas las páginas, cambia `mantenimiento.activo` a `true` en `inscripcion-config.js` y publica ese archivo junto con `mantenimiento.html`, `mantenimiento.css` y `mantenimiento.js`. Edita `mantenimiento.mensaje` para cambiar el texto. Para restablecer el acceso, cambia `activo` a `false` y vuelve a publicar. El aviso afecta a la navegación del sitio; no suspende la API de Apps Script ni operaciones ya iniciadas. La actualización depende de la publicación y de la caché del alojamiento.

En Gen10, **Administración → Sincronizar plataformas** revisa los registros existentes. Solo el administrador puede ejecutar esta acción. Los cambios de cursos, inscripciones y calificaciones de Gen10 también ejecutan la sincronización existente.

La sincronización añade cursos publicados al catálogo Programas, respetando los programas deshabilitados, y vincula estudiantes e inscripciones de Gen10 con Alumnos y Matriculas. Comparte evaluaciones y resultados mediante NotasGen10, que consulta la página Notas. No mezcla las evaluaciones del campus con las notas de siete módulos. Informa los documentos faltantes, correos duplicados y matrículas ambiguas para que administración los corrija.

Todas las páginas usan la misma URL de Apps Script en `inscripcion-config.js`. Esto no significa sincronización bidireccional total: las modificaciones realizadas directamente en Alumnos, matrículas o notas de módulos no se convierten automáticamente en usuarios, inscripciones o evaluaciones del campus. Tampoco existe un catálogo editable común de información institucional.

Para activar la nueva acción, reemplaza el código de Apps Script con `backend/Code-para-Apps-Script.txt` y publica una nueva versión de la implementación. Publica también los archivos actualizados del sitio. No es necesario enviar correos para realizar esta revisión.
