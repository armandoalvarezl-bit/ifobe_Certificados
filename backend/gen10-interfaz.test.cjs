const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../gen10.html','utf8');
const script=fs.readFileSync(__dirname+'/../gen10.js','utf8');

test('Inicio muestra el curso bloqueado por pago sin pedir transferencia al alumno',async()=>{
  const data=state();data.cursos=[];data.lecciones=[];data.tareas=[];
  data.accesoPendiente=[{titulo:'Curso pendiente'}];
  const c=client(service(data));await c.login();
  const html=c.node('view').innerHTML;
  assert.match(html,/Acceso pendiente de pago/);
  assert.match(html,/Curso pendiente/);
  assert.match(html,/Tu docente debe registrar el pago/);
  assert.doesNotMatch(html,/data-action="registrar-pago"/);
});

test('Curso culminado queda visible para consulta y oculta acciones de entrega',async()=>{
  const data=state();data.cursos[0].estado='Culminado';
  const c=client(service(data));await c.login();
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'curso',id:'course-1'}})}});
  assert.match(c.node('view').innerHTML,/Curso culminado/);
  assert.doesNotMatch(c.node('view').innerHTML,/data-action="estado-curso"|data-action="completar"/);
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'tab',id:'tareas'}})}});
  assert.doesNotMatch(c.node('view').innerHTML,/data-action="entregar"/);
});

