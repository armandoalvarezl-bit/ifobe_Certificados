const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const header = `// IFOBE + GEN10 — CÓDIGO COMPLETO PARA GOOGLE APPS SCRIPT
// Copia TODO este archivo y reemplaza el contenido de Code.gs en Google Apps Script.
// Incluye el sistema actual y Gen10 con acceso por contraseña. No pegues PortalGen10.gs ni Gen10Crypto.gs por separado.
// Si ya existen PortalGen10.gs o Gen10Crypto.gs en el proyecto, elimina esas copias para evitar declaraciones duplicadas.
// Ejecuta configurarTodaLaPlataforma. Prepara las hojas y carpetas sin borrar registros ni enviar correos.
// Administrador del campus por defecto: institutoifobe@gmail.com.
// Para otro administrador, configura GEN10_ADMIN_EMAIL en Propiedades del script.
// Opcional: GEN10_CAMPUS_URL fija el enlace público HTTPS de gen10.html en los correos de credenciales.
// Después publica una nueva versión de la implementación existente.
// Todas las páginas usan el enlace /exec de inscripcion-config.js: cámbialo solo allí si es nuevo.

`;
const license = '/* SJCL 1.0.8 — https://github.com/bitwiseshiftleft/sjcl/tree/1.0.8\n' + fs.readFileSync(path.join(__dirname, 'vendor/sjcl-LICENSE.txt'), 'utf8') + '\n*/\n';
const source = header + license + ['Gen10Crypto.gs', 'Code.gs', 'PortalGen10.gs'].map(name => fs.readFileSync(path.join(__dirname, name), 'utf8').trim()).join('\n\n') + '\n';
new vm.Script(source);
for (const name of ['Code-para-Apps-Script.txt', 'Apps-Script-completo-Gen10.txt']) {
  const target = path.join(__dirname, name);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== source) throw Error(name + ' está desactualizado. Ejecuta node backend/generar-apps-script.cjs');
  } else fs.writeFileSync(target, source, 'utf8');
}
console.log(process.argv.includes('--check') ? 'Archivos integrados verificados.' : 'Archivos integrados actualizados.');
