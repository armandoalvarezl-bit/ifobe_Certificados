/* Campus conectado al expediente académico. Publicar junto con Code.gs. */
// Ejecutar para vincular también las inscripciones y notas existentes. No envía correos.
function sincronizarAcademicoGen10(){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{const resultado=g10SincronizarAcademico_();Logger.log(JSON.stringify(resultado));return resultado;}finally{lock.releaseLock();}
}
// Importa matrículas activas sin enviar correos ni modificar accesos retirados.
function g10ImportarMatriculas_(){
  const cursos=g10Lista_('Cursos'),usuarios=g10Lista_('Usuarios'),inscritos=g10Lista_('Inscritos');
  const alumnos=hojaAlumnosCompleta_().getDataRange().getDisplayValues().slice(1);
  const normalizar=function(x){return convertirTexto(x).trim().replace(/\s+/g,' ').toLowerCase();};
  const resultado={creadas:0,pendientes:[],estados:{}};
  const filas=getHoja('Matriculas',COLUMNAS_MATRICULAS_).getDataRange().getDisplayValues().slice(1).filter(function(r){return r[0];});
  filas.forEach(function(r){const estado=convertirTexto(r[8]).trim()||'Sin estado';resultado.estados[estado]=(resultado.estados[estado]||0)+1;});
  filas.filter(function(r){return convertirTexto(r[8]).trim()==='Activa';}).forEach(function(r){
    const matches=cursos.filter(function(c){return normalizar(c.titulo)===normalizar(r[5])&&(!c.estado||c.estado==='Activo');});
    if(matches.length!==1){resultado.pendientes.push(r[0]+': no hay un único curso activo con el nombre del programa.');return;}
    const curso=matches[0],fichas=alumnos.filter(function(a){return convertirTexto(a[0]).trim()===convertirTexto(r[3]).trim();});
    const email=fichas.length===1?normalizar(fichas[0][2]):'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){resultado.pendientes.push(r[0]+': revisa el correo en Alumnos.');return;}
    if(alumnos.some(function(a){return normalizar(a[2])===email&&convertirTexto(a[0]).trim()!==convertirTexto(r[3]).trim();})){resultado.pendientes.push(r[0]+': correo compartido por varios documentos.');return;}
    let usuario=usuarios.find(function(u){return u.email===email;});
    if(usuario&&(!usuario.activo||usuario.rol!=='estudiante'||(usuario.cedula&&usuario.cedula!==r[3]))){resultado.pendientes.push(r[0]+': revisa el acceso del usuario en Gen10.');return;}
    if(!usuario){usuario=g10Guardar_('Usuarios',{id:email,email:email,nombre:r[4]||fichas[0][1],cedula:r[3],rol:'estudiante',activo:true},0);usuarios.push(usuario);}
    if(inscritos.some(function(e){return e.curso===curso.id&&e.email===email;}))return;
    const item=g10Guardar_('Inscritos',{id:curso.id+':'+email,curso:curso.id,email:email,activo:true,matriculaId:r[0]},0);
    inscritos.push(item);resultado.creadas++;
  });
  return resultado;
}
function g10SincronizarAcademico_(){
  const importacion=g10ImportarMatriculas_();
  const alumnos=hojaAlumnosCompleta_(),matriculas=getHoja('Matriculas',COLUMNAS_MATRICULAS_);
  const usuarios=g10Lista_('Usuarios'),cursos=g10Lista_('Cursos'),tareas=g10Lista_('Tareas'),entregas=g10Lista_('Entregas');
  const resultado={creadas:0,actualizadas:importacion.creadas,pendientes:importacion.pendientes};
  // Comparte la oferta con inscripciones y certificaciones sin reactivar programas deshabilitados.
  const catalogo=getHoja('Programas',['Programa','Activo']);
  const conocidos=catalogo.getDataRange().getDisplayValues().slice(1).map(function(r){return convertirTexto(r[0]).trim();});
  cursos.filter(function(c){return c.publicado;}).forEach(function(c){
    const titulo=convertirTexto(c.titulo).trim();
    if(titulo&&conocidos.indexOf(titulo)<0){catalogo.appendRow([textoHoja_(titulo),'SI']);conocidos.push(titulo);resultado.actualizadas++;}
  });
  g10Lista_('Inscritos').filter(function(e){return e.activo;}).forEach(function(inscrito){
    const usuario=usuarios.find(function(u){return u.email===inscrito.email&&u.activo&&u.rol==='estudiante';});
    const curso=cursos.find(function(c){return c.id===inscrito.curso;});if(!usuario||!curso)return;
    const coincidencias=alumnos.getDataRange().getDisplayValues().slice(1).filter(function(r){return convertirTexto(r[2]).trim().toLowerCase()===usuario.email;});
    if(coincidencias.length>1){resultado.pendientes.push(usuario.email+': correo duplicado en Alumnos.');return;}
    let alumno=coincidencias[0],cedula=alumno?alumno[0]:usuario.cedula;
    if(alumno&&usuario.cedula&&usuario.cedula!==cedula){resultado.pendientes.push(usuario.email+': el documento no coincide con Alumnos.');return;}
    if(!cedula){resultado.pendientes.push(usuario.email+': completa su documento en Administración.');return;}
    if(!alumno){
      const f=buscarFilaAlumno(alumnos,cedula);
      if(f>0){const r=alumnos.getRange(f,1,1,5).getDisplayValues()[0];if(r[2].trim().toLowerCase()!==usuario.email){resultado.pendientes.push(usuario.email+': documento asociado a otro correo.');return;}alumno=r;}
      else{alumno=[cedula,usuario.nombre,usuario.email,curso.titulo,'Activo'];alumnos.getRange(alumnos.getLastRow()+1,1,1,5).setNumberFormat('@').setValues([alumno.map(textoHoja_)]);}
    }
    const periodo='Campus Gen10',rows=matriculas.getDataRange().getDisplayValues();
    let index=rows.findIndex(function(r,i){return i>0&&r[3]===cedula&&r[5]===curso.titulo&&r[6]===periodo&&r[8]!=='Cancelada';});
    const vinculos=libro_().getSheetByName('NotasGen10');
    const vinculo=vinculos&&vinculos.getDataRange().getDisplayValues().slice(1).find(function(r){return r[1]===curso.id&&r[2]===usuario.email;});
    if(vinculo){index=rows.findIndex(function(r,i){return i>0&&r[0]===vinculo[0]&&r[3]===cedula;});if(index>=0&&rows[index][8]==='Cancelada'){resultado.pendientes.push(usuario.email+': la matrícula vinculada está cancelada.');return;}}
    if(index<0){const candidatas=rows.map(function(r,i){return {r:r,i:i};}).filter(function(x){return x.i>0&&x.r[3]===cedula&&x.r[5]===curso.titulo&&x.r[8]!=='Cancelada';});if(candidatas.length===1)index=candidatas[0].i;else if(candidatas.length>1){resultado.pendientes.push(usuario.email+': varias matrículas del mismo curso; revisa el período.');return;}}
    const ahora=new Date().toISOString();
    if(index<0){const id='gen10-'+Utilities.getUuid();const row=[id,ahora,ahora,cedula,alumno[1],curso.titulo,periodo,'Flexible','Activa','Inscripción desde campus Gen10','Gen10','1','','',periodo,'','','','[]'];index=matriculas.getLastRow();matriculas.getRange(index+1,1,1,19).setValues([row.map(textoHoja_)]);resultado.creadas++;}
    const evaluaciones=tareas.filter(function(t){return t.curso===curso.id&&t.publicado;}).map(function(t){const e=entregas.find(function(e){return e.tarea===t.id&&e.email===usuario.email;});return {id:t.id,nombre:t.titulo,tipo:t.tipo==='examen'?'examen':'tarea',nota:e&&typeof e.nota==='number'&&Number.isFinite(e.nota)?e.nota:null,observacion:e?e.comentario||'':'',actualizada:e?e.actualizada||e.entregada:'',estado:e?(e.nota==null?'Por calificar':'Calificada'):'Sin entregar'};});
    const grupos=['tarea','examen'].map(function(tipo){const items=evaluaciones.filter(function(e){return e.tipo===tipo;}),calificadas=items.filter(function(e){return e.nota!==null;});return {total:items.length,calificadas:calificadas.length,promedio:calificadas.length?calificadas.reduce(function(a,e){return a+e.nota;},0)/calificadas.length:null};});
    const peso=curso.pesoTareas,parcial=Number.isInteger(peso)&&grupos.every(function(g){return g.promedio!==null;})?(grupos[0].promedio*peso+grupos[1].promedio*(100-peso))/100:null;
    const final=parcial!==null&&grupos.every(function(g){return g.total>0&&g.total===g.calificadas;})?parcial.toFixed(1):'';
    const vista=getHoja('NotasGen10',['Matricula ID','Curso ID','Correo','Evaluaciones','Parcial','Definitiva','Actualizada']);
    const registros=vista.getDataRange().getDisplayValues(),n=registros.findIndex(function(r,i){return i>0&&r[0]===matriculas.getRange(index+1,1).getDisplayValues()[0][0]&&r[1]===curso.id;});
    const mid=matriculas.getRange(index+1,1).getDisplayValues()[0][0],valores=[mid,curso.id,usuario.email,JSON.stringify(evaluaciones),parcial===null?'':parcial.toFixed(1),final];
    const m=matriculas.getRange(index+1,1,1,19).getDisplayValues()[0];
    let history;try{history=JSON.parse(m[18]||'[]');}catch(ignore){resultado.pendientes.push(usuario.email+': revisa el historial académico de la matrícula.');return;}
    if(!Array.isArray(history)){resultado.pendientes.push(usuario.email+': historial académico inválido.');return;}
    const lifecycle=history.filter(function(h){return h.tipo==='gen10EstadoCurso'&&h.curso===curso.id;}).slice(-1)[0];
    const estadoCurso=curso.estado||'Activo';
    if((estadoCurso==='Culminado'||lifecycle)&&(!lifecycle||lifecycle.estadoCurso!==estadoCurso)){
      history.push({tipo:'gen10EstadoCurso',curso:curso.id,estadoCurso:estadoCurso,fecha:ahora,usuario:curso.cerradoPor||'Gen10'});
      if(JSON.stringify(history).length>4000){resultado.pendientes.push(usuario.email+': historial académico sin espacio para registrar el cierre.');return;}
      m[2]=ahora;m[8]=estadoCurso==='Culminado'?'Finalizada':'Activa';m[11]=String((Number(m[11])||0)+1);m[15]=final;m[18]=JSON.stringify(history);
      matriculas.getRange(index+1,1,1,19).setValues([m.map(textoHoja_)]);resultado.actualizadas++;
    }
    if(n<0||JSON.stringify(registros[n].slice(0,6))!==JSON.stringify(valores)){vista.getRange(n<0?vista.getLastRow()+1:n+1,1,1,7).setNumberFormat('@').setValues([valores.concat([ahora]).map(textoHoja_)]);resultado.actualizadas++;}
  });return resultado;
}
function g10NotasAcademicas_(){
  const s=libro_().getSheetByName('NotasGen10');if(!s)return [];
  return s.getDataRange().getDisplayValues().slice(1).filter(function(r){return r[0];}).map(function(r){return {id:r[0],curso:r[1],email:r[2],evaluaciones:JSON.parse(r[3]),parcial:r[4],definitiva:r[5],actualizada:r[6]};});
}
const G10_TABLAS_ = ['Usuarios', 'Cursos', 'Inscritos', 'Lecciones', 'Tareas', 'Entregas', 'Progreso', 'Notificaciones', 'IntentosExamen', 'Foros', 'Soporte', 'Pagos'];
// Las columnas visibles son una vista del registro técnico, nunca otra fuente de datos.
function g10Columnas_(table) {
  const fields = {
    Pagos: [['titulo','Curso'],['docente','Docente'],['inscripciones','Inscripciones'],['valorUnitario','Valor por alumno'],['total','Total COP'],['nequi','Nequi'],['referencia','Referencia'],['estado','Estado'],['fecha','Fecha'],['validadoPor','Validado por'],['validadoEn','Fecha de validacion'],['observacion','Observacion'],['archivos','Comprobante']],
    Usuarios: [['nombre','Nombre'],['email','Correo de acceso'],['rol','Rol'],['activo','Acceso habilitado'],['credencial','Contraseña'],['creada','Cuenta creada'],['actualizada','Último cambio'],['cedula','Documento']],
    Cursos: [['titulo','Curso'],['docente','Correo del docente'],['publicado','Publicado'],['descripcion','Descripción'],['archivos','Materiales'],['creada','Creado'],['actualizada','Último cambio']],
    Inscritos: [['curso','ID del curso'],['email','Correo del estudiante'],['activo','Inscripción activa'],['creada','Inscrito desde'],['actualizada','Último cambio']],
    Lecciones: [['curso','ID del curso'],['orden','Orden'],['titulo','Lección'],['publicado','Publicada'],['contenido','Contenido'],['archivos','Materiales'],['actualizada','Último cambio']],
    Tareas: [['curso','ID del curso'],['titulo','Tarea'],['publicado','Publicada'],['fechaLimite','Fecha límite'],['contenido','Instrucciones'],['archivos','Materiales'],['actualizada','Último cambio']],
    Entregas: [['curso','ID del curso'],['tarea','ID de la tarea'],['email','Correo del estudiante'],['entregada','Fecha de entrega'],['nota','Nota (0 a 5)'],['comentario','Comentario docente'],['contenido','Respuesta'],['archivos','Archivos'],['actualizada','Último cambio']],
    Notificaciones: [['email','Destinatario'],['titulo','Aviso'],['mensaje','Detalle'],['leida','Leída'],['correoEstado','Estado del correo'],['creada','Fecha'],['correoDetalle','Error del correo']],
    IntentosExamen: [['curso','Curso'],['tarea','Examen'],['email','Estudiante'],['inicio','Inicio'],['vence','Fin del intento']],
    Foros: [['curso','Curso'],['titulo','Tema'],['nombre','Autor'],['contenido','Mensaje'],['padre','Conversacion']],
    Soporte: [['email','Solicitante'],['titulo','Asunto'],['nombre','Autor'],['contenido','Mensaje'],['padre','Solicitud'],['tipoPQRS','Tipo de PQRS'],['estado','Estado'],['prioridad','Prioridad']],
    Progreso: [['curso','ID del curso'],['leccion','ID de la lección'],['email','Correo del estudiante'],['creada','Completada desde'],['actualizada','Último cambio']]
  };
  return fields[table];
}
function g10FilaVisible_(table, item) {
  return g10Columnas_(table).map(function(field) {
    const key=field[0], value=item[key];
    if(key==='credencial')return value && value.hash ? 'Contraseña creada' : 'Pendiente de activación';
    if(typeof value==='boolean')return value?'Sí':'No';
    if(key==='archivos')return textoHoja_((value||[]).map(function(f){return f.nombre;}).join('\n'));
    return textoHoja_(value==null?'':String(value));
  });
}
function g10EstiloHoja_(sheet, columns, hidden) {
  sheet.getRange(1,1,1,columns).setBackground('#142d4e').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  sheet.setFrozenRows(1);sheet.setRowHeight(1,44);
  sheet.setColumnWidths(1,columns,190);
  if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,columns).setVerticalAlignment('top').setWrap(true);
  if(hidden){sheet.hideColumns(1,3);sheet.setColumnWidth(4,240);}
}
// Ejecutar para actualizar las vistas de registros existentes sin cambiar credenciales.
function organizarHojasGen10() {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{return g10OrganizarHojas_();}finally{lock.releaseLock();}
}
function g10OrganizarHojas_() {
  G10_TABLAS_.forEach(function(table){
    const sheet=g10Hoja_(table), columns=g10Columnas_(table), rows=sheet.getDataRange().getValues().slice(1);
    sheet.getRange(1,4,1,columns.length).setValues([columns.map(function(f){return f[1];})]);
    if(rows.length)sheet.getRange(2,4,rows.length,columns.length).setValues(rows.map(function(row){return row[0]?g10FilaVisible_(table,JSON.parse(row[1])):columns.map(function(){return '';});}));
    g10EstiloHoja_(sheet,columns.length+3,true);
    sheet.getRange(1,4).setNote('Vista de consulta. Edita los registros desde el portal Gen10. Las columnas Aâ€“C conservan los datos que lee el sistema.');
  });
  ['Inscripciones','Alumnos','Programas','Matriculas','Notas','Usuarios','Historial','EnviosDiplomas','EnviosWhatsApp'].forEach(function(name){
    const sheet=libro_().getSheetByName(name);if(sheet&&sheet.getLastColumn())g10EstiloHoja_(sheet,sheet.getLastColumn(),false);
  });
  const guide=getHoja('GuiaGen10',['Sección','Qué contiene','Cómo se actualiza']);
  const info=[
    ['Gen10Usuarios','Nombre, correo, rol, acceso y estado de contraseña de alumnos, docentes y administrador.','Administración del portal habilita el acceso. Cada persona crea su contraseña mediante el código recibido.'],
    ['Contraseñas Gen10','Se guardan en Gen10Usuarios, columna B (Datos), campo credencial: hash, salt, algoritmo e iteraciones. A–C están ocultas para facilitar la lectura.','El login compara la huella de la contraseña ingresada. No se guarda ni se puede consultar la contraseña original. Usa Olvidé mi contraseña para cambiarla.'],
    ['Pendiente de activación','La cuenta está habilitada pero todavía no tiene contraseña guardada.','Activa la cuenta desde Gen10. Si ya lo hiciste, verifica que la web apunte a la implementación actual y al mismo libro.'],
    ['Gen10Cursos / Gen10Lecciones / Gen10Tareas','Cursos, contenidos, fechas y materiales publicados o en borrador.','Desde los cursos del portal.'],
    ['Gen10Inscritos / Gen10Entregas / Gen10Progreso','Accesos a cursos, respuestas, calificaciones y lecciones completadas.','Desde el portal según el rol de cada persona.'],
    ['Usuarios (sin Gen10)','Acceso al panel anterior de certificados. Es independiente del campus.','No copies aquí las contraseñas de Gen10.'],
    ['Columnas visibles','Vista de consulta que se actualiza al guardar en el portal.','No edites estas copias en Sheets: el sistema lee el registro técnico de A–C.'],
    ['Otras hojas','Inscripciones, matrículas, notas, alumnos e historial del sistema académico.','Conservan sus columnas originales y sus registros.'],
    ['Actualizar presentación','Ejecuta organizarHojasGen10 para regenerar esta vista.','No borra registros, no cambia contraseñas ni envía correos.']
  ];
  guide.getRange(2,1,info.length,3).setValues(info);g10EstiloHoja_(guide,3,false);guide.setColumnWidth(1,260);guide.setColumnWidths(2,2,440);
  return 'Hojas Gen10 organizadas. Contraseñas y registros conservados. Consulta el estado de activación en Gen10Usuarios.';
}

