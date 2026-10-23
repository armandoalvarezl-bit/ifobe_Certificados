const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const serverCode = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const clientCode = fs.readFileSync(path.join(root, 'inscripcion.js'), 'utf8');
test('sheet helper rejects missing arguments before accessing Sheets',()=>{
  const ctx=vm.createContext({});vm.runInContext(serverCode,ctx);
  for(const args of [['Inscripciones'],['Inscripciones',[]],['', ['Nombre']],['Inscripciones',['']]]) {
    assert.throws(()=>ctx.getHoja(...args),/configurarInscripciones/);
  }
});
test('running getHoja without arguments creates the missing sheet and reuses it',()=>{
  const props={}, rows=[];let folders=0, exists=false, sheetsCreated=0;
  const sheet={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),setFrozenRows(){},
    getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),
    getRange(row,col,height=1,width=1){return {
      getDisplayValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(rows[row-1+i]?.[col-1+j]??''))),
      setValue(value){(rows[row-1]||=[])[col-1]=value}
    }}
  };
  const book={getId:()=> 'book',getName:()=> 'IFOBE',getSheetByName:()=>exists?sheet:null,insertSheet:name=>{assert.equal(name,'Inscripciones');exists=true;sheetsCreated++;return sheet}};
  const folder={getId:()=> 'folder',getUrl:()=> 'https://drive.example/folder'};
  const ctx=vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:()=>book},
    DriveApp:{createFolder:()=>{folders++;return folder},getFolderById:()=>folder},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Logger:{log(){}},MailApp:{getRemainingDailyQuota:()=>100},Session:{getEffectiveUser:()=>({getEmail:()=> 'institutoifobe@gmail.com'})}
  });
  vm.runInContext(serverCode,ctx);assert.equal(ctx.getHoja(),sheet);ctx.getHoja();ctx.configurarInscripciones();
  assert.equal(rows.length,1);assert.ok(rows[0].length>0);assert.equal(sheetsCreated,1);assert.equal(folders,1);assert.equal(props.SPREADSHEET_ID,'book');
});

