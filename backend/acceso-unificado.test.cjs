const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../acceso-unificado.js'),'utf8');
test('El módulo integrado usa la sesión administrativa validada sin otra consulta que deje la página oculta',()=>{
 const classes=new Set();let consultas=0;
 const storage={getItem:()=> 'token',setItem(){}};
 const document={documentElement:{classList:{add:name=>classes.add(name)}}};
 const window={parent:{sessionStorage:storage,document:{getElementById:()=>({getAttribute:()=> 'admin'})}},addEventListener(){}};
 vm.runInNewContext(source,{window,document,sessionStorage:storage,location:{href:'https://ifobe.test/home.html?integrado=1',pathname:'/home.html',search:'?integrado=1'},URL,URLSearchParams,fetch(){consultas++;}});
 assert.equal(consultas,0);
 assert.ok(classes.has('gestion-autorizada'));
});