// Ejecutar desde el editor de Apps Script, vinculado a la hoja institucional.
// Prepara el almacenamiento; no envía correos ni habilita alumnos automáticamente.
function configurarTodaLaPlataforma() {
  configurarBaseDatos();
  getHojaUsuarios();
  getHojaHistorial();
  getHoja('Notas', COLUMNAS_NOTAS_);
  configurarPortalGen10();
  organizarHojasGen10();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const folderId = props.getProperty('GEN10_FILES_FOLDER_ID');
    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder('IFOBE - Archivos privados Gen10');
    if (!folderId) props.setProperty('GEN10_FILES_FOLDER_ID', folder.getId());
    const result = {
      hoja: libro_().getUrl(),
      documentos: DriveApp.getFolderById(props.getProperty('DOCUMENTS_FOLDER_ID')).getUrl(),
      archivosCampus: folder.getUrl(),
      administradorCampus: (props.getProperty('GEN10_ADMIN_EMAIL') || '').trim() || 'institutoifobe@gmail.com',
      mensaje: 'Configuración completa. Se conservaron los registros existentes. Publica una nueva versión y usa su enlace /exec en inscripcion-config.js para todas las páginas. Habilita estudiantes y docentes desde Administración en Gen10.'
    };
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally { lock.releaseLock(); }
}

