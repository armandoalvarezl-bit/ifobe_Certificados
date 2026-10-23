const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(code=200,network=false){
  const rows=[['headers']],calls=[];
  const sheet={getDataRange:()=>({getDisplayValues:()=>rows}),getLastRow:()=>rows.length,getRange:(r,c)=>({setNumberFormat(){},setValue(v){rows[r-1]??=[];rows[r-1][c-1]=v;},setValues(a){rows[r-1]??=[];a[0].forEach((v,i)=>rows[r-1][c-1+i]=v);}})};
  const props={WHATSAPP_ENABLED:'true',WHATSAPP_TOKEN:'secret',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_API_VERSION:'v99.0',WHATSAPP_TEMPLATE:'example',WHATSAPP_LANGUAGE:'es'};
  const ctx={getHoja:()=>sheet,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},SpreadsheetApp:{flush(){}},UrlFetchApp:{fetch(url,options){calls.push({url,options});if(network)throw Error('network');return {getResponseCode:()=>code,getContentText:()=>JSON.stringify({messages:[{id:'message1'}]})}}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8'),ctx);
  ctx.getHoja=()=>sheet;
  const p={solicitudId:'request1',datos:{whatsappConsentimiento:'on',telefono:'312 794 7484',nombres:'Prueba',programa:'Curso'}};
  return {ctx,p,rows,calls,props};
}
test('sin consentimiento no registra ni contacta a Meta',()=>{const t=setup();t.p.datos.whatsappConsentimiento='';assert.equal(t.ctx.confirmarWhatsApp_(t.p),'No autorizado');assert.equal(t.calls.length,0);assert.equal(t.rows.length,1)});
test('plantilla, normalización y deduplicación',()=>{const t=setup();assert.equal(t.ctx.confirmarWhatsApp_(t.p),'Aceptado por Meta');assert.equal(t.ctx.confirmarWhatsApp_(t.p),'Aceptado por Meta');assert.equal(t.calls.length,1);const p=JSON.parse(t.calls[0].options.payload);assert.equal(p.to,'573127947484');assert.equal(p.template.components[0].parameters.length,3);assert.equal(t.rows[1][5],'message1')});
test('sin configuración conserva consentimiento sin enviar',()=>{const t=setup();delete t.props.WHATSAPP_TOKEN;assert.equal(t.ctx.confirmarWhatsApp_(t.p),'Pendiente');assert.equal(t.calls.length,0);assert.equal(t.rows.length,2)});
test('rechazos y fallos ambiguos no se reintentan',()=>{for(const [code,network,state] of [[400,false,'Rechazado'],[500,false,'Por verificar'],[200,true,'Por verificar']]){const t=setup(code,network);assert.equal(t.ctx.confirmarWhatsApp_(t.p),state);t.ctx.confirmarWhatsApp_(t.p);assert.equal(t.calls.length,1)}});
