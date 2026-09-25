'use strict';
let programasSolicitud = 0;
async function cargarProgramas() {
  const select = document.getElementById('programa');
  if (!select) return;
  const estado = document.getElementById('programasEstado');
  const numero = ++programasSolicitud;
  const previo = select.value;
  select.disabled = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const url = window.IFOBE_INSCRIPCION?.apiUrl;
    if (!url) throw Error('Falta configurar la conexión institucional.');
    const response = await fetch(url + '?accion=programas', {cache:'no-store', signal:controller.signal});
    const data = await response.json();
    if(!response.ok || data.ok !== true || !Array.isArray(data.programas) || data.programas.some(p=>typeof p!=='string')) throw Error('El servicio no entrega el catálogo. Publica la versión actual de Code.gs.');
    if(numero !== programasSolicitud)return;
    select.replaceChildren(new Option('Selecciona un programa',''));
    data.programas.forEach(nombre=>select.add(new Option(nombre,nombre)));
    if(data.programas.includes(previo))select.value=previo;
    select.disabled = data.programas.length === 0;
    estado.textContent = data.programas.length ? data.programas.length + ' programas disponibles · Lista actualizada.' : 'No hay programas activos. Administración debe ejecutar configurarBaseDatos y revisar la columna Activo de Programas.';
  } catch(error) {
    if(numero !== programasSolicitud)return;
    select.replaceChildren(new Option('No se pudieron cargar los programas',''));
    estado.textContent=error.message && error.name !== 'TypeError' && error.name !== 'AbortError' ? error.message : 'No se pudo consultar la oferta. Revisa la conexión y pulsa Actualizar programas.';
  } finally {clearTimeout(timer)}
}
cargarProgramas();
// La actualización es explícita para no cambiar selecciones mientras se envía un formulario.