function g10Texto_(value, max, required) {
  if (typeof value !== 'string') throw Error('Revisa los campos del formulario.');
  const text = value.trim();
  if ((required && !text) || text.length > max) throw Error('Hay un campo vacío o demasiado largo.');
  return text;
}
function g10Email_(value) {
  const email = g10Texto_(value, 150, true).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) throw Error('Escribe un correo válido.');
  return email;
}
function g10Url_(value) {
  const url = g10Texto_(value || '', 2000, false);
  if (url && !/^https:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i.test(url)) throw Error('El enlace debe empezar por https:// y no contener espacios.');
  return url;
}
function g10Hoja_(table) {
  if (G10_TABLAS_.indexOf(table) < 0) throw Error('Tabla inválida.');
  const sheet = libro_().getSheetByName('Gen10' + table);
  if (!sheet) throw Error('Administración debe ejecutar configurarPortalGen10 antes de usar el portal.');
  return sheet;
}
function g10Lista_(table) {
  return g10Hoja_(table).getDataRange().getValues().slice(1).filter(function(row) { return row[0]; }).map(function(row) {
    try { return JSON.parse(row[1]); } catch (_) { throw Error('Hay un registro dañado en Gen10' + table + '. Contacta a administración.'); }
  });
}
function g10Guardar_(table, item, expected) {
  const sheet = g10Hoja_(table), rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(function(row, i) { return i > 0 && String(row[0]) === item.id; });
  const old = index < 0 ? null : JSON.parse(rows[index][1]);
  if ((old ? old.revision : 0) !== expected) throw Error('Este registro cambió. Actualiza el portal antes de volver a guardar.');
  const now = new Date().toISOString();
  const saved = Object.assign({}, item, {revision: expected + 1, creada: old ? old.creada : now, actualizada: now});
  if (JSON.stringify(saved).length > 45000) throw Error('El contenido supera el tamaño permitido. Reduce el texto o enlaza un documento.');
  const row = [saved.id, JSON.stringify(saved), now].concat(g10FilaVisible_(table,saved));
  if (index < 0) sheet.appendRow(row);
  else sheet.getRange(index + 1, 1, 1, row.length).setValues([row]);
  return saved;
}
function configurarPortalGen10() {
  const configurado = (PropertiesService.getScriptProperties().getProperty('GEN10_ADMIN_EMAIL') || '').trim();
  const email = g10Email_(configurado || 'institutoifobe@gmail.com');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    G10_TABLAS_.forEach(function(table) { getHoja('Gen10' + table, ['ID', 'Datos', 'Actualizado'].concat(g10Columnas_(table).map(function(f){return f[1];}))); });
    const users = g10Lista_('Usuarios');
    if (!users.some(function(u) { return u.rol === 'admin' && u.activo; })) {
      g10Guardar_('Usuarios', {id: email, nombre: 'Administración Gen10', email: email, rol: 'admin', activo: true}, 0);
    }
    return 'Portal preparado. Accede a gen10.html con el correo administrador configurado.';
  } finally { lock.releaseLock(); }
}
function g10Hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function(b) {
    return ('0' + (b & 255).toString(16)).slice(-2);
  }).join('');
}
function g10Usuario_(email) {
  const user = g10Lista_('Usuarios').find(function(u) { return u.email === email && u.activo === true; });
  if (!user || ['admin', 'docente', 'estudiante'].indexOf(user.rol) < 0) throw Error('Tu acceso no está activo. Contacta a administración.');
  return user;
}
function g10Publico_(user) {
  return {id:user.id, email:user.email, nombre:user.nombre, rol:user.rol, activo:user.activo,
    cedula:user.cedula||'', tienePassword:!!user.credencial, revision:user.revision, creada:user.creada, actualizada:user.actualizada};
}
function g10Password_(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw Error('La contraseña debe tener entre 12 y 128 caracteres.');
  return password;
}
function g10Derivar_(password, salt) {
  return sjcl.codec.hex.fromBits(sjcl.misc.pbkdf2(password, salt, 600000, 256));
}
function g10CredencialAdmin_(password) {
  const salt=Utilities.getUuid()+Utilities.getUuid();
  return {algoritmo:'pbkdf2-sha256',iteraciones:600000,salt:salt,hash:g10Derivar_(g10Password_(password),salt)};
}
function g10CampusUrl_(d) {
  const url=PropertiesService.getScriptProperties().getProperty('GEN10_CAMPUS_URL')||d.campusUrl||'';
  if(!/^https:\/\/[^\s<>"']+\/gen10\.html(?:[?#][^\s<>"']*)?$/.test(url))throw Error('Configura GEN10_CAMPUS_URL con el enlace público HTTPS de gen10.html.');
  return url;
}
function g10CorreoCredenciales_(user,password,url,curso) {
  // La contraseña solo existe durante esta petición; nunca se guarda en avisos ni registros.
  let aviso,started=false;
  try {
    aviso=g10Guardar_('Notificaciones',{id:'credenciales:'+user.credencial.salt,email:user.email,curso:curso?curso.id:'',titulo:'Credenciales de acceso',mensaje:'Administración preparó tu acceso. Revisa tu correo para consultar las credenciales e instrucciones.',leida:false,correoEstado:'No enviado'},0);
    if(MailApp.getRemainingDailyQuota()<1)throw Error('Cuota de correo agotada');
    const details=[['Correo de acceso',user.email],['Contraseña',password],['Campus',url]];
    if(curso)details.unshift(['Curso',curso.titulo]);
    const mail=mensajeAcademico_(user.email,'Tu acceso a Gen10 está listo','Hola, '+user.nombre+'. Administración ha preparado tu acceso al campus.',details,'Abre el enlace del campus e ingresa con tu correo y contraseña. Completa Mi perfil y, en Mis cursos, revisa las lecciones, tareas, exámenes y fechas de entrega. Consulta tus calificaciones en Notas y avance. Conserva tus credenciales en privado. Para cambiar la contraseña, utiliza Olvidé mi contraseña en la pantalla de acceso. Si necesitas ayuda, responde a este correo.');
    mail.name='Campus Gen10 · IFOBE';mail.subject='Gen10 | Credenciales e instrucciones de acceso';
    aviso=g10Guardar_('Notificaciones',Object.assign({},aviso,{correoEstado:'Enviando'}),aviso.revision);started=true;
    MailApp.sendEmail(mail);
    g10Guardar_('Notificaciones',Object.assign({},aviso,{correoEstado:'Enviado'}),aviso.revision);
    return 'Guardado. Se enviaron las credenciales e instrucciones al correo del usuario.';
  }catch(error){
    try{if(aviso)g10Guardar_('Notificaciones',Object.assign({},aviso,{correoEstado:started?'Por verificar':'No enviado',correoDetalle:started?'Revisar la entrega del correo antes de generar nuevas credenciales.':'No fue posible enviar el correo; establece una nueva contraseña y vuelve a enviarlo.'}),aviso.revision);}catch(ignore){}
    return 'Acceso guardado; el correo de credenciales requiere revisión. No se reenvía automáticamente para evitar duplicados. Administración puede establecer una nueva contraseña y enviar otro correo.';
  }
}
function g10NuevaSesion_(user) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('gen10:sesion:' + token,
    JSON.stringify({email:user.email, version:user.credencial ? user.credencial.salt : ''}), 21600);
  return {token:token, usuario:g10Publico_(user), autenticacion:'password-v1'};
}
function g10Login_(d) {
  const email = g10Email_(d.email), cache = CacheService.getScriptCache();
  const key = 'gen10:login:' + g10Hash_(email), globalKey = 'gen10:login:global:' + Math.floor(Date.now()/900000);
  const attempts = Number(cache.get(key) || 0), total = Number(cache.get(globalKey) || 0);
  if (attempts >= 5 || total >= 120) throw Error('Demasiados intentos. Espera 15 minutos e intenta de nuevo.');
  cache.put(key, String(attempts + 1), 900);
  cache.put(globalKey, String(total + 1), 900);
  const password = g10Password_(d.password);
  let user;
  try { user = g10Usuario_(email); } catch (_) {}
  const credential = user && user.credencial;
  const salt = credential ? credential.salt : 'gen10-cuenta-no-disponible';
  const hash = g10Derivar_(password, salt);
  if (!credential || credential.hash !== hash) throw Error('Correo o contraseña incorrectos. Si es tu primer ingreso, activa tu cuenta.');
  cache.remove(key);
  return g10NuevaSesion_(user);
}
function g10SolicitarCodigo_(d) {
  const email = g10Email_(d.email), cache = CacheService.getScriptCache(), key = 'gen10:codigo:' + g10Hash_(email);
  const message = 'Si tu correo tiene acceso activo, recibirás un código válido durante 10 minutos. Revisa también spam.';
  const old = JSON.parse(cache.get(key) || 'null');
  if (old && Date.now() - old.enviado < 60000) return {mensaje: message};
  // Se limita también el total de solicitudes para proteger la cuota de correo institucional.
  const hourKey = 'gen10:correo:' + Math.floor(Date.now() / 3600000);
  const count = Number(cache.get(hourKey) || 0);
  if (count >= 60) throw Error('Se alcanzó el límite temporal de accesos. Intenta más tarde.');
  cache.put(hourKey, String(count + 1), 3600);
  cache.put(key, JSON.stringify({enviado: Date.now(), intentos: 5, hash: ''}), 600);
  let user;
  try { user = g10Usuario_(email); } catch (_) { return {mensaje: message}; }
  const purpose = d.proposito === 'recuperar' ? 'recuperar' : 'activar';
  if (purpose === 'activar' && user.credencial) return {mensaje: message};
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  const record = {enviado: Date.now(), intentos: 0, hash: g10Hash_(email + ':' + code), proposito:purpose, version:user.credencial ? user.credencial.salt : ''};
  cache.put(key, JSON.stringify(record), 600);
  try {
    MailApp.sendEmail({to: email, subject: (purpose === 'recuperar' ? 'Recuperar contraseña' : 'Activar cuenta') + ' · Gen10 IFOBE', name: 'Gen10 IFOBE',
      body: 'Hola, ' + user.nombre + '.\n\nTu código de acceso es: ' + code + '\n\nÚsalo para ' + (purpose === 'recuperar' ? 'restablecer' : 'crear') + ' tu contraseña. Después ingresarás con correo y contraseña. Vence en 10 minutos y solo se puede usar una vez. No lo compartas. Si no solicitaste este cambio, ignora este mensaje.'});
  } catch (error) {
    cache.remove(key);
    PropertiesService.getScriptProperties().setProperty('GEN10_ULTIMO_ERROR_CORREO', JSON.stringify({fecha:new Date().toISOString(),tipo:'Código de acceso',detalle:String(error.message||error).slice(0,500)}));
    throw Error('No pudimos enviar el código. Administración debe ejecutar diagnosticarCorreosGen10 en Apps Script.');
  }
  return {mensaje: message};
}
// Ejecutar desde el editor: consulta el servicio y los errores sin enviar correos.
function diagnosticarCorreosGen10() {
  const resultado={cuentaEjecutora:Session.getEffectiveUser().getEmail(),cuotaDisponible:null,ultimoErrorCodigo:PropertiesService.getScriptProperties().getProperty('GEN10_ULTIMO_ERROR_CORREO')||'',estados:{},errores:[]};
  try{resultado.cuotaDisponible=MailApp.getRemainingDailyQuota();}catch(error){resultado.errorServicio=String(error.message||error);}
  try{
    g10Lista_('Notificaciones').forEach(function(n){
      const estado=n.correoEstado||'Sin estado';resultado.estados[estado]=(resultado.estados[estado]||0)+1;
      if(n.correoDetalle)resultado.errores.push({fecha:n.actualizada,estado:estado,detalle:n.correoDetalle});
    });
    resultado.errores=resultado.errores.slice(-20);
  }catch(error){resultado.errorRegistros=String(error.message||error);}
  Logger.log(JSON.stringify(resultado,null,2));return resultado;
}
function g10VerificarCodigo_(d) {
  const email = g10Email_(d.email), cache = CacheService.getScriptCache(), key = 'gen10:codigo:' + g10Hash_(email);
  const record = JSON.parse(cache.get(key) || 'null');
  if (!record || record.intentos >= 5 || Date.now() - record.enviado >= 600000) throw Error('Código inválido o vencido. Solicita uno nuevo.');
  record.intentos++;
  const remaining = Math.max(1, Math.floor((600000 - (Date.now() - record.enviado)) / 1000));
  cache.put(key, JSON.stringify(record), remaining);
  if (typeof d.codigo !== 'string' || record.hash !== g10Hash_(email + ':' + d.codigo.trim().toUpperCase())) throw Error('Código inválido o vencido. Solicita uno nuevo.');
  const user = g10Usuario_(email);
  const password = g10Password_(d.password);
  if (!record.proposito || record.version !== (user.credencial ? user.credencial.salt : '') || (record.proposito === 'activar' && user.credencial)) throw Error('Código inválido o vencido. Solicita uno nuevo.');
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const saved = g10Guardar_('Usuarios', Object.assign({}, user, {credencial:{algoritmo:'pbkdf2-sha256', iteraciones:600000, salt:salt, hash:g10Derivar_(password, salt)}}), user.revision);
  cache.remove(key);
  cache.remove('gen10:login:' + g10Hash_(email));
  return g10NuevaSesion_(saved);
}
function g10Sesion_(token) {
  if (typeof token !== 'string' || token.length > 100) throw Error('La sesión venció. Vuelve a ingresar.');
  let session;
  try { session = JSON.parse(CacheService.getScriptCache().get('gen10:sesion:' + token) || 'null'); } catch (_) {}
  if (!session || !session.email) throw Error('La sesión venció. Vuelve a ingresar.');
  const user = g10Usuario_(session.email);
  if (session.version !== (user.credencial ? user.credencial.salt : '')) throw Error('La sesión venció. Vuelve a ingresar.');
  return user;
}
function g10PagoAprobado_(memberId) {
  return g10Lista_('Pagos').some(function(p){return p.estado==='Aprobado' && (p.inscripciones||[]).indexOf(memberId)>=0;});
}
function g10Curso_(user, id, editing) {
  const course = g10Lista_('Cursos').find(function(c) { return c.id === id; });
  if (!course) throw Error('Curso no disponible.');
  if (user.rol === 'admin' || (user.rol === 'docente' && course.docente === user.email)) return course;
  if (!editing && user.rol === 'estudiante' && course.publicado && g10Lista_('Inscritos').some(function(e) { return e.curso === id && e.email === user.email && e.activo && g10PagoAprobado_(e.id); })) return course;
  throw Error('No tienes permiso para acceder a este curso.');
}
function g10FichaCurso_(valor,id) {
  const courses=g10Lista_('Cursos');
  let ficha=String(valor||'').trim().toUpperCase();
  if(ficha&&!/^\d{2}V\d{5}$/.test(ficha))throw Error('La ficha debe tener el formato 26V53337.');
  if(!ficha){
    const prefix=String(new Date().getFullYear()).slice(-2)+'V';
    let number=10000;
    while(courses.some(function(c){return c.ficha===prefix+number;}))number++;
    if(number>99999)throw Error('No quedan fichas disponibles para este año.');
    ficha=prefix+number;
  }
  if(courses.some(function(c){return c.id!==id&&c.ficha===ficha;}))throw Error('Esta ficha ya pertenece a otro curso.');
  return ficha;
}
function g10CompletarFichas_() {
  g10Lista_('Cursos').filter(function(c){return !c.ficha;}).forEach(function(c){
    g10Guardar_('Cursos',Object.assign({},c,{ficha:g10FichaCurso_('',c.id)}),c.revision);
  });
}
function g10Estado_(user) {
  g10CompletarFichas_();
  const members = g10Lista_('Inscritos'), allCourses = g10Lista_('Cursos');
  const courses = allCourses.filter(function(c) {
    return user.rol === 'admin' || (user.rol === 'docente' ? c.docente === user.email : c.publicado && members.some(function(e) { return e.curso === c.id && e.email === user.email && e.activo && g10PagoAprobado_(e.id); }));
  });
  const ids = courses.map(function(c) { return c.id; });
  const isStudent = user.rol === 'estudiante';
  const scoped = function(table) { return g10Lista_(table).filter(function(r) { return ids.indexOf(r.curso) >= 0; }); };
  const lessons = scoped('Lecciones').filter(function(r) { return !isStudent || r.publicado; });
  const tasks = scoped('Tareas').filter(function(r) { return !isStudent || r.publicado; }).map(function(t) {
    if (!isStudent || t.tipo !== 'examen') return t;
    return Object.assign({}, t, {preguntas:(t.preguntas || []).map(function(p) { return {enunciado:p.enunciado,opciones:p.opciones}; })});
  });
  const taskIds = tasks.map(function(t) { return t.id; }), lessonIds = lessons.map(function(l) { return l.id; });
  const visibleMembers = members.filter(function(e) { return ids.indexOf(e.curso) >= 0 && (!isStudent || e.email === user.email); });
  const emails = visibleMembers.map(function(e) { return e.email; });
  const users = isStudent ? [] : g10Lista_('Usuarios').filter(function(u) { return user.rol === 'admin' || emails.indexOf(u.email) >= 0; });
  const perfil=function(u){return Object.assign(g10Publico_(u),{telefono:u.telefono||'',direccion:u.direccion||'',ciudad:u.ciudad||'',contactoEmergencia:u.contactoEmergencia||'',archivos:u.archivos||[]});};
  const historialAcademico=isStudent?members.filter(function(m){return m.email===user.email&&(!m.activo||allCourses.some(function(c){return c.id===m.curso&&['Cerrado','Culminado'].indexOf(c.estado)>=0;}));}).map(function(m){
    const c=allCourses.find(function(c){return c.id===m.curso;});
    const notas=m.activo?g10NotasAcademicas_().find(function(n){return n.curso===m.curso&&n.email===user.email;}):m.archivoNotas;
    return {id:m.id,curso:m.curso,titulo:notas&&notas.titulo||c&&c.titulo||'Curso',estado:m.activo?c.estado:'Archivado',notas:notas||null,certificado:m.certificado||null,archivos:m.certificado?(m.archivos||[]):[]};
  }):[];
  const pagos=g10Lista_('Pagos').filter(function(p){return user.rol==='admin'||(user.rol==='docente'&&p.docente===user.email);});
  const accesoPendiente=isStudent?members.filter(function(m){return m.email===user.email&&m.activo&&!g10PagoAprobado_(m.id);}).map(function(m){const c=allCourses.find(function(c){return c.id===m.curso;});return {titulo:c?c.titulo:'Curso',estado:'Pendiente de pago y validacion del docente'};}):[];
  const inscripcionesPagadas=isStudent?[]:visibleMembers.filter(function(m){return g10PagoAprobado_(m.id);}).map(function(m){return m.id;});
  return {pagos:pagos,accesoPendiente:accesoPendiente,inscripcionesPagadas:inscripcionesPagadas,mantenimiento:user.rol==='admin'?g10Mantenimiento_():undefined,foros:scoped('Foros'),soporte:g10Lista_('Soporte').filter(function(r){return user.rol==='admin'||r.email===user.email;}),historialAcademico:historialAcademico.filter(function(m){return g10PagoAprobado_(m.id);}),documentosRequeridos:G10_DOCUMENTOS_REQUERIDOS_,
    perfil:Object.assign(g10Publico_(user),{fotoPerfil:user.fotoPerfil||'',telefono:user.telefono||'',direccion:user.direccion||'',ciudad:user.ciudad||'',contactoEmergencia:user.contactoEmergencia||''}),expediente:isStudent?perfil(user):null,expedientes:user.rol==='admin'?users.filter(function(u){return u.rol==='estudiante';}).map(perfil):[],notificaciones:g10AvisosVigentes_(user), evaluaciones:'gen10-examenes-v1', limitesExamen:true, intentosExamen:scoped('IntentosExamen').filter(function(a){return !isStudent || (a.email===user.email && taskIds.indexOf(a.tarea)>=0);}), usuario: g10Publico_(user), cursos: courses, inscritos: visibleMembers, lecciones: lessons, tareas: tasks,
    entregas: scoped('Entregas').filter(function(e) { return !isStudent || (e.email === user.email && taskIds.indexOf(e.tarea) >= 0); }),
    progreso: scoped('Progreso').filter(function(p) { return !isStudent || (p.email === user.email && lessonIds.indexOf(p.leccion) >= 0); }), usuarios: users.map(g10Publico_)};
}
function g10Id_(d) {
  const id = g10Texto_(d.id, 80, true);
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error('Identificador inválido.');
  return id;
}
function g10Revision_(d) {
  if (!Number.isInteger(d.revision) || d.revision < 0) throw Error('Actualiza la página e intenta de nuevo.');
  return d.revision;
}
function g10Mutar_(user, d) {
  if(d.accion==='gen10RegistrarPago'){
    if(user.rol!=='docente')throw Error('El comprobante debe registrarlo el docente responsable.');
    const course=g10Curso_(user,d.curso,true),id=g10Id_(d);
    if(g10Lista_('Pagos').some(function(p){return p.id===id;}))throw Error('Este pago ya fue registrado. Actualiza la pagina.');
    const ids=d.inscripciones;
    if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(function(id,i){return typeof id!=='string'||ids.indexOf(id)!==i;}))throw Error('Selecciona entre 1 y 500 inscripciones diferentes.');
    const members=g10Lista_('Inscritos'),pagos=g10Lista_('Pagos');
    ids.forEach(function(id){
      if(!members.some(function(m){return m.id===id&&m.curso===course.id&&m.activo;}))throw Error('Selecciona alumnos activos de este curso.');
      if(pagos.some(function(p){return ['Pendiente','Aprobado'].indexOf(p.estado)>=0&&(p.inscripciones||[]).indexOf(id)>=0;}))throw Error('Un alumno ya tiene un pago aprobado o en revision.');
    });
    if(!Array.isArray(d.archivos)||d.archivos.length!==1||d.archivos[0].id||!(/\.(pdf|png|jpe?g)$/i).test(d.archivos[0].nombre||''))throw Error('Adjunta un comprobante nuevo en PDF, JPG o PNG.');
    return g10GuardarArchivos_('Pagos',{id:id,curso:course.id,titulo:course.titulo,docente:user.email,inscripciones:ids,valorUnitario:5000,total:ids.length*5000,nequi:'3127947484',referencia:g10Texto_(d.referencia,120,true),estado:'Pendiente',fecha:new Date().toISOString()},Object.assign({},d,{revision:0}),null);
  }
  if(d.accion==='gen10ValidarPago'){
    if(user.rol!=='admin')throw Error('Solo administracion puede validar pagos.');
    const pago=g10Lista_('Pagos').find(function(p){return p.id===d.id;});
    if(!pago||pago.estado!=='Pendiente')throw Error('El pago ya fue revisado o no existe.');
    if(['Aprobado','Rechazado'].indexOf(d.estado)<0)throw Error('Estado de pago invalido.');
    const observacion=g10Texto_(d.observacion,1000,d.estado==='Rechazado');
    return g10Guardar_('Pagos',Object.assign({},pago,{estado:d.estado,observacion:observacion,validadoPor:user.email,validadoEn:new Date().toISOString()}),g10Revision_(d));
  }
  if(d.accion==='gen10SeguimientoPQRS') {
    if(user.rol!=='admin')throw Error('Solo administraci\u00f3n puede gestionar las PQRS.');
    const ticket=g10Lista_('Soporte').find(function(r){return r.id===d.id&&!r.padre;});
    if(!ticket)throw Error('Solicitud no disponible.');
    if(['Recibida','En revisi\u00f3n','En espera del estudiante','Resuelta','Cerrada'].indexOf(d.estado)<0)throw Error('Estado inv\u00e1lido.');
    const detalle=g10Texto_(d.detalle,2000,true),historial=(ticket.historial||[]).concat([{fecha:new Date().toISOString(),estado:d.estado,detalle:detalle,nombre:user.nombre}]);
    return g10Guardar_('Soporte',Object.assign({},ticket,{estado:d.estado,historial:historial}),d.revision);
  }
  if(d.accion==='gen10PublicarComunidad') {
    if(['foro','soporte'].indexOf(d.tipo)<0)throw Error('Tipo inválido.');
    const support=d.tipo==='soporte',table=support?'Soporte':'Foros';
    const parent=d.padre?g10Lista_(table).find(function(r){return r.id===d.padre&&!r.padre;}):null;
    if(d.padre&&!parent)throw Error('Conversación no disponible.');
    if(support&&parent&&parent.estado==='Cerrada')throw Error('Este caso est\u00e1 cerrado y no admite nuevas respuestas.');
    const course=support?null:g10Curso_(user,d.curso,false);
    if(course&&course.estado&&course.estado!=='Activo')throw Error('El foro está disponible solo para consulta.');
    if(parent&&(support?(user.rol!=='admin'&&parent.email!==user.email):parent.curso!==course.id))throw Error('No tienes acceso a esta conversaci?n.');
    const id=g10Id_(d);
    if(g10Lista_(table).some(function(r){return r.id===id;}))throw Error('El mensaje ya fue enviado. Actualiza el campus.');
    const detalles={};
    if(support&&!parent){
      const tipo=d.tipoPQRS||'Petici\u00f3n';
      if(['Petici\u00f3n','Queja','Reclamo','Sugerencia'].indexOf(tipo)<0)throw Error('Tipo de PQRS inv\u00e1lido.');
      detalles.tipoPQRS=tipo;detalles.estado='Recibida';detalles.historial=[{fecha:new Date().toISOString(),estado:'Recibida',detalle:'Solicitud registrada.',nombre:user.nombre}];
    }
    if(support&&!parent&&d.categoria!==undefined){
      if(['Acceso','Cursos','Tareas y examenes','Notas y certificados','Archivos','Otro'].indexOf(d.categoria)<0||['Normal','Alta','Urgente'].indexOf(d.prioridad)<0)throw Error('Revisa categoria y prioridad.');
      detalles.categoria=d.categoria;detalles.prioridad=d.prioridad;
      const related=d.cursoRelacionado&&d.cursoRelacionado!=='general'?g10Curso_(user,d.cursoRelacionado,false):null;
      detalles.cursoRelacionado=related?related.id:'';detalles.cursoTitulo=related?related.titulo:'';
      ['dispositivo','pasos','esperado','errorDetalle'].forEach(function(k){detalles[k]=g10Texto_(d[k],k==='pasos'?2000:k==='dispositivo'?200:1000,false);});
    }
    return g10GuardarArchivos_(table,Object.assign(detalles,{id:id,curso:course?course.id:'',padre:parent?parent.id:'',email:parent&&support?parent.email:user.email,autor:user.email,nombre:user.nombre,titulo:parent?'':g10Texto_(d.titulo,140,true),contenido:g10Texto_(d.contenido,4000,true)}),Object.assign({},d,{revision:0}),null);
  }

  if(d.accion==='gen10PublicarCertificado'){
    if(user.rol!=='admin')throw Error('Solo administración puede publicar certificados firmados.');
    const member=g10Lista_('Inscritos').find(function(m){return m.id===d.id;});
    if(!member)throw Error('Inscripción no disponible.');
    if(!g10PagoAprobado_(member.id))throw Error('Primero aprueba el pago de esta inscripcion.');
    const course=g10Curso_(user,member.curso,true);
    const sync=member.activo?g10SincronizarAcademico_():null;
    const notes=(!member.activo&&member.archivoNotas)||g10NotasAcademicas_().find(function(n){return n.curso===member.curso&&n.email===member.email;});
    const state=course.estado;
    if(['Cerrado','Culminado'].indexOf(state)<0)throw Error('No se puede publicar el certificado: el estado del curso es '+(state||'desconocido')+'. Debe estar Cerrado o Culminado.');
    const pending=sync&&sync.pendientes.filter(function(p){return p.indexOf(member.email+':')===0;});
    if(pending&&pending.length)throw Error('No se pudo vincular la nota del estudiante: '+pending.join(' '));
    if(!notes)throw Error('No se encontró la nota en el expediente académico del estudiante. Revisa su documento y la vinculación con Alumnos.');
    if(notes.definitiva===''||!Number.isFinite(Number(notes.definitiva))){
      const evaluations=notes.evaluaciones||[],missing=evaluations.filter(function(e){return e.nota===null||e.nota===undefined;}).map(function(e){return e.nombre;});
      throw Error('La nota definitiva está pendiente. Promedio parcial: '+(notes.parcial||'sin calcular')+'. '+(missing.length?'Evaluaciones pendientes: '+missing.join(', ')+'.':'Revisa los porcentajes del curso y que existan tareas y exámenes publicados y calificados.'));
    }
    if(Number(notes.definitiva)<3)throw Error('La nota definitiva es '+notes.definitiva+'. La mínima para certificar es 3.0.');
    const docente=g10Texto_(d.docente,120,true),coordinadora=g10Texto_(d.coordinadora,120,true);
    if(d.firmasConfirmadas!==true)throw Error('Confirma que el PDF contiene ambas firmas autorizadas.');
    if(!Array.isArray(d.archivos)||d.archivos.length!==1||!d.archivos[0]||typeof d.archivos[0].nombre!=='string'||!(/\.pdf$/i).test(d.archivos[0].nombre)||d.archivos[0].id)throw Error('Sube un único certificado PDF firmado.');
    const certificado={docente:docente,coordinadora:coordinadora,nota:notes.definitiva,titulo:notes.titulo||course.titulo,emitido:new Date().toISOString(),publicadoPor:user.email};
    return g10GuardarArchivos_('Inscritos',Object.assign({},member,{certificado:certificado}),d,member);
  }
  const action = d.accion;
  if(action==='gen10GuardarDatosUsuario') {
    // La identidad procede de la sesión; nunca de un correo o ID recibido.
    const item=Object.assign({},user,{nombre:g10Texto_(d.nombre,120,true)});
    if(d.fotoPerfil!==undefined){
      if(typeof d.fotoPerfil!=='string'||d.fotoPerfil.length>30000||(d.fotoPerfil&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.fotoPerfil)))throw Error('La foto de perfil no es válida. Selecciona otra imagen.');
      if(d.fotoPerfil){const bytes=Utilities.base64Decode(d.fotoPerfil.split(',')[1]);if(bytes.length<4||(bytes[0]&255)!==255||(bytes[1]&255)!==216||(bytes[2]&255)!==255)throw Error('La foto debe ser una imagen JPEG.');}
      item.fotoPerfil=d.fotoPerfil;
    }
    ['telefono','direccion','ciudad','contactoEmergencia'].forEach(function(k){item[k]=g10Texto_(d[k]||'',k==='direccion'?300:120,false);});
    return g10Publico_(g10Guardar_('Usuarios',item,g10Revision_(d)));
  }
  if(action==='gen10ReutilizarCurso') {
    if(user.rol!=='admin')throw Error('Solo administración puede preparar otro grupo.');
    const source=g10Curso_(user,g10Id_(d),true);
    if(source.revision!==g10Revision_(d))throw Error('El curso cambió. Actualiza el portal.');
    const titulo=g10Texto_(d.titulo,140,true),id=g10Texto_(d.nuevoId,80,true);
    if(!/^[a-zA-Z0-9-]{16,80}$/.test(id)||id===source.id)throw Error('Identificador de nueva edición inválido.');
    const existing=g10Lista_('Cursos').find(function(c){return c.id===id;});
    if(existing&&existing.cursoOrigen!==source.id)throw Error('La edición ya existe.');
    const copy=function(item,newId){const x=JSON.parse(JSON.stringify(item));['revision','creada','actualizada'].forEach(function(k){delete x[k];});x.id=newId;return x;};
    // IDs deterministas permiten reintentar sin duplicar el contenido.
    ['Lecciones','Tareas'].forEach(function(table){
      const present=g10Lista_(table);
      present.filter(function(x){return x.curso===source.id;}).forEach(function(x,index){
        const newId=id+'-'+table+'-'+index;
        if(present.some(function(y){return y.id===newId;}))return;
        const item=copy(x,newId);item.curso=id;
        if(table==='Tareas')item.fechaLimite='';
        g10Guardar_(table,item,0);
      });
    });
    if(existing)return existing;
    const course=copy(source,id);
    Object.assign(course,{ficha:g10FichaCurso_('',id),titulo:titulo,cursoOrigen:source.id,estado:'Activo',publicado:false,fechaCierre:'',cerradoPor:'',historialEstado:[]});
    return g10Guardar_('Cursos',course,0);
  }
  if(action==='gen10EstadoCurso') {
    const course=g10Curso_(user,g10Id_(d),true);
    if(['Activo','Cerrado','Culminado'].indexOf(d.estado)<0)throw Error('Estado de curso inválido.');
    if(course.estado==='Culminado'&&d.estado!=='Culminado'&&user.rol!=='admin')throw Error('Solo administración puede reabrir un curso culminado.');
    if(d.estado==='Activo'&&user.rol!=='admin')throw Error('Solo administración puede reabrir un curso.');
    if(d.estado!=='Activo'&&g10Lista_('IntentosExamen').some(function(a){return a.curso===course.id&&!a.finalizado&&(!a.vence||Date.parse(a.vence)>Date.now());}))throw Error('Hay exámenes en curso. Espera a que finalicen antes de cerrar.');
    if(d.estado==='Culminado'&&g10Lista_('Entregas').some(function(e){return e.curso===course.id&&e.nota==null;}))throw Error('Califica las entregas pendientes antes de culminar el curso.');
    const history=(course.historialEstado||[]).concat([{estado:d.estado,anterior:course.estado||'Activo',fecha:new Date().toISOString(),usuario:user.email}]);
    if(history.length>100)throw Error('El historial de estados alcanzó su capacidad.');
    return g10Guardar_('Cursos',Object.assign({},course,{estado:d.estado,fechaCierre:d.estado==='Activo'?'':new Date().toISOString(),cerradoPor:d.estado==='Activo'?'':user.email,historialEstado:history}),g10Revision_(d));
  }
  // También se exige en el servidor: ocultar botones no basta para cerrar el curso.
  const contentActions=['gen10Inscribir','gen10GuardarLeccion','gen10GuardarTarea'];
  const studentActions=['gen10Entregar','gen10IniciarExamen','gen10GuardarRespuestaExamen','gen10ResponderExamen','gen10Completar'];
  let affected=null;
  if(contentActions.indexOf(action)>=0)affected=g10Curso_(user,d.curso,true);
  if(action==='gen10GuardarCurso')affected=g10Lista_('Cursos').find(function(c){return c.id===d.id;});
  if(studentActions.indexOf(action)>=0){
    const entry=g10Lista_(action==='gen10Completar'?'Lecciones':'Tareas').find(function(t){return t.id===(d.leccion||d.tarea);});
    if(entry)affected=g10Curso_(user,entry.curso,false);
  }
  if(action==='gen10Calificar'){
    const delivery=g10Lista_('Entregas').find(function(e){return e.id===d.entrega;});
    if(delivery)affected=g10Curso_(user,delivery.curso,true);
  }
  const removingEnrollment=action==='gen10Inscribir'&&d.activo===false;
  if(affected&&affected.estado&&affected.estado!=='Activo'&&!removingEnrollment&&(action!=='gen10Calificar'||affected.estado==='Culminado'))throw Error('El curso está '+affected.estado.toLowerCase()+'. Solo permite consulta; solicita su reapertura a administración.');
  if(action==='gen10GuardarPerfil') {
    if(user.rol!=='estudiante')throw Error('Esta opción es para estudiantes.');
    const item=Object.assign({},user,{nombre:g10Texto_(d.nombre,120,true)});
    ['telefono','direccion','ciudad','contactoEmergencia'].forEach(function(k){item[k]=g10Texto_(d[k]||'',k==='direccion'?300:120,false);});
    const cedula=g10Texto_(d.cedula||'',40,true);
    if(!/^[a-zA-Z0-9-]{3,40}$/.test(cedula))throw Error('Revisa tu documento.');
    const alumnos=hojaAlumnosCompleta_(),rows=alumnos.getDataRange().getDisplayValues();
    const linked=rows.find(function(r,i){return i>0&&r[2].trim().toLowerCase()===user.email;});
    if((user.cedula&&user.cedula!==cedula)||(linked&&linked[0]!==cedula))throw Error('Solicita a administración la corrección del documento vinculado.');
    if(rows.some(function(r,i){return i>0&&r[0]===cedula&&r[2].trim().toLowerCase()!==user.email;})||g10Lista_('Usuarios').some(function(u){return u.email!==user.email&&u.cedula===cedula;}))throw Error('Documento asociado a otro estudiante.');
    item.cedula=cedula;
    const saved=g10GuardarArchivos_('Usuarios',item,d,user);
    const index=rows.findIndex(function(r,i){return i>0&&r[0]===cedula&&r[2].trim().toLowerCase()===user.email;});
    if(index>0)alumnos.getRange(index+1,2).setValue(textoHoja_(saved.nombre));
    return g10Publico_(saved);
  }
  if (action === 'gen10GuardarUsuario') {
    if (user.rol !== 'admin') throw Error('Solo administración puede gestionar accesos.');
    const email = g10Email_(d.email), rol = d.rol;
    if (['admin', 'docente', 'estudiante'].indexOf(rol) < 0 || typeof d.activo !== 'boolean') throw Error('Rol o estado inválido.');
    if (email === user.email && (rol !== 'admin' || !d.activo)) throw Error('No puedes retirar tu propio acceso administrativo.');
    const existing = g10Lista_('Usuarios').find(function(u) { return u.email === email; });
    const cedula=g10Texto_((d.cedula===undefined?(existing||{}).cedula:d.cedula)||'',40,false);
    if(cedula&&!/^[a-zA-Z0-9-]{3,40}$/.test(cedula))throw Error('Revisa el documento del estudiante.');
    return g10Publico_(g10Guardar_('Usuarios', Object.assign({}, existing || {}, {id: email, email: email, cedula:cedula, nombre: g10Texto_(d.nombre, 120, true), rol: rol, activo: d.activo}), g10Revision_(d)));
  }
  if(action==='gen10ConfigurarPassword') {
    if(user.rol!=='admin')throw Error('Solo administración puede configurar contraseñas.');
    const target=g10Lista_('Usuarios').find(function(u){return u.email===g10Email_(d.email);});
    if(!target)throw Error('Usuario no disponible.');
    if(target.email===user.email)throw Error('Para tu propia contraseña utiliza Olvidé mi contraseña al salir del campus.');
    const password=g10Password_(d.password),url=d.enviarCorreo===true?g10CampusUrl_(d):'';
    if(d.enviarCorreo===true&&!target.activo)throw Error('Activa el acceso antes de enviar credenciales.');
    const saved=g10Guardar_('Usuarios',Object.assign({},target,{credencial:g10CredencialAdmin_(password)}),g10Revision_(d));
    CacheService.getScriptCache().remove('gen10:codigo:'+g10Hash_(target.email));
    return Object.assign(g10Publico_(saved),{avisoMensaje:d.enviarCorreo===true?g10CorreoCredenciales_(saved,password,url):'Contraseña actualizada. Las sesiones anteriores del usuario vencerán.'});
  }
  if (action === 'gen10GuardarCurso') {
    const id = g10Id_(d), existing = g10Lista_('Cursos').find(function(c) { return c.id === id; });
    if (user.rol !== 'admin') {
      if (!existing) throw Error('Solo administración puede crear cursos y asignar docentes.');
      g10Curso_(user, id, true);
      if (d.docente !== existing.docente) throw Error('Solo administración puede cambiar el docente.');
    }
    const teacher = g10Usuario_(g10Email_(d.docente));
    if (teacher.rol !== 'docente') throw Error('Selecciona un docente activo.');
    const pesoTareas = d.pesoTareas === undefined ? (existing && existing.pesoTareas != null ? existing.pesoTareas : null) : d.pesoTareas;
    if (pesoTareas !== null && (!Number.isInteger(pesoTareas) || pesoTareas < 1 || pesoTareas > 99)) throw Error('El porcentaje de tareas debe estar entre 1 y 99; exámenes usa el porcentaje restante.');
    return g10GuardarArchivos_('Cursos', Object.assign({},existing||{estado:'Activo'},{id: id, ficha:g10FichaCurso_(d.ficha===undefined?(existing||{}).ficha:d.ficha,id), titulo: g10Texto_(d.titulo, 140, true), descripcion: g10Texto_(d.descripcion, 4000, false), docente: teacher.email, publicado: d.publicado === true, pesoTareas:pesoTareas}), d, existing);
  }
  if (['gen10Inscribir', 'gen10GuardarLeccion', 'gen10GuardarTarea'].indexOf(action) >= 0) {
    g10Curso_(user, d.curso, true);
    if (action === 'gen10Inscribir') {
      if(d.crearEstudiante===true) {
        if(user.rol!=='admin')throw Error('Solo administración puede crear estudiantes y sus credenciales.');
        if(d.activo!==true||g10Revision_(d)!==0)throw Error('La creación requiere una inscripción nueva y activa.');
        const email=g10Email_(d.email),exists=g10Lista_('Usuarios').some(function(u){return u.email===email;});
        if(exists)throw Error('Este correo ya tiene una cuenta. Desmarca Crear estudiante para asignarla al curso.');
        const url=g10CampusUrl_(d),nombre=g10Texto_(d.nombre,120,true),cedula=g10Texto_(d.cedula||'',40,false);
        if(cedula&&!/^[a-zA-Z0-9-]{3,40}$/.test(cedula))throw Error('Revisa el documento del estudiante.');
        if(g10Lista_('Inscritos').some(function(m){return m.id===d.curso+':'+email;}))throw Error('La inscripción ya existe. Actualiza el portal.');
        const password='G10-'+Utilities.getUuid().replace(/-/g,'');
        const created=g10Guardar_('Usuarios',{id:email,email:email,nombre:nombre,cedula:cedula,rol:'estudiante',activo:true,credencial:g10CredencialAdmin_(password)},0);
        const enrolled=g10Guardar_('Inscritos',{id:d.curso+':'+email,curso:d.curso,email:email,activo:true},0);
        return Object.assign(enrolled,{avisoMensaje:g10CorreoCredenciales_(created,password,url,g10Lista_('Cursos').find(function(c){return c.id===d.curso;}))});
      }
      const student = g10Usuario_(g10Email_(d.email));
      if (student.rol !== 'estudiante' || typeof d.activo !== 'boolean') throw Error('Selecciona un estudiante activo.');
      const previous=g10Lista_('Inscritos').find(function(e){return e.curso===d.curso&&e.email===student.email;});
      if(d.activo===false&&!previous)throw Error('El estudiante no está asignado a este curso.');
      let archivo=previous&&previous.archivoNotas;
      if(d.activo===false&&previous.activo){
        if(Number(previous.revision)!==Number(g10Revision_(d)))throw Error('La inscripción cambió. Actualiza antes de retirar al estudiante.');
        g10SincronizarAcademico_();
        const deliveries=g10Lista_('Entregas');
        const evaluations=g10Lista_('Tareas').filter(function(t){return t.curso===d.curso&&t.publicado;}).map(function(t){
          const e=deliveries.find(function(e){return e.tarea===t.id&&e.email===student.email;});
          return {id:t.id,nombre:t.titulo,tipo:t.tipo==='examen'?'examen':'tarea',nota:e&&typeof e.nota==='number'&&Number.isFinite(e.nota)?e.nota:null,observacion:e?e.comentario||'':'',estado:e?(e.nota==null?'Por calificar':'Calificada'):'Sin entregar'};
        });
        const groups=['tarea','examen'].map(function(type){const items=evaluations.filter(function(e){return e.tipo===type;}),graded=items.filter(function(e){return e.nota!==null;});return {complete:items.length>0&&items.length===graded.length,average:graded.length?graded.reduce(function(sum,e){return sum+e.nota;},0)/graded.length:null};});
        const weight=affected.pesoTareas,partial=Number.isInteger(weight)&&groups.every(function(g){return g.average!==null;})?(groups[0].average*weight+groups[1].average*(100-weight))/100:null;
        archivo={curso:d.curso,email:student.email,evaluaciones:evaluations,parcial:partial===null?'':partial.toFixed(1),definitiva:partial!==null&&groups.every(function(g){return g.complete;})?partial.toFixed(1):'',actualizada:new Date().toISOString()};
        archivo=Object.assign({},archivo,{fechaRetiro:new Date().toISOString(),titulo:affected.titulo,estadoCurso:affected.estado||'Activo'});
      }
      return g10Guardar_('Inscritos', Object.assign({},previous||{},{id: d.curso + ':' + student.email, curso: d.curso, email: student.email, activo: d.activo,archivoNotas:archivo||null}), g10Revision_(d));
    }
    const table = action === 'gen10GuardarLeccion' ? 'Lecciones' : 'Tareas';
    const id = g10Id_(d), existing = g10Lista_(table).find(function(r) { return r.id === id; });
    if (existing && existing.curso !== d.curso) throw Error('No puedes mover contenido entre cursos.');
    const item = {id: id, curso: d.curso, titulo: g10Texto_(d.titulo, 140, true), contenido: g10Texto_(d.contenido, 18000, true), url: g10Url_(d.url), publicado: d.publicado === true};
    if (table === 'Tareas') {
      const tipo = d.tipo === undefined ? (existing && existing.tipo || 'tarea') : d.tipo;
      if (['tarea','examen'].indexOf(tipo) < 0) throw Error('Tipo de evaluación inválido.');
      if (existing && tipo !== (existing.tipo || 'tarea') && g10Lista_('Entregas').some(function(e) { return e.tarea === id; })) throw Error('No puedes cambiar el tipo de una evaluación con entregas.');
      item.tipo = tipo;
      if(existing && tipo!==(existing.tipo||'tarea') && g10Lista_('IntentosExamen').some(function(a){return a.tarea===id;}))throw Error('No puedes cambiar el tipo de un examen con intentos iniciados.');
      if (tipo === 'examen') {
        item.duracionMinutos=Number(d.duracionMinutos===undefined?(existing && existing.duracionMinutos || 0):d.duracionMinutos);
        item.intentosPermitidos=Number(d.intentosPermitidos===undefined?(existing && existing.intentosPermitidos || 1):d.intentosPermitidos);
        if(!Number.isInteger(item.duracionMinutos)||item.duracionMinutos<0||item.duracionMinutos>600)throw Error('La duración debe estar entre 0 y 600 minutos.');
        if(!Number.isInteger(item.intentosPermitidos)||item.intentosPermitidos<1||item.intentosPermitidos>10)throw Error('Selecciona entre 1 y 10 intentos.');
        if(existing && g10Lista_('IntentosExamen').some(function(a){return a.tarea===id;}) && JSON.stringify(existing.preguntas)!==JSON.stringify(d.preguntas))throw Error('El examen ya tiene intentos iniciados; no puedes cambiar sus preguntas.');
        if (!Array.isArray(d.preguntas) || !d.preguntas.length || d.preguntas.length > 20) throw Error('El examen debe tener entre 1 y 20 preguntas.');
        item.preguntas = d.preguntas.map(function(p) {
          if (!p || !Array.isArray(p.opciones) || p.opciones.length !== 4 || !Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) throw Error('Cada pregunta debe tener cuatro opciones y una respuesta correcta.');
          return {enunciado:g10Texto_(p.enunciado,1000,true),opciones:p.opciones.map(function(o) { return g10Texto_(o,500,true); }),correcta:p.correcta};
        });
        if (existing && g10Lista_('Entregas').some(function(e) { return e.tarea === id; }) && JSON.stringify(existing.preguntas) !== JSON.stringify(item.preguntas)) throw Error('Este examen ya tiene respuestas. Crea otro examen para cambiar las preguntas.');
      }
    }
    if (table === 'Lecciones') {
      if (!Number.isInteger(d.orden) || d.orden < 1 || d.orden > 999) throw Error('El orden debe estar entre 1 y 999.');
      item.orden = d.orden;
    } else {
      item.fechaLimite = g10Texto_(d.fechaLimite || '', 30, false);
      if (item.fechaLimite && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.fechaLimite) || !Number.isFinite(Date.parse(item.fechaLimite)) || new Date(item.fechaLimite).toISOString() !== item.fechaLimite)) throw Error('Fecha límite inválida.');
    }
    return g10GuardarArchivos_(table, item, d, existing);
  }
  if (action === 'gen10Completar') {
    if (user.rol !== 'estudiante') throw Error('Esta acción corresponde al estudiante.');
    const lesson = g10Lista_('Lecciones').find(function(l) { return l.id === d.leccion && l.publicado; });
    if (!lesson) throw Error('Lección no disponible.');
    g10Curso_(user, lesson.curso, false);
    const id = lesson.id + ':' + user.email, old = g10Lista_('Progreso').find(function(p) { return p.id === id; });
    if (old) return old;
    return g10Guardar_('Progreso', {id: id, curso: lesson.curso, leccion: lesson.id, email: user.email}, 0);
  }
  if (['gen10IniciarExamen','gen10GuardarRespuestaExamen','gen10ResponderExamen'].indexOf(action)>=0) {
    if(user.rol!=='estudiante')throw Error('Solo los estudiantes pueden responder exámenes.');
    const exam=g10Lista_('Tareas').find(function(t){return t.id===d.tarea && t.tipo==='examen' && t.publicado;});
    if(!exam)throw Error('Examen no disponible.');
    g10Curso_(user,exam.curso,false);
    const id=exam.id+':'+user.email,old=g10Lista_('Entregas').find(function(e){return e.id===id;});
    let attempt=g10Lista_('IntentosExamen').find(function(a){return a.id===id;});
    const used=old?(old.historialIntentos||[old]).length:0;
    if(action==='gen10IniciarExamen'){
      if(attempt && !attempt.finalizado)return attempt;
      if(used>=(exam.intentosPermitidos||1))throw Error('Ya utilizaste los intentos permitidos.');
      if(exam.fechaLimite && Date.now()>Date.parse(exam.fechaLimite))throw Error('El plazo para responder este examen terminó.');
      let deadline=exam.duracionMinutos?Date.now()+exam.duracionMinutos*60000:Infinity;
      if(exam.fechaLimite)deadline=Math.min(deadline,Date.parse(exam.fechaLimite));
      return g10Guardar_('IntentosExamen',{id:id,curso:exam.curso,tarea:exam.id,email:user.email,numero:used+1,inicio:new Date().toISOString(),vence:Number.isFinite(deadline)?new Date(deadline).toISOString():'',respuestas:Array(exam.preguntas.length).fill(null),finalizado:false},attempt?attempt.revision:0);
    }
    // Compatibilidad con exámenes antiguos sin límites ni inicio previo.
    if(!attempt){
      if(old)return old;
      if(exam.duracionMinutos || (exam.intentosPermitidos||1)>1)throw Error('Inicia el examen antes de responder.');
      if(exam.fechaLimite && Date.now()>Date.parse(exam.fechaLimite))throw Error('El plazo para responder este examen terminó.');
    }
    if(attempt && attempt.finalizado)return old;
    if(attempt && Number(d.numero)!==attempt.numero)throw Error('Este intento cambió. Vuelve a abrir el examen.');
    const expired=attempt && attempt.vence && Date.now()>=Date.parse(attempt.vence);
    if(!expired && (!Array.isArray(d.respuestas)||d.respuestas.length!==exam.preguntas.length||d.respuestas.some(function(r){return r!==null && (!Number.isInteger(r)||r<0||r>3);})))throw Error('Respuestas inválidas.');
    const answers=expired?attempt.respuestas:d.respuestas;
    if(action==='gen10GuardarRespuestaExamen'){
      if(!attempt)throw Error('Inicia el examen.');
      if(expired)return attempt;
      return g10Guardar_('IntentosExamen',Object.assign({},attempt,{respuestas:answers.slice()}),attempt.revision);
    }
    if(!expired && answers.some(function(r){return r===null;}))throw Error('Responde todas las preguntas del examen.');
    const aciertos=exam.preguntas.reduce(function(sum,p,i){return sum+(p.correcta===answers[i]?1:0);},0),nota=Math.round(aciertos*50/exam.preguntas.length)/10;
    const result={numero:attempt?attempt.numero:1,nota:nota,respuestas:answers.slice(),aciertos:aciertos,entregada:new Date().toISOString()};
    const history=old?(old.historialIntentos||[{numero:1,nota:old.nota,respuestas:old.respuestas,aciertos:old.aciertos,entregada:old.entregada}]).slice():[];
    if(!history.some(function(h){return h.numero===result.numero;}))history.push(result);
    const best=history.reduce(function(a,b){return b.nota>a.nota?b:a;});
    const saved=g10Guardar_('Entregas',{id:id,curso:exam.curso,tarea:exam.id,email:user.email,contenido:'',url:'',archivos:[],respuestas:best.respuestas,aciertos:best.aciertos,totalPreguntas:exam.preguntas.length,nota:best.nota,comentario:'Mejor nota de '+history.length+' intento(s). Calificación automática: '+best.aciertos+' de '+exam.preguntas.length+' respuestas correctas.',entregada:result.entregada,tardia:false,automatica:true,historialIntentos:history},old?old.revision:0);
    if(attempt)g10Guardar_('IntentosExamen',Object.assign({},attempt,{finalizado:true}),attempt.revision);
    return saved;
  }
  if (action === 'gen10Entregar') {
    if (user.rol !== 'estudiante') throw Error('Solo los estudiantes pueden entregar tareas.');
    const task = g10Lista_('Tareas').find(function(t) { return t.id === d.tarea && t.publicado; });
    if (!task) throw Error('Tarea no disponible.');
    if (task.tipo === 'examen') throw Error('Responde el examen desde su sección.');
    g10Curso_(user, task.curso, false);
    const id = task.id + ':' + user.email, old = g10Lista_('Entregas').find(function(e) { return e.id === id; });
    if (old && old.nota !== null) throw Error('Esta entrega ya fue calificada y no se puede reemplazar.');
    const contenido = g10Texto_(d.contenido || '', 18000, false), url = g10Url_(d.url);
    if (!contenido && !url && !(d.archivos === undefined ? old && old.archivos && old.archivos.length : Array.isArray(d.archivos) && d.archivos.length)) throw Error('Escribe tu respuesta o adjunta tu trabajo.');
    return g10GuardarArchivos_('Entregas', {id: id, curso: task.curso, tarea: task.id, email: user.email, contenido: contenido, url: url, nota: null, comentario: '',
      entregada: new Date().toISOString(), tardia: !!task.fechaLimite && Date.now() > Date.parse(task.fechaLimite)}, d, old);
  }
  if (action === 'gen10Calificar') {
    const old = g10Lista_('Entregas').find(function(e) { return e.id === d.entrega; });
    if (!old) throw Error('Entrega no disponible.');
    g10Curso_(user, old.curso, true);
    if (old.automatica) throw Error('Este examen tiene calificación automática.');
    if (typeof d.nota !== 'number' || !Number.isFinite(d.nota) || d.nota < 0 || d.nota > 5 || Math.abs(d.nota * 10 - Math.round(d.nota * 10)) > 0.000001) throw Error('La nota debe estar entre 0.0 y 5.0, con máximo un decimal.');
    const comment = g10Texto_(d.comentario || '', 4000, false);
    const history = (old.historial || []).concat([{nota: d.nota, comentario: comment, docente: user.email, fecha: new Date().toISOString()}]);
    if (history.length > 50) throw Error('Se alcanzó el límite de revisiones de esta entrega. Contacta a administración.');
    return g10Guardar_('Entregas', Object.assign({}, old, {nota: d.nota, comentario: comment, historial: history}), g10Revision_(d));
  }
  throw Error('Acción del portal no reconocida.');
}
function g10Mantenimiento_() {
  var valor;
  try { valor=JSON.parse(PropertiesService.getScriptProperties().getProperty('IFOBE_MANTENIMIENTO')||'null'); } catch(ignore) {}
  return {activo:!!(valor&&valor.activo===true),mensaje:valor&&valor.mensaje||'Estamos realizando mejoras en la plataforma. Gracias por tu paciencia.'};
}
function gen10Api_(d) {
  if(d.accion==='gen10ConsultarMantenimiento') {
    var administrador=false;
    try { administrador=g10Sesion_(d.token).rol==='admin'; } catch(ignore) {}
    return responderJSON({ok:true,portal:'gen10-v1',mantenimiento:g10Mantenimiento_(),administrador:administrador});
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    let data;
    if (d.accion === 'gen10SolicitarCodigo') data = g10SolicitarCodigo_(d);
    else if (d.accion === 'gen10VerificarCodigo') data = g10VerificarCodigo_(d);
    else if (d.accion === 'gen10Login') data = g10Login_(d);
    else {
      const user = g10Sesion_(d.token);
      if(user.rol!=='admin'&&d.accion!=='gen10Salir'&&g10Mantenimiento_().activo)return responderJSON({ok:false,mantenimiento:true,mensaje:g10Mantenimiento_().mensaje});
      if (d.accion === 'gen10Salir') { CacheService.getScriptCache().remove('gen10:sesion:' + d.token); data = {}; }
      else if(d.accion==='gen10GuardarMantenimiento') {
        if(user.rol!=='admin')throw Error('Solo administración puede cambiar el mantenimiento.');
        if(typeof d.activo!=='boolean')throw Error('Estado de mantenimiento inválido.');
        const mensaje=g10Texto_(d.mensaje,500,true);
        PropertiesService.getScriptProperties().setProperty('IFOBE_MANTENIMIENTO',JSON.stringify({activo:d.activo,mensaje:mensaje}));
        data={mantenimiento:g10Mantenimiento_()};
      }
      else if(d.accion==='gen10Notificaciones') { data={notificaciones:g10AvisosVigentes_(user)}; }
      else if (d.accion === 'gen10Estado') { const importacion=d.recuperarSesion===true?null:g10ImportarMatriculas_(); data = g10Estado_(user); if(user.rol==='admin'&&importacion)data.importacionMatriculas=importacion; }
      else if (d.accion === 'gen10Sincronizar') {
        if(user.rol!=='admin')throw Error('Solo administración puede sincronizar las plataformas.');
        data = {sincronizacion:g10SincronizarAcademico_()};
      }
      else if (d.accion === 'gen10LeerArchivo') data = g10LeerArchivo_(user, d);
      else if(d.accion==='gen10LeerNotificacion') {
        const n=g10Lista_('Notificaciones').find(function(n){return n.id===d.id&&n.email===user.email;});
        if(!n)throw Error('Aviso no disponible.');
        data={registro:n.leida?n:g10Guardar_('Notificaciones',Object.assign({},n,{leida:true}),n.revision)};
      } else {
        const tables={gen10GuardarCurso:'Cursos',gen10Inscribir:'Inscritos',gen10GuardarLeccion:'Lecciones',gen10GuardarTarea:'Tareas',gen10Calificar:'Entregas',gen10ResponderExamen:'Entregas',gen10Entregar:'Entregas'};
        if(d.accion==='gen10EstadoCurso')tables[d.accion]='Cursos';
        const table=tables[d.accion], id=d.accion==='gen10Inscribir'?d.curso+':'+d.email:d.accion==='gen10Calificar'?d.entrega:(d.accion==='gen10ResponderExamen'||d.accion==='gen10Entregar')?d.tarea+':'+user.email:d.id;
        const old=table?g10Lista_(table).find(function(r){return r.id===id;}):null;
        const saved=g10Mutar_(user,d);
        data={registro:saved};
        if(saved.avisoMensaje)data.avisoMensaje=saved.avisoMensaje;
        if(['Cursos','Inscritos','Entregas','Tareas'].indexOf(table)>=0||d.accion==='gen10GuardarUsuario')try{data.sincronizacion=g10SincronizarAcademico_();}catch(error){data.avisoMensaje='Guardado. Sincronización académica pendiente: '+String(error.message||error);}
        if(d.accion==='gen10SeguimientoPQRS'||(d.accion==='gen10PublicarComunidad'&&d.tipo==='soporte'))try{g10AvisarPQRS_(saved,user);}catch(error){data.avisoMensaje='Solicitud guardada; no se pudieron crear los avisos. Contacta a administraci\u00f3n.';}
        if(table&&!(d.accion==='gen10Inscribir'&&d.crearEstudiante===true))try{g10AvisarCambio_(table,saved,old);}catch(error){data.avisoMensaje='El cambio se guardó, pero no se pudieron completar los avisos. Contacta a administración.';}
      }

    }
    return responderJSON(Object.assign({ok: true, portal: 'gen10-v1'}, data));
  } finally { lock.releaseLock(); }
}