test('Docente cambia estado mediante confirmación y revisión del curso',async()=>{
  const data=state('docente');data.cursos[0].revision=7;
  const c=client(service(data));await c.login();
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'curso',id:'course-1'}})}});
  assert.match(c.node('view').innerHTML,/data-action="estado-curso"/);
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'estado-curso',id:'course-1'}})}});
  assert.match(c.node('editorFields').innerHTML,/Cerrado.*Culminado/s);
  assert.doesNotMatch(c.node('editorFields').innerHTML,/<option value="Activo"/);
});
function client(fetch, remembered=new Map()) {
  const nodes={},requests=[],storage=new Map([['ifobeSesion','admin-existing']]);
  function node(id){return nodes[id]||={id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},listeners:{},attributes:{},
    addEventListener(name,fn){this.listeners[name]=fn},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},focus(){},
    replaceChildren(){this.innerHTML=''},close(){this.open=false},showModal(){this.open=true},querySelector(){return node(id+'-button')},querySelectorAll(){return []}
  };}
  for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))node(m[1]).hidden=/\bhidden\b/.test(m[0]);
  const nav=['inicio','cursos','tareas','examenes','seguimiento','administracion'].map(v=>{const n=node('nav-'+v);n.dataset.view=v;return n});
  const ctx=vm.createContext({AbortController,setTimeout,clearTimeout,TypeError,crypto:require('node:crypto').webcrypto,
    FormData:class {constructor(form){this.values=form.values||{}}get(key){return this.values[key]??null}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]()}},
    localStorage:{getItem:k=>remembered.get(k)||null,setItem:(k,v)=>remembered.set(k,v)},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    window:{IFOBE_INSCRIPCION:{apiUrl:'https://example.com/exec'},scrollTo(){}},
    document:{getElementById:id=>nodes[id]||(nodes.editorFields?.innerHTML.includes(`id="${id}"`)?node(id):null),addEventListener(name,fn){node("document").listeners[name]=fn},querySelectorAll:selector=>selector==='[data-view]'?nav:[]},
    fetch:async(url,options)=>{const payload=JSON.parse(options.body);requests.push(payload);return {ok:true,json:async()=>fetch(payload)}}
  });
  vm.runInContext(fs.readFileSync(__dirname+'/../gen10-archivos.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync(__dirname+'/../gen10-perfil.js','utf8'),ctx);
  for(const name of ['gen10-soporte.js','gen10-expedientes.js'])vm.runInContext(fs.readFileSync(__dirname+'/../'+name,'utf8'),ctx);
  vm.runInContext(script,ctx);
  const submit=id=>node(id).listeners.submit({preventDefault(){},target:node(id)});
  async function login(){node('loginEmail').value='student@example.com';node('loginPassword').value='Mi contraseña de prueba';await submit('loginForm');}
  return {node,requests,storage,remembered,submit,login,nav};
}
function state(rol='estudiante'){
  return {ok:true,portal:'gen10-v1',usuario:{email:'student@example.com',nombre:'<img src=x onerror=alert(1)>',rol},
    cursos:[{id:'course-1',titulo:'<script>bad()</script>',descripcion:'Mi curso',publicado:true}],
    lecciones:[{id:'lesson-1',curso:'course-1',titulo:'Tema',contenido:'Texto',orden:1,publicado:true}],
    tareas:[{id:'task-1',curso:'course-1',titulo:'Tarea',contenido:'Instrucción',publicado:true}],
    inscritos:[{curso:'course-1',email:'student@example.com',activo:true}],progreso:[],usuarios:[],
    entregas:[{id:'submission',curso:'course-1',tarea:'task-1',email:'student@example.com',nota:0,contenido:'Respuesta',url:'',comentario:'Revisar'}]};
}
function service(snapshot=state()){return d=>d.accion==='gen10Estado'?snapshot:['gen10Login','gen10VerificarCodigo'].includes(d.accion)?{ok:true,portal:'gen10-v1',autenticacion:'password-v1',token:'campus-session'}:{ok:true,portal:'gen10-v1',mensaje:'Revisa tu correo'};}

test('Solo administrador ve configuración y confirma contraseñas antes de enviarlas',async()=>{
  const snapshot=state('admin');snapshot.usuarios=[{id:'alumno',email:'alumno@example.com',nombre:'Alumno',rol:'estudiante',activo:true,revision:3}];
  const c=client(service(snapshot));await c.login();c.nav.find(n=>n.dataset.view==='administracion').listeners.click();
  assert.match(c.node('view').innerHTML,/Configuración de roles y contraseñas/);
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'password-usuario',id:'alumno'}})}});
  c.node('editorForm').values={password:'Contraseña nueva 2026',confirmPassword:'otra clave',enviarCorreo:'on'};
  await c.submit('editorForm');assert.equal(c.requests.some(r=>r.accion==='gen10ConfigurarPassword'),false);
  c.node('editorForm').values.confirmPassword='Contraseña nueva 2026';await c.submit('editorForm');
  assert.equal(c.requests.find(r=>r.accion==='gen10ConfigurarPassword').revision,3);
  const teacher=client(service(state('docente')));await teacher.login();
  await teacher.node('view').listeners.click({target:{closest:()=>({dataset:{action:'password-usuario',id:'alumno'}})}});
  assert.equal(!!teacher.node('editor').open,false);
  assert.equal(teacher.requests.some(r=>r.accion==='gen10ConfigurarPassword'),false);
});

test('Crear estudiante desde curso es una opción exclusiva de administración',async()=>{
  for(const role of ['admin','docente']){
    const c=client(service(state(role)));await c.login();
    await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'curso',id:'course-1'}})}});
    await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'inscribir',id:''}})}});
    if(role==='admin')assert.match(c.node('editorFields').innerHTML,/Crear estudiante nuevo y enviar sus credenciales/);
    else assert.doesNotMatch(c.node('editorFields').innerHTML,/crearEstudiante/);
  }
});

test('Bienvenida: aparece en cada inicio de sesión y no al actualizar el campus',async()=>{
  const c=client(service());await c.login();
  assert.equal(c.node('welcomeDialog').open,true);
  c.node('welcomeContinue').listeners.click();
  await c.node('refresh').listeners.click();
  assert.equal(c.node('welcomeDialog').open,false);
  await c.node('logout').listeners.click();
  await c.login();
  assert.equal(c.node('welcomeDialog').open,true);
  await c.node('logout').listeners.click();
  assert.equal(c.node('welcomeDialog').open,false);
});

