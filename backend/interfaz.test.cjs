const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function scripts(file) {
  return 'globalThis.window ||= {};\n' + fs.readFileSync(path.join(root,'inscripcion-config.js'),'utf8') + '\n' + [...fs.readFileSync(path.join(root,file),'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
}
function login(fetch) {
  const nodes = {};
  const node = key => nodes[key] ||= {value:'',textContent:'',setAttribute(){},disabled:false,querySelector:selector=>node(key+' '+selector)};
  const form = {reportValidity:()=>true,querySelector:()=>node('button'),setAttribute(){},removeAttribute(){}};
  const ctx = vm.createContext({fetch,URLSearchParams,AbortController,setTimeout,clearTimeout,
    window:{location:{href:'index.html'}},
    document:{documentElement:{lang:'es'},addEventListener(){},getElementById:node,querySelector:node,querySelectorAll:()=>[]}
  });
  vm.runInContext(scripts('index.html'),ctx);ctx.updateTexts('es');
  node('email').value='usuario@example.com';node('password').value='incorrecta';
  return {ctx,node,submit:()=>ctx.validarLogin({preventDefault(){},target:form})};
}
test('login blocks duplicate requests and navigates after authorization',async()=>{
  let resolve,calls=0;const l=login(()=>{calls++;return new Promise(r=>resolve=r)});
  const pending=l.submit();await l.submit();assert.equal(calls,1);assert.equal(l.node('button').disabled,true);
  resolve({ok:true,json:async()=>({ok:true,autorizado:true})});await pending;
  assert.equal(l.ctx.window.location.href,'home.html');assert.equal(l.node('button').disabled,false);
});
test('invalid credentials and connection failures remain on login with actionable feedback',async()=>{
  const denied=login(async()=>({ok:true,json:async()=>({ok:true,autorizado:false})}));await denied.submit();
  assert.equal(denied.ctx.window.location.href,'index.html');assert.match(denied.node('login-status').textContent,/contraseña/);
  const offline=login(async()=>{throw Error('offline')});await offline.submit();
  assert.equal(offline.ctx.window.location.href,'index.html');assert.match(offline.node('login-status').textContent,/conectar/);assert.equal(offline.node('button').disabled,false);
});
test('home does not confirm a rejected history write',async()=>{
  const messages=[];
  const ctx=vm.createContext({fetch:async()=>({ok:true,json:async()=>({ok:false})}),localStorage:{setItem(){}},document:{addEventListener(){},getElementById(){return null}}});
  vm.runInContext(scripts('home.html'),ctx);ctx.showToast=(message,kind)=>messages.push({message,kind});
  await ctx.registrarHistorial({cedula:'123',nombre:'Ejemplo',programa:'Curso',horas:'40',semestre:'1'},'TEST','certificado');
  assert.equal(messages.length,1);assert.equal(messages[0].kind,'error');
});
test('an empty remote student list stays empty and does not authorize sample students',async()=>{
  const nodes={cedula:{value:'36'},nombre:{value:''}};
  const ctx=vm.createContext({fetch:async()=>({ok:true,json:async()=>({ok:true,alumnos:{}})}),localStorage:{setItem(){},getItem(){return null}},document:{addEventListener(){},getElementById:id=>nodes[id]}});
  vm.runInContext(scripts('home.html'),ctx);ctx.showToast=()=>{};
  assert.equal(await ctx.validarCedula(),false);assert.equal(nodes.nombre.value,'');
});
