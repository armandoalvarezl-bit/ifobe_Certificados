'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let datos = {matriculas: [], estudiantes: [], programas: []}, actual = null, ocupado = false;
  const token = sessionStorage.getItem('ifobeSesion');
  if (!token) { window.location.replace('index.html'); return; }

  async function api(payload) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(window.IFOBE_INSCRIPCION.apiUrl, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({...payload, token}), signal: controller.signal, credentials: 'omit', redirect: 'follow'});
      if (!response.ok) throw Error('No se pudo conectar con el servidor.');
      const result = await response.json();
      if (result.ok !== true) throw Error(result.mensaje || 'No se confirmó la operación.');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('Se agotó el tiempo. Puedes reintentar con los mismos datos; no se duplicará la matrícula.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function aviso(text, error = false) { $('mensaje').textContent = text; $('mensaje').dataset.error = String(error); }
  function mensajePostGuardado(result) {
    if (result.correoEnviado) return 'Confirmación enviada al correo del estudiante.';
    const tecnico = String(result.correoMensaje || '');
    if (/formato de n[uú]mero|number format|columna con texto/i.test(tecnico)) {
      return 'Matrícula guardada. Revisa o completa el correo del estudiante para enviar la confirmación.';
    }
    return tecnico || 'La confirmación se envía al activar la matrícula.';
  }
  function opciones(select, values, placeholder) {
    select.replaceChildren();
    if (placeholder) select.add(new Option(placeholder, ''));
    values.forEach(v => select.add(new Option(v.label || v, v.value || v)));
  }
  function estudiantePorCedula(cedula) { return datos.estudiantes.find(a => String(a.cedula) === String(cedula)); }
  function nombreEstudiante(a) { return a?.nombre || a?.nombres || a?.estudiante || 'Estudiante sin nombre'; }
  function correoEstudiante(a) { return a?.correo || a?.email || a?.correoElectronico || ''; }
  function programaMatriculado(cedula) {
    const prioridad = {Activa: 4, Pendiente: 3, Finalizada: 2, Cancelada: 1};
    return datos.matriculas
      .filter(m => String(m.cedula) === String(cedula) && m.programa)
      .sort((a, b) => (prioridad[b.estado] || 0) - (prioridad[a.estado] || 0))[0]?.programa || '';
  }
  function programaEstudiante(a) { return a?.programa || a?.programaAcademico || programaMatriculado(a?.cedula) || ''; }
  function matriculaDuplicada(cedula, programa, periodo) {
    return datos.matriculas.some(m => String(m.cedula) === String(cedula) && m.programa === programa && m.periodo === periodo);
  }
  function limpiar(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
  function fechaDocumento() {
    return new Date().toLocaleDateString('es-CO', {year: 'numeric', month: 'long', day: 'numeric'});
  }
  const ACADEMIC_START = '[IFOBE_ACADEMICO]';
  const ACADEMIC_END = '[/IFOBE_ACADEMICO]';
  function separarAcademico(observaciones = '') {
    const texto = String(observaciones || '');
    const inicio = texto.indexOf(ACADEMIC_START);
    const fin = texto.indexOf(ACADEMIC_END);
    if (inicio < 0 || fin < inicio) return {texto: texto.trim(), academico: {historial: []}};
    const visible = (texto.slice(0, inicio) + texto.slice(fin + ACADEMIC_END.length)).trim();
    try {
      const academico = JSON.parse(texto.slice(inicio + ACADEMIC_START.length, fin).trim());
      return {texto: visible, academico: {...academico, historial: Array.isArray(academico.historial) ? academico.historial : []}};
    } catch {
      return {texto: visible, academico: {historial: []}};
    }
  }
  function academicoDeMatricula(matricula = {}) {
    const separado = separarAcademico(matricula.observaciones || '').academico;
    return {
      ciclo: matricula.cicloAcademico || separado.ciclo || '',
      nota: matricula.notaFinal || separado.nota || '',
      estado: matricula.estadoAcademico || separado.estado || '',
      seguimiento: matricula.seguimientoAcademico || separado.seguimiento || '',
      historial: Array.isArray(matricula.historialAcademico) ? matricula.historialAcademico : (separado.historial || [])
    };
  }
  function datosAcademicosFormulario(previo = {}) {
    return {
      ciclo: $('cicloAcademico').value.trim(),
      nota: $('notaFinal').value.trim(),
      estado: $('estadoAcademico').value,
      seguimiento: $('seguimientoAcademico').value.trim(),
      historial: Array.isArray(previo.historial) ? previo.historial : []
    };
  }
  function armarObservaciones(texto, academico) {
    const limpio = {
      ciclo: academico.ciclo || '',
      nota: academico.nota || '',
      estado: academico.estado || '',
      seguimiento: academico.seguimiento || '',
      historial: (academico.historial || []).slice(-8)
    };
    const tieneDatos = limpio.ciclo || limpio.nota || limpio.estado || limpio.seguimiento || limpio.historial.length;
    return [texto.trim(), tieneDatos ? `${ACADEMIC_START}\n${JSON.stringify(limpio)}\n${ACADEMIC_END}` : ''].filter(Boolean).join('\n\n');
  }
  function renderHistorialAcademico(historial = []) {
    const box = $('historialAcademico');
    box.replaceChildren();
    box.hidden = !historial.length;
    if (!historial.length) return;
    const title = document.createElement('strong');
    title.textContent = 'Historial de ciclos';
    const list = document.createElement('ul');
    historial.slice().reverse().forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.fecha || ''} · ${item.ciclo || 'Ciclo'} · ${item.estado || 'Sin estado'}${item.nota ? ' · Nota ' + item.nota : ''}`;
      list.append(li);
    });
    box.append(title, list);
  }
  function llenarAcademico(matricula) {
    const {texto} = separarAcademico(matricula?.observaciones || '');
    const academico = academicoDeMatricula(matricula || {});
    $('observaciones').value = texto;
    $('cicloAcademico').value = academico.ciclo || matricula?.periodo || '';
    $('notaFinal').value = academico.nota || '';
    $('estadoAcademico').value = academico.estado || '';
    $('seguimientoAcademico').value = academico.seguimiento || '';
    renderHistorialAcademico(academico.historial || []);
    return academico;
  }
  function detalle(label, value, icon = '') {
    const p = document.createElement('p');
    if (icon) {
      const iconEl = document.createElement('i');
      iconEl.className = `bi ${icon}`;
      iconEl.setAttribute('aria-hidden', 'true');
      p.append(iconEl);
    }
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = label;
    span.textContent = value || 'No registrado';
    p.append(strong, span);
    return p;
  }

  function renderFicha(cedula, matricula = null) {
    const card = $('fichaEstudiante');
    const estudiante = estudiantePorCedula(cedula);
    card.replaceChildren();
    card.hidden = !cedula;
    if (!cedula) return;

    const nombre = estudiante ? nombreEstudiante(estudiante) : (matricula?.nombre || 'Ficha del estudiante');
    const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'ES';

    const title = document.createElement('div');
    title.className = 'student-card-title';
    const avatar = document.createElement('span');
    avatar.className = 'student-avatar';
    avatar.textContent = iniciales;
    const main = document.createElement('div');
    main.className = 'student-card-main';
    const h3 = document.createElement('h3');
    h3.textContent = nombre;
    const meta = document.createElement('p');
    meta.textContent = matricula ? `${matricula.programa || 'Programa sin definir'} · ${matricula.periodo || 'Período pendiente'}` : 'Ficha lista para nueva matrícula';
    main.append(h3, meta);
    const actions = document.createElement('div');
    actions.className = 'student-card-actions';
    if (matricula?.estado) {
      const status = document.createElement('span');
      status.className = 'student-status';
      status.dataset.estado = matricula.estado;
      status.textContent = matricula.estado;
      actions.append(status);
    }
    if (matricula) {
      const pdf = document.createElement('button');
      pdf.type = 'button';
      pdf.className = 'student-pdf';
      pdf.innerHTML = '<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i><span>Descargar PDF</span>';
      pdf.addEventListener('click', () => descargarPDFMatricula(matricula));
      actions.append(pdf);
    }
    const link = document.createElement('a');
    link.href = 'registro-alumnos (2).html';
    link.textContent = estudiante ? 'Actualizar datos del alumno' : 'Revisar en estudiantes';
    actions.append(link);
    title.append(avatar, main, actions);

    const summary = document.createElement('div');
    summary.className = 'student-card-summary';
    summary.append(
      detalle('Programa', matricula?.programa || programaEstudiante(estudiante), 'bi-mortarboard'),
      detalle('Período', matricula?.periodo, 'bi-calendar3'),
      detalle('Jornada', matricula?.jornada, 'bi-clock')
    );

    const grid = document.createElement('div');
    grid.className = 'student-card-grid';
    grid.append(
      detalle('Documento', cedula, 'bi-credit-card-2-front'),
      detalle('Correo', correoEstudiante(estudiante), 'bi-envelope'),
      detalle('Programa registrado', programaEstudiante(estudiante), 'bi-journal-bookmark'),
      detalle('Registro', matricula ? `Código ${matricula.id || 'sin código'}` : 'Nueva matrícula', 'bi-patch-check')
    );
    const academico = academicoDeMatricula(matricula || {});
    if (matricula && (academico.ciclo || academico.nota || academico.estado)) {
      const academic = document.createElement('div');
      academic.className = 'student-card-grid academic-card-grid';
      academic.append(
        detalle('Ciclo académico', academico.ciclo, 'bi-layers'),
        detalle('Nota final', academico.nota, 'bi-clipboard-check'),
        detalle('Estado académico', academico.estado, 'bi-award'),
        detalle('Certificación / graduación', ['Certificado','Graduado'].includes(academico.estado) ? academico.estado : '', 'bi-patch-check'),
        detalle('Seguimiento', academico.seguimiento, 'bi-chat-square-text')
      );
      card.append(title, summary, grid, academic);
    } else {
      card.append(title, summary, grid);
    }
  }

  function filaPDF(label, value) {
    return `<div class="pdf-row"><span>${limpiar(label)}</span><strong>${limpiar(value || 'No registrado')}</strong></div>`;
  }

  function descargarPDFMatricula(matricula) {
    const estudiante = estudiantePorCedula(matricula.cedula) || {};
    const nombre = matricula.nombre || nombreEstudiante(estudiante);
    const correo = correoEstudiante(estudiante);
    const programaRegistrado = programaEstudiante(estudiante);
    const academicoPDF = academicoDeMatricula(matricula);
    const situacionFinal = academicoPDF.estado || (matricula.estado === 'Finalizada' ? 'Finalizada' : matricula.estado || 'No registrada');
    const folio = String(matricula.id || crypto.randomUUID()).slice(0, 8).toUpperCase();
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { aviso('El navegador bloqueó la ventana del PDF. Permite ventanas emergentes para descargar la matrícula.', true); return; }
    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Matrícula ${limpiar(nombre)}</title>
<style>
  @page{size:letter;margin:14mm}
  *{box-sizing:border-box}
  body{margin:0;color:#10233d;font-family:Arial,Helvetica,sans-serif;background:white}
  .sheet{position:relative;min-height:245mm;padding:24px 28px 34px;border:1.4px solid #10233d;overflow:hidden}
  .sheet::before{content:"";position:absolute;inset:12px;border:1px solid #d5dee9;pointer-events:none}
  .sheet>*{position:relative;z-index:1}
  .top{display:grid;grid-template-columns:78px 1fr 170px;gap:16px;align-items:center;border-bottom:3px solid #10233d;padding:0 0 12px}
  .logo{width:68px;height:68px;object-fit:contain;border:1px solid #d5dee9;border-radius:6px;padding:6px;background:#fff}
  .eyebrow{margin:0 0 5px;font-size:10px;letter-spacing:.18em;color:#7f5c1b;font-weight:800;text-transform:uppercase}
  h1{margin:0;color:#10233d;font-family:Georgia,serif;font-size:25px}
  .sub{margin:5px 0 0;color:#526172;font-size:12px}
  .code{border:1px solid #10233d;padding:9px 10px;text-align:left;background:#f8fafc}
  .code span{display:block;font-size:9px;color:#526172;text-transform:uppercase;letter-spacing:.12em}
  .code strong{display:block;margin-top:5px;font-size:12px;overflow-wrap:anywhere;color:#10233d}
  .control{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d5dee9;border-bottom:0;margin:14px 0 0}
  .control div{padding:8px 10px;border-right:1px solid #d5dee9;border-bottom:1px solid #d5dee9}
  .control div:last-child{border-right:0}
  .control span{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#68778a;margin-bottom:4px}
  .control strong{display:block;font-size:12px;color:#10233d}
  .stamp-row{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
  .stamp{border:1px solid #b78a37;color:#73531a;padding:6px 10px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;background:#fffaf0}
  .stamp.blue{border-color:#10233d;color:#10233d;background:#f8fafc}
  .section{margin-top:14px;border:1px solid #d5dee9;overflow:hidden;background:#fff}
  .section h2{margin:0;padding:9px 12px;background:#f1f5f9;color:#10233d;border-bottom:1px solid #d5dee9;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
  .grid{display:grid;grid-template-columns:1fr 1fr}
  .pdf-row{min-height:52px;padding:11px 12px;border-top:1px solid #edf1f6;border-right:1px solid #edf1f6}
  .pdf-row:nth-child(2n){border-right:0}
  .pdf-row span{display:block;color:#697b8e;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px}
  .pdf-row strong{display:block;color:#132b4a;font-size:14px;line-height:1.35}
  .note{padding:12px;min-height:70px;color:#223a58;line-height:1.5;font-size:13px}
  .legal{margin:14px 0 0;padding:11px 13px;border-left:4px solid #b78a37;background:#f8fafc;color:#3d5067;line-height:1.45;font-size:12px}
  .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;margin-top:48px}
  .sig{border-top:1px solid #10233d;text-align:center;padding-top:8px;color:#263b56;font-size:11px;min-height:34px}
  .seal{position:absolute;right:42px;bottom:64px;width:96px;height:96px;border:2px solid #b78a37;border-radius:50%;display:grid;place-items:center;text-align:center;color:#8c651d;font-weight:800;font-size:10px;letter-spacing:.1em;opacity:.55}
  .foot{position:absolute;left:28px;right:28px;bottom:18px;border-top:1px solid #d8e0ec;padding-top:8px;color:#6b7c8e;font-size:9.5px;text-align:center}
  @media print{.no-print{display:none}.sheet{border-color:#10233d}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<main class="sheet">
  <header class="top">
    <img class="logo" src="img/Logogen10.png" alt="Logo IFOBE">
    <div>
      <p class="eyebrow">Secretaría Académica · Registro y Control</p>
      <h1>Ficha universitaria de matrícula</h1>
      <p class="sub">Instituto de Formación IFOBE · Documento académico generado el ${limpiar(fechaDocumento())}</p>
    </div>
    <div class="code"><span>Folio académico</span><strong>IFOBE-MAT-${limpiar(folio)}</strong><span>Código interno</span><strong>${limpiar(matricula.id || 'Sin código')}</strong></div>
  </header>
  <div class="control">
    <div><span>Documento</span><strong>${limpiar(matricula.cedula)}</strong></div>
    <div><span>Estado matrícula</span><strong>${limpiar(matricula.estado || 'Pendiente')}</strong></div>
    <div><span>Período</span><strong>${limpiar(matricula.periodo || 'No registrado')}</strong></div>
    <div><span>Situación final</span><strong>${limpiar(situacionFinal)}</strong></div>
  </div>
  <div class="stamp-row">
    <span class="stamp blue">${limpiar(matricula.estado || 'Pendiente')}</span>
    <span class="stamp">Registro académico</span>
    <span class="stamp">IFOBE</span>
  </div>
  <section class="section">
    <h2>Datos del estudiante</h2>
    <div class="grid">
      ${filaPDF('Nombre completo', nombre)}
      ${filaPDF('Documento', matricula.cedula)}
      ${filaPDF('Correo', correo)}
      ${filaPDF('Programa registrado en alumnos', programaRegistrado)}
    </div>
  </section>
  <section class="section">
    <h2>Datos de matrícula</h2>
    <div class="grid">
      ${filaPDF('Programa matriculado', matricula.programa)}
      ${filaPDF('Período académico', matricula.periodo)}
      ${filaPDF('Jornada', matricula.jornada)}
      ${filaPDF('Estado', matricula.estado)}
    </div>
  </section>
  <section class="section">
    <h2>Seguimiento académico</h2>
    <div class="grid">
      ${filaPDF('Ciclo académico', academicoPDF.ciclo || matricula.periodo)}
      ${filaPDF('Nota final', academicoPDF.nota)}
      ${filaPDF('Estado académico', academicoPDF.estado)}
      ${filaPDF('Certificación / graduación', ['Certificado','Graduado'].includes(academicoPDF.estado) ? academicoPDF.estado : '')}
      ${filaPDF('Seguimiento', academicoPDF.seguimiento)}
      ${filaPDF('Fecha de emisión', fechaDocumento())}
    </div>
  </section>
  <section class="section">
    <h2>Observaciones</h2>
    <div class="note">${limpiar(separarAcademico(matricula.observaciones || '').texto || 'Sin observaciones registradas.')}</div>
  </section>
  <p class="legal">Esta ficha certifica el registro de matrícula del estudiante en la plataforma académica de IFOBE. Para cambios de datos personales, actualiza primero el expediente del alumno y vuelve a generar este documento.</p>
  <div class="signatures">
    <div class="sig">Admisiones y Registro</div>
    <div class="sig">Coordinación Académica</div>
    <div class="sig">Firma del estudiante</div>
  </div>
  <div class="seal">REGISTRO<br>ACADÉMICO<br>IFOBE</div>
  <footer class="foot">IFOBE · Secretaría Académica · Ficha de matrícula generada desde el sistema institucional</footer>
</main>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function render() {
    const q = $('buscar').value.trim().toLocaleLowerCase('es'), estado = $('filtroEstado').value, periodo = $('filtroPeriodo').value;
    const rows = datos.matriculas.filter(m => (!estado || m.estado === estado) && (!periodo || m.periodo === periodo) && (!q || [m.nombre, m.cedula, m.id].join(' ').toLocaleLowerCase('es').includes(q)));
    $('total').textContent = datos.matriculas.length;
    $('activas').textContent = datos.matriculas.filter(m => m.estado === 'Activa').length;
    $('pendientes').textContent = datos.matriculas.filter(m => m.estado === 'Pendiente').length;
    $('filas').replaceChildren();
    $('vacio').hidden = rows.length > 0;
    $('cantidad').textContent = `${rows.length} de ${datos.matriculas.length} matrículas`;
    rows.forEach(m => {
      const academico = academicoDeMatricula(m);
      const tr = document.createElement('tr');
      [m.nombre, m.programa, `${m.periodo} / ${m.jornada}`].forEach((text, index) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (index === 2 && (academico.ciclo || academico.nota || academico.estado)) {
          const small = document.createElement('small');
          small.textContent = [academico.ciclo, academico.estado, academico.nota ? 'Nota ' + academico.nota : ''].filter(Boolean).join(' · ');
          td.append(small);
        }
        tr.append(td);
      });
      const sub = document.createElement('small');
      sub.textContent = m.cedula;
      tr.firstChild.append(sub);
      const td = document.createElement('td'), badge = document.createElement('span');
      badge.className = 'badge';
      badge.dataset.estado = m.estado;
      badge.textContent = m.estado;
      td.append(badge);
      tr.append(td);
      const actions = document.createElement('td'), button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = 'Ficha';
      button.addEventListener('click', () => abrir(m));
      actions.append(button);
      tr.append(actions);
      $('filas').append(tr);
    });
  }

  function refrescar() {
    const selected = $('filtroPeriodo').value;
    opciones($('filtroPeriodo'), [...new Set(datos.matriculas.map(m => m.periodo))].sort().reverse(), 'Todos los períodos');
    $('filtroPeriodo').value = selected;
    render();
  }

  async function cargar() {
    $('actualizar').disabled = true;
    try {
      const result = await api({accion: 'gestionMatriculas'});
      if (!Array.isArray(result.matriculas) || !Array.isArray(result.estudiantes) || !Array.isArray(result.programas)) throw Error('Actualiza y publica backend/Code.gs para habilitar las matrículas.');
      datos = result;
      refrescar();
      $('nueva').disabled = false;
      $('masiva').disabled = datos.estudiantes.length === 0 || datos.programas.length === 0;
      aviso(datos.estudiantes.length ? 'Listado actualizado.' : 'Registra primero un estudiante para crear su matrícula.');
    } catch (error) {
      aviso(error.message, true);
    } finally { $('actualizar').disabled = false; }
  }

  function abrir(m) {
    actual = m ? {...m} : {id: crypto.randomUUID(), revision: ''};
    $('formulario').reset();
    $('error').textContent = '';
    $('titulo').textContent = m ? 'Ficha de matrícula' : 'Nueva matrícula';
    opciones($('estudiante'), datos.estudiantes.map(a => ({value: a.cedula, label: `${nombreEstudiante(a)} · ${a.cedula}`})), 'Selecciona un estudiante');
    opciones($('programa'), datos.programas, 'Selecciona un programa');
    if (m) {
      if (!datos.estudiantes.some(a => a.cedula === m.cedula)) $('estudiante').add(new Option(`${m.nombre} · ${m.cedula}`, m.cedula));
      if (!datos.programas.includes(m.programa)) $('programa').add(new Option(`${m.programa} (inactivo)`, m.programa));
      $('estudiante').value = m.cedula;
      ['programa', 'periodo', 'jornada', 'estado'].forEach(k => $(k).value = m[k] || '');
    }
    const academico = llenarAcademico(m);
    $('guardarNuevoCiclo').checked = false;
    $('nuevoCicloWrap').hidden = !m;
    $('estudiante').disabled = !!m;
    renderFicha($('estudiante').value, m);
    $('editor').showModal();
  }

  function periodoSugerido() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 1 : 2}`;
  }

  function estudiantesMasivosVisibles() {
    const q = $('buscarMasivo').value.trim().toLocaleLowerCase('es');
    const programa = $('programaMasivo').value;
    const soloPrograma = $('soloPrograma').checked;
    return datos.estudiantes
      .filter(a => !soloPrograma || !programa || programaEstudiante(a) === programa)
      .filter(a => !q || [nombreEstudiante(a), a.cedula, correoEstudiante(a)].join(' ').toLocaleLowerCase('es').includes(q))
      .sort((a, b) => nombreEstudiante(a).localeCompare(nombreEstudiante(b), 'es'));
  }

  function actualizarResumenMasivo() {
    const checks = [...$('listaMasiva').querySelectorAll('input[type="checkbox"]')];
    const seleccionados = checks.filter(c => c.checked && !c.disabled).length;
    const duplicados = checks.filter(c => c.disabled).length;
    $('resumenMasivo').textContent = `${seleccionados} seleccionados · ${checks.length} visibles${duplicados ? ` · ${duplicados} ya matriculados` : ''}`;
    $('guardarMasivo').disabled = seleccionados === 0;
  }

  function renderMasivo() {
    const list = $('listaMasiva');
    const programa = $('programaMasivo').value;
    const periodo = $('periodoMasivo').value.trim();
    const visibles = estudiantesMasivosVisibles();
    list.replaceChildren();
    if (!visibles.length) {
      const empty = document.createElement('p');
      empty.className = 'bulk-empty';
      empty.textContent = 'No hay estudiantes para mostrar con estos filtros.';
      list.append(empty);
      actualizarResumenMasivo();
      return;
    }
    visibles.forEach(a => {
      const duplicada = programa && periodo && matriculaDuplicada(a.cedula, programa, periodo);
      const label = document.createElement('label');
      label.className = 'bulk-item';
      if (duplicada) label.dataset.disabled = 'true';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = a.cedula;
      input.disabled = duplicada;
      input.addEventListener('change', actualizarResumenMasivo);
      const info = document.createElement('span');
      const name = document.createElement('strong');
      const meta = document.createElement('small');
      name.textContent = nombreEstudiante(a);
      meta.textContent = `${a.cedula}${programaEstudiante(a) ? ' · ' + programaEstudiante(a) : ''}${duplicada ? ' · ya matriculado' : ''}`;
      info.append(name, meta);
      label.append(input, info);
      list.append(label);
    });
    actualizarResumenMasivo();
  }

  function abrirMasivo() {
    $('formularioMasivo').reset();
    $('errorMasivo').textContent = '';
    opciones($('programaMasivo'), datos.programas, 'Selecciona un programa');
    $('periodoMasivo').value = periodoSugerido();
    renderMasivo();
    $('masivo').showModal();
  }

  async function guardarMasivo(event) {
    event.preventDefault();
    if (ocupado || !$('formularioMasivo').reportValidity()) return;
    const cedulas = [...$('listaMasiva').querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')].map(c => c.value);
    if (!cedulas.length) { $('errorMasivo').textContent = 'Selecciona al menos un estudiante.'; return; }

    ocupado = true;
    const controls = [...$('formularioMasivo').elements], disabled = controls.map(c => c.disabled);
    controls.forEach(c => c.disabled = true);
    $('errorMasivo').textContent = `Guardando 0 de ${cedulas.length} matrículas...`;
    const creadas = [];
    try {
      for (const [index, cedula] of cedulas.entries()) {
        $('errorMasivo').textContent = `Guardando ${index + 1} de ${cedulas.length} matrículas...`;
        const result = await api({
          accion: 'guardarMatricula',
          id: crypto.randomUUID(),
          revision: '',
          cedula,
          programa: $('programaMasivo').value,
          periodo: $('periodoMasivo').value.trim(),
          jornada: $('jornadaMasiva').value,
          estado: $('estadoMasivo').value,
          observaciones: $('observacionesMasivas').value.trim()
        });
        if (!result.matricula?.id) throw Error('El servidor no confirmó una de las matrículas.');
        creadas.push(result.matricula);
      }
      datos.matriculas = [...creadas.reverse(), ...datos.matriculas.filter(m => !creadas.some(n => n.id === m.id))];
      refrescar();
      $('masivo').close();
      aviso(`${creadas.length} matrícula${creadas.length === 1 ? '' : 's'} creada${creadas.length === 1 ? '' : 's'} correctamente.`);
    } catch (error) {
      if (creadas.length) {
        datos.matriculas = [...creadas.reverse(), ...datos.matriculas.filter(m => !creadas.some(n => n.id === m.id))];
        refrescar();
      }
      $('errorMasivo').textContent = `${creadas.length} guardadas. ${error.message}`;
    } finally {
      ocupado = false;
      controls.forEach((c, i) => c.disabled = disabled[i]);
      actualizarResumenMasivo();
    }
  }

  $('estudiante').addEventListener('change', () => {
    const a = estudiantePorCedula($('estudiante').value);
    $('programa').value = datos.programas.includes(programaEstudiante(a)) ? programaEstudiante(a) : '';
    renderFicha($('estudiante').value, null);
  });
  $('formulario').addEventListener('submit', async event => {
    event.preventDefault();
    if (ocupado || !$('formulario').reportValidity()) return;
    ocupado = true;
    const previo = academicoDeMatricula(actual || {});
    const academico = datosAcademicosFormulario(previo);
    const esNuevoCiclo = datos.matriculas.some(m => m.id === actual.id) && $('guardarNuevoCiclo').checked;
    const ahora = new Date().toLocaleDateString('es-CO');
    if (esNuevoCiclo) {
      academico.historial = [
        ...(previo.historial || []),
        {fecha: ahora, ciclo: previo.ciclo || actual.periodo || '', nota: previo.nota || '', estado: previo.estado || actual.estado || '', matriculaId: actual.id}
      ];
    }
    const payload = {accion: 'guardarMatricula', id: esNuevoCiclo ? crypto.randomUUID() : actual.id, revision: esNuevoCiclo ? '' : actual.revision, cedula: $('estudiante').value};
    ['programa', 'periodo', 'jornada', 'estado'].forEach(k => payload[k] = $(k).value.trim());
    payload.cicloAcademico = academico.ciclo;
    payload.notaFinal = academico.nota;
    payload.estadoAcademico = academico.estado;
    payload.seguimientoAcademico = academico.seguimiento;
    payload.historialAcademico = academico.historial;
    payload.observaciones = armarObservaciones($('observaciones').value, academico);
    const controls = [...$('formulario').elements], disabled = controls.map(c => c.disabled);
    controls.forEach(c => c.disabled = true);
    $('error').textContent = 'Guardando...';
    try {
      const result = await api(payload);
      if (!result.matricula?.id) throw Error('El servidor no confirmó la matrícula. Actualiza el backend.');
      datos.matriculas = datos.matriculas.filter(m => m.id !== result.matricula.id);
      datos.matriculas.unshift(result.matricula);
      refrescar();
      $('editor').close();
      aviso('Matrícula guardada. ' + mensajePostGuardado(result), result.matricula.estado === 'Activa' && !result.correoEnviado && !/formato de n[uú]mero|number format|columna con texto/i.test(String(result.correoMensaje || '')));
    } catch (error) {
      $('error').textContent = error.message;
    } finally {
      ocupado = false;
      controls.forEach((c, i) => c.disabled = disabled[i]);
    }
  });
  $('formularioMasivo').addEventListener('submit', guardarMasivo);
  $('editor').addEventListener('cancel', event => { if (ocupado) event.preventDefault(); });
  $('masivo').addEventListener('cancel', event => { if (ocupado) event.preventDefault(); });
  $('cerrar').addEventListener('click', () => $('editor').close());
  $('cerrarMasivo').addEventListener('click', () => $('masivo').close());
  $('nueva').addEventListener('click', () => abrir(null));
  $('masiva').addEventListener('click', abrirMasivo);
  $('actualizar').addEventListener('click', cargar);
  $('seleccionarTodos').addEventListener('click', () => {
    $('listaMasiva').querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(c => c.checked = true);
    actualizarResumenMasivo();
  });
  ['buscar', 'filtroEstado', 'filtroPeriodo'].forEach(id => $(id).addEventListener('input', render));
  $('buscarMasivo').addEventListener('input', renderMasivo);
  $('periodoMasivo').addEventListener('input', renderMasivo);
  $('programaMasivo').addEventListener('change', renderMasivo);
  $('soloPrograma').addEventListener('change', renderMasivo);
  $('salir').addEventListener('click', () => { sessionStorage.removeItem('ifobeSesion'); window.location.replace('index.html'); });
  cargar();
})();
