import { $, $$, reduced, esc, money } from './util.js';

/* ---------- ERP ---------- */
const PRICE = 350, COST = 210, MAX = 6;
const START = { sold: 0, stock: MAX, cash: 1200, igv: 0 };
let s = { ...START }, timers = [];
const mod = n => $(`[data-mod=${n}]`);
const out = (n, v) => { mod(n).querySelector('output').textContent = v; };
$('.stock').innerHTML = '<i></i>'.repeat(MAX);

const paint = {
  ventas: () => out('ventas', s.sold),
  almacen: () => {
    out('almacen', s.stock);
    $$('.stock i').forEach((e, i) => e.classList.toggle('off', i >= s.stock));
  },
  caja: () => out('caja', money(s.cash)),
  conta: () => out('conta', money(s.igv)),
  compras: () => {
    const low = s.stock <= 2;
    $('#buy-note').textContent = low ? 'Quedan pocas sillas' : 'Stock suficiente';
    $('#restock').disabled = !low;
    mod('compras').classList.toggle('alert', low);
  },
};
const ALL = Object.keys(paint);

// Actualiza los módulos en cadena, en el orden en que viaja el dato.
function ripple(order) {
  timers.forEach(clearTimeout);
  if (!order.length) ALL.forEach(n => paint[n]());
  timers = order.map((n, i) => setTimeout(() => {
    paint[n]();
    if (!reduced) mod(n).animate([{ '--lit': 1 }, { '--lit': 0 }], { duration: 1100, easing: 'cubic-bezier(.23,1,.32,1)' });
  }, reduced ? 0 : i * 170));
  $('#sell').disabled = s.stock === 0;
  $('#erp-reset').hidden = s.sold === 0;
}
const say = t => { $('#erp-msg').textContent = t; };

$('#sell').onclick = () => {
  if (!s.stock) return;
  s.sold++; s.stock--; s.cash += PRICE; s.igv += PRICE - PRICE / 1.18;
  ripple(ALL);
  say(s.stock === 0 ? 'Sin stock: repón sillas desde Compras.'
    : s.stock <= 2 ? 'Compras recibió un aviso de stock bajo.'
      : 'Cinco módulos al día con un solo registro.');
};
$('#restock').onclick = () => {
  if (s.stock > 2) return;
  s.stock += 4; s.cash -= COST * 4; s.igv -= COST * 4 - COST * 4 / 1.18;
  ripple(['compras', 'almacen', 'caja', 'conta']);
  say('Compra registrada: entró stock, salió caja y bajó el IGV.');
};
$('#erp-reset').onclick = () => {
  s = { ...START };
  ripple([]);
  say('Ejemplo: silla de oficina, S/ 350.00.');
  $('#sell').focus();
};

/* ---------- Facturación ---------- */
const goods = [
  { name: 'Café molido 250 g', price: 24.9, q: 1 },
  { name: 'Taza de cerámica', price: 32, q: 0 },
  { name: 'Filtro de papel x100', price: 18.5, q: 0 },
];
const seq = { boleta: 128, factura: 41 };
let type = 'boleta', issued = false;
const doc = $('#doc');
const icon = plus => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10${plus ? 'M8 3v10' : ''}"/></svg>`;

$('#items').innerHTML = goods.map((g, i) => `<li><span>${g.name}<small>${money(g.price)}</small></span>
  <div class="step"><button type="button" data-i="${i}" data-d="-1" aria-label="Quitar ${g.name}">${icon(false)}</button><output>${g.q}</output><button type="button" data-i="${i}" data-d="1" aria-label="Agregar ${g.name}">${icon(true)}</button></div></li>`).join('');

function ticket() {
  const isB = type === 'boleta';
  const total = goods.reduce((a, g) => a + g.q * g.price, 0);
  const base = Math.round(total / 1.18 * 100) / 100;
  const rows = goods.filter(g => g.q).map(g => `<tr><td>${g.q} × ${g.name}</td><td>${money(g.q * g.price)}</td></tr>`).join('');
  $('#paper').innerHTML = `<header><b>Tu negocio S.A.C.</b><span>${isB ? 'Boleta' : 'Factura'}<br>${isB ? 'B001' : 'F001'}-${String(seq[type]).padStart(6, '0')}</span></header>
    <p class="who">${isB ? 'DNI' : 'RUC'}: ${esc(doc.value) || (isB ? 'Cliente varios' : 'Falta el RUC')}</p>
    <table><tbody>${rows || '<tr><td colspan="2">Agrega un producto para empezar.</td></tr>'}</tbody></table>
    <dl><dt>Op. gravada</dt><dd>${money(base)}</dd><dt>IGV 18%</dt><dd>${money(total - base)}</dd><dt class="tot">Total</dt><dd class="tot">${money(total)}</dd></dl>
    <p class="legal">Demostración sin valor tributario</p>${issued ? '<span class="stamp">Emitido</span>' : ''}`;
  $$('#items output').forEach((o, i) => { o.textContent = goods[i].q; });
  $$('#items [data-d="-1"]').forEach((b, i) => { b.disabled = !goods[i].q; });
  $('#pos [type=submit]').innerHTML = issued ? 'Nuevo comprobante' : `Emitir comprobante<span class="sum">${money(total)}</span>`;
  $('#facturacion').classList.toggle('issued', issued);
}
function docErr(t, field) {
  $('#doc-err').textContent = t;
  if (field) { doc.setAttribute('aria-invalid', 'true'); doc.focus(); } else doc.removeAttribute('aria-invalid');
}
// Cualquier cambio tras emitir abre un comprobante nuevo con el número siguiente.
function reopen() {
  if (issued) { issued = false; seq[type]++; }
  docErr('');
}
function print() {
  if (!reduced) $('#paper').animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)' });
}
$('#items').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  reopen();
  const g = goods[b.dataset.i];
  g.q = Math.max(0, Math.min(99, g.q + Number(b.dataset.d)));
  ticket();
});
$$('[name=tipo]').forEach(r => r.addEventListener('change', () => {
  reopen();
  type = r.value;
  doc.value = '';
  doc.maxLength = type === 'boleta' ? 8 : 11;
  $('#doc-label').textContent = type === 'boleta' ? 'DNI del cliente (opcional)' : 'RUC del cliente';
  ticket();
}));
doc.addEventListener('input', () => { reopen(); doc.value = doc.value.replace(/\D/g, ''); ticket(); });
$('#pos').addEventListener('submit', e => {
  e.preventDefault();
  if (issued) {
    reopen();
    goods.forEach((g, i) => { g.q = i ? 0 : 1; });
    doc.value = '';
    ticket();
    return;
  }
  const n = doc.value.length;
  if (type === 'factura' && n !== 11) return docErr('El RUC tiene 11 dígitos.', true);
  if (type === 'boleta' && n && n !== 8) return docErr('El DNI tiene 8 dígitos.', true);
  if (!goods.some(g => g.q)) return docErr('Agrega al menos un producto.');
  issued = true;
  ticket();
  print();
});
ticket();

