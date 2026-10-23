// ÚNICO enlace para login, alumnos, certificados, inscripciones, matrículas, notas y Gen10.
// Copiar backend/Code-para-Apps-Script.txt en Apps Script y ejecutar configurarTodaLaPlataforma.
// Publicar la implementación y, si cambia su URL, reemplazar solamente apiUrl aquí.
(() => {
  // CONFIGURACIÓN COMPARTIDA. Rutas relativas a la carpeta de este archivo.
  const opciones = {
    // Activa el aviso en todas las páginas publicando este archivo con activo: true.
    mantenimiento: {activo: false, mensaje: 'Estamos trabajando para brindarte una mejor experiencia. Gracias por tu paciencia.'},
  apiUrl: 'https://script.google.com/macros/s/AKfycbx87A2JTPPxHga0WCQfSnAPeb9Q65qlIaPr0KHuoaoDZW2m44x6YlqxldBTxQmjuvYDAQ/exec',
    imagenes: {
      logo: 'img/Logogen10.png',
      icono: 'img/Logogen10.png',
      fondoAcceso: 'img/campus-universitario.png',
      // Banner decorativo de Gen10: coloca tu imagen en img/ y cambia esta ruta.
      // Recomendado: imagen horizontal (1600 ? 240 px). Usa '' para ocultarlo.
      bannerGen10: 'img/banner-gen10-aprendizaje.png',
      certificado: 'img/certificado.png',
      certificadoCapacitacion: 'img/certificado_capacitacion.png'
    }
  };
  const base = document.currentScript.src;
  const imagenes = Object.freeze(Object.fromEntries(Object.entries(opciones.imagenes)
    .map(([nombre, ruta]) => [nombre, ruta ? new URL(ruta, base).href : ''])));
  const mantenimiento = Object.freeze({...opciones.mantenimiento});
  window.IFOBE_CONFIG = Object.freeze({apiUrl: opciones.apiUrl, imagenes, mantenimiento});
  window.IFOBE_INSCRIPCION = window.IFOBE_CONFIG;
  const avisoUrl = new URL('mantenimiento.html', base);
  const pagina=decodeURIComponent(window.location.pathname.split('/').pop()||'index.html');
  const esCampus=/^gen10(?:-[a-z]+)?\.html$/.test(pagina);
  let consultando=false;
  async function consultarMantenimiento(){
    if(consultando)return;
    consultando=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const token=sessionStorage.getItem('gen10Sesion')||'';
      const response=await fetch(opciones.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},credentials:'omit',signal:controller.signal,body:JSON.stringify({accion:'gen10ConsultarMantenimiento',token})});
      const estado=await response.json();
      if(!estado.ok||!estado.mantenimiento)return;
      const mensaje=document.getElementById('mensaje');
      if(pagina==='mantenimiento.html'&&mensaje)mensaje.textContent=estado.mantenimiento.mensaje;
      const accesoCampus=pagina==='gen10.html'&&!token;
      const accesoAdministrador=esCampus&&estado.administrador===true;
      if(estado.mantenimiento.activo&&!accesoAdministrador&&!accesoCampus&&pagina!=='mantenimiento.html')window.location.replace(avisoUrl.href);
    }catch(ignore){}finally{clearTimeout(timer);consultando=false;}
  }
  consultarMantenimiento();
  setInterval(consultarMantenimiento,30000);
  window.addEventListener('focus',consultarMantenimiento);
  document.documentElement.style.setProperty('--ifobe-logo', `url(${JSON.stringify(imagenes.logo)})`);
  document.documentElement.style.setProperty('--ifobe-fondo-acceso', `url(${JSON.stringify(imagenes.fondoAcceso)})`);
  function aplicarImagenes() {
    document.querySelectorAll('[data-ifobe-imagen]').forEach(elemento => {
      const ruta = imagenes[elemento.dataset.ifobeImagen];
      if (ruta) elemento.setAttribute(elemento.tagName === 'LINK' ? 'href' : 'src', ruta);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarImagenes);
  else aplicarImagenes();
})();