// Los archivos permanecen privados en Drive. Cada lectura verifica el acceso actual.
function g10LeerArchivo_(user, d) {
  if(d.tabla==='Pagos'){
    const pago=g10Lista_('Pagos').find(function(p){return p.id===d.registro;});
    if(!pago||(user.rol!=='admin'&&!(user.rol==='docente'&&pago.docente===user.email)))throw Error('No tienes acceso a este comprobante.');
    const file=(pago.archivos||[]).find(function(f){return f.id===d.archivo;});
    if(!file)throw Error('Comprobante no disponible.');
    return {archivo:Object.assign({},file,{base64:Utilities.base64Encode(DriveApp.getFileById(file.id).getBlob().getBytes())})};
  }
  if(d.tabla==='Inscritos'){
    const member=g10Lista_('Inscritos').find(function(m){return m.id===d.registro;});
    if(!member||!member.certificado||(user.rol!=='admin'&&!(user.rol==='estudiante'&&member.email===user.email)))throw Error('No tienes acceso a este certificado.');
    if(user.rol==='estudiante'&&!g10PagoAprobado_(member.id))throw Error('El pago de esta inscripcion esta pendiente de aprobacion.');
    const file=(member.archivos||[]).find(function(f){return f.id===d.archivo&&f.tipo==='application/pdf';});
    if(!file)throw Error('Certificado no disponible.');
    const blob=DriveApp.getFileById(file.id).getBlob();
    return {archivo:Object.assign({},file,{base64:Utilities.base64Encode(blob.getBytes())})};
  }
  if(d.tabla==='Usuarios') {
    const owner=g10Lista_('Usuarios').find(function(u){return u.id===d.registro;});
    if(!owner||(user.rol!=='admin'&&owner.email!==user.email))throw Error('No tienes acceso a este archivo.');
    const file=(owner.archivos||[]).find(function(f){return f.id===d.archivo;});
    if(!file)throw Error('Archivo no disponible.');
    const blob=DriveApp.getFileById(file.id).getBlob();
    return {archivo:Object.assign({},file,{base64:Utilities.base64Encode(blob.getBytes())})};
  }
  const tables = {Cursos:'cursos', Lecciones:'lecciones', Tareas:'tareas', Entregas:'entregas', Foros:'foros', Soporte:'soporte'};
  if (!Object.prototype.hasOwnProperty.call(tables, d.tabla)) throw Error('Archivo no disponible.');
  const state = g10Estado_(user), item = state[tables[d.tabla]].find(function(r) { return r.id === d.registro; });
  const files = item ? (item.archivos || []).concat(item.portada ? [item.portada] : []) : [];
  const file = files.find(function(f) { return f.id === d.archivo; });
  if (!file) throw Error('No tienes acceso a este archivo.');
  const blob = DriveApp.getFileById(file.id).getBlob();
  return {archivo: Object.assign({}, file, {base64: Utilities.base64Encode(blob.getBytes())})};
}
const G10_DOCUMENTOS_REQUERIDOS_ = [{id:'cedula',nombre:'Cédula'},{id:'actaBachiller',nombre:'Acta de bachiller'},{id:'icfes',nombre:'Resultados de pruebas ICFES'}];
function g10GuardarArchivos_(table, item, d, old) {
  const revision = g10Revision_(d);
  if ((old ? old.revision : 0) !== revision) throw Error('Este registro cambió. Actualiza el portal antes de volver a guardar.');
  const created = [], previous = old && old.archivos || [];
  let total = 0;
  function prepare(value, existing, cover) {
    if (!value || typeof value !== 'object') throw Error('Adjunto inválido.');
    if (value.id) {
      const found = existing.find(function(f) { return f.id === value.id; });
      if (!found) throw Error('El archivo no pertenece a este contenido.');
      if(table==='Usuarios' && value.categoria){
        if(!G10_DOCUMENTOS_REQUERIDOS_.some(function(r){return r.id===value.categoria;}))throw Error('Tipo de documento inválido.');
        return {metadata:Object.assign({},found,{categoria:value.categoria})};
      }
      return {metadata: found};
    }
    const name = g10Texto_(value.nombre, 180, true).replace(/[\\/\x00-\x1f]/g, '_');
    const extension = name.split('.').pop().toLowerCase();
    const formats = {pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',mp3:'audio/mpeg',mp4:'video/mp4',webm:'video/webm'};
    if (!Object.prototype.hasOwnProperty.call(formats, extension) || (cover && ['png','jpg','jpeg','webp'].indexOf(extension) < 0)) throw Error('Formato de archivo no admitido.');
    if(table==='Usuarios' && (!G10_DOCUMENTOS_REQUERIDOS_.some(function(r){return r.id===value.categoria;}) || ['pdf','png','jpg','jpeg'].indexOf(extension)<0))throw Error('Selecciona cédula, acta de bachiller o resultados ICFES en PDF, JPG o PNG.');
    const max = (cover ? 2 : 10) * 1024 * 1024;
    if (typeof value.base64 !== 'string' || !value.base64 || value.base64.length > Math.ceil(max / 3) * 4 || value.base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.base64)) throw Error('Archivo inválido o demasiado grande.');
    const bytes = Utilities.base64Decode(value.base64), b = bytes.map(function(v) { return v & 255; });
    total += bytes.length;
    if (!bytes.length || bytes.length > max || total > 20 * 1024 * 1024) throw Error('Máximo 10 MB por archivo, 2 MB por portada y 20 MB por envío.');
    function starts(signature, offset) { return signature.every(function(v,i) { return b[(offset || 0)+i] === v; }); }
    const valid = extension === 'pdf' ? starts([37,80,68,70,45]) : extension === 'png' ? starts([137,80,78,71,13,10,26,10]) : /^(jpg|jpeg)$/.test(extension) ? starts([255,216,255]) : extension === 'webp' ? starts([82,73,70,70]) && starts([87,69,66,80],8) : /^(docx|xlsx|pptx)$/.test(extension) ? starts([80,75,3,4]) : extension === 'mp4' ? starts([102,116,121,112],4) : extension === 'webm' ? starts([26,69,223,163]) : extension === 'mp3' ? starts([73,68,51]) || (b[0] === 255 && (b[1] & 224) === 224) : b.indexOf(0) < 0;
    if (!valid) throw Error('El contenido del archivo no coincide con su formato.');
    return {nombre:name,tipo:formats[extension],bytes:bytes,categoria:table==='Usuarios'?value.categoria:undefined};
  }
  const requested = d.archivos === undefined ? previous.map(function(f) { return {id:f.id}; }) : d.archivos;
  if (!Array.isArray(requested) || requested.length > 5) throw Error('Adjunta hasta cinco archivos por contenido.');
  const prepared = requested.map(function(f) { return prepare(f, previous, false); });
  if(table==='Usuarios'){
    const categories=prepared.map(function(f){return f.metadata?f.metadata.categoria:f.categoria;}).filter(Boolean);
    if(categories.some(function(c,i){return categories.indexOf(c)!==i;}))throw Error('Sube un archivo por cada documento requerido.');
  }
  let cover;
  if (table === 'Cursos') {
    const value = d.portada === undefined ? old && old.portada : d.portada;
    cover = value ? prepare(value, old && old.portada ? [old.portada] : [], true) : null;
  }
  let folder;
  function persist(file) {
    if (file.metadata) return file.metadata;
    if (!folder) {
      const props = PropertiesService.getScriptProperties(), folderId = props.getProperty('GEN10_FILES_FOLDER_ID');
      folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder('IFOBE - Archivos privados Gen10');
      if (!folderId) props.setProperty('GEN10_FILES_FOLDER_ID', folder.getId());
    }
    const saved = folder.createFile(Utilities.newBlob(file.bytes, file.tipo, file.nombre));
    created.push(saved);
    return Object.assign({id:saved.getId(),nombre:file.nombre,tipo:file.tipo,tamano:file.bytes.length},file.categoria?{categoria:file.categoria}:{});
  }
  try {
    item.archivos = prepared.map(persist);
    if (table === 'Cursos') item.portada = cover ? persist(cover) : null;
    return g10Guardar_(table, item, revision);
  } catch (error) {
    created.forEach(function(file) { try { file.setTrashed(true); } catch (_) {} });
    throw error;
  }
}

