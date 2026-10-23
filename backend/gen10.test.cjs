const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

test('Reutilizar curso separa grupos y conserva el expediente anterior',()=>{
  const s=fixture(),source=s.c.g10Lista_('Cursos').find(c=>c.id==='course-1');
  const submission=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Trabajo anterior',revision:0},s.student).registro;
  const fields={id:source.id,revision:source.revision,nuevoId:'nuevo-grupo-2026-001',titulo:'Curso · Grupo 2026'};
  assert.equal(s.post('gen10ReutilizarCurso',fields,s.teacher).ok,false);
  assert.equal(s.post('gen10ReutilizarCurso',fields,s.student).ok,false);
  const before=JSON.stringify(s.c.g10Lista_('Entregas'));
  const course=s.ok('gen10ReutilizarCurso',fields).registro;
  assert.equal(course.estado,'Activo');assert.equal(course.publicado,false);
  for(const table of ['Lecciones','Tareas']){
    const original=s.c.g10Lista_(table).filter(x=>x.curso===source.id);
    const copies=s.c.g10Lista_(table).filter(x=>x.curso===course.id);
    assert.equal(copies.length,original.length);
    copies.forEach((x,i)=>{assert.notEqual(x.id,original[i].id);assert.equal(x.titulo,original[i].titulo);if(table==='Tareas')assert.equal(x.fechaLimite,'');});
  }
  for(const table of ['Inscritos','Entregas','Progreso','IntentosExamen'])assert.equal(s.c.g10Lista_(table).filter(x=>x.curso===course.id).length,0);
  assert.equal(JSON.stringify(s.c.g10Lista_('Entregas')),before);
  assert.ok(s.c.g10Lista_('Entregas').some(x=>x.id===submission.id));
  s.ok('gen10ReutilizarCurso',fields);
  assert.equal(s.c.g10Lista_('Cursos').filter(x=>x.id===course.id).length,1);
});

test('Sincronización manual es exclusiva de administración y comparte programas sin reactivar los deshabilitados',()=>{
  const s=fixture();
  assert.equal(s.post('gen10Sincronizar',{},s.teacher).ok,false);
  assert.equal(s.post('gen10Sincronizar',{},s.student).ok,false);
  const catalogo=s.c.getHoja('Programas',['Programa','Activo']);
  const titulo=s.c.g10Lista_('Cursos').find(c=>c.id==='course-1').titulo;
  const fila=catalogo.rows.find(r=>r[0]===titulo);
  assert.ok(fila,'El curso publicado forma parte de la oferta compartida');
  fila[1]='NO';
  const first=s.ok('gen10Sincronizar').sincronizacion;
  assert.ok(Array.isArray(first.pendientes));
  assert.equal(catalogo.rows.find(r=>r[0]===titulo)[1],'NO');
  const snapshot=JSON.stringify(catalogo.rows);
  s.ok('gen10Sincronizar');
  assert.equal(JSON.stringify(catalogo.rows),snapshot);
});

test('Cerrar y culminar curso conserva registros, exige permisos y bloquea actividades',()=>{
  const s=fixture();
  const u=s.c.g10Usuario_('student@example.com');
  s.ok('gen10GuardarUsuario',{email:u.email,nombre:u.nombre,rol:u.rol,activo:true,cedula:'123456',revision:u.revision});
  const submission=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Trabajo final',revision:0},s.student).registro;
  let c=s.ok('gen10Estado',{},s.teacher).cursos.find(c=>c.id==='course-1');
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.student).ok,false);
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.otherTeacher).ok,false);
  c=s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.teacher).registro;
  assert.equal(c.estado,'Cerrado');
  assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'Cambiar',revision:submission.revision},s.student).ok,false);
  assert.equal(s.post('gen10Completar',{leccion:'lesson-1'},s.student).ok,false);
  assert.equal(s.post('gen10GuardarCurso',{...c,titulo:'Cambiar'},s.teacher).ok,false);
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:1,estado:'Culminado'},s.teacher).ok,false);
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Culminado'},s.teacher).ok,false);
  const grade=s.ok('gen10Calificar',{entrega:submission.id,nota:4,comentario:'Final',revision:submission.revision},s.teacher).registro;
  c=s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Culminado'},s.teacher).registro;
  assert.equal(s.ok('gen10Estado',{},s.student).cursos[0].estado,'Culminado');
  assert.equal(s.post('gen10Calificar',{entrega:grade.id,nota:5,revision:grade.revision},s.teacher).ok,false);
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.teacher).ok,false);
  assert.equal(s.sheets.Matriculas.rows[1][8],'Finalizada');
  assert.equal(s.sheets.Matriculas.rows[1][15],'','Culminar no inventa una nota final');
  const preserved=JSON.stringify(s.c.g10Lista_('Entregas'));
  c=s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Activo'}).registro;
  assert.equal(s.sheets.Matriculas.rows[1][8],'Activa');
  assert.equal(JSON.stringify(s.c.g10Lista_('Entregas')),preserved);
  assert.equal(c.historialEstado.length,3);
  assert.equal(c.archivos.length,0);
});

test('Retirar de un curso cerrado conserva las notas al reutilizarlo',()=>{
  const s=fixture(),u=s.c.g10Usuario_('student@example.com');
  s.ok('gen10GuardarUsuario',{email:u.email,nombre:u.nombre,rol:u.rol,activo:true,cedula:'123456',revision:u.revision});
  const e=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Final',revision:0},s.student).registro;
  s.ok('gen10Calificar',{entrega:e.id,nota:4,comentario:'Bien',revision:e.revision},s.teacher);
  let c=s.ok('gen10Estado',{},s.teacher).cursos.find(c=>c.id==='course-1');
  c=s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Culminado'},s.teacher).registro;
  const m=s.c.g10Lista_('Inscritos').find(m=>m.curso===c.id&&m.email===u.email);
  const retired=s.ok('gen10Inscribir',{curso:c.id,email:u.email,activo:false,revision:m.revision},s.teacher).registro;
  assert.equal(retired.activo,false);
  assert.equal(retired.archivoNotas.evaluaciones[0].nota,4);
  const archived=JSON.stringify(s.c.g10NotasAcademicas_());
  s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Activo'});
  assert.equal(JSON.stringify(s.c.g10NotasAcademicas_()),archived);
  assert.equal(s.ok('gen10Estado',{},s.student).cursos.some(x=>x.id===c.id),false);
  assert.equal(s.c.g10Lista_('Entregas').find(x=>x.id===e.id).nota,4);
});

test('Certificado firmado requiere aprobado, culminado y administración; sigue privado tras retirar',()=>{
  const s=fixture(),u=s.c.g10Usuario_('student@example.com');
  s.ok('gen10GuardarUsuario',{email:u.email,nombre:u.nombre,rol:u.rol,activo:true,cedula:'123456',revision:u.revision});
  let course=s.ok('gen10Estado',{},s.teacher).cursos.find(c=>c.id==='course-1');
  course=s.ok('gen10GuardarCurso',{...course,pesoTareas:50},s.teacher).registro;
  const e=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Trabajo',revision:0},s.student).registro;
  s.ok('gen10Calificar',{entrega:e.id,nota:1,comentario:'Resultado',revision:e.revision},s.teacher);
  s.ok('gen10GuardarTarea',{id:'exam-certificate',curso:course.id,titulo:'Final',contenido:'Responde',tipo:'examen',publicado:true,revision:0,preguntas:[{enunciado:'Uno',opciones:['A','B','C','D'],correcta:0}]},s.teacher);
  const attempt=s.ok('gen10IniciarExamen',{tarea:'exam-certificate'},s.student).registro;
  s.ok('gen10ResponderExamen',{tarea:'exam-certificate',numero:attempt.numero,respuestas:[0]},s.student);
  const member=()=>s.c.g10Lista_('Inscritos').find(m=>m.curso===course.id&&m.email===u.email);
  const fields={id:member().id,revision:member().revision,docente:'Docente de prueba',coordinadora:'Coordinadora de prueba',firmasConfirmadas:true,archivos:[{nombre:'Certificado.pdf',base64:Buffer.from('%PDF-1.4 firmado de prueba').toString('base64')}]};
  assert.equal(s.post('gen10PublicarCertificado',fields).ok,false,'No emite con curso activo');
  course=s.ok('gen10EstadoCurso',{id:course.id,revision:course.revision,estado:'Cerrado'},s.teacher).registro;
  const closedCertificate=s.ok('gen10PublicarCertificado',fields).registro;
  assert.equal(closedCertificate.certificado.nota,'3.0','También permite publicar al cerrar con definitiva aprobada');
  fields.revision=closedCertificate.revision;
  course=s.ok('gen10EstadoCurso',{id:course.id,revision:course.revision,estado:'Culminado'},s.teacher).registro;
  assert.equal(s.post('gen10PublicarCertificado',fields,s.student).ok,false);
  assert.equal(s.post('gen10PublicarCertificado',fields,s.teacher).ok,false);
  assert.equal(s.post('gen10PublicarCertificado',{...fields,firmasConfirmadas:false}).ok,false);
  const issued=s.ok('gen10PublicarCertificado',fields).registro;
  assert.equal(issued.certificado.nota,'3.0');
  s.ok('gen10Inscribir',{curso:course.id,email:u.email,activo:false,revision:issued.revision},s.teacher);
  const state=s.ok('gen10Estado',{},s.student);
  assert.equal(state.cursos.some(c=>c.id===course.id),false);
  const history=state.historialAcademico.find(h=>h.curso===course.id);
  assert.equal(history.notas.definitiva,'3.0');
  assert.equal(history.certificado.docente,fields.docente);
  const request={tabla:'Inscritos',registro:issued.id,archivo:issued.archivos[0].id};
  assert.equal(s.ok('gen10LeerArchivo',request,s.student).archivo.tipo,'application/pdf');
  assert.equal(s.post('gen10LeerArchivo',request,s.otherStudent).ok,false);
  assert.equal(s.post('gen10PublicarCertificado',fields).ok,false,'Revisión antigua rechazada');
  const m=member();
  const legacyNotes={...m.archivoNotas};
  delete legacyNotes.estadoCurso;
  const legacy=s.c.g10Guardar_('Inscritos',{...m,archivoNotas:legacyNotes},m.revision);
  const reissued=s.ok('gen10PublicarCertificado',{...fields,revision:legacy.revision}).registro;
  assert.equal(reissued.certificado.nota,'3.0','El estado actual permite certificar retirados cuyo archivo no contiene estado');
  const withoutArchive=s.c.g10Guardar_('Inscritos',{...reissued,archivoNotas:null},reissued.revision);
  const recovered=s.ok('gen10PublicarCertificado',{...fields,revision:withoutArchive.revision}).registro;
  assert.equal(recovered.certificado.nota,'3.0','Recupera la nota persistida si un retiro antiguo no tiene archivo');
  const low=s.c.g10Guardar_('Inscritos',{...recovered,archivoNotas:{...legacyNotes,definitiva:'2.9'}},recovered.revision);
  assert.equal(s.post('gen10PublicarCertificado',{...fields,revision:low.revision}).ok,false,'Una definitiva menor a 3.0 no permite emitir');
});