function payload() {
  return { accion:'inscribirEstudiante', solicitudId:'12345678-1234-4234-8234-123456789abc', datos:{
    nombres:'Ana',apellidos:'Prueba',tipoDocumento:'CC',cedula:'00123456',fechaNacimiento:'2000-01-01',lugarExpedicion:'Bogotá',correo:'ana@example.com',telefono:'+57 300 1234567',pais:'Colombia',departamento:'Bogotá',ciudad:'Bogotá',direccion:'Calle 1',programa:'Programa de prueba',nivelEstudios:'Bachiller',institucionAnterior:'',confirmacion:'on'
  }, archivos:[] };
}
function server(mailFailure=false, account='institutoifobe@gmail.com') {
  const rows = [], files = [], mails = [], alumnos=[], catalogo=[['Programa','Activo'],['Programa de prueba','SI'],['=IMPORTXML("test")','SI']], envios=[];
  const makeSheet = rows => ({
    getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),
    getLastRow:()=>rows.length, appendRow:row=>rows.push(Array.from(row)), setFrozenRows(){},
    getDataRange(){return {getValues:()=>rows,getDisplayValues:()=>rows.map(r=>r.map(String))}},
    getRange(row,col,height,width) { return {
      getDisplayValues:()=>Array.from({length:height||1},(_,i)=>Array.from({length:width||1},(_,j)=>String(rows[row-1+i]?.[col-1+j]??''))),
      getValues:()=>rows.slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width)),
      getValue:()=>rows[row-1][col-1], setNumberFormat(){},
      setValue(value){(rows[row-1]||=[])[col-1]=value},
      setValues(values){values.forEach((r,i)=>r.forEach((v,j)=>(rows[row-1+i]||=[])[col-1+j]=v))},
      createTextFinder(id){return {matchEntireCell(){return this},findNext(){const i=rows.findIndex(r=>r[0]===id);return i<0?null:{getRow:()=>i+1}}}}
    }}
  });
  const sheet=makeSheet(rows), sheets={Matriculas:makeSheet([]),Inscripciones:sheet,Alumnos:makeSheet(alumnos),Programas:makeSheet(catalogo),EnviosDiplomas:makeSheet(envios)};
  const ctx = vm.createContext({
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
    Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(bytes,type,name)=>({bytes,type,name})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key})},
    SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]}),flush(){}},
    CacheService:{getScriptCache:()=>({get:token=>token==='sesion:valida'?'coordinador':null})},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>{if(mailFailure)throw Error('Mail error');mails.push(message)}},
    Session:{getEffectiveUser:()=>({getEmail:()=>account})},
    DriveApp:{getFileById:id=>({getBlob:()=>files[Number(id)].blob}),getFolderById:()=>({createFile:blob=>{const id=files.length;const f={blob,getId:()=>String(id),getUrl:()=> 'https://drive.example/'+files.length,setTrashed(){}};files.push(f);return f}})}
  });
  vm.runInContext(serverCode,ctx);
  return {ctx,rows,files,mails,alumnos,catalogo,envios,post:p=>ctx.doPost({postData:{contents:JSON.stringify(p)}})};
}
test('matriculas authenticate, validate, avoid duplicates and detect concurrent edits',()=>{
  const s=server();s.post(payload());
  const p={accion:'guardarMatricula',token:'valida',id:'12345678-1234-4234-8234-123456789abc',cedula:'00123456',programa:'Programa de prueba',periodo:'2026-2',jornada:'Noche',estado:'Activa',observaciones:'',revision:''};
  assert.equal(s.post({accion:'gestionMatriculas',token:''}).ok,false);
  for(const change of [{token:''},{cedula:'missing'},{programa:'missing'},{periodo:''},{estado:'invalid'},{jornada:'invalid'},{observaciones:'x'.repeat(2001)}])assert.equal(s.post({...p,...change}).ok,false);
  assert.equal(s.post(p).matricula.cedula,'00123456');
  assert.equal(s.post(p).matricula.revision,'1');
  assert.equal(s.post({accion:'gestionMatriculas',token:'valida'}).matriculas.length,1);
  assert.equal(s.post({...p,id:'22345678-1234-4234-8234-123456789abc'}).ok,false);
  assert.equal(s.post({...p,estado:'Finalizada',revision:''}).ok,false);
  assert.equal(s.post({...p,estado:'Finalizada',revision:'1'}).matricula.revision,'2');
  assert.equal(s.post({...p,estado:'Cancelada',revision:'1'}).ok,false);
  assert.equal(s.post({...p,estado:'Cancelada',revision:'2'}).ok,true);
  assert.equal(s.post({...p,id:'22345678-1234-4234-8234-123456789abc'}).ok,true);
  assert.equal(s.post({...p,revision:'3'}).ok,false);
});

test('active enrollment sends one confirmation; pending and ambiguous retries do not send',()=>{
  const s=server();s.post(payload());s.mails.length=0;
  const p={accion:'guardarMatricula',token:'valida',id:'12345678-1234-4234-8234-123456789abc',cedula:'00123456',programa:'Programa de prueba',periodo:'2026-2',jornada:'Noche',estado:'Pendiente',observaciones:'',revision:''};
  assert.equal(s.post(p).correoEnviado,false);assert.equal(s.mails.length,0);
  const active={...p,estado:'Activa',revision:'1'};
  assert.equal(s.post(active).correoEnviado,true);assert.equal(s.mails.length,1);
  assert.equal(s.mails[0].to,'ana@example.com');assert.match(s.mails[0].subject,/matrícula/);assert.match(s.mails[0].htmlBody,/2026-2/);
  assert.equal(s.post(active).correoEnviado,true);assert.equal(s.mails.length,1);
  const failed=server(true);failed.post(payload());
  const result=failed.post({...p,estado:'Activa'});assert.equal(result.ok,true);assert.equal(result.correoEnviado,false);
  assert.match(failed.post({...p,estado:'Activa'}).correoMensaje,/verificación/);
});

