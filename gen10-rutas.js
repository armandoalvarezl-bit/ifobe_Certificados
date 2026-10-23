'use strict';
(() => {
  const pages=Object.freeze({certificados:'gen10.html?seccion=certificados',matriculas:'gen10.html?seccion=matriculas',estudiantes:'gen10.html?seccion=estudiantes',registroNotas:'gen10.html?seccion=registroNotas',inicio:'gen10.html',cursos:'gen10-cursos.html',curso:'gen10-curso.html',tareas:'gen10-tareas.html',examenes:'gen10-examenes.html',seguimiento:'gen10-notas.html',soporte:'gen10-soporte.html',perfil:'gen10-perfil.html',expediente:'gen10-documentos.html',administracion:'gen10-administracion.html'});
  const url=new URL(window.location.href);
  const page=url.pathname.split('/').pop();
  const initial=(Object.hasOwn(pages,url.searchParams.get('seccion'))?url.searchParams.get('seccion'):null)||Object.keys(pages).find(key=>pages[key]===page)||'inicio';
  const tabs=['portada','bienvenida','materiales','lecciones','tareas','examenes','seguimiento','grupo','ajustes','foro'];
  function href(view,course='',tab='portada') {
    const target=new URL(pages[view]||pages.inicio,url);
    if(view==='curso'&&course){target.searchParams.set('curso',course);if(tabs.includes(tab)&&tab!=='portada')target.searchParams.set('tab',tab);}
    return target.href;
  }
  function go(view,course='',tab='portada',replace=false) {
    const target=href(view,course,tab);
    if(target!==window.location.href)window.history[replace?'replaceState':'pushState'](null,'',target);
  }
  function sync(view,course,tab) {
    go(view,course,tab,true);
  }
  function current(){
    const address=new URL(window.location.href);
    return {view:(Object.hasOwn(pages,address.searchParams.get('seccion'))?address.searchParams.get('seccion'):null)||Object.keys(pages).find(key=>pages[key]===address.pathname.split('/').pop())||'inicio',course:address.searchParams.get('curso')||'',tab:tabs.includes(address.searchParams.get('tab'))?address.searchParams.get('tab'):'portada'};
  }
  window.G10Routes=Object.freeze({pages,current,initial,course:url.searchParams.get('curso')||'',tab:tabs.includes(url.searchParams.get('tab'))?url.searchParams.get('tab'):'portada',href,go,sync});
})();
