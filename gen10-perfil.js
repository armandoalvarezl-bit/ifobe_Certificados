window.G10Profile = (() => {
  const safePhoto=value=>/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'')?value:'';
  function avatar(profile) {
    const photo=safePhoto(profile.fotoPerfil);
    return photo?'<img class="profile-avatar" src="'+photo+'" alt="Tu foto de perfil">':'<span class="profile-avatar profile-placeholder"><i class="bi bi-person" aria-hidden="true"></i></span>';
  }
  function fields(profile) {
    return '<fieldset class="upload-section"><legend>Mi foto de perfil</legend>'+avatar(profile)+'<label for="profilePhoto">Seleccionar foto</label><input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><p class="hint">JPG, PNG o WebP de hasta 5 MB. La imagen se recorta al centro y se optimiza antes de guardarla.</p><img id="profilePhotoPreview" class="profile-avatar" alt="Vista previa de tu nueva foto" hidden><label class="checkbox-label"><input id="removeProfilePhoto" type="checkbox"> Quitar mi foto actual</label></fieldset>';
  }
  async function optimize(file) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5*1048576)throw Error('Selecciona una foto JPG, PNG o WebP de hasta 5 MB.');
    const url=URL.createObjectURL(file);
    try {
      const img=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No pudimos leer esta foto. Prueba otra imagen.'));img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
      const ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,192,192);
      ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,192,192);
      for(const quality of [0.8,0.65,0.5,0.35]){const photo=canvas.toDataURL('image/jpeg',quality);if(photo.length<=30000)return photo;}
      throw Error('No pudimos optimizar esta foto. Selecciona otra imagen.');
    } finally {URL.revokeObjectURL(url);}
  }
  let previewGeneration=0;
  document.addEventListener('change',async event=>{
    if(event.target.id!=='profilePhoto')return;
    const generation=++previewGeneration,preview=document.getElementById('profilePhotoPreview');
    preview.hidden=true;
    const file=event.target.files?.[0];if(!file)return;
    try {const photo=await optimize(file);if(generation!==previewGeneration||!preview.isConnected)return;preview.src=photo;preview.hidden=false;document.getElementById('removeProfilePhoto').checked=false;}
    catch(error){if(generation!==previewGeneration||!preview.isConnected)return;event.target.value='';const box=document.getElementById('editorError');box.textContent=error.message;box.hidden=false;}
  });
  async function collect() {
    const file=document.getElementById('profilePhoto')?.files?.[0];
    if(document.getElementById('removeProfilePhoto')?.checked)return {fotoPerfil:''};
    return file?{fotoPerfil:await optimize(file)}:{};
  }
  const dialog=document.getElementById('welcomeDialog');
  document.getElementById('welcomeContinue').addEventListener('click',()=>dialog.close());
  function welcome(user,login=false) {
    const key='gen10Bienvenida:'+user.email;
    if((!login&&sessionStorage.getItem(key))||dialog.open)return;
    document.getElementById('welcomeName').textContent=user.nombre;
    dialog.showModal();sessionStorage.setItem(key,'1');
  }
  function header(profile={}) {
    const button=document.getElementById('accountProfile');
    if(button)button.innerHTML=avatar(profile);
  }
  return {avatar,fields,collect,welcome,header};
})();