test('finalization sends a separate email once and retains active confirmation',()=>{
  const s=server();s.post(payload());s.mails.length=0;
  const p={accion:'guardarMatricula',token:'valida',id:'12345678-1234-4234-8234-123456789abc',cedula:'00123456',programa:'Programa de prueba',periodo:'2026-2',jornada:'Noche',estado:'Activa',observaciones:'',revision:''};
  Object.assign(p,{cicloAcademico:'Ciclo 2',notaFinal:'4.5',estadoAcademico:'',seguimientoAcademico:'Completo',historialAcademico:[{estado:'Aprobado'}]});
  assert.equal(s.post(p).correoEnviado,true);
  const final={...p,estado:'Finalizada',revision:'1'};
  assert.equal(s.post(final).correoEnviado,true);assert.equal(s.mails.length,2);
  const stored=s.post({accion:'gestionMatriculas',token:'valida'}).matriculas[0];
  for(const key of ['cicloAcademico','notaFinal','estadoAcademico','seguimientoAcademico'])assert.equal(stored[key],p[key]);
  assert.equal(JSON.stringify(stored.historialAcademico),JSON.stringify(p.historialAcademico));
  assert.equal(s.mails[1].to,'ana@example.com');assert.match(s.mails[1].subject,/Finalización/);
  assert.match(s.mails[1].body,/Programa de prueba/);assert.equal(s.mails[1].attachments,undefined);
  assert.equal(s.post(final).correoEnviado,true);assert.equal(s.mails.length,2);
  assert.equal(s.post({...p,revision:'2'}).correoEnviado,true);assert.equal(s.mails.length,2);
  const partial={...p,estado:'Finalizada',revision:'3'};
  for(const key of ['cicloAcademico','notaFinal','estadoAcademico','seguimientoAcademico','historialAcademico'])delete partial[key];
  const preserved=s.post(partial);assert.equal(preserved.ok,true);assert.equal(preserved.matricula.notaFinal,'4.5');assert.equal(preserved.matricula.cicloAcademico,'Ciclo 2');assert.equal(s.mails.length,2);
  const failed=server();failed.post(payload());failed.post(p);
  failed.ctx.MailApp.sendEmail=()=>{throw Error('Mail error')};
  assert.equal(failed.post(final).correoEnviado,false);
  assert.match(failed.post(final).correoMensaje,/verificación/);
});

test('academic transitions notify once, preserve records and allow returning to a prior state',()=>{
  const s=server();s.post(payload());s.mails.length=0;
  let p={accion:'guardarMatricula',token:'valida',id:'12345678-1234-4234-8234-123456789abc',cedula:'00123456',programa:'Programa de prueba',periodo:'2026-2',jornada:'Noche',estado:'Activa',observaciones:'',revision:'',estadoAcademico:'En curso',notaFinal:'4.5',historialAcademico:[{estado:'Aprobado'}]};
  let result=s.post(p);assert.equal(result.correoEnviado,true);assert.equal(s.mails.length,1);
  assert.equal(s.post(p).correoEnviado,true);assert.equal(s.mails.length,1);
  for(const estadoAcademico of ['Aprobado','Certificado','En curso']){
    p={...p,revision:result.matricula.revision,estadoAcademico};
    result=s.post(p);assert.equal(result.correoEnviado,true);
    assert.match(s.mails.at(-1).subject,new RegExp(estadoAcademico));
    assert.equal(result.matricula.notaFinal,'4.5');assert.equal(result.matricula.historialAcademico[0].estado,'Aprobado');
    assert.equal(s.post(p).correoEnviado,true);
  }
  assert.equal(s.mails.length,4);
  result=s.post({...p,revision:result.matricula.revision,observaciones:'Actualización administrativa'});
  assert.equal(result.ok,true);assert.equal(s.mails.length,4);
  p={...p,revision:result.matricula.revision,estadoAcademico:'Graduado'};
  s.ctx.MailApp.getRemainingDailyQuota=()=>0;
  result=s.post(p);assert.equal(result.ok,true);assert.equal(result.correoPendiente,true);
  s.ctx.MailApp.getRemainingDailyQuota=()=>100;
  assert.equal(s.post(p).correoEnviado,true);assert.equal(s.mails.length,5);
});

