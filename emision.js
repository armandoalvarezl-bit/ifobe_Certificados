'use strict';
let solicitudCorreo = null, enviandoCopia = false;
const panelCorreo = document.createElement('section');
panelCorreo.className='email-status-panel';
const avisoCorreo = document.createElement('p');
avisoCorreo.setAttribute('role','status');
avisoCorreo.textContent='La copia del PDF se enviará al correo registrado en Alumnos, sin la firma manuscrita.';
const reintentarCorreo=document.createElement('button');
reintentarCorreo.type='button';reintentarCorreo.className='btn btn-outline-primary';
reintentarCorreo.textContent='Confirmar o reintentar la misma copia';reintentarCorreo.hidden=true;
reintentarCorreo.addEventListener('click',()=>enviarCopiaPendiente());
panelCorreo.append(avisoCorreo,reintentarCorreo);
document.querySelector('.certificate-content')?.append(panelCorreo);
async function consultarExpedicion(datos) {
  // Subir el PDF y enviarlo puede tardar más que una consulta de datos.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),datos.accion==='enviarDiploma'?180000:60000);
  try {
    const response=await fetch(HISTORIAL_API_URL,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...datos,token:sessionStorage.getItem('ifobeSesion')||''}),signal:controller.signal});
    if(!response.ok)throw Error('Google respondió con HTTP '+response.status+'. Revisa la ejecución en Apps Script antes de reintentar.');
    if(!(response.headers?.get('content-type')||'application/json').includes('application/json'))throw Error('Google devolvió una página en lugar de la confirmación. Revisa el acceso de la implementación y las ejecuciones de Apps Script.');
    const result=await response.json();
    if(!response.ok || result.ok!==true)throw Error(result.mensaje||'No se confirmó la operación.');
    return result;
  }catch(error){
    if(controller.signal.aborted || error.name==='AbortError') {
      throw Error('Se agotó el tiempo de espera. El servidor puede haber completado la operación aunque no haya llegado la respuesta.');
    }
    if(error instanceof TypeError)throw Error('El navegador no pudo leer la respuesta de Google (conexión o CORS). Revisa en Apps Script → Ejecuciones si enviarDiploma terminó y en EnviosDiplomas el estado de este envío.');
    throw error;
  }finally{clearTimeout(timer)}
}
async function prepararEmision() {
  if(enviandoCopia || solicitudCorreo){showToast('Primero resuelve el envío pendiente usando el botón de reintento.','warning');return false;}
  try {
    const cedula=document.getElementById('cedula').value.trim();
    const {alumno}=await consultarExpedicion({accion:'detalleAlumno',cedula});
    if(!alumno.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alumno.correo))throw Error('Completa el correo del estudiante en la hoja Alumnos.');
    if(document.getElementById('programa').disabled)throw Error('Actualiza los programas antes de generar el documento.');
    const programa=document.getElementById('programa').value;
    const response=await fetch(HISTORIAL_API_URL+'?accion=programas',{cache:'no-store'});
    const catalogo=await response.json();
    if(!response.ok || catalogo.ok!==true || !Array.isArray(catalogo.programas) || !catalogo.programas.includes(programa))throw Error('Selecciona un programa activo. Actualiza la lista de programas.');
    document.getElementById('cedula').value=alumno.cedula;
    document.getElementById('nombre').value=alumno.nombre;
    return true;
  }catch(error){showToast(error.message,'error',8000);return false;}
}
async function enviarCopiaPDF(doc,datos) {
  if(solicitudCorreo || enviandoCopia){showToast('Confirma primero el envío pendiente antes de enviar otro PDF.','warning');return;}
  solicitudCorreo={accion:'enviarDiploma',emisionId:datos.codigo.replace(/^IFOBE-/,''),...datos,pdf:doc.output('datauristring').split(',')[1]};
  if(!solicitudCorreo.pdf || solicitudCorreo.pdf.length>22369624){
    solicitudCorreo=null;
    avisoCorreo.textContent='El PDF se descargó, pero la copia supera el límite de 16 MB o no pudo prepararse. No se envió por correo. Reduce el tamaño de las imágenes antes de generar otro documento.';
    return;
  }
  await enviarCopiaPendiente();
}
async function enviarCopiaPendiente() {
  if(enviandoCopia || !solicitudCorreo)return;
  enviandoCopia=true;reintentarCorreo.hidden=true;
  avisoCorreo.textContent='PDF descargado. Enviando la copia por correo… Mantén abierta esta página.';
  try {
    const data=await consultarExpedicion(solicitudCorreo);
    if(data.correoEnviado!==true)throw Error('No se confirmó el envío del correo.');
    avisoCorreo.textContent='Copia del PDF enviada al correo registrado, sin la firma manuscrita.';
    solicitudCorreo=null;
  }catch(error){
    avisoCorreo.textContent='El PDF se descargó. '+error.message+' Identificador: '+solicitudCorreo.emisionId+'. Tamaño de la copia: '+(solicitudCorreo.pdf.length*3/4/1024/1024).toFixed(2)+' MB. Mantén esta página abierta y pulsa «Confirmar o reintentar la misma copia». Conservamos el identificador del envío para que el servidor compruebe si ya fue enviado.';
    reintentarCorreo.hidden=false;
  }finally{enviandoCopia=false;}
}
document.getElementById('cedula').addEventListener('input',()=>{document.getElementById('nombre').value='';});
document.getElementById('cedula').addEventListener('change', async()=>{
  if(solicitudCorreo || enviandoCopia)return;
  const cedula=document.getElementById('cedula').value.trim();
  if(!cedula)return;
  try {
    const {alumno}=await consultarExpedicion({accion:'detalleAlumno',cedula});
    if(document.getElementById('cedula').value.trim()!==cedula)return;
    document.getElementById('nombre').value=alumno.nombre;
    const select=document.getElementById('programa');
    if(Array.from(select.options).some(o=>o.value===alumno.programa))select.value=alumno.programa;
    if(!solicitudCorreo && !enviandoCopia)avisoCorreo.textContent='Estudiante: '+alumno.nombre+' · Programa registrado: '+(alumno.programa||'Por asignar')+' · Correo: '+(alumno.correo||'Pendiente en Alumnos');
  }catch(error){showToast(error.message,'warning');}
});
window.addEventListener('beforeunload',event=>{if(solicitudCorreo){event.preventDefault();event.returnValue='';}});