/* ---------- Páginas web ---------- */
const art = {
  plato: '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="#fff" opacity=".92"/><circle cx="60" cy="60" r="36" fill="var(--t)" opacity=".16"/><path d="M34 66c6-24 46-24 52 0-8 14-44 14-52 0z" fill="var(--t)"/><path d="M44 58c8-9 22-12 33-4M50 68c8 4 16 4 24-1" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  pulso: '<svg viewBox="0 0 120 120"><path d="M60 104C18 78 12 52 24 36c10-13 28-10 36 4 8-14 26-17 36-4 12 16 6 42-36 68z" fill="#fff" opacity=".94"/><path d="M28 62h16l7-14 13 30 9-22 5 6h14" fill="none" stroke="var(--t)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  bolsa: '<svg viewBox="0 0 120 120"><path d="M44 44V32a16 16 0 0 1 32 0v12" fill="none" stroke="#fff" stroke-width="6"/><path d="M26 40h68l8 66H18z" fill="#fff"/><path d="M46 62a14 14 0 0 0 28 0" fill="none" stroke="var(--t)" stroke-width="6" stroke-linecap="round"/></svg>',
};
const goodsArt = [
  '<path d="M28 10 40 16l12-6 16 12-8 9-6-4v25H26V27l-6 4-8-9z"/>',
  '<path d="M12 42V26c10 4 14-2 18-8l22 18c6 2 14 2 16 8v4H12z"/>',
  '<path d="M14 36a26 22 0 0 1 48 0h8c4 6-4 10-10 10H16c-4 0-4-6-2-10z"/>',
];
const prods = [['Polo básico', 49], ['Zapatilla', 189], ['Gorra', 39]];
const sites = {
  restaurante: {
    t: 'Cocina de casa, mesa de domingo', b: 'Reservar mesa', a: 'plato', n: ['Carta', 'Local', 'Reservas'],
    body: '<ul class="carta"><li><b>Lomo saltado</b><span>S/ 32</span></li><li><b>Ají de gallina</b><span>S/ 28</span></li><li><b>Ceviche clásico</b><span>S/ 35</span></li><li><b>Suspiro limeño</b><span>S/ 14</span></li></ul>',
  },
  clinica: {
    t: 'Tu cita médica, sin hacer cola', b: 'Agendar cita', a: 'pulso', n: ['Servicios', 'Médicos', 'Citas'],
    body: '<div class="citas"><b>Horarios de hoy</b><div><span>9:00</span><span class="x">9:30</span><span>10:00</span><span>11:30</span><span class="x">12:00</span><span>15:30</span></div></div>',
  },
  tienda: {
    t: 'Recién llegado a la tienda', b: 'Ver catálogo', a: 'bolsa', n: ['Nuevo', 'Ofertas', 'Carrito'],
    body: `<div class="prods">${prods.map(([n, p], i) => `<div><svg viewBox="0 0 80 60">${goodsArt[i]}</svg><b>${n}</b><span>S/ ${p}</span></div>`).join('')}</div>`,
  },
};
function site() {
  const d = sites[$('[name=rubro]:checked').value];
  const name = $('#biz').value.trim() || 'Tu negocio';
  $('#site').style.setProperty('--t', $('[name=tono]:checked').value);
  $('#site').innerHTML = `<nav aria-label="Ejemplo"><b>${esc(name)}</b><span>${d.n.map(x => `<i>${x}</i>`).join('')}</span></nav>
    <div class="top"><div><p class="lead">${d.t}</p><em>${d.b}</em></div>${art[d.a]}</div>${d.body}`;
  const slug = name.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'tunegocio';
  $('#url').textContent = `www.${slug}.com`;
  $('#device').classList.toggle('cel', $('[name=disp]:checked').value === 'cel');
}
$('.builder').addEventListener('input', site);
site();
