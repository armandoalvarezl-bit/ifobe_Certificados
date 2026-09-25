'use strict';
(() => {
  const $=id=>document.getElementById(id);
  let datos={matriculas:[],estudiantes:[],programas:[]}, actual=null, ocupado=false;
  const token=sessionStorage.getItem('ifobeSesion');
  if(!token){window.location.replace('index.html');return;}
  async function api(payload){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch(window.IFOBE_INSCRIPCION.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,token}),signal:controller.signal,credentials:'omit',redirect:'follow'});
      if(!response.ok)throw Error('No se pudo conectar con el servidor.');
      const result=await response.json();if(result.ok!==true)throw Error(result.mensaje||'No se confirmó la operación.');return result;
    }catch(error){if(error.name==='AbortError')throw Error('Se agotó el tiempo. Puedes reintentar con los mismos datos; no se duplicará la matrícula.');throw error;}
    finally{clearTimeout(timer);}
  }
  function aviso(text,error=false){$('mensaje').textContent=text;$('mensaje').dataset.error=String(error);}
  function opciones(select,values,placeholder){select.replaceChildren();if(placeholder)select.add(new Option(placeholder,''));values.forEach(v=>select.add(new Option(v.label||v,v.value||v)));}
  function render(){
    const q=$('buscar').value.trim().toLocaleLowerCase('es'),estado=$('filtroEstado').value,periodo=$('filtroPeriodo').value;
    const rows=datos.matriculas.filter(m=>(!estado||m.estado===estado)&&(!periodo||m.periodo===periodo)&&(!q||[m.nombre,m.cedula,m.id].join(' ').toLocaleLowerCase('es').includes(q)));
    $('total').textContent=datos.matriculas.length;$('activas').textContent=datos.matriculas.filter(m=>m.estado==='Activa').length;$('pendientes').textContent=datos.matriculas.filter(m=>m.estado==='Pendiente').length;
    $('filas').replaceChildren();$('vacio').hidden=rows.length>0;$('cantidad').textContent=`${rows.length} de ${datos.matriculas.length} matrículas`;
    rows.forEach(m=>{
      const tr=document.createElement('tr');
      [m.nombre,m.programa,`${m.periodo} / ${m.jornada}`].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});
      const sub=document.createElement('small');sub.textContent=m.cedula;tr.firstChild.append(sub);
      const td=document.createElement('td'),badge=document.createElement('span');badge.className='badge';badge.dataset.estado=m.estado;badge.textContent=m.estado;td.append(badge);tr.append(td);
      const actions=document.createElement('td'),button=document.createElement('button');button.className='secondary';button.textContent='Editar';button.addEventListener('click',()=>abrir(m));actions.append(button);tr.append(actions);$('filas').append(tr);
    });
  }
  function refrescar(){const selected=$('filtroPeriodo').value;opciones($('filtroPeriodo'),[...new Set(datos.matriculas.map(m=>m.periodo))].sort().reverse(),'Todos los períodos');$('filtroPeriodo').value=selected;render();}
  async function cargar(){
    $('actualizar').disabled=true;
    try{const result=await api({accion:'gestionMatriculas'});if(!Array.isArray(result.matriculas)||!Array.isArray(result.estudiantes)||!Array.isArray(result.programas))throw Error('Actualiza y publica backend/Code.gs para habilitar las matrículas.');datos=result;refrescar();$('nueva').disabled=false;aviso(datos.estudiantes.length?'Listado actualizado.':'Registra primero un estudiante para crear su matrícula.');}
    catch(error){aviso(error.message,true);}finally{$('actualizar').disabled=false;}
  }
  function abrir(m){
    actual=m?{...m}:{id:crypto.randomUUID(),revision:''};$('formulario').reset();$('error').textContent='';$('titulo').textContent=m?'Editar matrícula':'Nueva matrícula';
    opciones($('estudiante'),datos.estudiantes.map(a=>({value:a.cedula,label:`${a.nombre} · ${a.cedula}`})),'Selecciona un estudiante');
    opciones($('programa'),datos.programas,'Selecciona un programa');
    if(m){
      if(!datos.estudiantes.some(a=>a.cedula===m.cedula))$('estudiante').add(new Option(`${m.nombre} · ${m.cedula}`,m.cedula));
      if(!datos.programas.includes(m.programa))$('programa').add(new Option(`${m.programa} (inactivo)`,m.programa));
      $('estudiante').value=m.cedula;['programa','periodo','jornada','estado','observaciones'].forEach(k=>$(k).value=m[k]);
    }
    $('estudiante').disabled=!!m;$('editor').showModal();
  }
  $('estudiante').addEventListener('change',()=>{const a=datos.estudiantes.find(a=>a.cedula===$('estudiante').value);$('programa').value=datos.programas.includes(a?.programa)?a.programa:'';});
  $('formulario').addEventListener('submit',async event=>{
    event.preventDefault();if(ocupado||!$('formulario').reportValidity())return;ocupado=true;
    const payload={accion:'guardarMatricula',id:actual.id,revision:actual.revision,cedula:$('estudiante').value};['programa','periodo','jornada','estado','observaciones'].forEach(k=>payload[k]=$(k).value.trim());
    const controls=[...$('formulario').elements],disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);$('error').textContent='Guardando…';
    try{const result=await api(payload);if(!result.matricula?.id)throw Error('El servidor no confirmó la matrícula. Actualiza el backend.');datos.matriculas=datos.matriculas.filter(m=>m.id!==result.matricula.id);datos.matriculas.unshift(result.matricula);refrescar();$('editor').close();aviso('Matrícula guardada. '+(result.correoEnviado?'Confirmación enviada al correo del estudiante.':result.correoMensaje||'La confirmación se envía al activar la matrícula.'),result.matricula.estado==='Activa'&&!result.correoEnviado);}
    catch(error){$('error').textContent=error.message;}finally{ocupado=false;controls.forEach((c,i)=>c.disabled=disabled[i]);}
  });
  $('editor').addEventListener('cancel',event=>{if(ocupado)event.preventDefault();});
  $('cerrar').addEventListener('click',()=>$('editor').close());$('nueva').addEventListener('click',()=>abrir(null));$('actualizar').addEventListener('click',cargar);
  ['buscar','filtroEstado','filtroPeriodo'].forEach(id=>$(id).addEventListener('input',render));
  $('salir').addEventListener('click',()=>{sessionStorage.removeItem('ifobeSesion');window.location.replace('index.html');});
  cargar();
})();