// Los avisos se crean únicamente después de guardar un cambio autorizado.
function g10AvisarCambio_(table,item,old,recuperar) {
  if(old&&old.revision===item.revision)return;
  const comparable=function(r){const x=Object.assign({},r);['revision','creada','actualizada','historial'].forEach(function(k){delete x[k];});return JSON.stringify(x);};
  if(old&&comparable(old)===comparable(item))return;
  const curso=table==='Cursos'?item:g10Lista_('Cursos').find(function(c){return c.id===item.curso;});
  if(!curso)return;
  let titulo,mensaje,recipients;
  if(table==='Inscritos'){
    titulo=item.activo?'Inscripción en un curso':'Cambio de inscripción';
    mensaje=item.activo?'Se habilitó tu inscripción en '+curso.titulo+'. Ingresa con tu correo y la contraseña de tu cuenta. Si es tu primer ingreso y aún no tienes contraseña, elige Activar cuenta; si la olvidaste, elige Olvidé mi contraseña. En Mis cursos encontrarás lecciones, tareas, exámenes y fechas de entrega; consulta tus resultados en Notas y avance.':'Tu inscripción en '+curso.titulo+' fue desactivada.';
    recipients=[item.email];
  }else if(table==='Entregas'){
    const tarea=g10Lista_('Tareas').find(function(t){return t.id===item.tarea;});
    if(!curso.publicado||!tarea||!tarea.publicado)return;
    if(!old||old.entregada!==item.entregada){
      const estudiante=g10Lista_('Usuarios').find(function(u){return u.email===item.email;});
      titulo=item.automatica?'Examen realizado':old?'Entrega actualizada':'Actividad entregada';
      mensaje=(estudiante?estudiante.nombre:item.email)+' entregó «'+tarea.titulo+'».'+(item.tardia?' Entrega fuera del plazo.':'')+(item.nota!=null?' Calificación: '+Number(item.nota).toFixed(1)+' / 5.0.':' La actividad está pendiente de calificación.');
      recipients=[item.email,curso.docente];
    }else{
      if(item.nota==null)return;
      titulo=old.nota!=null?'Calificación actualizada':'Nueva calificación';
      mensaje=tarea.titulo+': '+Number(item.nota).toFixed(1)+' / 5.0.'+(item.comentario?' '+item.comentario:'');
      recipients=[item.email];
    }
  }else if(table==='Cursos'&&old&&(old.estado||'Activo')!==(item.estado||'Activo')){
    if(!curso.publicado)return;
    titulo='Curso '+(item.estado==='Activo'?'reabierto':item.estado.toLowerCase());
    mensaje='El curso «'+curso.titulo+'» está '+(item.estado||'Activo').toLowerCase()+'. '+(item.estado==='Activo'?'Las actividades vuelven a estar disponibles.':'Ingresa a Gen10 y revisa tus notas en «Notas y avance». Puedes consultar tus materiales y resultados. No se reciben nuevas entregas. Si alguna nota aparece pendiente o tienes una duda, comunícate con tu docente.');
  }else{
    if(table!=='Cursos'&&!curso.publicado)return;
    if(!item.publicado&&!(old&&old.publicado))return;
    const tipo=table==='Cursos'?'curso':table==='Lecciones'?'lección':item.tipo==='examen'?'examen':'tarea';
    titulo=!item.publicado?'Publicación retirada':!old||!old.publicado?'Nueva publicación':'Contenido actualizado';
    mensaje=(tipo==='lección'||tipo==='tarea'?'La ':'El ')+tipo+' «'+item.titulo+'» '+(!item.publicado?'dejó de estar disponible.':!old||!old.publicado?'ya está disponible.':'tiene cambios. Revisa el campus para ver los detalles.');
  }
  const members=g10Lista_('Inscritos');
  if(!recipients)recipients=members.filter(function(m){return m.curso===curso.id&&m.activo;}).map(function(m){return m.email;});
  if(table==='Entregas')recipients=recipients.filter(function(email){return email===curso.docente||members.some(function(m){return m.curso===curso.id&&m.email===email&&m.activo;});});
  const users=g10Lista_('Usuarios'),existing=g10Lista_('Notificaciones');
  recipients.filter(function(email,i,a){return a.indexOf(email)===i&&users.some(function(u){return u.email===email&&u.activo&&(u.rol==='estudiante'||table==='Entregas'&&email===curso.docente&&(u.rol==='docente'||u.rol==='admin'));});}).forEach(function(email){
    const id=table+':'+item.id+':'+item.revision+':'+email;
    if(existing.some(function(n){return n.id===id||(recuperar&&n.email===email&&n.id.indexOf(table+':'+item.id+':')===0);} ))return;
    let n=g10Guardar_('Notificaciones',{id:id,email:email,curso:curso.id,titulo:titulo,mensaje:mensaje,leida:false,correoEstado:'Pendiente'},0);
    if(!recuperar)g10EnviarAviso_(n,curso);
  });
}

