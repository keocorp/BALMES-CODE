import './demos.js';
import { CONFIG } from './config.js';
import { $, $$, reduced } from './util.js';

$('#year').textContent = new Date().getFullYear();
if (CONFIG.correo) Object.assign($('#mail'), { hidden: false, href: `mailto:${CONFIG.correo}`, textContent: CONFIG.correo });

/* Menú */
const burger = $('.burger'), bar = $('.bar');
const menu = open => {
  bar.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};
burger.onclick = () => menu(!bar.classList.contains('open'));
$('#menu').addEventListener('click', e => { if (e.target.closest('a')) menu(false); });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && bar.classList.contains('open')) { menu(false); burger.focus(); }
});

/* Productos: en el celular se muestra uno a la vez */
const prod = $('.prod');
const tabs = $$('.tabs button');
const setTab = id => {
  prod.dataset.tab = id;
  tabs.forEach(b => b.setAttribute('aria-pressed', b.dataset.go === id));
};
const isProduct = id => tabs.some(b => b.dataset.go === id);
tabs.forEach(b => b.addEventListener('click', () => {
  setTab(b.dataset.go);
  // Si ya se bajó dentro de otro producto, el nuevo empieza desde arriba.
  if (prod.getBoundingClientRect().top < 0) prod.scrollIntoView({ behavior: 'instant' });
}));
document.addEventListener('click', e => {
  const id = e.target.closest('a[href^="#"]')?.hash.slice(1);
  if (id && isProduct(id)) setTab(id);
});
const fromHash = () => {
  const id = location.hash.slice(1);
  if (isProduct(id)) { setTab(id); document.getElementById(id).scrollIntoView({ behavior: 'instant' }); }
};
fromHash();
addEventListener('popstate', () => { const id = location.hash.slice(1); if (isProduct(id)) setTab(id); });

/* Sección actual en el menú */
const links = new Map($$('#menu a:not(.btn)').map(a => [a.hash.slice(1), a]));
const spy = new IntersectionObserver(es => es.forEach(e => {
  const a = links.get(e.target.id);
  if (e.isIntersecting) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
}), { rootMargin: '-45% 0px -50%' });
links.forEach((_, id) => spy.observe(document.getElementById(id)));

/* Brillo que sigue al cursor en los botones dorados */
addEventListener('pointermove', e => {
  const b = e.target.closest?.('.btn.gold');
  if (b) b.style.setProperty('--mx', `${(e.clientX - b.getBoundingClientRect().left) / b.offsetWidth * 100}%`);
}, { passive: true });

/* Logo 3D */
const picks = $$('.picker a');
import('./metal.js').then(({ mountMetal }) => {
  const canvas = $('#metal');
  const m = mountMetal(canvas, { reduced });
  $('.stage').classList.add('ready');
  m.onPick(id => { setTab(id); document.getElementById(id).scrollIntoView(); });
  picks.forEach(a => {
    for (const ev of ['pointerenter', 'focus']) a.addEventListener(ev, () => m.setActive(a.dataset.piece));
    for (const ev of ['pointerleave', 'blur']) a.addEventListener(ev, () => m.setActive(null));
  });
  canvas.addEventListener('piece', e => picks.forEach(a => a.classList.toggle('on', a.dataset.piece === e.detail)));
  if (!reduced) {
    const scroll = () => m.setSpread(Math.max(0, Math.min(1, (scrollY - 60) / (innerHeight * 0.6))));
    addEventListener('scroll', scroll, { passive: true });
    scroll();
  }
}).catch(err => console.warn('Sin WebGL: se muestra el logo plano.', err));

/* Proceso: la línea se llena al bajar */
const ol = $('.proc ol');
const fill = () => {
  const k = (innerHeight * 0.85 - ol.getBoundingClientRect().top) / (innerHeight * 0.42);
  ol.style.setProperty('--k', reduced ? 1 : Math.max(0, Math.min(1, k)));
};
addEventListener('scroll', fill, { passive: true });
fill();

/* Contacto */
$$('[data-need]').forEach(a => a.addEventListener('click', () => {
  $(`[name=need][value="${a.dataset.need}"]`).checked = true;
}));
const direct = /^\d{8,15}$/.test(CONFIG.whatsapp);
if (direct) $('#send').textContent = 'Enviar por WhatsApp';
const setErr = t => {
  $('#nombre-err').textContent = t;
  if (t) $('#nombre').setAttribute('aria-invalid', 'true'); else $('#nombre').removeAttribute('aria-invalid');
};
$('#nombre').addEventListener('input', () => setErr(''));
$('#lead').addEventListener('submit', async e => {
  e.preventDefault();
  const v = s => $(s).value.trim();
  if (!v('#nombre')) { setErr('Escribe tu nombre para saber a quién responder.'); $('#nombre').focus(); return; }
  const needs = $$('[name=need]:checked').map(i => i.value);
  const text = [
    `Hola, BALMES CODE. Soy ${v('#nombre')}${v('#empresa') ? ` de ${v('#empresa')}` : ''}.`,
    needs.length ? `Me interesa: ${needs.join(', ')}.` : '',
    v('#msg'),
  ].filter(Boolean).join('\n');
  if (direct) { open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); return; }
  try {
    await navigator.clipboard.writeText(text);
    $('#lead-msg').textContent = 'Mensaje copiado. Ya puedes pegarlo en el chat.';
  } catch {
    $('#lead-msg').textContent = 'El navegador no permitió copiar el mensaje. Revisa los permisos del portapapeles.';
  }
});
