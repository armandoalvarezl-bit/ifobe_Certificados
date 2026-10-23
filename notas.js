'use strict';
(() => {
  const $=id=>document.getElementById(id),token=sessionStorage.getItem('ifobeSesion');
  if(!token){location.replace('index.html');return;}
  let data={matriculas:[],notas:[]},actual=null,dirty=false,busy=false;
  function aviso(text,error=false){['mensaje','mensaje-modal'].forEach(id=>{$(id).textContent=text;$(id).dataset.error=error;});}
  async function api(payload){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{const r=await fetch(window.IFOBE_INSCRIPCION.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,token}),signal:controller.signal});if(!r.ok)throw Error('No se pudo conectar.');const d=await r.json();if(!d.ok)throw Error(d.mensaje||'No se confirmó la operación.');return d;}finally{clearTimeout(timer);}
  }
  function bloquear(value){
    busy=value;
    ['campos','actualizar','matricula','buscar'].forEach(id=>$(id).disabled=value);
    $('opciones-matricula').querySelectorAll('button').forEach(button=>button.disabled=value);
    $('opciones-matricula').setAttribute('aria-busy',String(value));
  }
  function filtrarBase(){const q=$('buscar').value.toLocaleLowerCase('es').trim(),list=data.matriculas.filter(m=>(m.nombre+' '+m.cedula).toLocaleLowerCase('es').includes(q));$('matricula').replaceChildren(new Option('Selecciona una matrícula',''));list.forEach(m=>$('matricula').add(new Option(`${m.nombre} · ${m.cedula} · ${m.programa} · ${m.periodo} · ${m.estado}`,m.id)));if(actual&&list.some(m=>m.id===actual.id))$('matricula').value=actual.id;$('cantidad').textContent=`${list.length} matrículas encontradas. Cada curso y período conserva sus propias notas.`;}
  function valores(){return Array.from($('modulos').rows,r=>({nombre:r.querySelector('[data-field=nombre]').value,nota:r.querySelector('[data-field=nota]').value,observacion:r.querySelector('[data-field=observacion]').value}));}
  function notaCampus(){return actual&&(data.notasGen10||[]).find(n=>n.id===actual.id);}
  function resumen(){const campus=notaCampus();if(campus){$('avance').textContent=campus.evaluaciones.filter(e=>e.nota!==null&&e.nota!=='').length+' / '+campus.evaluaciones.length;$('promedio').textContent=campus.parcial===''?'Pendiente':campus.parcial;$('definitiva').textContent=campus.definitiva===''?'Pendiente':campus.definitiva;return;}const notas=valores().filter(m=>m.nota!==''),validas=notas.map(m=>Number(m.nota));const valido=validas.every(n=>Number.isFinite(n)&&n>=0&&n<=5);const promedio=notas.length&&valido?(validas.reduce((a,b)=>a+b,0)/notas.length).toFixed(1):'—';$('avance').textContent=notas.length+' / 7';$('promedio').textContent=promedio;$('definitiva').textContent=notas.length===7&&valido?promedio:'Pendiente';}
  function abrir(id){actual=data.matriculas.find(m=>m.id===id)||null;dirty=false;$('expediente').hidden=!actual;if(!actual)return;const registro=data.notas.find(n=>n.id===id);$('alumno').textContent=actual.nombre+' · '+actual.cedula;$('curso').textContent=actual.programa+' · Período '+actual.periodo+' · '+actual.jornada+' · Matrícula '+actual.id;
    const campus=$('resultados-gen10');campus.replaceChildren();
    const vinculadas=(data.notasGen10||[]).filter(n=>n.id===id);campus.hidden=!vinculadas.length;
    vinculadas.forEach(n=>{const title=document.createElement('h3');title.textContent='Evaluaciones del campus Gen10';campus.append(title);const summary=document.createElement('p');summary.textContent='Parcial: '+(n.parcial||'Pendiente')+' · Definitiva: '+(n.definitiva||'Pendiente')+' / 5.0';campus.append(summary);n.evaluaciones.forEach(e=>{const row=document.createElement('p');row.className='campus-grade';const name=document.createElement('strong'),grade=document.createElement('span');name.textContent=e.nombre;grade.textContent=(e.nota===null?e.estado:Number(e.nota).toFixed(1)+' / 5.0')+(e.observacion?' · '+e.observacion:'');row.append(name,grade);campus.append(row);});});
    const desdeCampus=!!notaCampus();$('tabla-manual').hidden=desdeCampus;$('guardar-notas').hidden=desdeCampus;$('criterio-notas').textContent=desdeCampus?'Evaluaciones del campus Gen10. Las calificaciones se actualizan desde el campus; la definitiva queda pendiente hasta completar tareas y exámenes.':'Los siete módulos tienen el mismo peso. Una nota vacía está pendiente; 0.0 es una calificación.';
    $('modulos').replaceChildren();const modulos=registro?.modulos||Array.from({length:7},(_,i)=>({nombre:'Módulo '+(i+1),nota:'',observacion:''}));
    modulos.forEach((m,i)=>{const row=$('modulos').insertRow();['nombre','nota','observacion'].forEach(k=>{const el=document.createElement(k==='observacion'?'textarea':'input');el.dataset.field=k;el.setAttribute('aria-label',`${k} del módulo ${i+1}`);el.value=m[k];if(k==='nota'){el.type='number';el.min='0';el.max='5';el.step='0.1';el.placeholder='Pendiente';}else{el.maxLength=k==='nombre'?100:500;el.required=k==='nombre';}row.insertCell().append(el);});});
    $('guardado').textContent=desdeCampus?'Notas sincronizadas desde el campus Gen10.':registro?'Último guardado: '+new Date(registro.actualizada).toLocaleString('es-CO'):'Sin notas guardadas.';
    $('historial').replaceChildren();(registro?.historial||[]).slice().reverse().forEach(h=>{const a=document.createElement('article'),title=document.createElement('strong');title.textContent=new Date(h.fecha).toLocaleString('es-CO')+' · '+h.usuario;a.append(title);h.modulos.forEach(m=>{const p=document.createElement('p');p.textContent=m.nombre+': '+(m.nota===''?'Pendiente':m.nota)+(m.observacion?' · '+m.observacion:'');a.append(p);});$('historial').append(a);});resumen();
  }
  async function cargar(){if(busy)return;if(dirty&&!confirm('¿Descartar los cambios sin guardar y actualizar?'))return;bloquear(true);aviso('Cargando notas…');try{const d=await api({accion:'gestionNotas'});if(!Array.isArray(d.notas)||!Array.isArray(d.matriculas))throw Error('Actualiza la implementación de Apps Script para habilitar las notas.');data=d;const id=actual?.id;filtrar();abrir(id);aviso('Selecciona un alumno y su curso para consultar o registrar notas.');}catch(e){aviso(e.name==='AbortError'?'La conexión tardó demasiado. Intenta actualizar.':e.message,true);}finally{bloquear(false);}}
  $('buscar').addEventListener('input',filtrar);
  function cerrarExpediente(){
    if(busy){aviso('Espera a que termine el guardado antes de cerrar.',true);return;}
    if(dirty&&!confirm('¿Cerrar el expediente y descartar los cambios sin guardar?'))return;
    dirty=false;$('ventana-notas').close();
  }
  $('cerrar-notas').addEventListener('click',cerrarExpediente);
  $('ventana-notas').addEventListener('cancel',e=>{e.preventDefault();cerrarExpediente();});
  $('ventana-notas').addEventListener('close',()=>{
    document.body.classList.remove('notas-modal-open');
    const selected=$('opciones-matricula').querySelector('[aria-pressed="true"]');if(selected)selected.focus();
  });
  function filtrar(){
    filtrarBase();
    const list=$('opciones-matricula');list.replaceChildren();
    Array.from($('matricula').options).slice(1).forEach(option=>{
      const m=data.matriculas.find(m=>m.id===option.value),button=document.createElement('button');
      button.type='button';button.className='academic-option';button.disabled=busy;
      button.setAttribute('aria-pressed',String(actual?.id===m.id));
      const icon=document.createElement('i');icon.className='bi bi-person-vcard';icon.setAttribute('aria-hidden','true');
      const identity=document.createElement('span'),name=document.createElement('strong'),doc=document.createElement('small');
      name.textContent=m.nombre;doc.textContent='Documento '+m.cedula;identity.append(name,doc);
      const course=document.createElement('span'),program=document.createElement('strong'),period=document.createElement('small');
      program.textContent=m.programa;period.textContent='Período '+m.periodo+' · '+m.jornada;course.append(program,period);
      const action=document.createElement('span');action.className='academic-open';action.textContent=actual?.id===m.id?'Expediente abierto':'Consultar →';
      button.append(icon,identity,course,action);
      button.addEventListener('click',()=>{if(busy)return;if(dirty&&!confirm('¿Descartar los cambios sin guardar?'))return;$('matricula').value=m.id;abrir(m.id);filtrar();$('mensaje-modal').textContent='';$('ventana-notas').showModal();document.body.classList.add('notas-modal-open');});
      list.append(button);
    });
    if(!list.children.length){const empty=document.createElement('p');empty.className='academic-empty';empty.textContent='No se encontraron expedientes. Prueba con otro nombre o documento.';list.append(empty);}
  };
  $('matricula').addEventListener('change',()=>{if(dirty&&!confirm('¿Descartar los cambios sin guardar?')){$('matricula').value=actual?.id||'';return;}abrir($('matricula').value);});
  $('modulos').addEventListener('input',()=>{dirty=true;resumen();$('guardado').textContent='Cambios sin guardar.';});
  $('actualizar').addEventListener('click',cargar);
  $('imprimir').addEventListener('click',()=>{if(dirty){aviso('Guarda las notas antes de imprimir la consulta.',true);return;}const campus=notaCampus(),registro=campus?{modulos:campus.evaluaciones.map(e=>({nombre:e.nombre,nota:e.nota===null?'':Number(e.nota).toFixed(1),observacion:e.observacion||e.estado})),actualizada:campus.actualizada}:data.notas.find(n=>n.id===actual.id);if(!registro){aviso('Guarda las notas antes de generar el boletín.',true);return;}
 $('boletin-periodo').textContent='Período académico · '+actual.periodo;
 $('boletin-criterio').textContent=$('criterio-notas').textContent;
 $('boletin-datos').replaceChildren();[['Estudiante',actual.nombre],['Documento de identidad',actual.cedula],['Programa de formación',actual.programa],['Jornada',actual.jornada],['Código de matrícula',actual.id]].forEach(([titulo,valor])=>{const box=document.createElement('div'),label=document.createElement('span'),v=document.createElement('strong');label.textContent=titulo;v.textContent=valor;box.append(label,v);$('boletin-datos').append(box);});
 $('boletin-modulos').replaceChildren();registro.modulos.forEach(m=>{const r=$('boletin-modulos').insertRow();[m.nombre,m.nota===''?'Pendiente':m.nota,m.observacion||'—'].forEach(t=>r.insertCell().textContent=t);});
 ['avance','promedio','definitiva'].forEach(k=>$('boletin-'+k).textContent=$(k).textContent);
 $('boletin-fecha').textContent='Última actualización: '+new Date(registro.actualizada).toLocaleString('es-CO');$('boletin').hidden=false;window.print();});
  $('formNotas').addEventListener('submit',async e=>{e.preventDefault();if(busy||!actual||notaCampus())return;const payload={accion:'guardarNotas',id:actual.id,revision:data.notas.find(n=>n.id===actual.id)?.revision||'',modulos:valores()};bloquear(true);aviso('Guardando notas…');try{const d=await api(payload);if(!d.notas||d.notas.id!==actual.id)throw Error('Respuesta no confirmada. Revisa la implementación de Apps Script.');data.notas=data.notas.filter(n=>n.id!==actual.id).concat(d.notas);abrir(actual.id);aviso('Notas guardadas correctamente.');}catch(e){aviso(e.name==='AbortError'?'No se confirmó el guardado. Reintenta con los mismos datos o actualiza para consultar.':e.message,true);}finally{bloquear(false);}});
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});cargar();
})();