test('Un examen en curso impide cerrar; el vencido no bloquea indefinidamente',()=>{
  const s=fixture();
  s.ok('gen10GuardarTarea',{id:'exam-close',curso:'course-1',titulo:'Examen',contenido:'Responde',tipo:'examen',publicado:true,revision:0,duracionMinutos:1,intentosPermitidos:1,preguntas:[{enunciado:'Pregunta',opciones:['A','B','C','D'],correcta:0}]},s.teacher);
  s.ok('gen10IniciarExamen',{tarea:'exam-close'},s.student);
  const c=s.ok('gen10Estado',{},s.teacher).cursos[0];
  assert.equal(s.post('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.teacher).ok,false);
  const NativeDate=Date,now=Date.now()+120000;
  s.c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  s.ok('gen10EstadoCurso',{id:c.id,revision:c.revision,estado:'Cerrado'},s.teacher);
  assert.equal(s.post('gen10IniciarExamen',{tarea:'exam-close'},s.student).ok,false);
  assert.equal(s.post('gen10ResponderExamen',{tarea:'exam-close',numero:1,respuestas:[0]},s.student).ok,false);
});

test('perfil propio conserva acceso y protege documentos frente a docentes',()=>{
  const s=fixture();
  const u=s.c.g10Lista_('Usuarios').find(u=>u.email==='student@example.com');
  s.ok('gen10GuardarPerfil',{nombre:'Nombre actualizado',cedula:'123456',telefono:'3001234567',direccion:'Calle 1',ciudad:'Bogotá',contactoEmergencia:'Familiar',revision:u.revision,rol:'admin',email:'otro@example.com',archivos:[]},s.student);
  const saved=s.c.g10Lista_('Usuarios').find(u=>u.email===u.id&&u.email==='student@example.com');
  assert.equal(saved.rol,'estudiante');assert.equal(saved.nombre,'Nombre actualizado');
  const own=s.ok('gen10Estado',{},s.student);assert.equal(own.perfil.telefono,'3001234567');
  const teacher=s.ok('gen10Estado',{},s.teacher);assert.equal(teacher.perfil.email,'teacher@example.com');assert.equal(teacher.expediente,null);assert.equal(teacher.expedientes.length,0);
  assert.throws(()=>s.c.g10LeerArchivo_(s.c.g10Usuario_('teacher@example.com'),{tabla:'Usuarios',registro:saved.id,archivo:'inventado'}),/acceso/);
  assert.throws(()=>s.c.g10Mutar_(saved,{accion:'gen10GuardarPerfil',nombre:saved.nombre,cedula:'999999',revision:saved.revision}),/administración/);
});

test('documentos del perfil permiten lectura propia y administrativa, rechazan acceso ajeno y conflictos',()=>{
  const s=fixture(),u=s.c.g10Usuario_('student@example.com'),base64=Buffer.from('%PDF-1.7\nIdentidad').toString('base64');
  const fields={nombre:u.nombre,cedula:'123456',revision:u.revision,archivos:[{nombre:'Identidad.pdf',categoria:'cedula',base64}]};
  s.ok('gen10GuardarPerfil',fields,s.student);
  const p=s.ok('gen10Estado',{},s.student).expediente;
  assert.equal(p.archivos[0].categoria,'cedula');
  assert.equal(s.ok('gen10Estado',{},s.student).documentosRequeridos.length,3);
  assert.equal(s.post('gen10GuardarPerfil',{...fields,revision:p.revision,archivos:[{nombre:'otra.pdf',categoria:'inventada',base64}]},s.student).ok,false);
  assert.equal(s.post('gen10GuardarPerfil',{...fields,revision:p.revision,archivos:[{id:p.archivos[0].id},{nombre:'otra.pdf',categoria:'cedula',base64}]},s.student).ok,false);
  const request={tabla:'Usuarios',registro:p.id,archivo:p.archivos[0].id};
  assert.equal(s.ok('gen10LeerArchivo',request,s.student).archivo.base64,base64);
  assert.equal(s.ok('gen10LeerArchivo',request).archivo.base64,base64);
  assert.equal(s.post('gen10LeerArchivo',request,s.otherStudent).ok,false);
  assert.equal(s.post('gen10LeerArchivo',request,s.teacher).ok,false);
  assert.equal(s.post('gen10GuardarPerfil',fields,s.student).ok,false);
  assert.equal(s.files.size,1);
  assert.equal(s.post('gen10GuardarPerfil',{...fields,revision:p.revision,archivos:[{nombre:'falso.pdf',base64:Buffer.from('falso').toString('base64')}]},s.student).ok,false);
  assert.equal(s.files.size,1);
});

test('sincronización académica Gen10 conserva notas, crea matrícula y actualiza sin duplicar',()=>{
  const s=fixture();
  let resultado=s.c.sincronizarAcademicoGen10();
  assert.equal(resultado.creadas,0);assert.ok(resultado.pendientes.length);
  const u=s.c.g10Lista_('Usuarios').find(u=>u.email==='student@example.com');
  s.ok('gen10GuardarUsuario',{email:u.email,nombre:u.nombre,rol:u.rol,activo:true,cedula:'123456',revision:u.revision});
  assert.equal(s.sheets.Alumnos.rows.length,2);
  assert.equal(s.sheets.Matriculas.rows.length,2);
  const mid=s.sheets.Matriculas.rows[1][0];
  const notas=s.c.getHoja('Notas',['Matricula ID','Revision','Modulos','Actualizada','Usuario','Historial']);
  notas.rows.push([mid,'1','[]','fecha','admin','[]']);const original=JSON.stringify(notas.rows);
  s.ok('gen10Entregar',{tarea:'task-1',contenido:'Trabajo',revision:0},s.student);
  s.ok('gen10Calificar',{entrega:'task-1:student@example.com',nota:0,comentario:'Revisar',revision:1},s.teacher);
  const calificaciones=s.c.g10NotasAcademicas_();assert.equal(calificaciones[0].evaluaciones[0].nota,0);
  assert.equal(calificaciones[0].definitiva,'','No inventa una definitiva con categorías pendientes');
  const mails=s.mails.length,before=JSON.stringify(s.sheets.NotasGen10.rows);
  resultado=s.c.sincronizarAcademicoGen10();assert.equal(resultado.creadas,0);assert.equal(resultado.actualizadas,0);
  assert.equal(s.sheets.Matriculas.rows.length,2);assert.equal(JSON.stringify(s.sheets.NotasGen10.rows),before);
  assert.equal(JSON.stringify(notas.rows),original);assert.equal(s.mails.length,mails);
  s.cache.set('sesion:test',{value:'admin',expires:Date.now()+60000});
  assert.equal(s.c.gestionNotas_({token:'test'}).notasGen10[0].evaluaciones[0].nota,0);
});

test('sincronización académica reutiliza matrícula existente y bloquea identidad ambigua',()=>{
  const s=fixture();
  const alumnos=s.c.hojaAlumnosCompleta_();alumnos.rows.push(['555','Estudiante registrado','student@example.com','Curso uno','Activo']);
  const matriculas=s.c.getHoja('Matriculas',vm.runInContext('COLUMNAS_MATRICULAS_',s.c));
  const registro=['matricula-original','fecha','fecha','555','Estudiante registrado','Curso uno','2026-2','Noche','Activa','','admin','3','','','2026-2','4.2','En curso','','[]'];
  matriculas.rows.push(registro.slice());
  s.c.sincronizarAcademicoGen10();assert.equal(matriculas.rows.length,2);assert.equal(s.c.g10NotasAcademicas_()[0].id,'matricula-original');assert.deepEqual(matriculas.rows[1],registro);
  alumnos.rows.push(['999','Duplicado','student@example.com','Curso uno','Activo']);
  const resultado=s.c.sincronizarAcademicoGen10();assert.ok(resultado.pendientes.some(x=>x.includes('duplicado')));assert.equal(matriculas.rows.length,2);
});

function setup(adminEmail = 'admin@example.com') {
  const sheets={}, cache=new Map(), mails=[], props={GEN10_ADMIN_EMAIL:adminEmail}, files=new Map();
  const folders=[];
  function makeFolder(){const id='folder-'+folders.length;const folder={getId:()=>id,getUrl:()=> 'https://drive.example/'+id,createFile(blob){const id=crypto.randomUUID();const file={getId:()=>id,getBlob:()=>blob,setTrashed:()=>files.delete(id)};files.set(id,file);return file;}};folders.push(folder);return folder;}
  const makeSheet=()=>{
    const rows=[];
    return {rows,setFrozenRows(){},setRowHeight(){},setColumnWidths(){},setColumnWidth(){},hideColumns(){},getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),appendRow:r=>rows.push([...r]),
      getDataRange:()=>({getValues:()=>rows.map(r=>[...r]),getDisplayValues:()=>rows.map(r=>r.map(String))}),
      getRange(row,col,height=1,width=1){return {
        setNumberFormat(){return this},setBackground(){return this},setFontColor(){return this},setFontWeight(){return this},setWrap(){return this},setVerticalAlignment(){return this},setNote(){return this},
        getDisplayValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(rows[row-1+i]?.[col-1+j]??''))),
        setValue:v=>{(rows[row-1]||=[])[col-1]=v},
        setValues:values=>values.forEach((r,i)=>r.forEach((v,j)=>(rows[row-1+i]||=[])[col-1+j]=v))
      }}
    };
  };
  const book={getId:()=> 'institution',getUrl:()=> 'https://sheets.example/institution',getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=makeSheet())};
  const c=vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key],setProperty:(key,value)=>{props[key]=value}})},
    DriveApp:{createFolder:makeFolder,getFolderById:id=>folders.find(f=>f.getId()===id),getFileById:id=>files.get(id)},
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:id=>{assert.equal(id,'institution');return book;}},
    Logger:{log(){}},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    CacheService:{getScriptCache:()=>({get:key=>{const entry=cache.get(key);return entry&&entry.expires>Date.now()?entry.value:null},put:(key,value,seconds)=>cache.set(key,{value,expires:Date.now()+seconds*1000}),remove:key=>cache.delete(key)})},
    Utilities:{getUuid:crypto.randomUUID,base64Decode:value=>Array.from(Buffer.from(value,'base64')),base64Encode:bytes=>Buffer.from(bytes).toString('base64'),newBlob:bytes=>({getBytes:()=>bytes}),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest())},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:mail=>mails.push(mail)},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
  });
  vm.runInContext(fs.readFileSync(__dirname+'/Gen10Crypto.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/Code.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/PortalGen10.gs','utf8'),c);
  c.configurarPortalGen10();
  function token(email){return c.g10NuevaSesion_(c.g10Lista_('Usuarios').find(u=>u.email===email)||{email}).token;}
  const admin=token('admin@example.com');
  function post(accion,fields={},session=admin){return c.doPost({postData:{contents:JSON.stringify({...fields,accion,token:session})}});}
  function ok(action,fields={},session=admin){const r=post(action,fields,session);assert.equal(r.ok,true,r.mensaje);return r;}
  function createUser(email,rol){ok('gen10GuardarUsuario',{email,rol,nombre:email.split('@')[0],activo:true,revision:0});return token(email);}
  return {c,sheets,cache,mails,props,files,folders,post,ok,admin,token,createUser};
}
test('Configuración completa prepara el mismo libro y reutiliza carpetas sin borrar ni enviar',()=>{
  const s=fixture();
  s.c.configurarTodaLaPlataforma();
  s.sheets.Notas.rows.push(['matricula-existente','1','[]','fecha','docente','[]']);
  const before=JSON.stringify(Object.fromEntries(Object.entries(s.sheets).map(([key,sheet])=>[key,sheet.rows])));
  const result=s.c.configurarTodaLaPlataforma();
  assert.equal(result.hoja,'https://sheets.example/institution');
  assert.equal(s.props.SPREADSHEET_ID,'institution');
  assert.equal(s.folders.length,2);
  assert.equal(s.mails.length,0);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(s.sheets).map(([key,sheet])=>[key,sheet.rows]))),before);
  for(const name of ['Inscripciones','Alumnos','Programas','Matriculas','Notas','Usuarios','Historial','EnviosDiplomas','Gen10Usuarios','Gen10Cursos','Gen10Inscritos','Gen10Lecciones','Gen10Tareas','Gen10Entregas','Gen10Progreso'])assert.ok(s.sheets[name],name);
});
test('Gen10: adjuntos privados, conservación al editar y revocación de lectura',()=>{
  const s=fixture(), base64=Buffer.from('%PDF-1.7\nprueba').toString('base64');
  const fields={id:'lesson-1',curso:'course-1',titulo:'Material',contenido:'Texto',url:'',publicado:true,orden:1,revision:1};
  const saved=s.ok('gen10GuardarLeccion',{...fields,archivos:[{nombre:'guia.pdf',base64}]},s.teacher).registro;
  const request={tabla:'Lecciones',registro:saved.id,archivo:saved.archivos[0].id};
  assert.equal(s.files.size,1);
  assert.equal(s.ok('gen10LeerArchivo',request,s.student).archivo.base64,base64);
  assert.equal(s.post('gen10LeerArchivo',request,s.otherTeacher).ok,false);
  const edited=s.ok('gen10GuardarLeccion',{...fields,revision:2},s.teacher).registro;
  assert.equal(edited.archivos[0].id,request.archivo);
  s.ok('gen10GuardarLeccion',{...fields,revision:3,publicado:false},s.teacher);
  assert.equal(s.post('gen10LeerArchivo',request,s.student).ok,false);
  assert.equal(s.ok('gen10LeerArchivo',request,s.teacher).archivo.base64,base64);
});