// Recupera avisos faltantes de trabajos ya realizados. No modifica entregas ni envía correo.
function recuperarAvisosEntregasGen10() {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const antes=g10Lista_('Notificaciones').length;
    g10Lista_('Entregas').forEach(function(entrega){g10AvisarCambio_('Entregas',entrega,null,true);});
    const resultado='Avisos recuperados: '+(g10Lista_('Notificaciones').length-antes)+'. Se conservaron entregas y notas. Ejecuta reenviarCorreosPendientesGen10 para enviar los correos.';
    Logger.log(resultado);return resultado;
  }finally{lock.releaseLock();}
}

function g10EnviarAviso_(n,curso) {
  if(n.correoEstado!=='Pendiente')return;
  let started=false;
  try {
    if(MailApp.getRemainingDailyQuota()<1)throw Error('Cuota de correo agotada');
    const mail=mensajeAcademico_(n.email,n.titulo,n.mensaje,[['Curso',curso.titulo]],'Ingresa al campus Gen10 para consultar tus novedades y calificaciones.');
    mail.name='Campus Gen10 · IFOBE';mail.subject='Gen10 | '+n.titulo;
    n=g10Guardar_('Notificaciones',Object.assign({},n,{correoEstado:'Enviando',correoDetalle:''}),n.revision);started=true;
    MailApp.sendEmail(mail);
    g10Guardar_('Notificaciones',Object.assign({},n,{correoEstado:'Enviado',correoDetalle:''}),n.revision);
  }catch(error){
    g10Guardar_('Notificaciones',Object.assign({},n,{correoEstado:started?'Por verificar':'Pendiente',correoDetalle:String(error.message||error).slice(0,500)}),n.revision);
  }
}