test('Examen con límites inicia y guarda respuestas con su número de intento',async()=>{
  const snapshot=state();snapshot.evaluaciones='gen10-examenes-v1';snapshot.limitesExamen=true;
  snapshot.tareas=[{id:'exam-limits',curso:'course-1',tipo:'examen',titulo:'Prueba',contenido:'Responde',publicado:true,duracionMinutos:2,intentosPermitidos:3,preguntas:[{enunciado:'Uno',opciones:['A','B','C','D']}]}];
  const c=client(d=>d.accion==='gen10IniciarExamen'?{ok:true,portal:'gen10-v1',registro:{numero:2,respuestas:[null],vence:''}}:service(snapshot)(d));
  await c.login();c.nav.find(n=>n.dataset.view==='examenes').listeners.click();
  assert.match(c.node('view').innerHTML,/3 intento\(s\).*2 minutos/);
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'responder-examen',id:'exam-limits'}})}});
  assert.equal(c.requests.at(-1).accion,'gen10IniciarExamen');
  c.node('editorForm').values={respuesta:'1'};c.node('editorFields').onchange();
  await c.submit('editorForm');
  const draft=c.requests.find(d=>d.accion==='gen10GuardarRespuestaExamen');assert.equal(draft.numero,2);assert.deepEqual(draft.respuestas,[1]);
  const answer=c.requests.find(d=>d.accion==='gen10ResponderExamen');assert.equal(answer.numero,2);assert.deepEqual(answer.respuestas,[1]);
});

