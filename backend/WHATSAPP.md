# Activar confirmaciones por WhatsApp

Remitente previsto: **+57 3127947484**. El número por sí solo no habilita la API. Meta debe tenerlo registrado y proporcionar su **Phone Number ID**, que es distinto del teléfono.

1. En tu aplicación de Meta Developers, configura WhatsApp Business Platform y registra/verifica ese número. Usa el procedimiento que Meta ofrezca para tu cuenta si el número ya está en WhatsApp Business.
2. En WhatsApp Manager solicita una plantilla de utilidad llamada `ifobe_inscripcion_recibida`, en español, con tres parámetros de cuerpo posicionales y sin encabezado ni botones con variables:

   `Hola {{1}}, recibimos tu solicitud de inscripción en IFOBE. Código: {{2}}. Programa: {{3}}. Estado: pendiente de revisión. Esta confirmación no constituye una matrícula ni una admisión.`

   Espera la aprobación de Meta. El código requiere exactamente esos tres parámetros, en ese orden.
3. En Apps Script → Configuración del proyecto → Propiedades del script, agrega:

   | Propiedad | Valor |
   | --- | --- |
   | WHATSAPP_TOKEN | Token de usuario del sistema autorizado para esa cuenta con permiso `whatsapp_business_messaging` |
   | WHATSAPP_PHONE_NUMBER_ID | ID que Meta asignó a +57 3127947484 |
   | WHATSAPP_API_VERSION | Versión compatible que aparece en la configuración de API de Meta, con formato `vNN.0` |
   | WHATSAPP_TEMPLATE | `ifobe_inscripcion_recibida` |
   | WHATSAPP_LANGUAGE | Código exacto del idioma aprobado, por ejemplo `es` |
   | WHATSAPP_ENABLED | `true` para activar; `false` para desactivar |

   No pongas el token en HTML, JavaScript del navegador, Git ni mensajes de chat.
4. Copia **todo** `Code-para-Apps-Script.txt` al proyecto Apps Script. Actualiza la implementación web con una nueva versión. Publica también los cambios de `inscripcion.html` e `inscripcion.js` en el sitio.
5. Realiza una inscripción de prueba con un celular tuyo, indicativo internacional y la autorización de WhatsApp marcada. Revisa `EnviosWhatsApp` y confirma la recepción en el teléfono. Apps Script necesitará autorización para solicitudes externas (UrlFetchApp).

El formulario acepta celulares colombianos de diez dígitos comenzados por 3 y añade 57. Para otros países escribe el número con su indicativo internacional.

`EnviosWhatsApp` conserva el consentimiento, solicitud, destinatario, estado e ID de mensaje. `Aceptado por Meta` significa aceptación de la API, no entrega: no se han implementado webhooks de entrega. `Enviando` o `Por verificar` requieren comprobar el resultado antes de reenviar. No hay reintentos automáticos ni envíos retroactivos de solicitudes existentes. `Pendiente` requiere revisar credenciales, activación y teléfono; `Rechazado` incluye el código HTTP. Los errores de WhatsApp no impiden guardar la inscripción.

Referencia: [documentación oficial de Meta en Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).
