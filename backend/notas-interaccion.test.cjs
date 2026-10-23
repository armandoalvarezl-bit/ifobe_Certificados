const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('el resumen usa las evaluaciones de Gen10 y conserva el cero', () => {
  const source=fs.readFileSync(path.join(__dirname,'../notas.js'),'utf8');
  const controls=Object.fromEntries(['avance','promedio','definitiva'].map(id=>[id,{}]));
  const context=vm.createContext({$:id=>controls[id],actual:{id:'m1'},data:{notasGen10:[{id:'m1',evaluaciones:[{nota:0},{nota:null}],parcial:'0.0',definitiva:''}]}});
  vm.runInContext(source.slice(source.indexOf('  function notaCampus('),source.indexOf('  function abrir(')),context);
  context.resumen();
  assert.equal(controls.avance.textContent,'1 / 2');
  assert.equal(controls.promedio.textContent,'0.0');
  assert.equal(controls.definitiva.textContent,'Pendiente');
  context.data.notasGen10[0].definitiva='0.0';context.resumen();
  assert.equal(controls.definitiva.textContent,'0.0');
});

test('habilita los expedientes creados durante la carga y los bloquea al guardar', () => {
  const source = fs.readFileSync(path.join(__dirname, '../notas.js'), 'utf8');
  const controls = Object.fromEntries(['campos', 'actualizar', 'matricula', 'buscar'].map(id => [id, {}]));
  const buttons = [];
  controls['opciones-matricula'] = {
    querySelectorAll: () => buttons,
    setAttribute(name, value) { this[name] = value; }
  };
  const context = vm.createContext({ $: id => controls[id], busy: false });
  vm.runInContext(source.slice(source.indexOf('  function bloquear('), source.indexOf('  function filtrarBase(')), context);
  context.bloquear(true);
  // El listado se construye mientras se procesa la respuesta del servidor.
  buttons.push({ disabled: true }, { disabled: true });
  context.bloquear(false);
  assert.equal(context.busy, false);
  assert.ok(buttons.every(button => !button.disabled));
  assert.equal(controls.buscar.disabled, false);
  assert.equal(controls['opciones-matricula']['aria-busy'], 'false');
  context.bloquear(true);
  assert.ok(buttons.every(button => button.disabled));
  // El finally debe liberar los controles incluso cuando falla la petición.
  context.bloquear(false);
  assert.ok(buttons.every(button => !button.disabled));
});