test('Gen10: adjunto falso y referencia ajena se rechazan antes de crear archivos',()=>{
  const s=fixture(), fields={id:'lesson-1',curso:'course-1',titulo:'Material',contenido:'Texto',url:'',publicado:true,orden:1,revision:1};
  for(const archivos of [[{nombre:'falso.pdf',base64:Buffer.from('No es PDF').toString('base64')}],[{id:'archivo-ajeno'}]]){
    assert.equal(s.post('gen10GuardarLeccion',{...fields,archivos},s.teacher).ok,false);
    assert.equal(s.files.size,0);
  }
});

test('Pagos: bloqueo real, comprobante privado, total del servidor y aprobacion exclusiva de administracion',()=>{
  const s=fixture(false),ids=['course-1:student@example.com','course-1:second@example.com'];
  const state=s.ok('gen10Estado',{},s.student);
  assert.equal(state.cursos.length,0);assert.equal(state.accesoPendiente.length,1);
  assert.equal(state.lecciones.length,0);assert.equal(state.tareas.length,0);
  assert.equal(s.post('gen10Completar',{leccion:'lesson-1'},s.student).ok,false);
  assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'Intento',revision:0},s.student).ok,false);
  const request={id:'pago-nuevo',curso:'course-1',inscripciones:ids,referencia:'NEQUI-123',total:1,archivos:[{nombre:'pago.pdf',base64:Buffer.from('%PDF-1.7\nComprobante').toString('base64')}]};
  assert.equal(s.post('gen10RegistrarPago',request,s.student).ok,false);
  assert.equal(s.post('gen10RegistrarPago',request,s.otherTeacher).ok,false);
  assert.equal(s.post('gen10RegistrarPago',{...request,inscripciones:[ids[0],ids[0]]},s.teacher).ok,false);
  const pago=s.ok('gen10RegistrarPago',request,s.teacher).registro;
  assert.equal(pago.total,10000);assert.equal(pago.valorUnitario,5000);assert.equal(pago.estado,'Pendiente');
  assert.equal(s.post('gen10RegistrarPago',{...request,id:'duplicado'},s.teacher).ok,false);
  assert.equal(s.ok('gen10Estado',{},s.student).cursos.length,0);
  const file={tabla:'Pagos',registro:pago.id,archivo:pago.archivos[0].id};
  assert.equal(s.post('gen10LeerArchivo',file,s.student).ok,false);
  assert.equal(s.post('gen10LeerArchivo',file,s.otherTeacher).ok,false);
  assert.ok(s.ok('gen10LeerArchivo',file,s.teacher).archivo.base64);
  assert.ok(s.ok('gen10LeerArchivo',file).archivo.base64);
  const decision={id:pago.id,revision:pago.revision,estado:'Aprobado',observacion:'Verificado en Nequi'};
  assert.equal(s.post('gen10ValidarPago',decision,s.teacher).ok,false);
  assert.equal(s.post('gen10ValidarPago',{...decision,revision:0}).ok,false);
  s.ok('gen10ValidarPago',decision);
  assert.equal(s.post('gen10ValidarPago',decision).ok,false);
  assert.equal(s.ok('gen10Estado',{},s.student).cursos.length,1);
  assert.equal(s.ok('gen10Estado',{},s.otherStudent).cursos.length,1);
  s.ok('gen10Completar',{leccion:'lesson-1'},s.student);
});

