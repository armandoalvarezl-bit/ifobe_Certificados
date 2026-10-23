// Genera una vista local con datos ficticios. No conecta con Google ni envía correos.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:()=>({})}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8'),ctx);
const message = ctx.mensajeConfirmacion_({solicitudId:'EJEMPLO-2026-001',datos:{nombres:'Ana',apellidos:'Ejemplo',correo:'ejemplo@example.com',programa:'Curso de Office Básico'}},2);
fs.writeFileSync(path.join(__dirname,'correo-vista-previa.html'),message.htmlBody.replace('cid:logoIfobe','../img/Logogen10.png'));
