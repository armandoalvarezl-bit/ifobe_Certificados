# Apps Script completo de la plataforma

## Campus Gen10 para docentes y estudiantes

El campus se abre en `gen10.html`. Para habilitarlo, seguir [GEN10.md](GEN10.md): copiar **Code-para-Apps-Script.txt** completo en Code.gs y ejecutar `configurarPortalGen10`. Este archivo ya integra Code.gs y PortalGen10.gs; no añadir otra copia de PortalGen10 en Google. El administrador predeterminado es institutoifobe@gmail.com; puede cambiarse mediante `GEN10_ADMIN_EMAIL`. Usa sus propias cuentas, permisos y tablas dentro del mismo libro. El formulario público de inscripción sigue siendo independiente.


Para publicar el sistema completo, usar **Code-para-Apps-Script.txt**. Para la preparación del catálogo, seguir [ACTUALIZAR-PROGRAMAS.md](ACTUALIZAR-PROGRAMAS.md): ejecutar **configurarBaseDatos** en lugar de limitarse a configurarInscripciones. Alta y edición incluyen correo y programa activo y requieren sesión. Las preinscripciones se sincronizan en Alumnos como pendientes de revisión. Las instrucciones de [GEN10.md](GEN10.md) prevalecen para publicar el campus completo.

## Instalación en el proyecto existente

1. Conservar una copia del Code.gs actual y reemplazar su contenido por el archivo `backend/Code.gs` completo. Solo debe existir un `doGet` y un `doPost` en el proyecto.
2. El proyecto utiliza el mismo archivo de Sheets al que está vinculado. Si es independiente, configurar la propiedad de script `SPREADSHEET_ID` con el ID del archivo existente antes del siguiente paso.
3. Seleccionar `configurarInscripciones` en el editor y ejecutarla una vez. Autorizar Sheets y Drive. Guarda el ID del archivo, crea la pestaña `Inscripciones` y una carpeta dedicada para los documentos. Las ejecuciones posteriores reutilizan la carpeta. Si se desea una carpeta existente, definir previamente `DOCUMENTS_FOLDER_ID` y comprobar que su acceso esté restringido a personal autorizado.
4. En Implementar > Administrar implementaciones, editar la implementación de la plataforma y seleccionar una nueva versión. Mantener la misma URL `/exec` para los clientes existentes. La aplicación debe ejecutarse con la cuenta institucional que tiene acceso al libro y a la carpeta.
5. Pegar esa URL `/exec` en `inscripcion-config.js`, en `apiUrl`. Hasta entonces el formulario muestra que el envío no está habilitado.
6. Verificar primero con datos ficticios: login, listado de alumnos, inscripción sin adjuntos, inscripción con PDF o fotos y reintento. Las pruebas locales no reemplazan esta verificación en Google.

## Funciones conservadas

Login, listado/agregado/edición/eliminación de alumnos, registro y consulta del historial mantienen los contratos del código original. Los certificados no fueron modificados. El original incluye funciones manuales de prueba; `configurarInscripciones` es la única que debe ejecutarse para configurar esta integración.

## Inscripciones

POST `accion: inscribirEstudiante` recibe el formulario completo y hasta dos documentos de 5 MB. Guarda la solicitud en `Inscripciones`, con estado `Pendiente de revisión`, y los archivos en Drive con enlaces en la fila. Una solicitud no se agrega automáticamente a la lista de alumnos habilitados para certificación.

Los reintentos desde la página conservan un UUID para evitar duplicar la misma solicitud. La página exige confirmación del código y la cantidad de adjuntos. No guarda documentos ni datos personales en localStorage. Las solicitudes sin adjuntos también se admiten.

GET `?accion=estadoInscripciones` identifica la versión del servicio sin devolver información de aspirantes. Los documentos no se publican por enlace desde el código. Revisar los permisos de cualquier carpeta existente elegida por la institución.

## Archivos

- `Code.gs`: versión completa integrada que se debe publicar.
- `inscripciones.test.cjs` e `interfaz.test.cjs`: pruebas de inscripción, correo, login e historial con servicios simulados. Ejecutar `node --test backend/inscripciones.test.cjs backend/interfaz.test.cjs` desde la carpeta de la aplicación.
- `correo-vista-previa.html`: vista local del correo con datos ficticios. Regenerar con `node backend/generar-vista-correo.cjs`; no envía mensajes.

El respaldo en una segunda hoja sigue pendiente de su enlace y de definir su conexión. No se alternan escrituras entre libros desconocidos.

## Confirmación por correo

Después del guardado se envía la confirmación con el nombre visible Admisiones IFOBE. No se adjuntan documentos de identidad. El formulario se limpia cuando se confirma el registro; el mensaje conserva su código. Si falla el correo, la inscripción sigue guardada y la pantalla informa la incidencia.

Actualizar Code.gs, ejecutar configurarInscripciones para autorizar MailApp y publicar una nueva versión de la misma implementación. En **Implementar > Administrar implementaciones**, la aplicación debe estar configurada como **Ejecutar como: institutoifobe@gmail.com**. La columna adicional Confirmación por correo registra el motivo concreto si el envío falla. Los reintentos de registros existentes no reenvían correos; los fallos de correo requieren revisión administrativa.

El correo incluye una versión HTML con el logo institucional integrado como imagen CID, el código de solicitud, el programa, la cantidad de documentos recibidos y el estado pendiente de revisión. Incluye también una versión de texto. El logo está incorporado en `Code.gs`, por lo que no requiere una URL pública ni cargar archivos adicionales en Apps Script.

La dirección real del remitente sigue visible y las respuestas se dirigen a institutoifobe@gmail.com. Esta versión requiere publicar desde esa cuenta. No activa `noReply`. Para revisar fallos de envío, consultar la columna Confirmación por correo; `reenviarCorreosPendientes` intenta enviar los pendientes y omite los marcados Enviado.

Verificación actual: 17 pruebas locales con servicios simulados, sin enviar correos reales. La comprobación visual en navegador y la prueba con la implementación de Google quedan pendientes.
Referencia: https://developers.google.com/apps-script/reference/mail/mail-app

## Acceso Gen10 con contraseña

Administradores, docentes y estudiantes activan su cuenta con un código único y crean una contraseña. Los ingresos siguientes usan correo y contraseña. La recuperación usa otro código de un solo uso. Publicar `Code-para-Apps-Script.txt` actualizado y los archivos `gen10.html` y `gen10.js`; seguir [GEN10.md](GEN10.md).
