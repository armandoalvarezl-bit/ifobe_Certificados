# Gestión de matrículas

La ficha conserva su resumen, descarga PDF, seguimiento, notas, historial y opción de nuevo ciclo. El selector **Estado académico** mantiene Sin definir, En curso, Aprobado, No aprobado, Certificado, Graduado y Retirado; es independiente de Pendiente, Activa, Finalizada y Cancelada.

Al guardar un cambio de estado académico no vacío, se envía una notificación con el programa, ciclo y nuevo estado. Guardar sin cambiar el estado no genera otra notificación. Volver a un estado anterior cuenta como una nueva transición. El envío se registra por revisión en columnas nuevas al final de Matriculas. Ante falta de correo o cuota, corregir y volver a guardar los mismos datos. Los envíos marcados Enviando requieren revisión antes de reintentar. El aviso de cambio académico tiene prioridad sobre la confirmación general de matrícula en ese guardado y no adjunta un certificado.

Publicar juntos matriculas.html, matriculas.css y matriculas.js, además de actualizar Code.gs en una nueva versión de la misma implementación. inscripcion-config.js conserva la URL configurada.

Al guardar una matrícula **Finalizada**, se envía un aviso de finalización al correo del estudiante, una sola vez por matrícula y separado de la confirmación de activación. Las columnas «Finalización por correo» y «Detalle del correo de finalización» se agregan al final de la hoja y registran el resultado y el error, conservando las columnas académicas. Este aviso no adjunta ni emite un certificado; el PDF se genera desde Certificaciones. Para matrículas ya finalizadas, abrir y volver a guardar después de actualizar la implementación. Si figura `Enviando`, verificar el envío antes de reintentar, igual que con la confirmación de activación.

Al guardar una matrícula **Activa**, se envía su confirmación al correo registrado en Alumnos, una sola vez por matrícula. Las columnas M y N registran el resultado. Si falta correo o cuota, corregir y volver a guardar. Si figura `Enviando`, verificar manualmente el envío antes de cambiarlo a `Pendiente`: podría haberse enviado aunque la respuesta fallara. Un cambio posterior de programa o período no vuelve a enviar la confirmación inicial.

El menú **Matrículas** permite matricular estudiantes existentes por programa y período, elegir jornada, agregar observaciones y editar estados: Pendiente, Activa, Finalizada y Cancelada. Incluye búsqueda, filtros y contadores.

## Activación

1. Reemplazar el contenido de Apps Script por `backend/Code.gs` completo.
2. Ejecutar `configurarBaseDatos`. Crea la hoja `Matriculas` conservando los datos existentes.
3. Publicar una nueva versión de la implementación, manteniendo la URL actual.
4. Publicar `matriculas.html`, `matriculas.css`, `matriculas.js` y los archivos actualizados `home.html` y `registro-alumnos (2).html`.
5. Iniciar sesión y abrir **Matrículas** desde el menú.

Las preinscripciones ya sincronizadas aparecen como estudiantes disponibles. El personal crea su matrícula al revisar su admisión. El estado de matrícula es independiente del estado en Alumnos y no cambia las reglas de expedición de certificados. Este módulo no incluye cobros ni contabilidad.

Las consultas y escrituras requieren sesión. Se impiden duplicados de estudiante, programa y período salvo matrículas canceladas. Los reintentos idénticos mantienen el identificador y las ediciones antiguas se rechazan. Se conserva la fecha de creación y se registra la fecha y el usuario de la última modificación; no constituye un historial completo de cambios.

Pruebas locales: `node --test backend/inscripciones.test.cjs backend/interfaz.test.cjs backend/emision.test.cjs`.

Tras publicar, verificar con datos ficticios: crear una matrícula, recargar, editar su estado y comprobar la fila en Sheets. Las pruebas locales usan servicios simulados y no sustituyen esa comprobación.
