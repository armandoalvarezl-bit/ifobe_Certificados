'use strict';
window.G10Files = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const accept = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.pptx,.mp3,.mp4,.webm';
  const size = bytes => bytes >= 1048576 ? (bytes/1048576).toFixed(1)+' MB' : Math.ceil(bytes/1024)+' KB';
  let generation = 0, urls = new Map(), previewUrl, opening = 0, lastApi;
  function clear() {
    generation++;
    urls.forEach(file => URL.revokeObjectURL(file.url)); urls.clear();
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null;
    const viewer = document.getElementById('fileViewer');
    if (viewer?.open) viewer.close();
  }
  function fields(files=[], cover) {
    return `<fieldset class="upload-section"><legend><i class="bi bi-paperclip" aria-hidden="true"></i> Materiales adjuntos</legend><p class="hint">Sube hasta 5 archivos: PDF, imágenes, Word, Excel, PowerPoint, texto, audio MP3 o video MP4/WebM. Máximo 10 MB por archivo y 20 MB en cada envío.</p><div class="existing-files">${files.map(f=>`<label class="checkbox-label"><input type="checkbox" name="keep-file" value="${esc(f.id)}" checked><span>${esc(f.nombre)} <small>${size(f.tamano)}</small></span></label>`).join('')}</div>${files.length?'<p class="hint">Desmarca un archivo para retirarlo de este contenido.</p>':''}<label class="upload-zone" for="g10-file-input"><i class="bi bi-cloud-arrow-up" aria-hidden="true"></i><strong>Seleccionar archivos de mi equipo</strong><input id="g10-file-input" type="file" accept="${accept}" multiple><span class="upload-selection" aria-live="polite">Ningún archivo nuevo seleccionado</span></label></fieldset>` + (cover === undefined ? '' : `<fieldset class="upload-section"><legend>Portada del curso</legend><p class="hint">Una imagen horizontal JPG, PNG o WebP, de hasta 2 MB.</p>${cover?`<label class="checkbox-label"><input id="g10-keep-cover" type="checkbox" value="${esc(cover.id)}" checked> Conservar portada actual: ${esc(cover.nombre)}</label>`:''}<label class="upload-zone" for="g10-cover-input"><i class="bi bi-image" aria-hidden="true"></i><strong>Subir imagen de portada</strong><input id="g10-cover-input" type="file" accept=".jpg,.jpeg,.png,.webp"><span class="upload-selection" aria-live="polite">Selecciona una imagen</span></label></fieldset>`);
  }
  async function read(file, cover=false) {
    if (!file.size || file.size > (cover?2:10)*1048576) throw Error(cover?'La portada debe pesar hasta 2 MB.':'Cada archivo debe pesar entre 1 byte y 10 MB.');
    const allowed = (cover?'.jpg,.jpeg,.png,.webp':accept).split(',');
    if (!allowed.includes('.'+file.name.split('.').pop().toLowerCase())) throw Error('Formato no admitido: '+file.name);
    const base64 = await new Promise((resolve,reject)=>{
      const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(Error('No se pudo leer '+file.name)); reader.readAsDataURL(file);
    });
    return {nombre:file.name,base64};
  }
  async function collect() {
    const input=document.getElementById('g10-file-input'); if(!input)return {};
    const keep=Array.from(document.querySelectorAll('input[name="keep-file"]:checked')).map(el=>({id:el.value}));
    const files=Array.from(input.files || []), cover=document.getElementById('g10-cover-input');
    const image=cover?.files?.[0];
    if(keep.length+files.length>5)throw Error('Puedes conservar y subir hasta cinco archivos en total.');
    if(files.reduce((n,f)=>n+f.size,0)+(image?.size||0)>20*1048576)throw Error('Selecciona hasta 20 MB por envío.');
    const result={archivos:keep.concat(await Promise.all(files.map(f=>read(f))))};
    if(cover){const current=document.getElementById('g10-keep-cover');result.portada=image?await read(image,true):current?.checked?{id:current.value}:null;}
    return result;
  }
  function documentFields(requirements, existing=[]) {
    return '<p class="hint">PDF, JPG o PNG. Hasta 10 MB por documento y 20 MB por envío. Puedes guardar tus datos y completar los documentos pendientes después. Un archivo nuevo reemplaza el anterior de ese tipo.</p>'+requirements.map(r=>{
      const current=existing.find(f=>f.categoria===r.id);
      return '<fieldset class="upload-section"><legend>'+esc(r.nombre)+'</legend><p>'+ (current?'Entregado: '+esc(current.nombre):'Pendiente')+'</p><label class="upload-zone" for="g10-doc-'+esc(r.id)+'"><strong>Seleccionar '+esc(r.nombre)+'</strong><input id="g10-doc-'+esc(r.id)+'" type="file" accept=".pdf,.jpg,.jpeg,.png"><span class="upload-selection" aria-live="polite">Ningún archivo nuevo seleccionado</span></label></fieldset>';
    }).join('');
  }
  async function collectDocuments(requirements, existing=[]) {
    const selected=requirements.map(r=>({r,file:document.getElementById('g10-doc-'+r.id)?.files?.[0]}));
    if(selected.reduce((sum,x)=>sum+(x.file?.size||0),0)>20*1048576)throw Error('Selecciona hasta 20 MB por envío.');
    const retained=existing.filter(f=>!selected.some(x=>x.file&&x.r.id===f.categoria)).map(f=>({id:f.id}));
    const additions=await Promise.all(selected.filter(x=>x.file).map(async x=>{
      if(!/\.(pdf|jpg|jpeg|png)$/i.test(x.file.name))throw Error('Usa PDF, JPG o PNG para '+x.r.nombre);
      return {...await read(x.file),categoria:x.r.id};
    }));
    if(retained.length+additions.length>5)throw Error('Tu expediente admite hasta cinco archivos. Contacta a administración para organizar los adjuntos anteriores.');
    return {archivos:retained.concat(additions)};
  }
  function render(files, table, record) {
    if(!files?.length)return '';
    return '<div class="materials-list" aria-label="Archivos adjuntos">'+files.map(f=>'<details class="attachment-panel"><summary><i class="bi bi-file-earmark-text" aria-hidden="true"></i><span><strong>'+esc(f.nombre)+'</strong><small>'+size(f.tamano)+' &middot; Ver contenido</small></span></summary><div class="attachment-preview" data-table="'+esc(table)+'" data-record="'+esc(record)+'" data-id="'+esc(f.id)+'" aria-live="polite">Despliega para cargar el contenido del documento.</div><button type="button" class="quiet" data-action="archivo" data-table="'+esc(table)+'" data-record="'+esc(record)+'" data-id="'+esc(f.id)+'">Ampliar y descargar</button></details>').join('')+'</div>';
  }
  async function hydrateDocuments(api) {
    const current=generation;
    for(const panel of document.querySelectorAll('.attachment-panel[open]')){
      const body=panel.querySelector('.attachment-preview');
      if(!body||body.dataset.loaded)continue;
      body.dataset.loaded='loading';body.textContent='Cargando contenido...';
      try{
        const f=await fetchFile(api,body.dataset.table,body.dataset.record,body.dataset.id);
        if(current!==generation||!body.isConnected)return;
        let node;
        if(f.tipo==='application/pdf'){node=document.createElement('object');node.type=f.tipo;node.data=f.url;node.setAttribute('aria-label',f.nombre);node.textContent='Usa Ampliar y descargar si tu navegador no muestra el PDF.';}
        else if(f.tipo.startsWith('image/')){node=document.createElement('img');node.src=f.url;node.alt=f.nombre;}
        else if(f.tipo==='text/plain'){node=document.createElement('pre');node.textContent=await f.blob.text();}
        else if(f.tipo.startsWith('audio/')||f.tipo.startsWith('video/')){node=document.createElement(f.tipo.startsWith('audio/')?'audio':'video');node.controls=true;node.src=f.url;}
        else {node=document.createElement('p');node.textContent='Este formato requiere una aplicaci\u00f3n compatible. Usa Ampliar y descargar para abrirlo en tu equipo.';}
        if(current!==generation||!body.isConnected)return;
        body.replaceChildren(node);body.dataset.loaded='ready';
      }catch(error){if(current===generation&&body.isConnected){delete body.dataset.loaded;body.textContent=error.message;}}
    }
  }
  function courseCover(course) {
    return (course.portada?.id ? course.portada : null) || (course.archivos||[]).find(f=>f.id&&(/\.(png|jpe?g|webp)$/i.test((f.nombre||'').trim())||/^image\//.test(f.tipo||''))) || null;
  }
  function courseMaterials(course) {
    const image=courseCover(course);
    const normalize=value=>String(value||'').trim().toLocaleLowerCase();
    return (course.archivos||[]).filter(f=>!image||(f.id!==image.id&&(!image.nombre||normalize(f.nombre)!==normalize(image.nombre))));
  }
  function cover(course) {
    const image=courseCover(course);
    return image?`<img class="g10-cover-image" data-course="${esc(course.id)}" data-file="${esc(image.id)}" alt="Portada de ${esc(course.titulo)}" hidden><span class="course-cover-status" role="status">Cargando portada...</span>`:'';
  }
  async function fetchFile(api, table, record, id) {
    const key=table+':'+record+':'+id, current=generation;
    if(urls.has(key))return urls.get(key);
    const {archivo:f}=await api('gen10LeerArchivo',{tabla:table,registro:record,archivo:id});
    if(current!==generation)throw Error('La vista cambió. Abre el archivo nuevamente.');
    const safe=['application/pdf','image/png','image/jpeg','image/webp','text/plain','audio/mpeg','video/mp4','video/webm','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if(!safe.includes(f.tipo))throw Error('Formato no admitido.');
    const blob=new Blob([Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))],{type:f.tipo});
    const result={...f,base64:undefined,blob,url:URL.createObjectURL(blob)};urls.set(key,result);return result;
  }
  async function hydrate(api) {
    lastApi=api;
    hydrateDocuments(api);
    const images=Array.from(document.querySelectorAll('.g10-cover-image, .g10-document-thumbnail')).filter(img=>!img.src&&(!img.closest('.record-admin')||img.closest('.record-admin').open)), current=generation;
    async function worker(){while(images.length && current===generation){const img=images.shift();try{const f=await fetchFile(api,img.dataset.course?'Cursos':img.dataset.table,img.dataset.course||img.dataset.record,img.dataset.file);if(img.isConnected&&current===generation){img.src=f.url;img.hidden=false;img.parentElement.querySelector('.course-cover-status')?.remove();}}catch(_){if(img.isConnected){const status=img.parentElement.querySelector('.course-cover-status');if(status)status.textContent='No se pudo cargar la portada. Pulsa Actualizar para reintentar.';}}}}
    await Promise.all([worker(),worker(),worker()]);
  }
  async function open(api, table, record, id) {
    const request=++opening, dialog=document.getElementById('fileViewer'), body=document.getElementById('fileContent');
    const download=document.getElementById('fileDownload'), external=document.getElementById('fileOpen');
    download.hidden=true;external.hidden=true;download.removeAttribute('href');external.removeAttribute('href');
    document.getElementById('fileTitle').textContent='Cargando archivo…';
    body.textContent='Preparando la vista previa. Puedes cerrar esta ventana mientras carga.';
    if(!dialog.open)dialog.showModal();
    let f;
    try{f=await fetchFile(api,table,record,id);}catch(error){
      if(request!==opening||!dialog.open)return;
      document.getElementById('fileTitle').textContent='No se pudo abrir el archivo';body.textContent=error.message;return;
    }
    if(request!==opening||!dialog.open)return;
    document.getElementById('fileTitle').textContent=f.nombre; body.replaceChildren();
    download.href=f.url;download.download=f.nombre;download.hidden=false;
    external.href=f.url;external.hidden=false;
    let node;
    if(f.tipo.startsWith('image/')){node=document.createElement('img');node.src=f.url;node.alt=f.nombre;}
    else if(f.tipo==='application/pdf'){node=document.createElement('object');node.type='application/pdf';node.data=f.url;node.setAttribute('aria-label',f.nombre);node.textContent='Tu navegador no muestra este PDF aquí. Usa Abrir en otra pestaña o Descargar archivo.';}
    else if(f.tipo.startsWith('video/')||f.tipo.startsWith('audio/')){node=document.createElement(f.tipo.startsWith('video/')?'video':'audio');node.controls=true;node.src=f.url;}
    else if(f.tipo==='text/plain'){node=document.createElement('pre');node.textContent=await f.blob.text();}
    else{node=document.createElement('p');node.textContent='Este documento está disponible para descargar. Ábrelo con Word, Excel o PowerPoint en tu equipo.';}
    if(request!==opening||!dialog.open)return;
    body.append(node);
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Si la vista previa no aparece, abre el archivo en otra pestaña o descárgalo.';body.append(hint);
  }
  document.addEventListener('toggle',event=>{if(event.target.matches?.('.record-admin, .attachment-panel')&&event.target.open&&lastApi)hydrate(lastApi);},true);
  document.addEventListener('change',event=>{
    const input=event.target;if(!['g10-file-input','g10-cover-input'].includes(input.id)&&!input.id?.startsWith('g10-doc-'))return;
    input.closest('.upload-zone').querySelector('.upload-selection').textContent=Array.from(input.files).map(f=>f.name+' ('+size(f.size)+')').join(' · ')||'Ningún archivo seleccionado';

  });
  document.getElementById('closeFile').addEventListener('click',()=>document.getElementById('fileViewer').close());
  document.getElementById('fileViewer').addEventListener('close',()=>{opening++;document.getElementById('fileContent').replaceChildren();});
  return {fields,collect,documentFields,collectDocuments,render,cover,courseCover,courseMaterials,hydrate,open,clear};
})();
