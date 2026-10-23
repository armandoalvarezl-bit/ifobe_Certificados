(() => {
  const config = window.IFOBE_CONFIG;
  document.getElementById('mensaje').textContent = config.mantenimiento.mensaje;
})();