test('Pagos: rechazo requiere motivo, no habilita y permite nuevo comprobante',()=>{
  const s=fixture(false),request={id:'pago-rechazado',curso:'course-1',inscripciones:['course-1:student@example.com'],referencia:'NEQUI-456',archivos:[{nombre:'pago.pdf',base64:Buffer.from('%PDF-1.7\nComprobante').toString('base64')}]};
  assert.equal(s.post('gen10RegistrarPago',{...request,archivos:[{nombre:'falso.pdf',base64:Buffer.from('falso').toString('base64')}]},s.teacher).ok,false);
  const p=s.ok('gen10RegistrarPago',request,s.teacher).registro;
  assert.equal(s.post('gen10ValidarPago',{id:p.id,revision:p.revision,estado:'Rechazado',observacion:''}).ok,false);
  s.ok('gen10ValidarPago',{id:p.id,revision:p.revision,estado:'Rechazado',observacion:'No se encuentra el abono'});
  assert.equal(s.ok('gen10Estado',{},s.student).cursos.length,0);
  s.ok('gen10RegistrarPago',{...request,id:'pago-corregido'},s.teacher);
  const m=s.c.g10Lista_('Inscritos').find(m=>m.id===request.inscripciones[0]);
  const cert=s.c.g10Guardar_('Inscritos',{...m,certificado:{},archivos:[{id:'certificado',tipo:'application/pdf'}]},m.revision);
  assert.match(s.post('gen10PublicarCertificado',{id:cert.id,revision:cert.revision}).mensaje,/pago/);
  assert.equal(s.post('gen10LeerArchivo',{tabla:'Inscritos',registro:cert.id,archivo:'certificado'},s.student).ok,false);
});

function fixture(paid=true){
  const s=setup();
  s.teacher=s.createUser('teacher@example.com','docente');s.otherTeacher=s.createUser('other@example.com','docente');
  s.student=s.createUser('student@example.com','estudiante');s.otherStudent=s.createUser('second@example.com','estudiante');
  s.ok('gen10GuardarCurso',{id:'course-1',titulo:'Curso uno',descripcion:'Contenido',docente:'teacher@example.com',publicado:true,revision:0});
  s.ok('gen10GuardarCurso',{id:'course-2',titulo:'Curso dos',descripcion:'Privado',docente:'other@example.com',publicado:true,revision:0});
  s.ok('gen10Inscribir',{curso:'course-1',email:'student@example.com',activo:true,revision:0});
  s.ok('gen10Inscribir',{curso:'course-1',email:'second@example.com',activo:true,revision:0});
  if(paid)s.c.g10Guardar_('Pagos',{id:'pago-fixture',curso:'course-1',docente:'teacher@example.com',estado:'Aprobado',inscripciones:['course-1:student@example.com','course-1:second@example.com']},0);
  s.ok('gen10GuardarLeccion',{id:'lesson-1',curso:'course-1',titulo:'Introducción',contenido:'Texto',url:'https://example.com/material',publicado:true,orden:1,revision:0},s.teacher);
  s.ok('gen10GuardarTarea',{id:'task-1',curso:'course-1',titulo:'Actividad',contenido:'Escribir',url:'',publicado:true,fechaLimite:'',revision:0},s.teacher);
  s.mails.length=0;
  return s;
}

test('Administración configura contraseñas, invalida sesiones y protege credenciales',()=>{
  const s=fixture(),u=s.c.g10Usuario_('student@example.com');
  const fields={email:u.email,password:'Una clave nueva 2026',revision:u.revision};
  assert.equal(s.post('gen10ConfigurarPassword',fields,s.teacher).ok,false);
  assert.equal(s.post('gen10ConfigurarPassword',fields,s.student).ok,false);
  assert.equal(s.post('gen10ConfigurarPassword',{...fields,password:'corta'}).ok,false);
  s.cache.set('gen10:codigo:'+s.c.g10Hash_(u.email),{value:'old',expires:Date.now()+10000});
  const result=s.ok('gen10ConfigurarPassword',fields);
  assert.equal(result.registro.tienePassword,true);
  assert.equal(JSON.stringify(result).includes(fields.password),false);
  assert.equal(s.cache.has('gen10:codigo:'+s.c.g10Hash_(u.email)),false);
  assert.equal(s.post('gen10Estado',{},s.student).ok,false);
  assert.equal(s.ok('gen10Login',{email:u.email,password:fields.password}).autenticacion,'password-v1');
});

test('Nuevo estudiante del curso recibe credenciales sin guardar ni exponer la contraseña',()=>{
  const s=fixture();s.props.GEN10_CAMPUS_URL='https://campus.example/gen10.html';
  const fields={curso:'course-1',email:'nuevo@example.com',nombre:'Nuevo alumno',cedula:'987654',activo:true,revision:0,crearEstudiante:true};
  assert.equal(s.post('gen10Inscribir',fields,s.teacher).ok,false);
  assert.equal(s.c.g10Lista_('Usuarios').some(u=>u.email===fields.email),false);
  const result=s.ok('gen10Inscribir',fields);
  const mail=s.mails.find(m=>m.subject==='Gen10 | Credenciales e instrucciones de acceso');
  assert.ok(mail);assert.equal(mail.to,fields.email);
  assert.match(mail.body,/Curso uno/);assert.match(mail.body,/https:\/\/campus.example\/gen10.html/);
  assert.match(mail.body,/Mis cursos/);
  const password=mail.body.match(/Contraseña: (G10-[a-f0-9]+)/)[1];
  assert.equal(JSON.stringify(s.sheets).includes(password),false);
  assert.equal(JSON.stringify(result).includes(password),false);
  assert.equal(s.ok('gen10Login',{email:fields.email,password}).autenticacion,'password-v1');
  const count=s.mails.length;assert.equal(s.post('gen10Inscribir',fields).ok,false);assert.equal(s.mails.length,count);
});

test('Correo de credenciales fallido conserva acceso y registra revisión sin reenvío automático',()=>{
  const s=fixture();s.props.GEN10_CAMPUS_URL='https://campus.example/gen10.html';
  const u=s.c.g10Usuario_('student@example.com');s.c.MailApp.getRemainingDailyQuota=()=>0;
  const result=s.ok('gen10ConfigurarPassword',{email:u.email,password:'Contraseña nueva 2026',enviarCorreo:true,revision:u.revision});
  assert.match(result.avisoMensaje,/correo.*revisión/);
  assert.equal(s.c.g10Lista_('Notificaciones').find(n=>n.titulo==='Credenciales de acceso').correoEstado,'No enviado');
  assert.equal(s.c.g10Usuario_(u.email).credencial.algoritmo,'pbkdf2-sha256');
});

test('Gen10: publicaciones avisan solo a inscritos activos; borradores no avisan y lectura es privada',()=>{
  const s=fixture(),before=s.c.g10Lista_('Notificaciones').length;
  const fields={id:'news',curso:'course-1',titulo:'Nueva lección',contenido:'Texto',url:'',orden:2,publicado:false,revision:0};
  s.ok('gen10GuardarLeccion',fields,s.teacher);
  assert.equal(s.c.g10Lista_('Notificaciones').length,before);
  s.ok('gen10GuardarLeccion',{...fields,publicado:true,revision:1},s.teacher);
  assert.equal(s.mails.length,2);
  const own=s.ok('gen10Estado',{},s.student).notificaciones;
  assert.ok(own.every(n=>n.email==='student@example.com'));
  const n=own.find(n=>n.mensaje.includes('Nueva lección'));
  assert.equal(n.correoEstado,'Enviado');
  assert.equal(s.post('gen10LeerNotificacion',{id:n.id},s.otherStudent).ok,false);
  assert.equal(s.ok('gen10LeerNotificacion',{id:n.id},s.student).registro.leida,true);
  s.ok('gen10GuardarLeccion',{...fields,publicado:true,revision:2},s.teacher);
  assert.equal(s.mails.length,2,'Guardar contenido idéntico no repite avisos');
});

test('Gen10: entregas avisan al estudiante y a su docente, también al reemplazar el trabajo',()=>{
  const s=fixture();
  const first=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Respuesta',revision:0},s.student).registro;
  assert.deepEqual(s.mails.map(m=>m.to).sort(),['student@example.com','teacher@example.com']);
  for(const session of [s.student,s.teacher])assert.ok(s.ok('gen10Estado',{},session).notificaciones.some(n=>n.titulo==='Actividad entregada'&&n.correoEstado==='Enviado'));
  assert.equal(s.ok('gen10Estado',{},s.otherTeacher).notificaciones.length,0);
  s.mails.length=0;
  s.ok('gen10Entregar',{tarea:'task-1',contenido:'Respuesta corregida',revision:first.revision},s.student);
  assert.equal(s.mails.length,2);
  assert.ok(s.mails.every(m=>m.subject==='Gen10 | Entrega actualizada'));
  s.mails.length=0;
  assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'Conflicto',revision:0},s.student).ok,false);
  assert.equal(s.mails.length,0);
});

