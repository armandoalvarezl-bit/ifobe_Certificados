const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const nodes={};
  const make=()=>({hidden:false,children:[],listeners:{},attributes:{},addEventListener(k,v){this.listeners[k]=v},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this[k]},replaceChildren(){this.children=[]},append(n){this.children.push(n)},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()}});
  const get=id=>nodes[id]||=(make());
  const context={window:{},Blob,Uint8Array,atob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{getElementById:get,createElement:make,addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../gen10-archivos.js','utf8'),context);
  return {files:context.window.G10Files,get};
}
const pdf=async()=>({archivo:{nombre:'Clase.pdf',tipo:'application/pdf',base64:'JVBERi0='}});
test('PDF con apertura directa y descarga; sin sandbox que bloquee el visor',async()=>{
  const {files,get}=setup();await files.open(pdf,'Lecciones','lesson','file');
  assert.equal(get('fileViewer').open,true);
  assert.equal(get('fileDownload').href,'blob:test');assert.equal(get('fileDownload').download,'Clase.pdf');
  assert.equal(get('fileOpen').hidden,false);
  assert.equal(get('fileContent').children[0].type,'application/pdf');
  assert.equal(get('fileContent').children[0].attributes.sandbox,undefined);
});
test('Cerrar durante la carga no reabre el archivo',async()=>{
  const {files,get}=setup();let resolve;
  const pending=files.open(()=>new Promise(r=>resolve=r),'Lecciones','lesson','file');
  get('fileViewer').close();resolve(await pdf());await pending;
  assert.equal(get('fileViewer').open,false);assert.equal(get('fileContent').children.length,0);
});
test('Errores de acceso se muestran sin habilitar enlaces de otro archivo',async()=>{
  const {files,get}=setup();await files.open(pdf,'Lecciones','lesson','file');
  await files.open(async()=>{throw Error('Sin acceso al archivo')},'Lecciones','lesson','other');
  assert.equal(get('fileContent').textContent,'Sin acceso al archivo');
  assert.equal(get('fileDownload').hidden,true);assert.equal(get('fileOpen').href,undefined);
});

test('La imagen adjunta del curso aparece como portada directa sin visor',()=>{
 const {files}=setup();
 const course={id:'curso',titulo:'Administracion',archivos:[{id:'flyer',nombre:'Course Flyer.png'}]};
 assert.equal(files.courseCover(course).id,'flyer');
 const html=files.cover(course);
 assert.match(html,/g10-cover-image/);assert.match(html,/data-file="flyer"/);assert.doesNotMatch(html,/attachment-panel|data-action/);
 course.portada={id:'explicit',nombre:'Portada.jpg'};
 assert.equal(files.courseCover(course).id,'explicit');
});

test('La portada no se repite como adjunto aunque tenga otro ID',()=>{
 const {files}=setup();
 const course={portada:{id:'cover',nombre:'Flyer.png'},archivos:[{id:'copy',nombre:' Flyer.png '},{id:'work',nombre:'Taller.pdf'}]};
 assert.equal(files.courseMaterials(course).length,1);assert.equal(files.courseMaterials(course)[0].id,'work');
});
