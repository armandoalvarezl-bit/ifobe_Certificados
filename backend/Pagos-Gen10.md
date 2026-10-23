# Pagos del docente por alumno

Cada inscripcion a un curso requiere un pago de $5.000 COP a Nequi **3127947484**. El docente selecciona los alumnos desde Inicio o Mis cursos, registra la referencia y adjunta un comprobante PDF, JPG o PNG (hasta 10 MB). Se calcula el total en el servidor; un comprobante puede cubrir varios alumnos del mismo curso.

Administracion revisa el comprobante y contrasta el abono, valor y referencia en Nequi. Solo administracion puede aprobar o rechazar. Un rechazo exige motivo y permite registrar otro comprobante. Un comprobante pendiente no habilita el acceso y no puede duplicarse para las mismas inscripciones.

La aprobacion habilita el curso y el derecho al certificado. La descarga del certificado sigue requiriendo las condiciones academicas y la publicacion del PDF firmado por administracion. No hay conexion bancaria ni confirmacion automatica de Nequi.

## Activacion

1. Reemplazar el codigo de Apps Script con TODO `Apps-Script-completo-Gen10.txt`. No combinarlo con las versiones separadas `PortalGen10.gs` y `Gen10Crypto.gs`.
2. Ejecutar `configurarTodaLaPlataforma` para crear la hoja `Gen10Pagos` sin borrar registros.
3. Publicar una nueva version de la implementacion existente y actualizar los archivos web, incluidas las paginas `gen10*.html` y `gen10.js`.
4. Probar con docente, administrador y alumno: registrar comprobante, verificar que el alumno siga bloqueado, aprobar y actualizar el campus del alumno.

**Las inscripciones existentes tambien requieren pago aprobado al activar esta version.** No se consideran pagadas automaticamente. La cuenta del alumno permite iniciar sesion y consultar su perfil/soporte mientras el curso esta bloqueado.

Los comprobantes quedan privados en Drive: solo el docente que registro el pago y administracion pueden leerlos. La aprobacion conserva administrador, fecha, importe, referencia y alumnos incluidos. No aprueba automaticamente un curso ni emite certificados.
