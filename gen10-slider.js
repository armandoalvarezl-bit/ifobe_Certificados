(() => {
  const banner = document.querySelector('.campus-slider');
  const configurada = window.IFOBE_CONFIG?.imagenes?.bannerGen10;
  const ruta = configurada && /\.(png|jpe?g|webp|svg)(\?|$)/i.test(configurada) ? configurada : 'img/banner-gen10-aprendizaje.png';
  if (!banner || !ruta) return;
  const imagen = banner.querySelector('img');
  imagen.addEventListener('load', () => { banner.hidden = false; });
  imagen.addEventListener('error', () => { banner.hidden = true; });
  imagen.src = ruta;
})();
