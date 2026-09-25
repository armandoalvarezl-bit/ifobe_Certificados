'use strict';
const form = document.getElementById('inscripcionForm');
const fields = document.getElementById('datos');
const submit = document.getElementById('enviar');
const statusBox = document.getElementById('estado');
const another = document.getElementById('otra');
const fileInput = document.getElementById('documentos');
const fileList = document.getElementById('listaArchivos');
const fileError = document.getElementById('adjuntosError');
const apiUrl = window.IFOBE_INSCRIPCION?.apiUrl || '';
const MAX_FILE = 5 * 1024 * 1024;
let attachments = [], previewUrls = [], pendingPayload = null;
let busy = false, uncertain = false;
const today = new Date();
document.getElementById('fechaNacimiento').max = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
function showStatus(message, kind) {
  statusBox.textContent = message; statusBox.dataset.kind = kind; statusBox.hidden = false;
}
function showFileError(message) { fileError.textContent = message; fileError.hidden = !message; }
function renderFiles() {
  previewUrls.forEach(url => URL.revokeObjectURL(url)); previewUrls = []; fileList.replaceChildren();
  attachments.forEach((file, index) => {
    const row = document.createElement('li');
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img'); image.src = URL.createObjectURL(file); previewUrls.push(image.src);
      image.alt = 'Vista previa del documento ' + (index + 1); row.append(image);
    }
    const info = document.createElement('span'); info.className = 'file-info';
    info.textContent = file.name + ' · ' + (file.size/1024/1024).toFixed(2) + ' MB';
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Quitar';
    remove.setAttribute('aria-label','Quitar ' + file.name);
    remove.addEventListener('click', () => { attachments.splice(index,1); showFileError(''); renderFiles(); fileInput.focus(); });
    row.append(info,remove); fileList.append(row);
  });
}
fileInput.addEventListener('change', () => {
  const selected = Array.from(fileInput.files); fileInput.value = '';
  if (attachments.length + selected.length > 2) { showFileError('Puedes adjuntar hasta dos archivos. Quita uno antes de agregar otro.'); return; }
  for (const file of selected) {
    if (!['application/pdf','image/jpeg','image/png'].includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      showFileError('Selecciona archivos PDF, JPG o PNG. Convierte otros formatos, como HEIC, antes de subirlos.'); return;
    }
    if (!file.size || file.size > MAX_FILE) { showFileError('Cada archivo debe contener datos y pesar como máximo 5 MB.'); return; }
  }
  attachments.push(...selected); showFileError(''); renderFiles();
});
function readFile(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({nombre:file.name,tipo:file.type,base64:String(reader.result).split(',')[1]});
    reader.onerror = reader.onabort = () => reject(new Error('FILE_READ'));
    reader.readAsDataURL(file);
  });
}
async function sendRegistration(payload) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),60000);
  try {
    const response = await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal,redirect:'follow'});
    if (!response.ok) throw new Error('UNCONFIRMED');
    const data = await response.json();
    if (data.ok === false && data.version === 'inscripciones-v1') {
      const error = new Error('REJECTED'); error.detail = typeof data.mensaje === 'string' ? data.mensaje : 'No se pudo completar la inscripción.'; throw error;
    }
    if (data.ok !== true || data.version !== 'inscripciones-v1' || data.solicitudId !== payload.solicitudId || data.archivosGuardados !== payload.archivos.length) throw new Error('UNCONFIRMED');
    return data;
  } finally { clearTimeout(timeout); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || (fields.disabled && !uncertain)) return;
  if (!apiUrl) { showStatus('El envío de inscripciones completas todavía no está habilitado. Contacta a la administración. No se han enviado tus datos ni documentos.','error'); statusBox.focus(); return; }
  if (!uncertain) {
    if (document.getElementById('programa').disabled || !document.getElementById('programa').value) {
      showStatus('Selecciona un programa disponible antes de enviar la solicitud.','error'); statusBox.focus(); return;
    }
    form.querySelectorAll('input:not([type="file"]):not([type="checkbox"])').forEach(input => { input.value = input.value.trim(); });
    if (!form.reportValidity()) return;
  }
  const values = uncertain ? null : Object.fromEntries(new FormData(form));
  busy = true; let sent = false;
  fields.disabled = true; submit.disabled = true; form.setAttribute('aria-busy','true');
  submit.textContent = 'Enviando inscripción…'; showStatus('Estamos guardando tu solicitud. Mantén esta página abierta hasta recibir la confirmación.','pending');
  try {
    if (!pendingPayload) pendingPayload = {accion:'inscribirEstudiante',solicitudId:crypto.randomUUID(),datos:values,archivos:await Promise.all(attachments.map(readFile))};
    sent = true;
    const result = await sendRegistration(pendingPayload);
    uncertain = false;
    const mailNotice = result.correoEnviado === true
      ? ' Enviamos la confirmación al correo registrado. Revisa también la carpeta de spam.'
      : ' Tu inscripción quedó guardada, pero no se confirmó el envío del correo. Conserva este código.';
    showStatus('Solicitud recibida. Código: ' + result.solicitudId + '. La institución revisará tu inscripción.' + mailNotice,'success');
    form.reset(); fields.disabled = false; submit.disabled = false;
    submit.textContent = 'Enviar inscripción →'; another.hidden = true; pendingPayload = null; attachments = []; fileInput.value = ''; showFileError(''); renderFiles();
  } catch (error) {
    if (error.message === 'REJECTED' || !sent) {
      uncertain = false; pendingPayload = null; fields.disabled = false;
      showStatus(error.detail || 'No se pudieron preparar los archivos. Revisa los adjuntos e intenta de nuevo. No se envió la solicitud.','error');
    } else {
      uncertain = true;
      showStatus('Aún no podemos confirmar la recepción. Conservamos esta solicitud en la página. Pulsa «Confirmar o reintentar» para enviar el mismo registro sin duplicarlo. No cierres esta página.','error');
    }
    submit.textContent = uncertain ? 'Confirmar o reintentar' : 'Volver a enviar'; submit.disabled = false;
  } finally { busy = false; form.removeAttribute('aria-busy'); statusBox.focus(); }
});
another.addEventListener('click', () => {
  form.reset(); fields.disabled = false; submit.disabled = false; another.hidden = true; statusBox.hidden = true;
  attachments = []; pendingPayload = null; uncertain = false; showFileError(''); renderFiles(); submit.textContent = 'Enviar inscripción →'; document.getElementById('nombres').focus();
});
// A retry must stay operable while its original data is locked.
fields.after(submit);
if (!apiUrl) showStatus('Formulario en preparación: el envío de datos y documentos estará disponible cuando la institución habilite la conexión.','pending');
window.addEventListener('beforeunload', event => { if (busy || uncertain) { event.preventDefault(); event.returnValue = ''; } });
