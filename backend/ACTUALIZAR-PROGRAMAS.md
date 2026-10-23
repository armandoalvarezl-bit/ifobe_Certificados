# Activar programas y sincronización

Verificación del 24 de septiembre de 2026: la URL configurada devuelve `historial` al pedir `?accion=programas`. La versión publicada es anterior al catálogo. Cambiar solo el sitio no corrige el servicio de Google.

1. Reemplazar el contenido del proyecto Apps Script existente por **Code.gs** de esta carpeta. Mantener un único doGet y doPost.
2. Ejecutar **configurarBaseDatos**, que incluye configurarInscripciones. Autorizar los servicios solicitados. Prepara Programas, Alumnos, Inscripciones y EnviosDiplomas; recupera inscripciones y completa correo/programa vacíos sin sobrescribir los expedientes existentes. Si Programas está vacía, carga la oferta que ya estaba en el código: revisarla antes de usar el portal. Conserva programas marcados inactivos.
3. Revisar **Programas**: columnas `Programa` y `Activo`, con `SI` para los disponibles. En **Alumnos**: `Cedula`, `Nombre`, `Correo`, `Programa`, `Estado`. Completar desde Registro de alumnos a quienes no tengan una inscripción previa; el sistema no inventa su programa.
4. En **Implementar → Administrar implementaciones → Editar**, publicar una nueva versión conservando la URL `/exec` y la cuenta institucional.
5. Consultar `?accion=programas`: debe devolver `{"ok":true,"programas":[...]}`. Iniciar sesión de nuevo, guardar un estudiante de prueba con programa y correo, y verificar su fila. Probar preinscripción y emisión con datos de prueba.

Todas las pantallas toman la conexión de **inscripcion-config.js**. Si cambia la URL, actualizar solo ese archivo. Alta y edición requieren una sesión válida, correo y programa activo.

Las preinscripciones se sincronizan en Alumnos como pendientes de revisión. Esto no equivale a una aprobación académica. No se han modificado las hojas reales ni publicado Apps Script desde esta sesión.

Validación: 26 pruebas locales con servicios simulados. Pendientes: publicación, pruebas con Google y revisión visual (la herramienta de navegador no pudo conectarse).
