const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../inscripcion-config.js'),'utf8');
async function config(page,active=true,admin=false,token='student'){
 const redirects=[],mensaje={textContent:''};
 const window={location:{pathname:'/campus/'+page,replace:url=>redirects.push(url)},addEventListener(){}};
 const document={currentScript:{src:'https://instituto.example/campus/inscripcion-config.js'},getElementById:()=>mensaje,readyState:'loading',addEventListener(){},documentElement:{style:{setProperty(){}}}};
 vm.runInNewContext(source,{window,document,URL,AbortController,setTimeout,clearTimeout,setInterval(){},sessionStorage:{getItem:()=>token},fetch:async()=>({json:async()=>({ok:true,administrador:admin,mantenimiento:{activo:active,mensaje:'Mejoras'}})})});
 await new Promise(resolve=>setImmediate(resolve));
 return {redirects,mensaje};
}
test('Bloquea visitantes, alumnos y docentes; permite administradores y modo desactivado',async()=>{
 for(const page of ['inscripcion.html','gen10.html','gen10-curso.html','gen10-soporte.html']){
 assert.equal((await config(page)).redirects.length,1);
 assert.equal((await config(page,true,true)).redirects.length,page.startsWith('gen10')?0:1);
 assert.equal((await config(page,false)).redirects.length,0);
 }
});
test('Cierra certificados y otras plataformas incluso con sesión del administrador del campus',async()=>{
 for(const page of ['index.html','home.html','matriculas.html','notas.html','registro-alumnos (2).html']){
 assert.equal((await config(page)).redirects.length,1);
 assert.equal((await config(page,true,true)).redirects.length,1);
 assert.equal((await config(page,false)).redirects.length,0);
 }
 assert.equal((await config('gen10-administracion.html',true,true)).redirects.length,0);
 assert.equal((await config('mantenimiento.html')).redirects.length,0);
 assert.equal((await config('gen10.html',true,false,'')).redirects.length,0);
 assert.equal((await config('mantenimiento.html')).mensaje.textContent,'Mejoras');
});
