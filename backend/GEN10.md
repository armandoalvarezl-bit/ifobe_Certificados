# Campus Gen10 IFOBE

El acceso del campus está en `gen10.html`. Es independiente del panel administrativo existente y del formulario público `inscripcion.html`. No se conceden cuentas automáticamente al enviar una preinscripción.

## Publicación en el Apps Script existente

1. Conservar una copia de la versión publicada y del libro antes de actualizar.
2. Copiar **todo** `backend/Code-para-Apps-Script.txt` en `Code.gs`. Incluye el sistema administrativo y Gen10 con adjuntos. `Apps-Script-completo-Gen10.txt` contiene exactamente lo mismo.
3. Con esta opción no agregar `PortalGen10.gs` ni `Gen10Crypto.gs` por separado. Si ya existen en el proyecto, eliminar esas copias después de guardar el respaldo para evitar declaraciones duplicadas. Alternativamente, los desarrolladores pueden publicar `backend/Code.gs`, `backend/PortalGen10.gs` y `backend/Gen10Crypto.gs` como tres archivos, sin pegar ningún archivo integrado. Solo debe existir un `doPost` y un `doGet`.
4. En Configuración del proyecto → Propiedades del script, crear `GEN10_ADMIN_EMAIL` con el correo real de la persona que administrará el campus. Se reutiliza el libro actual mediante `SPREADSHEET_ID` o el libro vinculado.
5. Ejecutar **configurarTodaLaPlataforma** desde el editor. Autorizar Sheets, Drive y correo. Prepara las hojas administrativas y del campus, el administrador Gen10 y las carpetas privadas para documentos, imágenes y portadas. No envía correos y puede repetirse sin borrar registros. El registro de ejecución muestra los enlaces al libro y las carpetas. No editar manualmente las columnas JSON.
6. La configuración solicita los permisos de correo sin enviar mensajes. Publicar con ejecución como institutoifobe@gmail.com para los correos institucionales existentes. Los docentes y estudiantes se habilitan después desde Administración del campus.
7. Actualizar la implementación web existente con una nueva versión y mantener la URL `/exec` configurada en `inscripcion-config.js`. El endpoint debe poder recibir peticiones del formulario público; las operaciones del campus validan su propia sesión en el servidor.
8. Publicar `gen10.html`, `gen10.css`, `gen10-institucional.css`, `gen10-archivos.js` y `gen10.js` junto con los archivos del sitio y los cambios de `index.html` y `portal-shell.js`. Conservar el orden de los scripts del HTML: configuración, archivos y campus. Abrir el sitio mediante HTTPS, no mediante `file://`.
9. Acceder con el correo configurado (por defecto, `institutoifobe@gmail.com`), elegir **Primera vez: activar mi cuenta**, solicitar el código único y crear una contraseña de entre 12 y 128 caracteres. Después ingresar con correo y contraseña. Revisar spam si no llega el código. Las cuotas de MailApp y la configuración de la implementación deben verificarse en la cuenta institucional.

## Puesta en marcha

- Administración → Habilitar usuario: registrar nombre, correo y rol. La cuenta puede desactivarse sin eliminar su historial. No se puede retirar el propio acceso administrativo.
- Crear curso: asignar un docente activo y decidir si se publica. Un curso en borrador no aparece a estudiantes.
- Entrar al curso → Estudiantes: asignar los correos de estudiantes previamente habilitados. Se puede retirar su acceso al curso.
- Lecciones: escribir el contenido, añadir enlaces HTTPS a archivos o videos, ordenar y publicar. Los borradores solo los ven el docente responsable y administración.
- Tareas: publicar instrucciones, recurso opcional y fecha límite. Las fechas se guardan en UTC; cada navegador las muestra en su hora local.
- Estudiantes: abrir cursos asignados, marcar lecciones completadas, entregar texto y/o enlace al trabajo, consultar nota y comentarios. Una entrega puede actualizarse hasta su calificación. Las entregas tardías se aceptan y quedan señaladas.
- Docentes: revisar entregas, calificar de 0.0 a 5.0 y dejar retroalimentación. Las revisiones de calificación conservan fecha y autor. Se permiten hasta 50 revisiones y un máximo de 45 000 caracteres por registro.
- Notas y avance: ver el desglose de tareas y exámenes, sus promedios y el resultado ponderado con los porcentajes del docente. Cero es una nota válida. Este resultado **no modifica** automáticamente el boletín de `notas.html`, ni estados de matrículas o certificados.

