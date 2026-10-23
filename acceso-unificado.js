'use strict';
(()=>{
 const token=sessionStorage.getItem('gen10Sesion');
 const destino=new URL('gen10.html',location.href);
 const pages={'home.html':'certificados','matriculas.html':'matriculas','notas.html':'registroNotas','registro-alumnos (2).html':'estudiantes'};
 const page=decodeURIComponent(location.pathname.split('/').pop());
 if(page==='index.html'){location.replace(destino.href);return;}
 if(!token){sessionStorage.removeItem('ifobeSesion');location.replace(destino.href);return;}
 sessionStorage.setItem('ifobeSesion',token);
 const integrado=new URLSearchParams(location.search).get('integrado')==='1'&&window.parent!==window;
 if(integrado)document.documentElement.classList.add('gestion-integrada');
 // El campus ya obtuvo este rol del servidor antes de crear el iframe.
 // Las operaciones del módulo siguen validando el token en Apps Script.
 let autorizado=false;
 try{autorizado=window.parent.sessionStorage.getItem('gen10Sesion')===token&&window.parent.document.getElementById('campus')?.getAttribute('data-role')==='admin';}catch(ignore){}
 if(autorizado)document.documentElement.classList.add('gestion-autorizada');
 else {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  function mostrarError(){
   const mostrar=()=>{
    document.documentElement.classList.add('gestion-autorizada');
    const aviso=document.createElement('p');
    aviso.setAttribute('role','alert');
    aviso.textContent='No se pudo verificar el acceso a esta herramienta. Vuelve al campus y abre la sección de nuevo.';
    document.body.replaceChildren(aviso);
   };
   if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mostrar,{once:true});else mostrar();
  }
  Promise.resolve().then(()=>fetch(window.IFOBE_INSCRIPCION.apiUrl,{method:'POST',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({accion:'gen10Estado',token,recuperarSesion:true})})).then(r=>r.json()).then(d=>{if(!d.ok||d.usuario?.rol!=='admin')mostrarError();else document.documentElement.classList.add('gestion-autorizada');}).catch(mostrarError).finally(()=>clearTimeout(timer));
 }
 window.addEventListener('DOMContentLoaded',()=>{document.getElementById('salir')?.addEventListener('click',()=>{sessionStorage.removeItem('gen10Sesion');sessionStorage.removeItem('ifobeSesion');window.top.location.replace(destino.origin+destino.pathname);},true);});
})();