test('legacy academic blocks move into columns and migration does not send email',()=>{
  const s=server();s.post(payload());
  const block='Nota administrativa\n[IFOBE_ACADEMICO]\n'+JSON.stringify({ciclo:'2026-2',nota:'4.7',estado:'Aprobado',seguimiento:'Completo',historial:[{ciclo:'2025'}]})+'\n[/IFOBE_ACADEMICO]';
  const p={accion:'guardarMatricula',token:'valida',id:'12345678-1234-4234-8234-123456789abc',cedula:'00123456',programa:'Programa de prueba',periodo:'2026-2',jornada:'Noche',estado:'Pendiente',observaciones:block,revision:''};
  const saved=s.post(p);assert.equal(saved.ok,true);assert.equal(saved.matricula.observaciones,'Nota administrativa');assert.equal(saved.matricula.notaFinal,'4.7');
  const sheet=s.ctx.getHoja('Matriculas',['ID']);
  sheet.getRange(2,10).setValue(block);sheet.getRange(2,15,1,5).setValues([['','','','','']]);
  const mails=s.mails.length;
  assert.match(s.ctx.migrarObservacionesAcademicas(),/Registros corregidos: 1/);
  assert.equal(sheet.getRange(2,10).getValue(),'Nota administrativa');assert.equal(sheet.getRange(2,16).getValue(),'4.7');
  assert.equal(JSON.parse(sheet.getRange(2,19).getValue())[0].ciclo,'2025');
  assert.match(s.ctx.migrarObservacionesAcademicas(),/Registros corregidos: 0/);assert.equal(s.mails.length,mails);
  const malformed={observaciones:'[IFOBE_ACADEMICO]incompleto[/IFOBE_ACADEMICO]'};
  assert.equal(s.ctx.separarDatosAcademicos_(malformed).observaciones,malformed.observaciones);
});

test('migration aligns academic headers without moving grades or email records',()=>{
  const s=server();s.post(payload());
  const sheet=s.ctx.getHoja('Matriculas',['ID']);
  sheet.getRange(1,15,1,5).setValues([['Columna 1','Columna 2','Columna 3','','']]);
  sheet.getRange(1,20,1,8).setValues([['ConfirmaciÃ³n por correo','CicloAcademico','NotaFinal','EstadoAcademico','SeguimientoAcademico','HistorialAcademico','Finalización por correo','Detalle del correo de finalización']]);
  sheet.getRange(2,1).setValue('registro-prueba');sheet.getRange(2,15,1,5).setValues([['2026-2','4.8','Certificado','','[]']]);sheet.getRange(2,26).setValue('Enviado');
  s.ctx.migrarObservacionesAcademicas();
  assert.equal(sheet.getRange(1,15).getValue(),'CicloAcademico');assert.equal(sheet.getRange(1,16).getValue(),'NotaFinal');
  assert.equal(sheet.getRange(2,16).getValue(),'4.8');assert.equal(sheet.getRange(1,21).getValue(),'');assert.equal(sheet.getRange(2,26).getValue(),'Enviado');
});

test('academic email escapes values and includes branded HTML and plain text',()=>{
  const s=server();const m=s.ctx.mensajeAcademico_('ana@example.com','Tu certificado está listo','Copia del certificado',[['Programa','<script>bad</script>'],['Código','ABC-123']],'PDF adjunto sin firma manuscrita.');
  assert.match(m.htmlBody,/cid:logoIfobe/);assert.match(m.htmlBody,/&lt;script&gt;/);assert.doesNotMatch(m.htmlBody,/<script>/);assert.match(m.body,/ABC-123/);assert.ok(m.inlineImages.logoIfobe);
});

test('confirmation uses institutional sender and is sent once after storage',()=>{
  const s=server(),p=payload();assert.equal(s.post(p).correoEnviado,true);
  assert.equal(s.post(p).correoEnviado,true);assert.equal(s.mails.length,1);
  assert.equal(s.mails[0].name,'Admisiones IFOBE');assert.equal(s.mails[0].to,p.datos.correo);
  assert.equal(s.mails[0].replyTo,'institutoifobe@gmail.com');assert.equal(s.mails[0].noReply,undefined);
  assert.ok(!s.mails[0].body.includes(p.datos.cedula));assert.equal(s.mails[0].attachments,undefined);
});