## Notas desglosadas y exámenes automáticos

En Ajustes del curso → Editar configuración, el docente o administración define el porcentaje de tareas (1–99 %). Exámenes usa el porcentaje restante hasta completar 100 %. Los cursos existentes mantienen sus notas y quedan sin porcentaje hasta que se configure; no se impone un reparto predeterminado.

Notas y avance muestra para cada alumno las evaluaciones publicadas, su tipo, estado, nota y retroalimentación. Docente y alumno usan el mismo cálculo: promedio de tareas × porcentaje de tareas + promedio de exámenes × porcentaje de exámenes. Cada evaluación tiene el mismo peso dentro de su categoría. Cero cuenta; las actividades sin entregar o sin calificar siguen pendientes. Se calcula con los valores completos y se redondea únicamente la presentación. La nota final aparece cuando ambas categorías tienen evaluaciones y todas están calificadas; antes se muestra el resultado ponderado parcial cuando ambas tienen al menos una calificación. Los borradores no cuentan. No se sincroniza automáticamente con el boletín de notas.html.

En la pestaña Exámenes de cada curso, el docente crea entre 1 y 20 preguntas de selección múltiple, con cuatro opciones y una respuesta correcta por pregunta. Puede añadir instrucciones, archivos y fecha límite. Todas las preguntas valen lo mismo. El alumno dispone de un intento y debe responderlas todas dentro del plazo. El servidor calcula la nota como respuestas correctas / total × 5, con un decimal; el navegador del alumno no recibe la clave de respuestas. Un reintento de conexión devuelve el resultado ya guardado y no crea otro intento. El docente consulta notas y aciertos; las notas automáticas no se modifican manualmente. Las preguntas de un examen con respuestas no pueden cambiarse; se debe crear otro examen.

Para activar estos cambios, publicar una nueva versión de backend/Code-para-Apps-Script.txt en la implementación existente y actualizar gen10.html, gen10.js y gen10-institucional.css en el sitio. Se reutilizan las hojas Gen10Tareas y Gen10Entregas sin eliminar sus registros.

## Materiales y archivos

El campus admite texto, enlaces HTTPS y hasta cinco adjuntos por contenido: PDF, imágenes, documentos Office, texto, audio MP3 y video MP4/WebM. El límite es 10 MB por archivo y 20 MB por envío; la portada del curso admite JPG, PNG o WebP de hasta 2 MB. Los adjuntos se guardan en una carpeta privada de Drive y cada lectura comprueba los permisos actuales del usuario. No se publican por enlace. El proyecto debe tener autorización de Drive para subir y leer archivos. Los enlaces externos conservan los permisos del servicio de origen.

## Acceso con correo y contraseña

Este flujo es el mismo para administradores, docentes y estudiantes. Las cuentas que usaban códigos también deben activar su contraseña una vez. Se conservan nombres, correos, roles, cursos y datos académicos. El panel administrativo anterior mantiene su acceso existente con correo y contraseña.

Si se olvida la contraseña, elegir **Olvidé mi contraseña**, solicitar un código al correo registrado y guardar una nueva. El cambio invalida las sesiones anteriores. Un código por sí solo ya no permite iniciar sesión y no puede reutilizarse. Las cuentas desactivadas no pueden activar ni recuperar el acceso. La activación no permite elegir ni modificar el rol.