test('Gen10: exámenes notifican a ambas partes y repetir la solicitud no duplica correos',()=>{
  const s=fixture();
  s.ok('gen10GuardarTarea',{id:'exam-notice',curso:'course-1',titulo:'Examen',contenido:'Evaluación',tipo:'examen',publicado:true,revision:0,preguntas:[{enunciado:'Pregunta',opciones:['A','B','C','D'],correcta:0}]},s.teacher);
  s.mails.length=0;
  s.ok('gen10ResponderExamen',{tarea:'exam-notice',respuestas:[0]},s.student);
  assert.deepEqual(s.mails.map(m=>m.to).sort(),['student@example.com','teacher@example.com']);
  assert.ok(s.mails.every(m=>m.subject==='Gen10 | Examen realizado'&&m.body.includes('5.0 / 5.0')));
  s.ok('gen10ResponderExamen',{tarea:'exam-notice',respuestas:[0]},s.student);
  assert.equal(s.mails.length,2);
});

test('Gen10: correo pendiente por cuota se recupera sin duplicar envíos',()=>{
  const s=fixture();
  s.c.MailApp.getRemainingDailyQuota=()=>0;
  s.ok('gen10GuardarTarea',{id:'exam-retry',curso:'course-1',titulo:'Examen',contenido:'Evaluación',tipo:'examen',publicado:true,revision:0,preguntas:[{enunciado:'Pregunta',opciones:['A','B','C','D'],correcta:0}]},s.teacher);
  s.ok('gen10ResponderExamen',{tarea:'exam-retry',respuestas:[0]},s.student);
  const n=s.ok('gen10Estado',{},s.student).notificaciones.find(n=>n.titulo==='Examen realizado');
  assert.equal(n.correoEstado,'Pendiente');
  assert.equal(n.correoDetalle,'Cuota de correo agotada');
  s.c.MailApp.getRemainingDailyQuota=()=>100;
  s.c.reenviarCorreosPendientesGen10();
  const count=s.mails.length;
  assert.equal(s.mails.filter(m=>m.subject==='Gen10 | Examen realizado').length,2);
  s.c.reenviarCorreosPendientesGen10();
  assert.equal(s.mails.length,count);
});

test('Gen10: recuperar avisos existentes conserva entregas y no duplica revisiones anteriores',()=>{
  const s=fixture();
  const entrega=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Respuesta',revision:0},s.student).registro;
  const rows=s.sheets.Gen10Notificaciones.rows;
  rows.splice(1,rows.length-1);
  const before=JSON.stringify(s.sheets.Gen10Entregas.rows);
  s.mails.length=0;
  s.c.recuperarAvisosEntregasGen10();
  assert.equal(s.c.g10Lista_('Notificaciones').length,2);
  assert.equal(s.mails.length,0);
  assert.equal(JSON.stringify(s.sheets.Gen10Entregas.rows),before);
  s.c.recuperarAvisosEntregasGen10();
  assert.equal(s.c.g10Lista_('Notificaciones').length,2);
  s.c.reenviarCorreosPendientesGen10();
  assert.equal(s.mails.length,2);
  s.c.g10Guardar_('Entregas',{...entrega,nota:4},entrega.revision);
  s.c.recuperarAvisosEntregasGen10();
  assert.equal(s.c.g10Lista_('Notificaciones').length,2);
});

test('Gen10: nota cero avisa al dueño y un fallo de correo conserva nota y aviso',()=>{
  const s=fixture();
  const entrega=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Respuesta',url:'',revision:0},s.student).registro;
  s.c.MailApp.sendEmail=()=>{throw Error('Fallo de transporte');};
  s.ok('gen10Calificar',{entrega:entrega.id,nota:0,comentario:'Revisa la solución',revision:1},s.teacher);
  const state=s.ok('gen10Estado',{},s.student),n=state.notificaciones.find(n=>n.titulo==='Nueva calificación');
  assert.match(n.mensaje,/0\.0 \/ 5\.0/);
  assert.equal(n.correoEstado,'Por verificar');
  assert.equal(state.entregas[0].nota,0);
  assert.equal(s.ok('gen10Estado',{},s.otherStudent).notificaciones.some(n=>n.titulo==='Nueva calificación'),false);
});
test('Gen10: configuración repetible, nueve tablas propias y sin enviar correos',()=>{
  const s=setup();s.c.configurarPortalGen10();assert.equal(Object.keys(s.sheets).length,9);assert.equal(s.sheets.Gen10Usuarios.rows.length,2);assert.equal(s.mails.length,0);
});
test('Gen10: código real simulado, un solo uso, sesiones separadas del panel anterior',()=>{
  const s=setup();s.ok('gen10SolicitarCodigo',{email:'admin@example.com'});
  const code=s.mails[0].body.match(/acceso es: ([A-F0-9]{8})/)[1];
  assert.equal([...s.cache.values()].some(v=>v.value.includes(code)),false);
  const r=s.ok('gen10VerificarCodigo',{email:'admin@example.com',codigo:code,password:'Mi contraseña de prueba'},'');
  assert.equal(s.ok('gen10Estado',{},r.token).usuario.rol,'admin');
  assert.throws(()=>s.c.exigirSesion_(r.token),/sesión/);
  assert.equal(s.post('gen10VerificarCodigo',{email:'admin@example.com',codigo:code}).ok,false);
  s.ok('gen10Salir',{},r.token);assert.equal(s.post('gen10Estado',{},r.token).ok,false);
});

function activate(s,email,password='Mi contraseña de prueba',proposito='activar') {
  s.ok('gen10SolicitarCodigo',{email,proposito},'');
  const codigo=s.mails.at(-1).body.match(/acceso es: ([A-F0-9]{8})/)[1];
  return s.ok('gen10VerificarCodigo',{email,codigo,password},'');
}
test('Gen10: contraseña compatible con PBKDF2 SHA256 y nunca expuesta en respuestas',()=>{
  const s=setup(),password='Una frase con ñ y espacios';
  const activated=activate(s,'admin@example.com',password);
  const user=s.c.g10Usuario_('admin@example.com');
  assert.equal(s.sheets.Gen10Usuarios.rows[1][7],'Contraseña creada');
  s.c.organizarHojasGen10();
  assert.equal(s.c.g10Usuario_('admin@example.com').credencial.hash,user.credencial.hash);
  assert.equal(user.credencial.hash,crypto.pbkdf2Sync(password,user.credencial.salt,600000,32,'sha256').toString('hex'));
  assert.doesNotMatch(JSON.stringify(s.sheets.Gen10Usuarios.rows),/Una frase con ñ y espacios/);
  for(const response of [activated,s.ok('gen10Estado',{},activated.token),s.ok('gen10GuardarUsuario',{email:user.email,nombre:'Nombre actualizado',rol:'admin',activo:true,revision:user.revision},activated.token)]) {
    assert.doesNotMatch(JSON.stringify(response),/credencial|"salt"|"hash"/);
  }
  const login=s.ok('gen10Login',{email:'ADMIN@example.com',password},'');
  assert.equal(login.usuario.nombre,'Nombre actualizado');
  assert.equal(s.mails.length,1,'El login diario no envía códigos');
  assert.equal(s.post('gen10Estado',{},s.admin).ok,false,'Activar revoca la sesión anterior');
});