test('Inicio: agenda y resultados reemplazan el panel de notificaciones',async()=>{
  const snapshot=state();snapshot.notificaciones=[{id:'aviso-1',titulo:'Nueva calificación',mensaje:'<script>nota</script>',leida:false,creada:'2026-10-05T12:00:00Z'}];
  const c=client(d=>{
    if(d.accion==='gen10LeerNotificacion')snapshot.notificaciones[0].leida=true;
    return service(snapshot)(d);
  });
  await c.login();
  assert.match(c.node('view').innerHTML,/Tu próximo paso|Tus resultados/);
  assert.doesNotMatch(c.node('view').innerHTML,/1 sin leer|Marcar como leído|Nueva calificación/);
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'vista-seguimiento',id:''}})}});
  assert.match(c.node('view').innerHTML,/Notas y avance/);
});
test('Gen10 interfaz: acceso por contraseña, textos escapados y cero válido en el promedio',async()=>{
  const c=client(service());await c.login();
  assert.equal(c.node('campus').hidden,false);assert.equal(c.node('access').hidden,true);assert.equal(c.node('adminNav').hidden,true);
  assert.equal(c.storage.get('gen10Sesion'),'campus-session');assert.equal(c.storage.has('ifobeSesion'),false);
  assert.match(c.node('view').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(c.node('view').innerHTML,/<script>|<img src=x/);
  c.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();assert.match(c.node('view').innerHTML,/<strong>0\.0<\/strong>/);
});
test('Gen10 interfaz: respuestas del servicio anterior no se consideran acceso confirmado',async()=>{
  const c=client(()=>({ok:true}));c.node('email').value='student@example.com';await c.submit('requestCode');
  assert.equal(c.node('verifyCode').hidden,true);assert.equal(c.node('notice').dataset.kind,'error');assert.match(c.node('notice').textContent,/publicar la versión/);
});
test('Gen10 interfaz: doble clic no duplica el correo de acceso',async()=>{
  let resolve;const c=client(()=>new Promise(r=>resolve=r));c.node('email').value='student@example.com';
  const pending=c.submit('requestCode');await Promise.resolve();await c.submit('requestCode');assert.equal(c.requests.length,1);
  resolve({ok:true,portal:'gen10-v1',mensaje:'Enviado'});await pending;assert.equal(c.node('verifyCode').hidden,false);assert.equal(c.node('requestCode-button').disabled,false);
});
test('Gen10 interfaz: cerrar sesión elimina el acceso único y su compatibilidad administrativa',async()=>{
  const c=client(service());await c.login();await c.node('logout').listeners.click();
  assert.equal(c.node('campus').hidden,true);assert.equal(c.node('view').innerHTML,'');assert.equal(c.storage.has('gen10Sesion'),false);assert.equal(c.storage.has('ifobeSesion'),false);
});
test('Gen10 interfaz: administración puede gestionar usuarios y docentes ven su espacio',async()=>{
  const a=client(service(state('admin')));await a.login();assert.equal(a.node('adminNav').hidden,false);
  a.nav.find(n=>n.dataset.view==='administracion').listeners.click();assert.match(a.node('view').innerHTML,/Habilitar usuario/);
  const d=client(service(state('docente')));await d.login();assert.equal(d.node('adminNav').hidden,true);assert.match(d.node('view').innerHTML,/Entregas por calificar/);
});

test('Gen10 interfaz: el ingreso diario usa correo y contraseña sin pedir código',async()=>{
  const c=client(service());assert.equal(c.node('loginForm').hidden,false);assert.equal(c.node('requestCode').hidden,true);
  await c.login();assert.deepEqual(c.requests.map(r=>r.accion),['gen10Login','gen10Estado']);
  assert.equal(c.requests[0].password,'Mi contraseña de prueba');
  assert.equal(c.node('loginPassword').value,'');assert.equal(c.storage.get('gen10Sesion'),'campus-session');
  assert.equal(c.storage.get('gen10Bienvenida:student@example.com'),'1');
});
test('Gen10 interfaz: activación valida confirmación y envía código con contraseña',async()=>{
  const c=client(service());c.node('loginEmail').value='student@example.com';
  c.node('activateAccount').listeners.click();assert.equal(c.node('requestCode').hidden,false);
  assert.equal(c.node('email').value,'student@example.com');await c.submit('requestCode');
  assert.equal(c.requests[0].proposito,'activar');c.node('code').value='AABB0011';
  c.node('newPassword').value='Mi contraseña de prueba';c.node('confirmPassword').value='Otra contraseña';
  await c.submit('verifyCode');assert.equal(c.requests.length,1);assert.match(c.node('notice').textContent,/no coinciden/);
  c.node('confirmPassword').value='Mi contraseña de prueba';await c.submit('verifyCode');
  assert.equal(c.requests[1].codigo,'AABB0011');assert.equal(c.requests[1].password,'Mi contraseña de prueba');
  assert.equal(c.node('campus').hidden,false);assert.equal(c.node('newPassword').value,'');assert.equal(c.node('confirmPassword').value,'');
});
test('Gen10 interfaz: recuperación y vuelta al login limpian los datos sensibles',async()=>{
  const c=client(service());c.node('loginEmail').value='student@example.com';c.node('loginPassword').value='Mi contraseña de prueba';
  c.node('recoverPassword').listeners.click();assert.equal(c.node('loginPassword').value,'');
  await c.submit('requestCode');assert.equal(c.requests[0].proposito,'recuperar');
  c.node('newPassword').value='Mi contraseña de prueba';c.node('cancelActivation').listeners.click();
  assert.equal(c.node('loginForm').hidden,false);assert.equal(c.node('newPassword').value,'');
});
test('Gen10 interfaz: doble envío de login no duplica peticiones y conserva errores',async()=>{
  let resolve;const c=client(()=>new Promise(r=>resolve=r));
  c.node('loginEmail').value='student@example.com';c.node('loginPassword').value='Mi contraseña de prueba';
  const pending=c.submit('loginForm');await Promise.resolve();await c.submit('loginForm');
  c.node('activateAccount').listeners.click();assert.equal(c.node('requestCode').hidden,true);
  assert.equal(c.requests.length,1);resolve({ok:false,mensaje:'Correo o contraseña incorrectos.'});await pending;
  assert.equal(c.node('notice').dataset.kind,'error');assert.equal(c.node('loginPassword').value,'');assert.equal(c.node('loginForm-button').disabled,false);
  assert.equal(c.storage.has('gen10Sesion'),false);
});
test('Gen10 interfaz: una versión antigua no confirma la creación de contraseña',async()=>{
  const c=client(()=>({ok:true,portal:'gen10-v1',token:'old-code-session'}));await c.login();
  assert.match(c.node('notice').textContent,/nueva versión/);assert.equal(c.storage.has('gen10Sesion'),false);
});

test('Cuenta conocida oculta activación tras salir y al volver; otra cuenta conserva primer ingreso',async()=>{
  const c=client(service());await c.login();await c.node('logout').listeners.click();
  assert.equal(c.node('activationOptions').hidden,true);
  assert.doesNotMatch(JSON.stringify([...c.remembered]),/contraseña de prueba/);
  const next=client(service(),c.remembered);
  assert.equal(next.node('loginEmail').value,'student@example.com');
  assert.equal(next.node('activationOptions').hidden,true);
  next.node('loginEmail').value='new@example.com';next.node('loginEmail').listeners.input();
  assert.equal(next.node('activationOptions').hidden,false);
});

test('Notas: desglose ponderado igual para docente y alumno, cero válido y pendientes sin nota final',async()=>{
  function snapshot(rol){
    const s=state(rol);s.cursos[0].pesoTareas=60;
    s.tareas.push({id:'task-2',curso:'course-1',titulo:'Segunda tarea',publicado:true},{id:'exam-1',curso:'course-1',tipo:'examen',titulo:'Parcial',publicado:true,preguntas:[]},{id:'hidden',curso:'course-1',titulo:'Borrador',publicado:false});
    s.entregas.push({id:'e2',curso:'course-1',tarea:'task-2',email:'student@example.com',nota:5},{id:'e3',curso:'course-1',tarea:'exam-1',email:'student@example.com',nota:4,automatica:true});
    return s;
  }
  for(const rol of ['estudiante','docente']){
    const c=client(service(snapshot(rol)));await c.login();c.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();
    if(rol!=='estudiante')await c.node('document').listeners.change({target:{id:'gradeCourse',value:'course-1'}});
    const h=c.node('view').innerHTML;
    assert.match(h,/Tareas: 60% · Exámenes: 40%/);assert.match(h,/<strong>2\.5<\/strong>/);assert.match(h,/<strong>3\.1<\/strong>/);
    assert.match(h,/30\.00 %/);assert.match(h,/32\.00 %/);assert.match(h,/62\.00 %/);assert.doesNotMatch(h,/Borrador/);
  }
  const s=snapshot('estudiante');s.entregas.find(e=>e.tarea==='task-2').nota=null;
  const c=client(service(s));await c.login();c.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();
  assert.match(c.node('view').innerHTML,/Total del curso[\s\S]*<strong>Pendiente<\/strong>/);assert.match(c.node('view').innerHTML,/Por calificar/);
});
test('Exámenes aparecen separados de tareas y no muestran controles de edición al alumno',async()=>{
  const s=state();s.tareas.push({id:'exam-1',curso:'course-1',tipo:'examen',titulo:'Examen final',contenido:'Responde',publicado:true,preguntas:[{enunciado:'Pregunta',opciones:['A','B','C','D']}]});
  const c=client(service(s));await c.login();c.nav.find(n=>n.dataset.view==='tareas').listeners.click();assert.doesNotMatch(c.node('view').innerHTML,/Examen final/);
  c.nav.find(n=>n.dataset.view==='examenes').listeners.click();assert.match(c.node('view').innerHTML,/Examen final/);assert.match(c.node('view').innerHTML,/Responder examen/);assert.doesNotMatch(c.node('view').innerHTML,/Editar examen/);
});

test('Docente crea un examen con su clave y alumno envía solo respuestas, no una nota',async()=>{
  const s=state('docente');s.evaluaciones='gen10-examenes-v1';
  const c=client(service(s));await c.login();
  const click=(action,id)=>c.node('view').listeners.click({target:{closest:()=>({dataset:{action,id}})}});
  await click('curso','course-1');await click('examen','');assert.equal(c.node('editor').open,true);
  c.node('editorForm').values={titulo:'Parcial',contenido:'Elige',publicado:'on','pregunta-0':'Capital de Colombia','opcion-0-0':'Bogotá','opcion-0-1':'Lima','opcion-0-2':'Quito','opcion-0-3':'Caracas','correcta-0':'0'};
  await c.submit('editorForm');
  const saved=c.requests.find(r=>r.accion==='gen10GuardarTarea');assert.equal(saved.tipo,'examen');assert.equal(saved.preguntas[0].correcta,0);assert.equal(saved.preguntas[0].opciones.length,4);
  const a=state();a.evaluaciones='gen10-examenes-v1';a.tareas.push({id:'exam-1',curso:'course-1',tipo:'examen',titulo:'Parcial',preguntas:[{enunciado:'Capital',opciones:['Bogotá','Lima','Quito','Caracas']}]});
  const student=client(service(a));await student.login();
  await student.node('view').listeners.click({target:{closest:()=>({dataset:{action:'responder-examen',id:'exam-1'}})}});
  assert.match(student.node('editorFields').innerHTML,/type="radio"/);assert.doesNotMatch(student.node('editorFields').innerHTML,/Respuesta correcta/);
  student.node('editorForm').values={respuesta:'0'};await student.submit('editorForm');
  const answer=student.requests.find(r=>r.accion==='gen10ResponderExamen');assert.deepEqual(answer.respuestas,[0]);assert.equal('nota' in answer,false);
});
test('Examen paso a paso conserva respuestas y solo envía al terminar',async()=>{
  const s=state();s.evaluaciones='gen10-examenes-v1';
  s.tareas.push({id:'exam-step',tipo:'examen',titulo:'Parcial',preguntas:[
    {enunciado:'Primera pregunta',opciones:['Uno','Dos']},
    {enunciado:'Segunda pregunta',opciones:['Tres','Cuatro']}
  ]});
  const c=client(service(s));await c.login();
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'responder-examen',id:'exam-step'}})}});
  assert.match(c.node('editorFields').innerHTML,/Pregunta 1 de 2/);
  assert.doesNotMatch(c.node('editorFields').innerHTML,/Segunda pregunta/);
  await c.submit('editorForm');assert.equal(c.node('editorError').hidden,false);
  c.node('editorForm').values={respuesta:'0'};await c.submit('editorForm');
  assert.match(c.node('editorFields').innerHTML,/Pregunta 2 de 2/);
  assert.equal(c.node('saveEditor').textContent,'Enviar examen');
  assert.equal(c.requests.some(r=>r.accion==='gen10ResponderExamen'),false);
  c.node('editorForm').values={respuesta:'1'};c.node('examPrevious').onclick();
  assert.match(c.node('editorFields').innerHTML,/value="0" required checked/);
  c.node('editorForm').values={respuesta:'1'};await c.submit('editorForm');
  assert.match(c.node('editorFields').innerHTML,/value="1" required checked/);
  await c.submit('editorForm');
  assert.deepEqual(c.requests.find(r=>r.accion==='gen10ResponderExamen').respuestas,[1,1]);
});

