import { $, $$, reduced } from './util.js';

// Cada respuesta puede sumar un producto (need) y la razón que se muestra al final (why).
const QUESTIONS = [
  {
    title: '¿Cómo emites tus comprobantes?', piece: 'facturacion', need: 'Facturación',
    options: [
      { t: 'A mano o con talonario', why: 'Para dejar el talonario y que el IGV se calcule solo.', say: 'emito comprobantes a mano' },
      { t: 'Con un sistema que me da problemas', why: 'Para cambiar un sistema que hoy te complica.', say: 'mi sistema de facturación me da problemas' },
      { t: 'Con un sistema que funciona bien' },
      { t: 'Todavía no emito', why: 'Para empezar a emitir de forma ordenada.', say: 'todavía no emito comprobantes' },
    ],
  },
  {
    title: '¿Cómo llevas stock, compras y caja?', piece: 'erp', need: 'ERP',
    options: [
      { t: 'En cuaderno o Excel', why: 'Para que una venta actualice stock, caja y compras sin copiar datos.', say: 'llevo stock y caja en cuaderno o Excel' },
      { t: 'En sistemas que no se conectan', why: 'Para unir lo que hoy tienes en sistemas separados.', say: 'uso sistemas que no se conectan' },
      { t: 'En un sistema que lo une todo' },
      { t: 'No manejo stock ni compras' },
    ],
  },
  {
    title: '¿Cómo te encuentran en internet?', piece: 'web', need: 'Página web',
    options: [
      { t: 'Solo por redes sociales', why: 'Para tener un sitio tuyo, además de las redes.', say: 'solo tengo redes sociales' },
      { t: 'Tengo una página que ya no me sirve', why: 'Para renovar una página que ya no te ayuda.', say: 'tengo una página que ya no me sirve' },
      { t: 'Tengo una página que funciona bien' },
      { t: 'No me encuentran', why: 'Para que puedan encontrarte y contactarte.', say: 'no aparezco en internet' },
    ],
  },
];

const box = $('#guide'), art = $('#guide-art'), msg = $('#msg');
let step = 0, picked = [], autoText = '';

const wins = () => QUESTIONS.map((q, i) => ({ ...q, o: q.options[picked[i]] })).filter(q => q.o?.why);
const list = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a.at(-1)}`);

function view() {
  if (step < QUESTIONS.length) {
    const q = QUESTIONS[step];
    return `<p class="g-step">Pregunta ${step + 1} de ${QUESTIONS.length}</p>
      <h3 tabindex="-1">${q.title}</h3>
      <div class="g-opts">${q.options.map((o, i) => `<button type="button" data-pick="${i}" aria-pressed="${picked[step] === i}">${o.t}</button>`).join('')}</div>
      <p class="g-nav">${step ? '<button type="button" class="g-link" data-go="back">Volver</button>' : ''}</p>`;
  }
  const w = wins();
  return `<p class="g-step">Nuestra sugerencia</p>
    <h3 tabindex="-1">${w.length ? list(w.map(q => q.need)) : 'Por ahora estás bien cubierto'}</h3>
    ${w.length ? `<ul class="g-why">${w.map(q => `<li><b>${q.need}</b>${q.o.why}</li>`).join('')}</ul>`
    : '<p>Tus respuestas no muestran algo urgente. Si igual hay una tarea que te quita tiempo, cuéntanos cuál es.</p>'}
    <p class="g-nav"><a class="btn gold" href="#contacto" data-go="use">${w.length ? 'Llenar mi solicitud' : 'Contar mi caso'}</a><button type="button" class="g-link" data-go="back">Volver</button><button type="button" class="g-link" data-go="reset">Empezar de nuevo</button></p>`;
}

function draw(dir = 0, byPointer = false) {
  box.innerHTML = view();
  $$('#guide-art path').forEach(p => p.classList.toggle('lit', wins().some(q => p.dataset.p === q.piece)));
  art.classList.toggle('done', step === QUESTIONS.length);
  if (!dir) return;
  box.querySelector('h3').focus({ preventScroll: true });
  // Con teclado no se anima: la respuesta debe sentirse inmediata.
  if (byPointer) {
    box.getAnimations().forEach(a => a.cancel());
    box.animate([{ opacity: 0, transform: reduced ? 'none' : `translateX(${dir * 12}px)` }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.23, 1, .32, 1)' });
  }
}

box.addEventListener('click', e => {
  const b = e.target.closest('[data-pick], [data-go]');
  if (!b) return;
  const byPointer = e.detail > 0;
  if (b.dataset.pick) { picked[step] = Number(b.dataset.pick); step++; return draw(1, byPointer); }
  if (b.dataset.go === 'back') { step--; return draw(-1, byPointer); }
  if (b.dataset.go === 'reset') { step = 0; picked = []; return draw(-1, byPointer); }
  // Usar la sugerencia: marca productos y redacta, sin pisar lo que la persona ya escribió.
  const w = wins();
  $$('[name=need]').forEach(i => { i.checked = w.some(q => q.need === i.value); });
  const text = w.length ? `Hoy ${list(w.map(q => q.o.say))}.` : '';
  if (!msg.value.trim() || msg.value === autoText) { msg.value = text; autoText = text; }
});
draw();