test('Vistas de Sheets preservan registros técnicos y filas vacías; muestran cero y escapan fórmulas',()=>{
  const s=fixture(),sheet=s.sheets.Gen10Usuarios;
  const technical=sheet.rows.slice(1).map(r=>r.slice(0,3));
  sheet.rows.splice(2,0,[]);
  s.c.organizarHojasGen10();
  assert.equal(sheet.rows[0][7],'Contraseña');
  assert.equal(sheet.rows[1][7],'Pendiente de activación');
  assert.deepEqual(sheet.rows.filter(r=>r[0]).slice(1).map(r=>r.slice(0,3)),technical);
  assert.equal(sheet.rows[2][3],'');
  assert.equal(sheet.rows[3][4],'teacher@example.com');
  assert.ok(s.sheets.GuiaGen10.rows.some(r=>String(r[1]).includes('credencial')));
  assert.equal(s.c.g10FilaVisible_('Entregas',{nota:0})[4],'0');
  assert.equal(s.c.g10FilaVisible_('Usuarios',{nombre:'=IMPORTXML(test)'})[0],"'=IMPORTXML(test)");
});
test('Gen10: recuperación reemplaza contraseña y revoca todas las sesiones anteriores',()=>{
  const s=setup(),email='admin@example.com';
  const first=activate(s,email);
  s.ok('gen10SolicitarCodigo',{email,proposito:'activar'},'');
  assert.equal(s.mails.length,1,'Una cuenta activada no recibe otra activación');
  s.cache.delete('gen10:codigo:'+s.c.g10Hash_(email));
  const second=activate(s,email,'Otra contraseña de prueba','recuperar');
  assert.equal(s.post('gen10Estado',{},first.token).ok,false);
  assert.equal(s.post('gen10Login',{email,password:'Mi contraseña de prueba'},'').ok,false);
  assert.equal(s.ok('gen10Login',{email,password:'Otra contraseña de prueba'},'').usuario.rol,'admin');
  assert.equal(s.ok('gen10Estado',{},second.token).usuario.email,email);
});
test('Gen10: código solo no inicia sesión y contraseña inválida no cambia la cuenta',()=>{
  const s=setup(),email='admin@example.com';
  s.ok('gen10SolicitarCodigo',{email},'');
  const codigo=s.mails[0].body.match(/acceso es: ([A-F0-9]{8})/)[1];
  for(const password of [undefined,'corta','x'.repeat(129)]) {
    assert.equal(s.post('gen10VerificarCodigo',{email,codigo,password},'').ok,false);
    assert.equal(s.c.g10Usuario_(email).credencial,undefined);
  }
  assert.equal(s.ok('gen10VerificarCodigo',{email,codigo,password:'Mi contraseña de prueba'},'').usuario.email,email);
  assert.equal(s.post('gen10VerificarCodigo',{email,codigo,password:'Otra contraseña de prueba'},'').ok,false);
});
test('Gen10: login limita intentos, no enumera cuentas y rechaza usuarios desactivados',()=>{
  const s=setup(),email='admin@example.com',password='Mi contraseña de prueba';
  const first=activate(s,email,password);
  const wrong=s.post('gen10Login',{email,password:'Contraseña equivocada'},'');
  const unknown=s.post('gen10Login',{email:'nadie@example.com',password},'');
  assert.equal(wrong.mensaje,unknown.mensaje);
  for(let i=1;i<5;i++)assert.equal(s.post('gen10Login',{email,password:'Contraseña equivocada'},'').ok,false);
  assert.match(s.post('gen10Login',{email,password},'').mensaje,/15 minutos/);
  s.cache.delete('gen10:login:'+s.c.g10Hash_(email));
  const user=s.c.g10Usuario_(email);
  s.c.g10Guardar_('Usuarios',{...user,activo:false},user.revision);
  assert.equal(s.post('gen10Login',{email,password},'').ok,false);
  assert.equal(s.post('gen10Estado',{},first.token).ok,false);
});
test('Gen10: docentes y estudiantes activan contraseña conservando sus permisos',()=>{
  const s=fixture();
  for(const [email,rol] of [['teacher@example.com','docente'],['student@example.com','estudiante']]) {
    const session=activate(s,email);
    assert.equal(session.usuario.rol,rol);
    assert.equal(s.ok('gen10Login',{email,password:'Mi contraseña de prueba'},'').usuario.rol,rol);
    assert.equal(s.post('gen10GuardarUsuario',{email:'intruso@example.com',nombre:'Intruso',rol:'admin',activo:true,revision:0},session.token).ok,false);
  }
});
test('Gen10: correo desconocido no se enumera, cooldown y cinco intentos bloquean el código',()=>{
  const s=setup();const known=s.ok('gen10SolicitarCodigo',{email:'admin@example.com'});const unknown=s.ok('gen10SolicitarCodigo',{email:'missing@example.com'});
  assert.equal(known.mensaje,unknown.mensaje);assert.equal(s.mails.length,1);
  s.ok('gen10SolicitarCodigo',{email:'admin@example.com'});assert.equal(s.mails.length,1);
  const code=s.mails[0].body.match(/acceso es: ([A-F0-9]{8})/)[1];
  for(let i=0;i<5;i++)assert.equal(s.post('gen10VerificarCodigo',{email:'admin@example.com',codigo:'WRONG'}).ok,false);
  assert.equal(s.post('gen10VerificarCodigo',{email:'admin@example.com',codigo:code}).ok,false);
});
test('Gen10: códigos vencidos y sesiones administrativas antiguas no dan acceso',()=>{
  const s=setup();s.ok('gen10SolicitarCodigo',{email:'admin@example.com'});
  const code=s.mails[0].body.match(/acceso es: ([A-F0-9]{8})/)[1];
  const key=[...s.cache.keys()].find(k=>k.startsWith('gen10:codigo:'));s.cache.get(key).expires=Date.now()-1;
  assert.equal(s.post('gen10VerificarCodigo',{email:'admin@example.com',codigo:code}).ok,false);
  s.cache.set('sesion:legacy',{value:'admin@example.com',expires:Date.now()+10000});assert.equal(s.post('gen10Estado',{},'legacy').ok,false);
});
test('Gen10: estudiantes solo reciben cursos asignados, contenido publicado y datos propios',()=>{
  const s=fixture();
  s.ok('gen10GuardarLeccion',{id:'draft',curso:'course-1',titulo:'No publicada',contenido:'Secreto',url:'',publicado:false,orden:2,revision:0},s.teacher);
  s.ok('gen10Entregar',{tarea:'task-1',contenido:'Trabajo ajeno',url:'',revision:0},s.otherStudent);
  s.ok('gen10Completar',{leccion:'lesson-1'},s.otherStudent);
  const r=s.ok('gen10Estado',{},s.student);
  assert.deepEqual(r.cursos.map(c=>c.id),['course-1']);assert.deepEqual(r.lecciones.map(l=>l.id),['lesson-1']);assert.equal(r.entregas.length,0);assert.equal(r.progreso.length,0);assert.equal(r.usuarios.length,0);assert.equal(r.inscritos.length,1);
  assert.equal(s.post('gen10Completar',{leccion:'draft'},s.student).ok,false);
});
test('Gen10: docente ajeno y estudiante no pueden editar contenido ni asignar permisos',()=>{
  const s=fixture();
  const payload={id:'bad',curso:'course-1',titulo:'Ataque',contenido:'No',url:'',publicado:true,orden:1,revision:0};
  for(const t of [s.otherTeacher,s.student]){
    assert.equal(s.post('gen10GuardarLeccion',payload,t).ok,false);
    assert.equal(s.post('gen10Inscribir',{curso:'course-1',email:'student@example.com',activo:false,revision:1},t).ok,false);
    assert.equal(s.post('gen10GuardarUsuario',{email:'student@example.com',nombre:'Admin',rol:'admin',activo:true,revision:1},t).ok,false);
  }
  const state=s.ok('gen10Estado',{},s.teacher);assert.deepEqual(state.cursos.map(c=>c.id),['course-1']);assert.equal(state.usuarios.some(u=>u.email==='admin@example.com'),false);
});
test('Gen10: no es posible sobrescribir una lección moviéndola a un curso propio',()=>{
  const s=fixture();const r=s.post('gen10GuardarLeccion',{id:'lesson-1',curso:'course-2',titulo:'Movimiento',contenido:'No',url:'',publicado:true,orden:1,revision:1},s.otherTeacher);
  assert.equal(r.ok,false);assert.match(r.mensaje,/mover/);
});
test('Gen10: alumno completa y entrega, docente califica cero, conserva historial y revisión',()=>{
  const s=fixture();s.ok('gen10Completar',{leccion:'lesson-1'},s.student);s.ok('gen10Completar',{leccion:'lesson-1'},s.student);assert.equal(s.sheets.Gen10Progreso.rows.length,2);
  const e=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Respuesta',url:'https://example.com/trabajo',revision:0},s.student).registro;
  assert.equal(e.email,'student@example.com');assert.equal(e.nota,null);
  assert.equal(s.post('gen10Calificar',{entrega:e.id,nota:5,comentario:'',revision:1},s.otherTeacher).ok,false);
  assert.equal(s.post('gen10Calificar',{entrega:e.id,nota:5,comentario:'',revision:1},s.student).ok,false);
  let graded=s.ok('gen10Calificar',{entrega:e.id,nota:0,comentario:'Revisar conceptos',revision:1},s.teacher).registro;
  assert.equal(graded.nota,0);assert.equal(graded.historial.length,1);
  assert.equal(s.post('gen10Calificar',{entrega:e.id,nota:4,comentario:'',revision:1},s.teacher).ok,false);
  graded=s.ok('gen10Calificar',{entrega:e.id,nota:4.5,comentario:'Revisión docente',revision:2},s.teacher).registro;
  assert.equal(graded.historial.length,2);assert.equal(graded.historial[0].nota,0);
  assert.equal(s.ok('gen10Estado',{},s.student).entregas[0].nota,4.5);
  assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'Reemplazar',url:'',revision:3},s.student).ok,false);
});
test('Gen10: revisiones evitan duplicados y pérdida de cambios en entregas',()=>{
  const s=fixture();const d={tarea:'task-1',contenido:'Primera',url:'',revision:0};
  s.ok('gen10Entregar',d,s.student);assert.equal(s.post('gen10Entregar',d,s.student).ok,false);
  s.ok('gen10Entregar',{...d,contenido:'Segunda',revision:1},s.student);assert.equal(s.sheets.Gen10Entregas.rows.length,2);
  assert.equal(s.ok('gen10Estado',{},s.student).entregas[0].contenido,'Segunda');
});
test('Gen10: desactivar usuario, retirar inscripción o despublicar curso revoca acceso',()=>{
  const s=fixture();s.ok('gen10Inscribir',{curso:'course-1',email:'student@example.com',activo:false,revision:1},s.teacher);
  assert.equal(s.ok('gen10Estado',{},s.student).cursos.length,0);assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'X',url:'',revision:0},s.student).ok,false);
  s.ok('gen10GuardarCurso',{id:'course-1',titulo:'Curso uno',descripcion:'',docente:'teacher@example.com',publicado:false,revision:1});
  assert.equal(s.ok('gen10Estado',{},s.otherStudent).cursos.length,0);
  s.ok('gen10GuardarUsuario',{email:'teacher@example.com',nombre:'Teacher',rol:'docente',activo:false,revision:1});assert.equal(s.post('gen10Estado',{},s.teacher).ok,false);
});
test('Gen10: notas inválidas, enlaces peligrosos, fecha imposible y autoexclusión se rechazan',()=>{
  const s=fixture();const e=s.ok('gen10Entregar',{tarea:'task-1',contenido:'Prueba',url:'',revision:0},s.student).registro;
  for(const nota of [-1,5.1,3.45,'5',null])assert.equal(s.post('gen10Calificar',{entrega:e.id,nota,comentario:'',revision:1},s.teacher).ok,false);
  for(const url of ['javascript:alert(1)','http://example.com','https://user@example.com'])assert.equal(s.post('gen10Entregar',{tarea:'task-1',contenido:'',url,revision:1},s.student).ok,false);
  assert.equal(s.post('gen10GuardarTarea',{id:'bad-date',curso:'course-1',titulo:'X',contenido:'X',url:'',publicado:true,fechaLimite:'2026-02-31T10:00:00.000Z',revision:0},s.teacher).ok,false);
  assert.equal(s.post('gen10GuardarUsuario',{email:'admin@example.com',nombre:'A',rol:'estudiante',activo:true,revision:1}).ok,false);
});
test('Gen10: entregas tardías se identifican y acciones desconocidas no escriben historial administrativo',()=>{
  const s=fixture();s.ok('gen10GuardarTarea',{id:'task-1',curso:'course-1',titulo:'Tarea',contenido:'Texto',url:'',publicado:true,fechaLimite:'2020-01-01T00:00:00.000Z',revision:1},s.teacher);
  assert.equal(s.ok('gen10Entregar',{tarea:'task-1',contenido:'Tarde',url:'',revision:0},s.student).registro.tardia,true);
  assert.equal(s.post('gen10Desconocida').ok,false);assert.equal(s.sheets.Historial,undefined);
});