// Ejecutar desde Apps Script para recuperar correos pendientes sin duplicar envíos confirmados.
function reenviarCorreosPendientesGen10() {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const cursos=g10Lista_('Cursos');
    g10Lista_('Notificaciones').filter(function(n){return n.correoEstado==='Pendiente';}).forEach(function(n){
      const curso=cursos.find(function(c){return c.id===n.curso;});
      if(curso)g10EnviarAviso_(n,curso);
    });
    return 'Reintento terminado. Revisa correoEstado y correoDetalle en Gen10Notificaciones. Los envíos Por verificar requieren revisión manual.';
  }finally{lock.releaseLock();}
}

// Avisos privados en la campana del campus para cada movimiento de PQRS.
function g10AvisarPQRS_(item,user){
  const ticket=item.padre?g10Lista_('Soporte').find(function(r){return r.id===item.padre;}):item;
  if(!ticket)return;
  const recipients=g10Lista_('Usuarios').filter(function(u){return u.activo!==false&&(u.rol==='admin'||u.email===ticket.email)&&u.email!==user.email;});
  recipients.forEach(function(u){
    const id='pqrs:'+item.id+':'+item.revision+':'+u.email;
    if(g10Lista_('Notificaciones').some(function(n){return n.id===id;}))return;
    g10Guardar_('Notificaciones',{id:id,email:u.email,titulo:'PQRS: '+ticket.titulo,mensaje:(item.padre?'Nueva respuesta':ticket.estado||'Recibida')+'. Consulta PQRS y soporte para ver el seguimiento.',leida:false,pqrs:ticket.id,correoEstado:'No aplica'},0);
  });
}

// La bandeja se depura por fecha en cada consulta, incluso al cambiar de dia.
// Conserva los registros para evitar duplicar eventos y mantener el control del correo.
function g10AvisosVigentes_(user) {
  const limite=Date.now()-30*86400000;
  return g10Lista_('Notificaciones').filter(function(n){return n.email===user.email&&!n.leida&&(!n.creada||Date.parse(n.creada)>=limite);}).slice(-100).reverse();
}