test('registration creates a searchable student with full name, document zeros, email and program',()=>{
  const s=server(),p=payload();assert.equal(s.post(p).ok,true);
  assert.deepEqual(Array.from(s.alumnos[1]),['00123456','Ana Prueba','ana@example.com','Programa de prueba','Pendiente de revisión']);
  s.post(p);assert.equal(s.alumnos.length,2);
  assert.equal(s.ctx.listarAlumnos().alumnos['00123456'],'Ana Prueba');
});
test('inactive and unknown programs cannot create registrations',()=>{
  const s=server(),p=payload();p.datos.programa='No existe';
  assert.equal(s.post(p).ok,false);assert.equal(s.rows.length,1);assert.equal(s.alumnos.length,0);
  p.datos.programa='Programa de prueba';s.catalogo[1][1]='NO';
  assert.equal(s.post(p).ok,false);assert.equal(s.files.length,0);
});
function emision(){return {accion:'enviarDiploma',token:'valida',emisionId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',cedula:'00123456',nombre:'Ana Prueba',programa:'Programa de prueba',codigo:'IFOBE-prueba',pdf:Buffer.from('%PDF-1.4 copia sin firma').toString('base64')}}
test('manual student creation and editing persist program and email without losing state',()=>{
  const s=server(),d={accion:'agregarAlumno',token:'valida',cedula:'00042',nombre:'Ana Manual',correo:'ana@example.com',programa:'Programa de prueba'};
  assert.equal(s.post(d).ok,true);
  assert.deepEqual(Array.from(s.alumnos[1]),['00042','Ana Manual','ana@example.com','Programa de prueba','Pendiente de revisión']);
  s.alumnos[1][4]='Revisado';
  assert.equal(s.post({...d,accion:'editarAlumno',cedulaOriginal:'00042',correo:'nuevo@example.com'}).ok,true);
  assert.equal(s.alumnos[1][2],'nuevo@example.com');assert.equal(s.alumnos[1][4],'Revisado');
  assert.equal(s.post(d).ok,false);assert.equal(s.alumnos.length,2);
});
test('manual student writes reject missing session, invalid program and duplicate document edits',()=>{
  const s=server(),d={accion:'agregarAlumno',token:'valida',cedula:'001',nombre:'Ana',correo:'ana@example.com',programa:'Programa de prueba'};
  assert.equal(s.post({...d,token:''}).ok,false);
  assert.equal(s.post({...d,programa:'Desconocido'}).ok,false);
  assert.equal(s.post(d).ok,true);assert.equal(s.post({...d,cedula:'002'}).ok,true);
  assert.equal(s.post({...d,accion:'editarAlumno',cedulaOriginal:'002'}).ok,false);
  assert.equal(s.alumnos[2][0],'002');
});
test('catalog tolerates blank active cells and de-duplicates active programs',()=>{
  const s=server();s.catalogo.push(['Sin activar'],['Programa de prueba','SI']);
  assert.deepEqual(Array.from(s.ctx.programas_()),['Programa de prueba','=IMPORTXML("test")']);
});
test('diploma attaches exact PDF bytes to the registered email and retries do not duplicate it',()=>{
  const s=server();s.post(payload());const d=emision();d.correo='otro@example.com';
  assert.equal(s.post(d).correoEnviado,true);assert.equal(s.post(d).correoEnviado,true);
  assert.equal(s.mails.length,2);const mail=s.mails[1];
  assert.equal(mail.to,'ana@example.com');
  assert.equal(Buffer.from(mail.attachments[0].bytes).toString(),'%PDF-1.4 copia sin firma');
  assert.equal(s.envios[1][6],'Enviado');assert.equal(s.files.length,1);
});
test('diploma rejects expired session, stale identity and invalid PDF before writing',()=>{
  for(const change of [d=>d.token='',d=>d.nombre='Otra persona',d=>d.pdf=Buffer.from('not a pdf').toString('base64'),d=>d.programa='No existe']){
    const s=server();s.post(payload());const d=emision();change(d);
    assert.equal(s.post(d).ok,false);assert.equal(s.mails.length,1);assert.equal(s.files.length,0);
  }
});
test('failed email retains original PDF and destination for retry',()=>{
  const s=server(true);s.post(payload());const d=emision();assert.equal(s.post(d).ok,false);
  assert.equal(s.envios[1][6],'Pendiente');
  s.ctx.MailApp.sendEmail=mail=>s.mails.push(mail);
  d.pdf=Buffer.from('%PDF-1.4 changed').toString('base64');s.alumnos[1][2]='changed@example.com';
  assert.equal(s.post(d).correoEnviado,true);
  assert.equal(s.mails[0].to,'ana@example.com');
  assert.equal(Buffer.from(s.mails[0].attachments[0].bytes).toString(),'%PDF-1.4 copia sin firma');
  assert.equal(s.files.length,1);
});
test('another execution account cannot send institutional confirmation',()=>{
  const s=server(false,'otra@gmail.com');const result=s.post(payload());
  assert.equal(result.ok,true);assert.equal(result.correoEnviado,false);assert.equal(s.mails.length,0);
  assert.ok(s.rows[1].some(value=>String(value).includes('configurar ejecuci')));
});

test('confirmation embeds the institutional logo and escapes applicant text',()=>{
  const s=server(),p=payload();p.datos.nombres='<img src=x onerror=alert(1)>';
  assert.equal(s.post(p).correoEnviado,true);
  const mail=s.mails[0];
  assert.ok(mail.htmlBody.includes('cid:logoIfobe'));
  assert.ok(mail.htmlBody.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!mail.htmlBody.includes('<img src=x'));
  assert.equal(mail.inlineImages.logoIfobe.type,'image/png');
  assert.deepEqual(Array.from(mail.inlineImages.logoIfobe.bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);
  assert.ok(mail.htmlBody.includes('Pendiente de revisión'));
  assert.ok(mail.body.includes(p.solicitudId));
  assert.ok(!mail.htmlBody.includes(p.datos.cedula));
});
test('mail failure does not undo enrollment or resend on a duplicate request',()=>{
  const s=server(true),p=payload();const result=s.post(p);
  assert.equal(result.ok,true);assert.equal(result.correoEnviado,false);
  assert.equal(s.post(p).ok,true);assert.equal(s.rows.length,2);
});
test('server stores all data, preserves document zeros, and idempotently saves two files',()=>{
  const s=server(),p=payload();
  p.archivos=[{tipo:'application/pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')},{tipo:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')}];
  p.datos.programa='=IMPORTXML("test")';
  const result=s.post(p);assert.equal(result.ok,true);assert.equal(result.archivosGuardados,2);
  assert.equal(s.rows[1][5],'00123456');assert.ok(s.rows[1].includes("'=IMPORTXML(\"test\")"));
  assert.equal(s.post(p).ok,true);assert.equal(s.rows.length,2);assert.equal(s.files.length,2);
});
test('server rejects missing fields, impossible dates, forged or oversized files before writes',()=>{
  const mutations=[p=>delete p.datos.correo,p=>p.datos.fechaNacimiento='2000-02-31',p=>p.datos.confirmacion='',p=>p.archivos=[{tipo:'image/png',base64:Buffer.from('not an image').toString('base64')}],p=>p.archivos=[{tipo:'application/pdf',base64:'A'.repeat(6990512)}]];
  for(const mutate of mutations){const s=server(),p=payload();mutate(p);assert.equal(s.post(p).ok,false);assert.equal(s.files.length,0);assert.equal(s.rows.length,0)}
});
function client(fetch,configured=true) {
  const elements={};
  function element(){return {value:'',dataset:{},hidden:true,disabled:false,files:[],children:[],listeners:{},resets:0,addEventListener(k,fn){this.listeners[k]=fn},setAttribute(){},removeAttribute(){},focus(){},after(){},reportValidity:()=>true,querySelectorAll:()=>[],reset(){this.resets++},replaceChildren(){this.children=[]},append(...items){this.children.push(...items)}}}
  for(const id of ['inscripcionForm','datos','enviar','estado','otra','documentos','listaArchivos','adjuntosError','fechaNacimiento','nombres','programa','inscripcionCompleta','bienvenida','submitSlot','completionCode','completionDetail','completionTitle'])elements[id]=element();
  elements.bienvenida.showModal=function(){this.open=true};
  const bodyClasses=new Set();
  elements.programa.value='Programa de prueba';
  const ctx=vm.createContext({
    window:{IFOBE_INSCRIPCION:{apiUrl:configured?'https://example.com/exec':''},addEventListener(){}},
    document:{getElementById:id=>elements[id],createElement:()=>element(),body:{classList:{add:name=>bodyClasses.add(name),remove:name=>bodyClasses.delete(name)}}},
    FormData:class{*[Symbol.iterator](){yield* Object.entries(payload().datos)}},
    crypto:{randomUUID:()=>payload().solicitudId},fetch,AbortController,setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL(){}},
    FileReader:class {readAsDataURL(){this.result='data:image/png;base64,iVBORw0KGgo=';this.onload()}}
  });
  vm.runInContext(clientCode,ctx);
  return {elements,submit:()=>elements.inscripcionForm.listeners.submit({preventDefault(){}})};
}
test('client does not send incomplete submissions to the old or unconfigured endpoint',async()=>{
  let calls=0;const c=client(async()=>{calls++},false);await c.submit();assert.equal(calls,0);assert.equal(c.elements.estado.dataset.kind,'error');
});
test('client rejects a legacy success and retries the exact request without duplicate clicks',async()=>{
  const bodies=[];let release;
  const c=client(async(url,options)=>{bodies.push(options.body);if(bodies.length===1)return new Promise(r=>release=r);const p=JSON.parse(options.body);return {ok:true,json:async()=>({version:'inscripciones-v1',ok:true,solicitudId:p.solicitudId,archivosGuardados:0})}});
  const first=c.submit();await Promise.resolve();await Promise.resolve();await c.submit();assert.equal(bodies.length,1);
  release({ok:true,json:async()=>({ok:true})});await first;
  assert.equal(c.elements.estado.dataset.kind,'error');assert.equal(c.elements.datos.disabled,true);assert.equal(c.elements.enviar.disabled,false);
  await c.submit();assert.equal(bodies[0],bodies[1]);assert.equal(c.elements.inscripcionCompleta.hidden,false);
  assert.equal(c.elements.completionCode.textContent,payload().solicitudId);assert.equal(c.elements.estado.hidden,true);
  assert.equal(c.elements.inscripcionForm.resets,1);assert.equal(c.elements.datos.disabled,false);assert.equal(c.elements.enviar.disabled,false);
  c.elements.otra.listeners.click();assert.equal(c.elements.datos.disabled,false);assert.equal(c.elements.inscripcionCompleta.hidden,true);assert.equal(c.elements.enviar.hidden,false);
});
test('client validates file type, size, count and removal',()=>{
  const c=client(()=>{}),e=c.elements;
  function select(files){e.documentos.files=files;e.documentos.listeners.change()}
  select([{name:'bad.exe',type:'application/octet-stream',size:50}]);assert.equal(e.adjuntosError.hidden,false);assert.equal(e.listaArchivos.children.length,0);
  select([{name:'big.pdf',type:'application/pdf',size:6*1024*1024}]);assert.equal(e.listaArchivos.children.length,0);
  const image={name:'cedula.png',type:'image/png',size:300};select([image,image]);assert.equal(e.listaArchivos.children.length,2);
  select([image]);assert.equal(e.listaArchivos.children.length,2);assert.equal(e.adjuntosError.hidden,false);
  e.listaArchivos.children[0].children.at(-1).listeners.click();assert.equal(e.listaArchivos.children.length,1);
});
test('client requires confirmation of every uploaded attachment',async()=>{
  const c=client(async(url,options)=>{const p=JSON.parse(options.body);return {ok:true,json:async()=>({version:'inscripciones-v1',ok:true,solicitudId:p.solicitudId,archivosGuardados:0})}});
  c.elements.documentos.files=[{name:'cedula.png',type:'image/png',size:300}];c.elements.documentos.listeners.change();
  await c.submit();assert.equal(c.elements.estado.dataset.kind,'error');assert.equal(c.elements.otra.hidden,true);
});
test('registration cannot submit while program catalog is unavailable',async()=>{
  let calls=0;const c=client(async()=>{calls++;return {ok:true}});
  c.elements.programa.disabled=true;
  await c.submit();assert.equal(calls,0);
  assert.match(c.elements.estado.textContent,/programa disponible/);
});
test('integrated routes preserve login, students and history',()=>{
  const ctx=vm.createContext({ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
  vm.runInContext(serverCode,ctx);
  for(const name of ['agregarAlumno','editarAlumno','eliminarAlumno','listarAlumnos','validarLogin','listarHistorial']) ctx[name]=()=>name;
  for(const action of ['agregarAlumno','editarAlumno','eliminarAlumno']) assert.equal(ctx.doPost({postData:{contents:JSON.stringify({accion:action})}}),action);
  assert.equal(ctx.doGet({parameter:{accion:'alumnos'}}),'listarAlumnos');
  assert.equal(ctx.doGet({parameter:{accion:'login'}}),'validarLogin');
  assert.equal(ctx.doGet({parameter:{accion:'listar'}}),'listarHistorial');
  assert.equal(ctx.doGet(), 'listarHistorial');
  let row;ctx.getHojaHistorial=()=>({appendRow:r=>row=r});
  assert.equal(ctx.doPost({postData:{contents:JSON.stringify({fecha:'2026',tipo:'certificado',cedula:'123',nombre:'Prueba',programa:'Curso',horas:'40',semestre:'1',codigo:'ABC'})}}).ok,true);
  assert.deepEqual(Array.from(row),['2026','certificado','123','Prueba','Curso','40','1','ABC']);
  assert.equal(ctx.doGet({parameter:{accion:'estadoInscripciones'}}).version,'inscripciones-v1');
});