test('Gen10: correo institucional cuando la propiedad falta o queda vac?a',()=>{
 for(const value of [null,'','   ']){
  const s=setup(value), users=s.c.g10Lista_('Usuarios');
  assert.equal(users.length,1);
  assert.equal(users[0].email,'institutoifobe@gmail.com');
  assert.equal(users[0].rol,'admin');
  s.c.configurarPortalGen10();
  assert.equal(s.c.g10Lista_('Usuarios').length,1);
  assert.equal(s.mails.length,0);
 }
});

test('Exámenes: cálculo automático, respuestas privadas, un intento y permisos',()=>{
  const s=fixture();
  const exam={id:'exam-1',curso:'course-1',titulo:'Parcial',contenido:'Responde',url:'',tipo:'examen',publicado:true,fechaLimite:'',revision:0,preguntas:[{enunciado:'Uno',opciones:['A','B','C','D'],correcta:0},{enunciado:'Dos',opciones:['A','B','C','D'],correcta:1},{enunciado:'Tres',opciones:['A','B','C','D'],correcta:2}]};
  s.ok('gen10GuardarTarea',exam,s.teacher);
  const studentExam=s.ok('gen10Estado',{},s.student).tareas.find(t=>t.id==='exam-1');assert.equal('correcta' in studentExam.preguntas[0],false);
  assert.equal(s.ok('gen10Estado',{},s.teacher).tareas.find(t=>t.id==='exam-1').preguntas[0].correcta,0);
  assert.equal(s.post('gen10ResponderExamen',{tarea:'exam-1',respuestas:[0]},s.student).ok,false);
  assert.equal(s.post('gen10ResponderExamen',{tarea:'exam-1',respuestas:[0,1,2]},s.otherTeacher).ok,false);
  assert.equal(s.post('gen10Entregar',{tarea:'exam-1',contenido:'evadir',revision:0},s.student).ok,false);
  const result=s.ok('gen10ResponderExamen',{tarea:'exam-1',respuestas:[0,1,0],nota:5},s.student).registro;
  assert.equal(result.nota,3.3);assert.equal(result.aciertos,2);
  assert.equal(s.ok('gen10ResponderExamen',{tarea:'exam-1',respuestas:[0,1,2]},s.student).registro.nota,3.3);
  assert.equal(s.post('gen10Calificar',{entrega:result.id,nota:5,revision:1},s.teacher).ok,false);
  assert.equal(s.post('gen10GuardarTarea',{...exam,revision:1,preguntas:[{enunciado:'Cambiada',opciones:['A','B','C','D'],correcta:0}]},s.teacher).ok,false);
  s.ok('gen10GuardarTarea',{...exam,id:'exam-expired',fechaLimite:'2020-01-01T00:00:00.000Z'},s.teacher);
  assert.equal(s.post('gen10ResponderExamen',{tarea:'exam-expired',respuestas:[0,1,2]},s.student).ok,false);
});
test('Limites de examen: reloj persistente, vencimiento, intentos y mejor nota',()=>{
  const s=fixture();
  const exam={id:'exam-limits',curso:'course-1',titulo:'Con límites',contenido:'Responde',tipo:'examen',publicado:true,revision:0,duracionMinutos:2,intentosPermitidos:2,preguntas:[{enunciado:'Uno',opciones:['A','B','C','D'],correcta:0},{enunciado:'Dos',opciones:['A','B','C','D'],correcta:1}]};
  assert.equal(s.post('gen10GuardarTarea',{...exam,duracionMinutos:-1},s.teacher).ok,false);
  assert.equal(s.post('gen10GuardarTarea',{...exam,intentosPermitidos:0},s.teacher).ok,false);
  s.ok('gen10GuardarTarea',exam,s.teacher);
  let now=Date.now();const NativeDate=Date;
  s.c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  assert.equal(s.post('gen10ResponderExamen',{tarea:exam.id,respuestas:[0,1]},s.student).ok,false);
  const a=s.ok('gen10IniciarExamen',{tarea:exam.id},s.student).registro;
  assert.equal(Date.parse(a.vence)-Date.parse(a.inicio),120000);
  now+=60000;
  assert.equal(s.ok('gen10IniciarExamen',{tarea:exam.id},s.student).registro.vence,a.vence);
  s.ok('gen10GuardarRespuestaExamen',{tarea:exam.id,numero:a.numero,respuestas:[0,null]},s.student);
  assert.equal(s.ok('gen10Estado',{},s.otherStudent).intentosExamen.length,0);
  assert.equal(s.post('gen10GuardarTarea',{...exam,revision:1,preguntas:[{enunciado:'Cambio',opciones:['A','B','C','D'],correcta:0}]},s.teacher).ok,false);
  now+=60001;
  s.ok('gen10GuardarRespuestaExamen',{tarea:exam.id,numero:a.numero,respuestas:[0,1]},s.student);
  const first=s.ok('gen10ResponderExamen',{tarea:exam.id,numero:a.numero,respuestas:[0,1]},s.student).registro;
  assert.equal(first.nota,2.5,'Después del plazo usa solo respuestas guardadas');
  assert.equal(s.ok('gen10ResponderExamen',{tarea:exam.id,numero:a.numero},s.student).registro.historialIntentos.length,1);
  const b=s.ok('gen10IniciarExamen',{tarea:exam.id},s.student).registro;
  assert.equal(b.numero,2);
  const second=s.ok('gen10ResponderExamen',{tarea:exam.id,numero:b.numero,respuestas:[2,2]},s.student).registro;
  assert.equal(second.nota,2.5);assert.equal(second.historialIntentos.length,2);
  assert.equal(s.post('gen10IniciarExamen',{tarea:exam.id},s.student).ok,false);
  assert.equal(s.c.g10Lista_('Entregas').filter(e=>e.tarea===exam.id).length,1);
});

test('Porcentajes: el docente configura su curso y se conservan al editar',()=>{
  const s=fixture();const course=s.ok('gen10Estado',{},s.teacher).cursos[0];
  const saved=s.ok('gen10GuardarCurso',{...course,pesoTareas:70},s.teacher).registro;
  assert.equal(saved.pesoTareas,70);
  assert.equal(s.post('gen10GuardarCurso',{...saved,pesoTareas:101},s.teacher).ok,false);
  assert.equal(s.post('gen10GuardarCurso',{...saved,pesoTareas:50},s.student).ok,false);
  const fields={...saved};delete fields.pesoTareas;
  assert.equal(s.ok('gen10GuardarCurso',fields,s.teacher).registro.pesoTareas,70);
});