test('La interfaz impide crear exámenes contra una implementación anterior',async()=>{
  const c=client(service(state('docente')));await c.login();
  await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'examen',id:''}})}});
  assert.match(c.node('notice').textContent,/Publica la nueva versión/);assert.equal(c.requests.some(r=>r.accion==='gen10GuardarTarea'),false);
});

test('Docente define el porcentaje del curso desde su formulario',async()=>{
  const s=state('docente');s.evaluaciones='gen10-examenes-v1';s.cursos[0].docente='student@example.com';s.cursos[0].revision=1;
  const c=client(service(s));await c.login();await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'editar-curso',id:'course-1'}})}});
  assert.match(c.node('editorFields').innerHTML,/Porcentaje de tareas/);
  c.node('editorForm').values={titulo:'Curso',descripcion:'Descripción',pesoTareas:'75',publicado:'on'};await c.submit('editorForm');
  assert.equal(c.requests.find(r=>r.accion==='gen10GuardarCurso').pesoTareas,75);
});

test('Modal de carga: visible durante el acceso y cerrado después de un error',async()=>{
  let resolveRequest;
  const c=client(()=>new Promise(resolve=>{resolveRequest=resolve}));
  c.node('loginEmail').value='student@example.com';c.node('loginPassword').value='Mi contraseña de prueba';
  const pending=c.submit('loginForm');
  assert.equal(c.node('loadingDialog').open,true);
  await new Promise(resolve=>setImmediate(resolve));
  resolveRequest({ok:false,mensaje:'Acceso rechazado'});
  await pending;
  assert.equal(c.node('loadingDialog').open,false);
  assert.equal(c.node('notice').textContent,'Acceso rechazado');
  assert.equal(c.node('loginForm-button').disabled,false);
});

