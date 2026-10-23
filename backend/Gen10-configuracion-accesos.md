# Roles, contraseñas y correo de acceso

En **Administración → Configuración de roles y contraseñas**, el administrador puede editar el rol y el acceso de cada cuenta, establecer una nueva contraseña y enviarla por correo con instrucciones. Las contraseñas existentes no se muestran. El cambio invalida las sesiones anteriores y los códigos de recuperación pendientes del usuario. Para su propia cuenta, el administrador utiliza **Olvidé mi contraseña** desde la pantalla de acceso.

En un curso, abre **Estudiantes → Asignar estudiante**. Para crear una cuenta nueva, marca **Crear estudiante nuevo y enviar sus credenciales**, completa el correo, nombre y documento, y deja la inscripción activa. Se crea una cuenta de estudiante, se asigna al curso y se envía un correo con una contraseña generada, el enlace del campus y orientaciones sobre perfil, materiales, entregas y resultados. Esta opción solo aparece para administración y el servidor rechaza su uso por docentes o estudiantes.

Si el correo ya tiene cuenta, deja esa opción desmarcada. La asignación conserva la contraseña y envía el aviso habitual con instrucciones de ingreso y recuperación.

## Publicación

1. Publica los archivos del sitio actualizados.
2. Copia todo `Code-para-Apps-Script.txt` en el proyecto de Apps Script y publica una nueva versión de la implementación existente.
3. Opcionalmente configura `GEN10_CAMPUS_URL` en Propiedades del script con el enlace público completo `https://…/gen10.html`. Esa propiedad tiene prioridad sobre el enlace enviado por la página. Si no está configurada, el formulario utiliza la dirección del sitio publicado; el envío de credenciales requiere HTTPS.

Las contraseñas se almacenan mediante PBKDF2 SHA-256; el texto enviado por correo no se guarda en las hojas ni se devuelve a la interfaz. `Gen10Notificaciones` registra el estado del correo de credenciales sin su contenido secreto. Si falta cuota o falla el envío, el acceso queda guardado y la interfaz informa que el correo requiere revisión. Los correos de credenciales no se reenvían automáticamente: revisa primero la entrega y, si hace falta, establece otra contraseña con envío por correo desde Administración.