test('Foto de perfil se guarda solo en la cuenta propia, se conserva y se puede quitar',()=>{
  const s=fixture(),u=s.c.g10Usuario_('teacher@example.com');
  const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,16,255,217]).toString('base64');
  const save=fields=>s.ok('gen10GuardarDatosUsuario',{nombre:u.nombre,revision:s.c.g10Usuario_(u.email).revision,...fields},s.teacher);
  save({fotoPerfil:photo,email:'student@example.com'});
  assert.equal(s.ok('gen10Estado',{},s.teacher).perfil.fotoPerfil,photo);
  assert.equal(s.c.g10Usuario_('student@example.com').fotoPerfil,undefined);
  assert.equal(s.c.g10Publico_(s.c.g10Usuario_(u.email)).fotoPerfil,undefined);
  save({telefono:'3001234567'});
  assert.equal(s.ok('gen10Estado',{},s.teacher).perfil.fotoPerfil,photo);
  for(const value of ['data:image/svg+xml;base64,AAAA','data:image/jpeg;base64,AAAA','x'.repeat(30001)])assert.equal(s.post('gen10GuardarDatosUsuario',{nombre:u.nombre,revision:s.c.g10Usuario_(u.email).revision,fotoPerfil:value},s.teacher).ok,false);
  save({fotoPerfil:''});
  assert.equal(s.ok('gen10Estado',{},s.teacher).perfil.fotoPerfil,'');
});

test('Mi perfil usa la cuenta de sesion y conserva los expedientes ajenos',()=>{
  const s=fixture();
  const teacher=s.c.g10Usuario_('teacher@example.com');
  const before=JSON.stringify(s.c.g10Usuario_('student@example.com'));
  s.ok('gen10GuardarDatosUsuario',{nombre:'Docente actualizado',telefono:'3000000000',direccion:'Mi direccion',ciudad:'Mi ciudad',revision:teacher.revision,email:'student@example.com',id:'student@example.com',rol:'admin',archivos:[]},s.teacher);
  const state=s.ok('gen10Estado',{},s.teacher);
  assert.equal(state.perfil.email,teacher.email);
  assert.equal(state.perfil.nombre,'Docente actualizado');
  assert.equal(state.perfil.rol,'docente');
  assert.equal(state.perfil.archivos,undefined);
  assert.equal(state.expediente,null);
  assert.equal(state.expedientes.length,0);
  assert.equal(JSON.stringify(s.c.g10Usuario_('student@example.com')),before);
  assert.equal(s.post('gen10GuardarDatosUsuario',{nombre:'Cambio viejo',revision:teacher.revision},s.teacher).ok,false);
});

test('Comunidad: foros por curso y soporte privado',()=>{
 const s=fixture();
 const topic=s.ok('gen10PublicarComunidad',{id:'topic-one',tipo:'foro',curso:'course-1',titulo:'Pregunta',contenido:'Hola'},s.student).registro;
 assert.equal(topic.curso,'course-1');
 assert.equal(s.post('gen10PublicarComunidad',{id:'topic-other',tipo:'foro',curso:'course-2',titulo:'Pregunta',contenido:'Hola'},s.student).ok,false);
 const ticket=s.ok('gen10PublicarComunidad',{id:'ticket-one',tipo:'soporte',titulo:'Ayuda',contenido:'No abre'},s.student).registro;
 assert.equal(s.ok('gen10Estado',{},s.teacher).soporte.length,0);
 s.ok('gen10PublicarComunidad',{id:'reply-one',tipo:'soporte',padre:ticket.id,contenido:'Respuesta'});
 assert.equal(s.ok('gen10Estado',{},s.student).soporte.length,2);
 assert.equal(s.post('gen10PublicarComunidad',{id:'reply-bad',tipo:'soporte',padre:ticket.id,contenido:'Respuesta'},s.teacher).ok,false);
});

test('Comunidad: adjuntos en temas y respuestas respetan permisos',()=>{
 const s=fixture(),archivo={nombre:'guia.pdf',base64:Buffer.from('%PDF-1.4 ejemplo').toString('base64')};
 const topic=s.ok('gen10PublicarComunidad',{id:'media-topic',tipo:'foro',curso:'course-1',titulo:'Material',contenido:'Mi aporte',archivos:[archivo]},s.student).registro;
 assert.equal(topic.archivos.length,1);
 assert.equal(s.ok('gen10LeerArchivo',{tabla:'Foros',registro:topic.id,archivo:topic.archivos[0].id},s.teacher).archivo.nombre,'guia.pdf');
 const reply=s.ok('gen10PublicarComunidad',{id:'media-reply',tipo:'foro',curso:'course-1',padre:topic.id,contenido:'Respuesta',archivos:[archivo]},s.teacher).registro;
 assert.equal(s.ok('gen10LeerArchivo',{tabla:'Foros',registro:reply.id,archivo:reply.archivos[0].id},s.student).archivo.nombre,'guia.pdf');
 const ticket=s.ok('gen10PublicarComunidad',{id:'media-ticket',tipo:'soporte',titulo:'Error',contenido:'Captura',archivos:[archivo]},s.student).registro;
 assert.equal(s.post('gen10LeerArchivo',{tabla:'Soporte',registro:ticket.id,archivo:ticket.archivos[0].id},s.teacher).ok,false);
 assert.equal(s.post('gen10PublicarComunidad',{id:'media-invalid',tipo:'foro',curso:'course-1',titulo:'Material',contenido:'Prueba',archivos:[{nombre:'falso.mp4',base64:archivo.base64}]},s.student).ok,false);
});

test('PQRS: seguimiento exclusivo de administracion, historial y avisos privados',()=>{
 const s=fixture();
 const t=s.ok('gen10PublicarComunidad',{id:'pqrs-test',tipo:'soporte',tipoPQRS:'Queja',titulo:'Mi solicitud',contenido:'Necesito seguimiento'},s.student).registro;
 assert.equal(t.estado,'Recibida');assert.equal(t.tipoPQRS,'Queja');
 assert.equal(s.post('gen10SeguimientoPQRS',{id:t.id,revision:t.revision,estado:'Resuelta',detalle:'Cambio'},s.student).ok,false);
 const updated=s.ok('gen10SeguimientoPQRS',{id:t.id,revision:t.revision,estado:'Resuelta',detalle:'Solucion aplicada'}).registro;
 assert.equal(updated.historial.length,2);assert.equal(updated.estado,'Resuelta');
 assert.equal(s.post('gen10SeguimientoPQRS',{id:t.id,revision:t.revision,estado:'Cerrada',detalle:'Anterior'}).ok,false);
 const student=s.ok('gen10Estado',{},s.student);
 assert.ok(student.notificaciones.some(n=>n.pqrs===t.id));
 assert.equal(s.ok('gen10Estado',{},s.teacher).notificaciones.some(n=>n.pqrs===t.id),false);
 assert.equal(student.soporte.find(r=>r.id===t.id).historial[1].detalle,'Solucion aplicada');
});

test('PQRS cerrada bloquea respuestas de estudiante y docente hasta reapertura',()=>{
 const s=fixture();
 for(const [i,user] of [s.student,s.teacher].entries()){
 const ticket=s.ok('gen10PublicarComunidad',{id:'closed-ticket-'+i,tipo:'soporte',titulo:'Ayuda',contenido:'Consulta'},user).registro;
 const closed=s.ok('gen10SeguimientoPQRS',{id:ticket.id,revision:ticket.revision,estado:'Cerrada',detalle:'Caso finalizado'}).registro;
 assert.equal(s.post('gen10PublicarComunidad',{id:'blocked-reply-'+i,tipo:'soporte',padre:ticket.id,contenido:'Respuesta tardia'},user).ok,false);
 s.ok('gen10SeguimientoPQRS',{id:ticket.id,revision:closed.revision,estado:'Recibida',detalle:'Reabierto'});
 assert.equal(s.ok('gen10PublicarComunidad',{id:'allowed-reply-'+i,tipo:'soporte',padre:ticket.id,contenido:'Respuesta tras reapertura'},user).registro.padre,ticket.id);
 }
});

 test('Fichas de cursos se asignan, persisten y no se duplican',()=>{
 const s=fixture();
 const state=s.ok('gen10Estado');
 assert.ok(state.cursos.length);
 state.cursos.forEach(c=>assert.match(c.ficha,/^\d{2}V\d{5}$/));
 assert.equal(new Set(state.cursos.map(c=>c.ficha)).size,state.cursos.length);
 const c=state.cursos.find(c=>c.id==='course-1');
 assert.equal(s.ok('gen10Estado').cursos.find(x=>x.id===c.id).ficha,c.ficha);
 assert.equal(s.c.g10Lista_('Cursos').find(x=>x.id===c.id).ficha,c.ficha);
 const updated=s.ok('gen10GuardarCurso',{...c,ficha:'26V53337'}).registro;
 assert.equal(updated.ficha,'26V53337');
 assert.throws(()=>s.c.g10FichaCurso_('26V53337','different-course'),/otro curso/);
 assert.throws(()=>s.c.g10FichaCurso_('incorrecta',c.id),/formato/);
 const copy=s.ok('gen10ReutilizarCurso',{id:updated.id,revision:updated.revision,nuevoId:'ficha-nuevo-grupo-001',titulo:'Nuevo grupo'}).registro;
 assert.notEqual(copy.ficha,updated.ficha);
 });