test('Modal de carga: el ingreso y la preparación del campus terminan sin bloqueo',async()=>{
  const c=client(service());await c.login();
  assert.equal(c.node('loadingDialog').open,false);
  assert.equal(c.node('campus').hidden,false);
});

test('Registro de notas pagina mil estudiantes sin desplegar todos sus expedientes',async()=>{
 const s=state('docente');
 s.inscritos=Array.from({length:1000},(_,i)=>({curso:'course-1',email:'alumno'+String(i).padStart(4,'0')+'@example.com',activo:true}));
 const c=client(service(s));await c.login();c.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();
 await c.node('document').listeners.change({target:{id:'gradeCourse',value:'course-1'}});
 const first=c.node('view').innerHTML;
 assert.equal((first.match(/class="grade-student"/g)||[]).length,25);
 assert.match(first,/1000 estudiantes encontrados/);assert.match(first,/de 40/);
 await c.node('view').listeners.click({target:{closest:()=>({dataset:{action:'grade-next'}})}});
 assert.notEqual(c.node('view').innerHTML,first);
 assert.match(c.node('view').innerHTML,/alumno0025@example.com/);
});

 test('Carga modal solo al entrar y salir, sin interrumpir actualizaciones',async()=>{
 let resolveRequest,hold='';
 const normal=service();
 const c=client(request=>request.accion===hold?new Promise(resolve=>{resolveRequest=resolve}):normal(request));
 await c.login();
 hold='gen10Estado';
 const refresh=c.node('refresh').listeners.click();
 assert.equal(c.node('loadingDialog').open,false);
 await new Promise(resolve=>setImmediate(resolve));
 resolveRequest(state());await refresh;
 hold='gen10Salir';
 const logout=c.node('logout').listeners.click();
 assert.equal(c.node('loadingDialog').open,true);
 await new Promise(resolve=>setImmediate(resolve));
 resolveRequest({ok:true,portal:'gen10-v1'});await logout;
 assert.equal(c.node('loadingDialog').open,false);
 });

test('Notas exige seleccionar curso al administrador y excluye cursos ajenos al alumno',async()=>{
 const s=state('admin');s.cursos.push({id:'other',titulo:'Curso ajeno',publicado:true});
 const c=client(service(s));await c.login();c.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();
 assert.doesNotMatch(c.node('view').innerHTML,/class="grade-student"/);
 await c.node('document').listeners.change({target:{id:'gradeCourse',value:'course-1'}});
 assert.match(c.node('view').innerHTML,/class="grade-student"/);
 assert.doesNotMatch(c.node('view').innerHTML,/<h3>Curso ajeno/);
 s.usuario.rol='estudiante';const a=client(service(s));await a.login();a.nav.find(n=>n.dataset.view==='seguimiento').listeners.click();
 assert.doesNotMatch(a.node('view').innerHTML,/Curso ajeno/);
});
