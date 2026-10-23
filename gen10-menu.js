(() => {
  const toggle=document.getElementById('mobileMenuToggle');
  const nav=document.getElementById('campusNavigation');
  const sidebar=toggle.closest('.campus-sidebar');
  const mobile=window.matchMedia('(max-width:900px)');
  function close() {
    sidebar.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded','false');
  }
  toggle.addEventListener('click',()=>{
    const open=toggle.getAttribute('aria-expanded')!=='true';
    sidebar.classList.toggle('menu-open',open);
    toggle.setAttribute('aria-expanded',String(open));
  });
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-view]');
    if(!button)return;
    document.getElementById('mobileMenuLabel').textContent=button.textContent.trim();
    close();
    if(mobile.matches)toggle.focus();
  });
  document.addEventListener('click',event=>{if(!sidebar.contains(event.target))close();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){close();toggle.focus();}
  });
  mobile.addEventListener('change',close);
})();
