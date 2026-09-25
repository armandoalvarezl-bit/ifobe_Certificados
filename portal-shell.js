/* Shared navigation for academic screens and public admissions. */
(() => {
  const page = document.body.dataset.portalPage;
  if (!page) return;
  const pages = [
    ['certificados', 'home.html', 'Certificaciones', 'patch-check'],
    ['matriculas', 'matriculas.html', 'Matrículas', 'journal-check'],
    ['estudiantes', 'registro-alumnos (2).html', 'Estudiantes', 'people']
  ];
  const brand = '<a class="shell-brand" href="home.html"><img src="img/Logogen10.png" alt=""><span><strong>IFOBE</strong><small>PLATAFORMA EDUCATIVA</small></span></a>';
  const header = document.createElement('header');
  header.className = 'shell-header';
  header.innerHTML = brand + '<nav aria-label="Navegación principal">' + pages.map(([key, url, label, icon]) => '<a href="' + url + '"' + (page === key ? ' aria-current="page"' : '') + '><i class="bi bi-' + icon + '" aria-hidden="true"></i> ' + label + '</a>').join('') + '</nav><div class="shell-account"></div>';
  const existingExit = document.getElementById('salir');
  if (existingExit) header.querySelector('.shell-account').append(existingExit);
  else {
    const exit = document.createElement('button');
    exit.type = 'button'; exit.textContent = 'Cerrar sesión ↗';
    exit.addEventListener('click', () => { sessionStorage.removeItem('ifobeSesion'); location.href = 'index.html'; });
    header.querySelector('.shell-account').append(exit);
  }
  const sidebar = document.createElement('aside');
  sidebar.className = 'shell-sidebar';
  sidebar.innerHTML = '<nav aria-label="Menú lateral">' + pages.map(([key,url,label,icon])=>'<a href="'+url+'"'+(page===key?' aria-current="page"':'')+'><i class="bi bi-'+icon+'" aria-hidden="true"></i>'+label+'</a>').join('') + '</nav><div class="shell-promise">' + brand + '<p>Tu formación,<br>nuestro compromiso.</p></div>';
  document.body.prepend(header, sidebar);
})();
