const CORREOS_PROPIETARIOS = ['aviacamoso@gmail.com', 'letcarcab@gmail.com'];
const WHATSAPP_NUMERO = '5492236841767';
const STORAGE_PRODUCTOS = 'caroBoutique_productos';
const STORAGE_CARRITO = 'caroBoutique_carrito';
const STORAGE_FAVORITOS = 'caroBoutique_favoritos';
const DIAS_NUEVO = 14;

const TAMANIO_LABELS = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' };
const COLOR_LABELS = {
  rosa: 'Rosa', rojo: 'Rojo', negro: 'Negro', blanco: 'Blanco', dorado: 'Dorado',
  azul: 'Azul', verde: 'Verde', violeta: 'Violeta', nude: 'Nude', multicolor: 'Multicolor'
};

let esPropietaria = false;
let imagenFinal = null;
let imagenOriginalData = null;
let archivoOriginal = null;

let productos = cargarJSON(STORAGE_PRODUCTOS, []);
let carrito = cargarJSON(STORAGE_CARRITO, []);
let favoritos = cargarJSON(STORAGE_FAVORITOS, []);

function cargarJSON(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function guardarProductos() { localStorage.setItem(STORAGE_PRODUCTOS, JSON.stringify(productos)); }
function guardarCarrito() { localStorage.setItem(STORAGE_CARRITO, JSON.stringify(carrito)); }
function guardarFavoritos() { localStorage.setItem(STORAGE_FAVORITOS, JSON.stringify(favoritos)); }

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatearPrecio(n) {
  return '$' + Number(n).toLocaleString('es-AR');
}

function mostrarToast(mensaje) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function esNuevo(fechaISO) {
  return Date.now() - new Date(fechaISO).getTime() < DIAS_NUEVO * 86400000;
}

function obtenerColorHex(selectEl) {
  return selectEl.options[selectEl.selectedIndex].dataset.hex || '#d87093';
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function comprimirImagen(dataUrl, maxAncho = 800) {
  const img = await cargarImagen(dataUrl);
  let w = img.width;
  let h = img.height;
  if (w > maxAncho) {
    h = Math.round(h * (maxAncho / w));
    w = maxAncho;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function procesarFondoBlanco(dataUrl, tolerancia) {
  const img = await cargarImagen(dataUrl);
  let w = img.width;
  let h = img.height;
  const maxAncho = 1000;
  if (w > maxAncho) {
    h = Math.round(h * (maxAncho / w));
    w = maxAncho;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const samples = [];
  const puntos = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]
  ];
  puntos.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  });

  const bgR = samples.reduce((s, p) => s + p[0], 0) / samples.length;
  const bgG = samples.reduce((s, p) => s + p[1], 0) / samples.length;
  const bgB = samples.reduce((s, p) => s + p[2], 0) / samples.length;

  const umbral = tolerancia * 2.8;
  const suavizado = umbral * 0.55;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    if (dist < umbral) {
      const mezcla = dist < umbral - suavizado ? 0 : (dist - (umbral - suavizado)) / suavizado;
      data[i] = Math.round(255 * (1 - mezcla) + r * mezcla);
      data[i + 1] = Math.round(255 * (1 - mezcla) + g * mezcla);
      data[i + 2] = Math.round(255 * (1 - mezcla) + b * mezcla);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const final = document.createElement('canvas');
  final.width = w;
  final.height = h;
  const fctx = final.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(canvas, 0, 0);

  return final.toDataURL('image/jpeg', 0.82);
}

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function verificarUsuario() {
  const email = document.getElementById('email-input').value.toLowerCase().trim();
  if (!email) {
    mostrarToast('Por favor, ingresá tu email.');
    return;
  }
  document.getElementById('caja-login').style.display = 'none';
  esPropietaria = CORREOS_PROPIETARIOS.includes(email);
  if (esPropietaria) {
    document.getElementById('panel-admin').style.display = 'block';
    mostrarToast('Modo Propietaria activado.');
    renderAdminLista();
  } else {
    mostrarToast('Bienvenida. Ya podés encargar tus moños.');
  }
}

async function manejarImagen(file) {
  if (!file || !file.type.startsWith('image/')) {
    mostrarToast('Seleccioná una imagen válida.');
    return;
  }
  archivoOriginal = file;
  imagenOriginalData = await leerArchivo(file);
  imagenFinal = null;

  document.getElementById('preview-original').src = imagenOriginalData;
  document.getElementById('preview-procesada').src = '';
  document.getElementById('herramienta-fondo').style.display = 'block';
  document.getElementById('btn-publicar').disabled = true;
}

async function quitarFondoPremium() {
  if (!imagenOriginalData) return;

  const btn = document.getElementById('btn-quitar-fondo');
  const barra = document.getElementById('barra-progreso');
  btn.disabled = true;
  barra.classList.add('visible');
  document.getElementById('barra-fill').style.width = '60%';

  try {
    await new Promise(r => setTimeout(r, 50));
    const tolerancia = parseInt(document.getElementById('sensibilidad-fondo').value, 10);
    imagenFinal = await procesarFondoBlanco(imagenOriginalData, tolerancia);
    document.getElementById('preview-procesada').src = imagenFinal;
    document.getElementById('btn-publicar').disabled = false;
    document.getElementById('barra-fill').style.width = '100%';
    mostrarToast('Fondo removido. Revisá el resultado antes de publicar.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo procesar. Probá con otra foto o usá la original.');
  } finally {
    btn.disabled = false;
    barra.classList.remove('visible');
    document.getElementById('barra-fill').style.width = '0%';
  }
}

async function usarOriginal() {
  if (!imagenOriginalData) return;
  imagenFinal = await comprimirImagen(imagenOriginalData);
  document.getElementById('preview-procesada').src = imagenFinal;
  document.getElementById('btn-publicar').disabled = false;
  mostrarToast('Se usará la imagen original.');
}

function publicarMono() {
  const nombre = document.getElementById('nuevo-nombre').value.trim();
  const precio = parseFloat(document.getElementById('nuevo-precio').value);
  const descripcion = document.getElementById('nuevo-descripcion').value.trim();
  const tamanio = document.getElementById('nuevo-tamanio').value;
  const colorSelect = document.getElementById('nuevo-color');
  const color = colorSelect.value;
  const colorHex = obtenerColorHex(colorSelect);
  const stock = parseInt(document.getElementById('nuevo-stock').value, 10) || 0;

  if (!nombre || isNaN(precio) || precio <= 0) {
    mostrarToast('Completa nombre y precio.');
    return;
  }
  if (!imagenFinal) {
    mostrarToast('Sube y procesa una imagen antes de publicar.');
    return;
  }

  productos.unshift({
    id: generarId(),
    titulo: nombre,
    valor: precio,
    descripcion: descripcion || 'Moño artesanal de alta calidad.',
    imagen: imagenFinal,
    tamanio,
    color,
    colorHex,
    stock,
    fecha: new Date().toISOString()
  });

  guardarProductos();
  limpiarFormularioAdmin();
  actualizarCatalogo();
  renderAdminLista();
  mostrarToast('Moño publicado con éxito.');
}

function limpiarFormularioAdmin() {
  document.getElementById('nuevo-nombre').value = '';
  document.getElementById('nuevo-precio').value = '';
  document.getElementById('nuevo-descripcion').value = '';
  document.getElementById('nuevo-stock').value = '1';
  document.getElementById('herramienta-fondo').style.display = 'none';
  document.getElementById('preview-original').src = '';
  document.getElementById('preview-procesada').src = '';
  document.getElementById('btn-publicar').disabled = true;
  document.getElementById('input-imagen').value = '';
  imagenFinal = null;
  imagenOriginalData = null;
  archivoOriginal = null;
}

function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto del catálogo?')) return;
  productos = productos.filter(p => p.id !== id);
  carrito = carrito.filter(i => i.productoId !== id);
  favoritos = favoritos.filter(f => f !== id);
  guardarProductos();
  guardarCarrito();
  guardarFavoritos();
  actualizarCatalogo();
  renderAdminLista();
  renderCarrito();
  mostrarToast('Producto eliminado.');
}

function renderAdminLista() {
  const cont = document.getElementById('contenedor-admin-productos');
  if (!productos.length) {
    cont.innerHTML = '<p style="font-size:13px;color:var(--texto-secundario);">Sin productos aún.</p>';
    return;
  }
  cont.innerHTML = productos.map(p => `
    <div class="item-admin">
      <img src="${p.imagen}" alt="${p.titulo}">
      <div class="item-admin-info">
        <strong>${p.titulo}</strong><br>
        ${formatearPrecio(p.valor)} · Stock: ${p.stock}
      </div>
      <button class="btn-eliminar" data-eliminar="${p.id}">Eliminar</button>
    </div>
  `).join('');
}

function obtenerProductosFiltrados() {
  const busqueda = document.getElementById('filtro-busqueda').value.toLowerCase().trim();
  const orden = document.getElementById('filtro-orden').value;
  const color = document.getElementById('filtro-color').value;
  const tamanio = document.getElementById('filtro-tamanio').value;
  const precioMax = parseFloat(document.getElementById('filtro-precio-max').value);

  let lista = productos.filter(p => {
    if (busqueda && !p.titulo.toLowerCase().includes(busqueda)) return false;
    if (color && p.color !== color) return false;
    if (tamanio && p.tamanio !== tamanio) return false;
    if (!isNaN(precioMax) && p.valor > precioMax) return false;
    return true;
  });

  switch (orden) {
    case 'precio-asc': lista.sort((a, b) => a.valor - b.valor); break;
    case 'precio-desc': lista.sort((a, b) => b.valor - a.valor); break;
    case 'nombre': lista.sort((a, b) => a.titulo.localeCompare(b.titulo)); break;
    default: lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }
  return lista;
}

function actualizarCatalogo() {
  const contenedor = document.getElementById('contenedor-productos');
  const lista = obtenerProductosFiltrados();

  document.getElementById('contador-resultados').textContent =
    lista.length === productos.length
      ? `${productos.length} moño${productos.length !== 1 ? 's' : ''} en colección`
      : `${lista.length} de ${productos.length} resultados`;

  if (!lista.length) {
    contenedor.innerHTML = '<div class="mensaje-vacio">No hay moños que coincidan con tu búsqueda.</div>';
    return;
  }

  contenedor.innerHTML = lista.map(p => `
    <article class="card-producto">
      ${esNuevo(p.fecha) ? '<span class="badge-nuevo">Nuevo</span>' : ''}
      <button class="btn-favorito ${favoritos.includes(p.id) ? 'activo' : ''}" data-fav="${p.id}" aria-label="Favorito">
        ${favoritos.includes(p.id) ? '&#9829;' : '&#9825;'}
      </button>
      <div class="card-imagen-wrap" data-ver="${p.id}">
        <img src="${p.imagen}" alt="${p.titulo}" loading="lazy">
      </div>
      <div class="card-cuerpo">
        <h3>${p.titulo}</h3>
        <p class="card-desc">${p.descripcion}</p>
        <div class="card-meta">
          <span class="chip"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.colorHex};margin-right:4px;border:1px solid rgba(0,0,0,0.1);vertical-align:middle;"></span>${COLOR_LABELS[p.color] || p.color}</span>
          <span class="chip">${TAMANIO_LABELS[p.tamanio] || p.tamanio}</span>
        </div>
        <div class="card-precio">${formatearPrecio(p.valor)}</div>
        <div class="card-acciones">
          <button class="btn-secundario" data-ver="${p.id}">Ver detalle</button>
          <button class="btn-principal" data-agregar="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
            ${p.stock <= 0 ? 'Agotado' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function toggleFavorito(id) {
  if (favoritos.includes(id)) {
    favoritos = favoritos.filter(f => f !== id);
    mostrarToast('Removido de favoritos.');
  } else {
    favoritos.push(id);
    mostrarToast('Agregado a favoritos.');
  }
  guardarFavoritos();
  actualizarCatalogo();
}

function abrirModal(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modal-contenido').innerHTML = `
    <div class="modal-imagen">
      <img src="${p.imagen}" alt="${p.titulo}">
    </div>
    <div class="modal-info">
      <h3>${p.titulo}</h3>
      <div class="card-meta" style="justify-content:flex-start;">
        <span class="chip">${COLOR_LABELS[p.color]}</span>
        <span class="chip">${TAMANIO_LABELS[p.tamanio]}</span>
        <span class="chip">Stock: ${p.stock}</span>
      </div>
      <div class="precio-grande">${formatearPrecio(p.valor)}</div>
      <p class="desc-completa">${p.descripcion}</p>
      <button class="btn-principal" data-agregar-modal="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
      </button>
    </div>
  `;

  document.getElementById('overlay-modal').classList.add('activo');
  document.getElementById('modal-producto').classList.add('activo');
}

function cerrarModal() {
  document.getElementById('overlay-modal').classList.remove('activo');
  document.getElementById('modal-producto').classList.remove('activo');
}

function agregarAlCarrito(id) {
  const p = productos.find(x => x.id === id);
  if (!p || p.stock <= 0) {
    mostrarToast('Producto no disponible.');
    return;
  }

  const item = carrito.find(i => i.productoId === id);
  if (item) {
    if (item.cantidad >= p.stock) {
      mostrarToast('No hay más stock disponible.');
      return;
    }
    item.cantidad++;
  } else {
    carrito.push({ productoId: id, cantidad: 1 });
  }

  guardarCarrito();
  actualizarBadgeCarrito();
  renderCarrito();
  mostrarToast(`${p.titulo} agregado al carrito.`);
}

function actualizarBadgeCarrito() {
  const total = carrito.reduce((s, i) => s + i.cantidad, 0);
  const badge = document.getElementById('badge-carrito');
  badge.textContent = total;
  badge.classList.toggle('visible', total > 0);
}

function renderCarrito() {
  const contenido = document.getElementById('contenido-carrito');
  const footer = document.getElementById('footer-carrito');

  if (!carrito.length) {
    contenido.innerHTML = '<div class="carrito-vacio">Tu carrito está vacío.</div>';
    footer.style.display = 'none';
    return;
  }

  let total = 0;
  contenido.innerHTML = carrito.map(item => {
    const p = productos.find(x => x.id === item.productoId);
    if (!p) return '';
    const subtotal = p.valor * item.cantidad;
    total += subtotal;
    return `
      <div class="item-carrito">
        <img src="${p.imagen}" alt="${p.titulo}">
        <div class="item-carrito-info">
          <h4>${p.titulo}</h4>
          <div class="precio">${formatearPrecio(p.valor)}</div>
          <div class="cantidad-control">
            <button data-menos="${p.id}">-</button>
            <span>${item.cantidad}</span>
            <button data-mas="${p.id}">+</button>
            <button data-quitar="${p.id}" style="margin-left:8px;border:none;background:none;color:#c62828;cursor:pointer;font-size:12px;">Quitar</button>
          </div>
        </div>
        <div style="font-weight:700;color:var(--rosa-oscuro);">${formatearPrecio(subtotal)}</div>
      </div>
    `;
  }).join('');

  document.getElementById('total-carrito').textContent = formatearPrecio(total);
  footer.style.display = 'block';
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(i => i.productoId === id);
  const p = productos.find(x => x.id === id);
  if (!item || !p) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.productoId !== id);
  } else if (item.cantidad > p.stock) {
    item.cantidad = p.stock;
    mostrarToast('Cantidad máxima de stock alcanzada.');
  }

  guardarCarrito();
  actualizarBadgeCarrito();
  renderCarrito();
}

function abrirCarrito() {
  renderCarrito();
  document.getElementById('overlay-carrito').classList.add('activo');
  document.getElementById('panel-carrito').classList.add('activo');
}

function cerrarCarrito() {
  document.getElementById('overlay-carrito').classList.remove('activo');
  document.getElementById('panel-carrito').classList.remove('activo');
}

function checkoutWhatsApp() {
  if (!carrito.length) return;

  let mensaje = 'Hola Caro! Quiero comprar estos moños:%0A%0A';
  let total = 0;

  carrito.forEach(item => {
    const p = productos.find(x => x.id === item.productoId);
    if (!p) return;
    const sub = p.valor * item.cantidad;
    total += sub;
    mensaje += `- ${p.titulo} x${item.cantidad} = ${formatearPrecio(sub)}%0A`;
  });

  mensaje += `%0ATotal: ${formatearPrecio(total)}%0A%0AGracias!`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${mensaje}`, '_blank');
  mostrarToast('Te redirigimos a WhatsApp para confirmar tu pedido.');
}

function enviarPedidoCustom() {
  const nombre = document.getElementById('pedido-nombre').value.trim();
  const contacto = document.getElementById('pedido-contacto').value.trim();
  const tela = document.getElementById('pedido-tela').value;
  const color = document.getElementById('pedido-color').value;
  const desc = document.getElementById('pedido-descripcion').value.trim();

  if (!nombre || !contacto) {
    mostrarToast('Completa tu nombre y contacto.');
    return;
  }

  const msg = `Hola Caro! Quiero un moño a medida:%0A%0ANombre: ${encodeURIComponent(nombre)}%0AContacto: ${encodeURIComponent(contacto)}%0ATela: ${tela}%0AColor: ${color}%0ADetalle: ${encodeURIComponent(desc || 'Sin detalle adicional')}`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, '_blank');
  mostrarToast('Solicitud enviada por WhatsApp.');
}

