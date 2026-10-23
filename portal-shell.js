/* Navegación exclusiva del panel administrativo. Inscripciones es una página pública independiente. */
(() => {
  const page = document.body.dataset.portalPage;
  if (!page) return;
  const pages = [
    ['campus', 'gen10.html', 'Campus Gen10', 'mortarboard'],
    ['notas', 'notas.html', 'Notas', 'journal-text'],
    ['certificados', 'home.html', 'Certificaciones', 'patch-check'],
    ['matriculas', 'matriculas.html', 'Matrículas', 'journal-check'],
    ['estudiantes', 'registro-alumnos (2).html', 'Estudiantes', 'people'],
    ['historial', 'home.html#historial', 'Historial', 'clock-history'],
    ['ayuda', 'home.html#ayuda', 'Ayuda', 'question-circle']
  ];
  const brand = '<a class="shell-brand" href="home.html"><img src="' + window.IFOBE_CONFIG.imagenes.logo + '" alt=""><span><strong>IFOBE</strong><small>PLATAFORMA EDUCATIVA</small></span></a>';
  const header = document.createElement('header');
  header.className = 'shell-header';
  header.innerHTML = brand + '<nav aria-label="Navegación principal">' + pages.map(([key, url, label, icon]) => '<a href="' + url + '"' + (page === key ? ' aria-current="page"' : '') + '><i class="bi bi-' + icon + '" aria-hidden="true"></i> ' + label + '</a>').join('') + '</nav><div class="shell-account"></div>';
  const existingExit = document.getElementById('salir');
  if (existingExit) header.querySelector('.shell-account').append(existingExit);
  else if (sessionStorage.getItem('ifobeSesion')) {
    const exit = document.createElement('button');
    exit.type = 'button'; exit.textContent = 'Cerrar sesión ↗';
    exit.addEventListener('click', () => { if(typeof window.cerrarSesion==='function'){window.cerrarSesion();return;}sessionStorage.removeItem('ifobeSesion'); location.href = 'index.html'; });
    header.querySelector('.shell-account').append(exit);
  } else header.querySelector('.shell-account').innerHTML='<a href="index.html">Iniciar sesión</a>';
  const sidebar = document.createElement('aside');
  sidebar.className = 'shell-sidebar';
  sidebar.innerHTML = '<nav aria-label="Menú lateral">' + pages.map(([key,url,label,icon])=>'<a href="'+url+'"'+(page===key?' aria-current="page"':'')+'><i class="bi bi-'+icon+'" aria-hidden="true"></i>'+label+'</a>').join('') + '</nav><div class="shell-promise">' + brand + '<p>Tu formación,<br>nuestro compromiso.</p></div>';
  document.body.prepend(header, sidebar);
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='shell-toggle';toggle.textContent='Menú';
  sidebar.id='shell-menu';toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded','false');
  const close=()=>{document.body.classList.remove('shell-menu-open');toggle.setAttribute('aria-expanded','false');};
  toggle.addEventListener('click',()=>{const open=document.body.classList.toggle('shell-menu-open');toggle.setAttribute('aria-expanded',String(open));});
  sidebar.addEventListener('click',e=>{if(e.target.closest('a'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();if(document.activeElement&&sidebar.contains(document.activeElement))toggle.focus();}});
  header.insertBefore(toggle,header.querySelector('.shell-account'));
  // La navegación se presenta una sola vez, desde el mismo catálogo en todas las páginas.
  header.querySelector('nav').remove();
  const current=document.createElement('span');current.className='shell-location';
  function markCurrent(){const key=page==='certificados'&&['#historial','#ayuda'].includes(location.hash)?location.hash.slice(1):page;current.textContent=pages.find(p=>p[0]===key)?.[2]||'Gestión académica';sidebar.querySelectorAll('nav a').forEach((a,i)=>{if(pages[i][0]===key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
  header.insertBefore(current,toggle);markCurrent();window.addEventListener('hashchange',markCurrent);
})();
