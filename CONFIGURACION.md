# Configuración de las páginas

Edita `inscripcion-config.js`. Todas las páginas comparten su configuración:

- `apiUrl`: enlace `/exec` de la implementación de Google Apps Script.
- `imagenes.logo`: logo institucional, también utilizado en impresiones y marcas de agua.
- `imagenes.icono`: icono de las pestañas del navegador.
- `imagenes.fondoAcceso`: fotografía de fondo del acceso y de inscripciones.
- `imagenes.certificado`: plantilla del certificado.
- `imagenes.certificadoCapacitacion`: plantilla opcional de capacitación. Actualmente ese archivo no existe; se conserva el diseño alternativo que dibuja el sistema. Puedes agregarlo y configurar su ruta aquí.

Las rutas locales se resuelven desde la carpeta de `inscripcion-config.js`. Puedes usar una URL HTTPS para logos y fondos. Para las plantillas exportadas a PDF, utiliza preferiblemente archivos locales; una imagen externa necesita permitir acceso desde el dominio de la página para poder exportarse.

Después de cambiar la configuración, publica los archivos web actualizados y recarga la página. La configuración está disponible como `window.IFOBE_CONFIG`; los módulos existentes también la reciben como `window.IFOBE_INSCRIPCION`.

Los logos incrustados en correos enviados por Apps Script siguen integrados en el backend (`LOGO_IFOBE_BASE64` en `backend/Code.gs`). El navegador no configura esos correos. Las portadas y los materiales subidos a los cursos se administran dentro de Gen10.