Las contraseñas se guardan con PBKDF2-HMAC-SHA256, 600 000 iteraciones y sal aleatoria por cambio; no se guardan en texto plano ni se devuelven hashes o sales al navegador. La implementación utiliza SJCL 1.0.8 en `Gen10Crypto.gs`, con licencia en `vendor/sjcl-LICENSE.txt`, incluida también en los archivos integrados. Referencias: [SJCL](https://github.com/bitwiseshiftleft/sjcl/tree/1.0.8) y [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

El login permite cinco intentos por correo antes de esperar 15 minutos, con un límite global adicional de 120 intentos por intervalo de 15 minutos. Estos límites usan CacheService. El cálculo de contraseña ocurre en el servidor; su tiempo de respuesta debe comprobarse en la implementación real de Apps Script.

## Acceso y datos

El código de activación o recuperación tiene ocho caracteres hexadecimales, vence a los diez minutos y permite cinco intentos. Se almacena su hash en CacheService. El envío tiene una espera de un minuto por correo y un máximo global de 60 solicitudes por hora para proteger la cuota. Las respuestas de solicitud no revelan si un correo existe. Una solicitud no crea una cuenta.

Al publicar esta actualización, las sesiones de la versión anterior dejan de ser válidas. Las sesiones duran como máximo seis horas y pueden expirar antes si Google elimina entradas de la caché. Se guardan en sessionStorage con una clave independiente. Los tokens Gen10 no se aceptan como sesiones del panel administrativo. Cada operación vuelve a comprobar el usuario activo, su rol, la asignación del docente o estudiante y el estado publicado del curso. Al desactivar un usuario pierde el acceso en su siguiente petición. Cerrar sesión invalida el token del servidor cuando hay conexión.

Los guardados usan bloqueo del servidor y número de revisión para evitar que dos personas sobrescriban cambios sin darse cuenta. Si hay un corte de conexión durante un guardado, actualizar y revisar el registro antes de repetirlo. No hay borrado destructivo de cursos, usuarios, lecciones ni entregas en la interfaz: se desactivan accesos o se retira la publicación.

Las pestañas Gen10 son nuevas; no se migran automáticamente alumnos ni usuarios del sistema anterior. El historial de notas corresponde a cada entrega, no a un registro de auditoría inmutable. El seguimiento de lecciones es una marca voluntaria del estudiante; no certifica visualización de videos ni asistencia.

## Comprobación

Desde la carpeta de la aplicación: `node --test backend/*.test.cjs`.

Después de modificar los scripts fuente, ejecutar `node backend/generar-apps-script.cjs`. Comprobar que las copias para publicar están sincronizadas con `node backend/generar-apps-script.cjs --check`.

Las pruebas locales usan servicios simulados y no envían correo. Antes de habilitar alumnos reales, comprobar en la implementación de Google: activar la cuenta con código y contraseña, cerrar sesión y volver a entrar con contraseña sin recibir otro correo, recuperar la contraseña y comprobar que la anterior y sus sesiones dejan de funcionar. Después acceder como administrador, habilitar un docente y dos estudiantes de prueba, publicar un curso, asignarlo a uno, publicar una lección y tarea, entregar como estudiante, calificar como docente, comprobar el promedio y verificar que el otro estudiante no recibe ese curso. Desactivar la cuenta y verificar el rechazo de su sesión.

El rendimiento y los límites de usuarios simultáneos dependen de las cuotas de Apps Script y del tamaño de las hojas. No se ha realizado una prueba de carga ni una validación de producción. La seguridad del sistema administrativo anterior es independiente de los permisos nuevos del campus.
# Avisos del campus

Gen10 guarda avisos personales en `Gen10Notificaciones` y envía un correo al publicar o modificar cursos, lecciones, tareas y exámenes, cambiar inscripciones o calificar entregas (incluidos exámenes automáticos). Los borradores no notifican. Las calificaciones solo se notifican al alumno correspondiente; las publicaciones llegan a los alumnos activos inscritos.

Los alumnos consultan los últimos 100 avisos en Inicio, con indicador de nuevos y botón para marcarlos como leídos. El campus abierto consulta novedades cada 30 segundos cuando no hay un formulario abierto. Los avisos anteriores siguen guardados en la hoja.

El correo se envía durante el guardado usando la cuenta ejecutora de Apps Script y su cuota. Un fallo no deshace la publicación ni la nota. `Pendiente` indica que no comenzó el envío; `Por verificar` requiere revisar antes de reenviar para evitar duplicados. No hay reenvío automático ni notificaciones retroactivas al configurar.

Para activar esta actualización, reemplaza Code.gs con `Apps-Script-completo-Gen10.txt`, ejecuta `configurarTodaLaPlataforma` para preparar la nueva hoja y publica una nueva versión de la implementación existente. Publica también los archivos web actualizados.

