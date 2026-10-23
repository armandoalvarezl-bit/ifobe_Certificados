'use strict';
const g10CommunityBrowser={query:'',status:'',page:1,render:null};
document.addEventListener('change',event=>{
  const key=event.target.dataset.communityFilter;
  if(!key)return;
  g10CommunityBrowser[key]=event.target.value;g10CommunityBrowser.page=1;g10CommunityBrowser.render?.();
});
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-community-page]');
  if(!control)return;
  g10CommunityBrowser.page=Number(control.dataset.communityPage);g10CommunityBrowser.render?.();
  document.querySelector('.community-tools')?.scrollIntoView({block:'start'});
});
window.G10Community = context => {
  const {data,courseId,heading,button,esc,date,files,empty,select,field,area,openEditor,api}=context;
  function renderCommunity(support) {
    const rows=(support?data.soporte:data.foros)||[];
    g10CommunityBrowser.render=context.render;
    const course=data.cursos.find(c=>c.id===courseId);
    const writable=support||!course?.estado||course.estado==='Activo';
    const kind=support?'soporte':'foro';
    const roots=rows.filter(t=>!t.padre&&(support||t.curso===courseId)).reverse();
    const query=g10CommunityBrowser.query.trim().toLocaleLowerCase('es');
    const filtered=roots.filter(t=>(!support||!g10CommunityBrowser.status||(t.estado||'Recibida')===g10CommunityBrowser.status)&&(!query||[t.titulo,t.nombre,t.id,t.contenido].join(' ').toLocaleLowerCase('es').includes(query)));
    const pages=Math.max(1,Math.ceil(filtered.length/15));
    g10CommunityBrowser.page=Math.min(Math.max(1,g10CommunityBrowser.page),pages);
    const start=(g10CommunityBrowser.page-1)*15;
    const replies=new Map();rows.forEach(r=>{if(r.padre){if(!replies.has(r.padre))replies.set(r.padre,[]);replies.get(r.padre).push(r);}});
    const pager='<nav class="community-pagination" aria-label="Páginas de solicitudes"><span>'+filtered.length+' resultados · Página '+g10CommunityBrowser.page+' de '+pages+'</span><button type="button" class="quiet" data-community-page="'+(g10CommunityBrowser.page-1)+'" '+(g10CommunityBrowser.page===1?'disabled':'')+'>Anterior</button><button type="button" class="quiet" data-community-page="'+(g10CommunityBrowser.page+1)+'" '+(g10CommunityBrowser.page===pages?'disabled':'')+'>Siguiente</button></nav>';
    return heading(support?'PQRS y soporte':'Foro de participación',writable?button(support?'Nueva solicitud':'Abrir tema','nuevo-'+kind,'',false):'')+
      '<p class="hint">'+(support?'Registra peticiones, quejas, reclamos, sugerencias o problemas del campus. Consulta las respuestas y el estado de cada solicitud. Solo tú y administración pueden consultar tu solicitud. No compartas contraseñas.':'Comparte preguntas, ideas y aportes con tu grupo y docente. Participa con respeto y evita publicar datos personales.')+'</p>'+
      '<div class="community-tools"><label>Buscar<input type="search" data-community-filter="query" value="'+esc(g10CommunityBrowser.query)+'" placeholder="Asunto, persona o radicado"></label>'+(support?'<label>Estado<select data-community-filter="status"><option value="">Todos</option>'+['Recibida','En revisión','En espera del estudiante','Resuelta','Cerrada'].map(s=>'<option '+(s===g10CommunityBrowser.status?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>':'')+'</div>'+pager+
      (filtered.slice(start,start+15).map(t=>'<details class="community-ticket"><summary><span class="ticket-heading"><strong>'+esc(t.titulo)+'</strong><small>'+esc(t.nombre)+' · '+esc(date(t.creada))+'</small></span><span class="badge">'+esc(support?(t.estado||'Recibida'):(replies.get(t.id)||[]).length+' respuestas')+'</span></summary><div class="ticket-body"><div class="prose">'+esc(t.contenido)+'</div>'+(support?supportDetails(t):'')+files.render(t.archivos,support?'Soporte':'Foros',t.id)+(replies.get(t.id)||[]).map(r=>'<blockquote><p class="hint">'+esc(r.nombre)+' · '+esc(date(r.creada))+'</p><div class="prose">'+esc(r.contenido)+'</div>'+files.render(r.archivos,support?'Soporte':'Foros',r.id)+'</blockquote>').join('')+(support&&t.estado==='Cerrada'?'<p class="ticket-closed"><i class="bi bi-lock" aria-hidden="true"></i> Caso cerrado. Disponible solo para consulta.</p>':writable?button('Responder','responder-'+kind,t.id):'')+'</div></details>').join('')||empty(roots.length?'No hay resultados con estos filtros.':support?'Aún no hay solicitudes.':'Sé la primera persona en abrir una conversación.'))+(filtered.length>15?pager:'');
  }
  function supportDetails(t) {
    return '<p class="ticket-reference"><strong>Radicado:</strong> '+esc(t.id)+'<br><strong>Estado:</strong> '+esc(t.estado||'Recibida')+'</p><dl>'+[['Tipo de PQRS',t.tipoPQRS||'Petici\u00f3n'],['Categoría',t.categoria],['Prioridad',t.prioridad],['Curso',t.cursoTitulo],['Dispositivo y navegador',t.dispositivo],['Pasos para reproducir',t.pasos],['Resultado esperado',t.esperado],['Mensaje de error',t.errorDetalle]].filter(([,v])=>v).map(([k,v])=>'<dt><strong>'+esc(k)+'</strong></dt><dd class="prose">'+esc(v)+'</dd>').join('')+'</dl>'+((t.historial||[]).length?'<details><summary>Historial de seguimiento</summary>'+t.historial.map(h=>'<p><strong>'+esc(h.estado)+'</strong> | '+esc(date(h.fecha))+' | '+esc(h.nombre)+'</p><div class="prose">'+esc(h.detalle)+'</div>').join('')+'</details>':'')+(data.usuario.rol==='admin'?button('Gestionar estado','gestionar-pqrs',t.id):'');
  }
  function communityEditor(support,parent='') {
    if(!Array.isArray(support?data.soporte:data.foros))throw Error('Actualiza el backend de Apps Script para habilitar soporte y foros.');
    if(support&&parent&&data.soporte.find(t=>t.id===parent)?.estado==='Cerrada')throw Error('Este caso est\u00e1 cerrado y no admite respuestas.');
    const id=crypto.randomUUID();
    const extra=support&&!parent?select('Tipo de solicitud','tipoPQRS',['Petici\u00f3n','Queja','Reclamo','Sugerencia'].map(v=>[v,v]),'Petici\u00f3n')+'<p class="hint">Usamos el nombre y correo de tu cuenta. No compartas contraseñas.</p>'+select('Categoría','categoria',['Acceso','Cursos','Tareas y examenes','Notas y certificados','Archivos','Otro'].map(v=>[v,v]),'Cursos')+select('Prioridad','prioridad',[['Normal','Normal: puedo continuar'],['Alta','Alta: una actividad bloqueada'],['Urgente','Urgente: campus inaccesible']],'Normal')+select('Curso relacionado','cursoRelacionado',[['general','General / sin curso'],...data.cursos.map(c=>[c.id,c.titulo])],'general')+field('Dispositivo y navegador','dispositivo','','text',false,200)+area('Pasos para reproducir el problema','pasos','',false,2000)+area('Resultado esperado','esperado','',false,1000)+area('Mensaje de error','errorDetalle','',false,1000):'';
    openEditor(parent?'Responder':support?'Nueva PQRS o solicitud de soporte':'Abrir tema de participación',(parent?'':field('Asunto','titulo'))+area('Mensaje','contenido','',true,4000)+extra+files.fields([]),async f=>api('gen10PublicarComunidad',{id,tipo:support?'soporte':'foro',curso:support?'':courseId,padre:parent,titulo:f.titulo||'',contenido:f.contenido,...(support&&!parent?{tipoPQRS:f.tipoPQRS,categoria:f.categoria,prioridad:f.prioridad,cursoRelacionado:f.cursoRelacionado,dispositivo:f.dispositivo,pasos:f.pasos,esperado:f.esperado,errorDetalle:f.errorDetalle}:{}),...await files.collect()}));
  }
  function pqrsEditor(id){
    const t=data.soporte.find(t=>t.id===id&&!t.padre);
    if(!t||data.usuario.rol!=='admin')throw Error('Solicitud no disponible.');
    openEditor('Seguimiento de PQRS',select('Estado','estado',['Recibida','En revisi\u00f3n','En espera del estudiante','Resuelta','Cerrada'].map(v=>[v,v]),t.estado||'Recibida')+area('Detalle del seguimiento (visible para el estudiante)','detalle','',true,2000),async f=>api('gen10SeguimientoPQRS',{id:t.id,revision:t.revision,estado:f.estado,detalle:f.detalle}));
  }
  return {renderCommunity,supportDetails,communityEditor,pqrsEditor};
};