function limpiarFiltros() {
  document.getElementById('filtro-busqueda').value = '';
  document.getElementById('filtro-orden').value = 'reciente';
  document.getElementById('filtro-color').value = '';
  document.getElementById('filtro-tamanio').value = '';
  document.getElementById('filtro-precio-max').value = '';
  actualizarCatalogo();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(i => i.productoId !== id);
  guardarCarrito();
  actualizarBadgeCarrito();
  renderCarrito();
}

function initEventos() {
  document.getElementById('btn-login').addEventListener('click', verificarUsuario);
  document.getElementById('email-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') verificarUsuario();
  });

  const zona = document.getElementById('zona-upload');
  const inputImg = document.getElementById('input-imagen');

  zona.addEventListener('click', () => inputImg.click());
  inputImg.addEventListener('change', e => manejarImagen(e.target.files[0]));
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('dragover'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('dragover'));
  zona.addEventListener('drop', e => {
    e.preventDefault();
    zona.classList.remove('dragover');
    manejarImagen(e.dataTransfer.files[0]);
  });

  document.getElementById('btn-quitar-fondo').addEventListener('click', quitarFondoPremium);
  document.getElementById('btn-usar-original').addEventListener('click', usarOriginal);
  document.getElementById('btn-publicar').addEventListener('click', publicarMono);

  ['filtro-busqueda', 'filtro-orden', 'filtro-color', 'filtro-tamanio', 'filtro-precio-max'].forEach(id => {
    document.getElementById(id).addEventListener('input', actualizarCatalogo);
    document.getElementById(id).addEventListener('change', actualizarCatalogo);
  });
  document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

  document.getElementById('contenedor-productos').addEventListener('click', e => {
    const btnAgregar = e.target.closest('[data-agregar]');
    const btnVer = e.target.closest('[data-ver]');
    const btnFav = e.target.closest('[data-fav]');
    if (btnAgregar) agregarAlCarrito(btnAgregar.dataset.agregar);
    if (btnVer) abrirModal(btnVer.dataset.ver);
    if (btnFav) toggleFavorito(btnFav.dataset.fav);
  });

  document.getElementById('modal-contenido').addEventListener('click', e => {
    const btn = e.target.closest('[data-agregar-modal]');
    if (btn) {
      agregarAlCarrito(btn.dataset.agregarModal);
      cerrarModal();
    }
  });

  document.getElementById('contenedor-admin-productos').addEventListener('click', e => {
    const btn = e.target.closest('[data-eliminar]');
    if (btn) eliminarProducto(btn.dataset.eliminar);
  });

  document.getElementById('btn-abrir-carrito').addEventListener('click', abrirCarrito);
  document.getElementById('btn-cerrar-carrito').addEventListener('click', cerrarCarrito);
  document.getElementById('overlay-carrito').addEventListener('click', cerrarCarrito);
  document.getElementById('btn-checkout').addEventListener('click', checkoutWhatsApp);
  document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
  document.getElementById('overlay-modal').addEventListener('click', cerrarModal);
  document.getElementById('btn-enviar-pedido').addEventListener('click', enviarPedidoCustom);

  document.getElementById('contenido-carrito').addEventListener('click', e => {
    if (e.target.dataset.menos) cambiarCantidad(e.target.dataset.menos, -1);
    if (e.target.dataset.mas) cambiarCantidad(e.target.dataset.mas, 1);
    if (e.target.dataset.quitar) quitarDelCarrito(e.target.dataset.quitar);
  });
}

initEventos();
actualizarCatalogo();
actualizarBadgeCarrito();
