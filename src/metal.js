import {
  ACESFilmicToneMapping, Color, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster, Scene,
  Shape, Vector2, Vector3, WebGLRenderer,
} from 'three';

// Las tres piezas de la B, en el mismo sistema que el SVG de index.html (100 x 120).
const PIECES = {
  erp: [[14, 0], [26, 0], [26, 120], [14, 120], [0, 106], [0, 14]],
  facturacion: [[32, 0], [74, 0], [92, 18], [92, 41], [76, 57], [32, 57], [32, 37], [64, 37], [68, 33], [68, 24], [64, 20], [32, 20]],
  web: [[32, 63], [78, 63], [100, 85], [100, 100], [80, 120], [32, 120], [32, 100], [70, 100], [75, 95], [75, 89], [70, 84], [32, 84]],
};
// Hacia dónde se separa cada pieza, y desde dónde entra al cargar.
const OFFSET = { erp: [-0.62, 0, 0.25], facturacion: [0.5, 0.42, 0.45], web: [0.5, -0.42, 0.45] };
const FROM = { erp: [-0.5, 0, 0.3], facturacion: [0.4, 0.35, 0.4], web: [0.4, -0.35, 0.4] };

// Estudio de luz: paneles claros y oscuros para que el metal tenga qué reflejar.
function studio(renderer) {
  const s = new Scene();
  s.background = new Color(0x6f747d);
  const card = (color, k, w, h, p) => {
    const m = new Mesh(new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), side: DoubleSide }));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  card(0xffffff, 7, 9, 3, [0, 9, 3]);
  card(0xffffff, 3.2, 1.6, 12, [-8, 1, 4]);
  card(0xffffff, 2.6, 4, 9, [9, 2, 2]);
  card(0xfff1d6, 3.6, 9, 4, [3, -7, 5]);
  card(0xffffff, 1.5, 7, 5, [8, -4, 5]);
  card(0xffffff, 0.85, 5, 12, [-4, 0, 9]);
  card(0x5a5e66, 1, 2, 12, [5, -1, 8]);
  card(0xffffff, 1.6, 0.7, 12, [1.4, 0, 9]);
  card(0x0c0d10, 1, 14, 6, [0, -4, -9]);
  const pm = new PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.025).texture;
  pm.dispose();
  return t;
}

const FOV = 14;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ramp = (v, a, b) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mixSpot = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), s: mix(a.s, b.s, t), c: mix(a.c, b.c, t) });

/* Un solo lienzo recorre la página. Cada pieza sale de la B, espera en el margen,
   ocupa el hueco (.slot3d) de su sección y vuelve a unirse en Contacto.
   El viaje es solo para pantallas grandes con mouse (ver `.slot3d` en el CSS): en
   celular y tablet los huecos no existen y la B se queda en la portada. */
export function mountMetal(canvas, stage, { reduced }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  scene.environment = studio(renderer);
  const cam = new PerspectiveCamera(FOV, 1, 10, 10000);

  const gold = new MeshPhysicalMaterial({ color: 0xe3a02a, metalness: 1, roughness: 0.2, clearcoat: 0.15, clearcoatRoughness: 0.1 });
  const rhodium = new MeshPhysicalMaterial({ color: 0xe9ecf1, metalness: 1, roughness: 0.12 });

  const S = 1 / 40;
  const items = Object.entries(PIECES).map(([id, pts]) => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const box = { w: (Math.max(...xs) - Math.min(...xs)) * S, h: (Math.max(...ys) - Math.min(...ys)) * S };
    const mid = new Vector3(((Math.max(...xs) + Math.min(...xs)) / 2 - 50) * S, (60 - (Math.max(...ys) + Math.min(...ys)) / 2) * S, 0);
    const shape = new Shape(pts.map(([x, y]) => new Vector2((x - 50) * S, (60 - y) * S)));
    const g = new ExtrudeGeometry(shape, {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.045, bevelOffset: -0.045, bevelSegments: 4,
    });
    g.translate(0, 0, -0.25);
    const mesh = new Mesh(g, id === 'erp' ? rhodium : gold);
    mesh.userData.id = id;
    const group = new Group();
    group.add(mesh);
    scene.add(group);
    return {
      id, mesh, group, box, mid, off: new Vector3(...OFFSET[id]),
      pos: reduced ? new Vector3() : new Vector3(...FROM[id]), vel: new Vector3(),
      a: 0, b: 0, c: 0, slot: null,
    };
  });

  let active = null, hover = null, raf = 0, last = 0, drag = null, vw = 1, vh = 1;
  let home = null, contact = null, blank = false;
  const rot = { x: 0, y: reduced ? -0.42 : -0.95, vx: 0, vy: 0 };
  const aim = { x: 0, y: 0 };
  const spin = { x: 0, y: 0 };
  const target = new Vector3();
  const touch = matchMedia('(hover: none)').matches;
  const DIST = () => vh / 2 / Math.tan(FOV * Math.PI / 360);

  /* ---- Medidas: solo cuando cambia la página, nunca por cuadro ---- */
  const rect = el => {
    const r = el?.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + scrollY + r.height / 2, w: r.width, h: r.height, top: r.top + scrollY } : null;
  };
  function measure() {
    const st = rect(stage);
    if (!st) return;
    home = { x: st.x, y: st.y, s: Math.min(st.h * 0.667, st.w * 0.757) / 3, c: 0 };
    for (const it of items) {
      const r = rect(document.querySelector(`.slot3d[data-slot=${it.id}]`));
      it.slot = r && { x: r.x, y: r.y, s: Math.min(r.w / (it.box.w + 0.35), r.h / it.box.h) * 0.92, c: 1 };
      if (!r) it.a = it.b = it.c = 0;
    }
    const k = rect(document.querySelector('.slot3d[data-slot=contacto]'));
    contact = k && { x: k.x, y: k.y, s: Math.min(k.h / 3.1, k.w / 2.9), c: 0 };
  }
  function resize() {
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    if (!vw || !vh) return;
    // Pantallas grandes: menos densidad para no pintar millones de píxeles por cuadro.
    renderer.setPixelRatio(Math.min(devicePixelRatio, vw * vh > 900000 ? 1.5 : 2));
    renderer.setSize(vw, vh, false);
    cam.aspect = vw / vh;
    cam.position.z = DIST();
    cam.near = DIST() * 0.4; cam.far = DIST() * 1.8;
    cam.updateProjectionMatrix();
    measure();
  }

  const onScreen = (spot, sc) => ({ ...spot, y: spot.y - sc });

  function place(it, i, dt, sc) {
    const start = onScreen(home, sc);
    if (reduced || !it.slot) return start;
    const ease = 1 - Math.exp(-dt * 9);
    const slotY = it.slot.y - sc;
    let spot = start;
    if (it.id !== 'erp') {
      // Margen derecho: la pieza espera su turno sin tapar contenido.
      const pad = Math.min(80, Math.max(20, vw * 0.05));
      it.a += (ramp(sc, 40, vh * 0.5) - it.a) * ease;
      spot = mixSpot(start, { x: vw - pad / 2, y: vh * (i === 1 ? 0.44 : 0.56), s: pad * 0.5 / it.box.w, c: 1 }, it.a);
    }
    const b = it.id === 'erp' ? ramp(sc, 30, Math.max(60, Math.min(it.slot.y - vh * 0.5, vh * 0.75))) : ramp(vh - slotY, vh * 0.12, vh * 0.42);
    it.b += (b - it.b) * ease;
    spot = mixSpot(spot, onScreen(it.slot, sc), it.b);

    if (contact) {
      it.c += (ramp(vh - (contact.y - sc), vh * -0.35, vh * 0.1) - it.c) * ease;
      spot = mixSpot({ ...spot, y: Math.max(spot.y, -vh * 0.25) }, onScreen(contact, sc), it.c);
    }
    return spot;
  }

  function step(dt) {
    for (const it of items) {
      const loose = (1 - it.a) * (1 - it.b);
      target.copy(it.off).multiplyScalar((active === it.id || hover === it.id ? 1 : 0) * loose);
      if (reduced) it.pos.copy(target);
      else for (const a of ['x', 'y', 'z']) {
        it.vel[a] += ((target[a] - it.pos[a]) * 70 - it.vel[a] * 13) * dt;
        it.pos[a] += it.vel[a] * dt;
      }
    }
    if (!drag) { const k = Math.exp(-dt * 2.2); spin.x *= k; spin.y *= k; }
    const ty = -0.42 + aim.x * 0.5 + spin.y, tx = 0.1 + aim.y * 0.25 + spin.x;
    if (reduced) { rot.x = tx; rot.y = ty; } else {
      rot.vx += ((tx - rot.x) * 34 - rot.vx * 9) * dt; rot.x += rot.vx * dt;
      rot.vy += ((ty - rot.y) * 34 - rot.vy * 9) * dt; rot.y += rot.vy * dt;
    }
  }
  function render(t) {
    if (!home) return;
    const dt = Math.min(Math.max((t - last) / 1000, 0), 0.25);
    last = t;
    const n = Math.ceil(dt / 0.012) || 1; // subpasos: estable aunque caigan cuadros
    for (let i = 0; i < n; i++) step(dt / n);
    if (touch && !reduced) aim.x = Math.sin(t / 1900) * 0.6; // sin mouse, se mece sola para lucir el reflejo
    const sc = scrollY;
    let seen = false;
    items.forEach((it, i) => {
      const p = place(it, i, dt, sc);
      const float = reduced ? 0 : Math.sin(t / 1600) * 0.045 * p.s * (1 - p.c);
      it.group.position.set(p.x - vw / 2, vh / 2 - p.y + float, 0);
      it.group.scale.setScalar(Math.max(p.s, 0.01));
      it.group.rotation.set(rot.x, rot.y + (it.b - it.c) * Math.PI * 2 * (reduced ? 0 : 1), 0);
      it.mesh.position.copy(it.pos).addScaledVector(it.mid, -p.c);
      const reach = 2.4 * p.s;
      it.group.visible = p.s > 0.6 && p.y > -reach && p.y < vh + reach;
      seen ||= it.group.visible;
    });
    if (stage) shadow(1 - Math.max(...items.map(it => Math.max(it.a, it.b))));
    if (seen || !blank) {
      // El lienzo viaja con el documento: entre cuadros acompaña al scroll nativo.
      canvas.style.transform = `translate3d(0,${sc}px,0)`;
      renderer.render(scene, cam);
      blank = !seen;
    }
  }
  let shade = -1;
  function shadow(v) {
    const q = Math.round(v * 50) / 50;
    if (q !== shade) { shade = q; stage.querySelector('.shade')?.style.setProperty('opacity', q); }
  }
  function loop(t) { render(t); raf = requestAnimationFrame(loop); }
  const redraw = () => { if (reduced) render(last); };

  /* ---- Mano y mouse sobre la portada ---- */
  const ray = new Raycaster(), p = new Vector2();
  const pick = e => {
    const r = canvas.getBoundingClientRect();
    p.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    scene.updateMatrixWorld();
    ray.setFromCamera(p, cam);
    return ray.intersectObjects(items.map(it => it.mesh))[0]?.object.userData.id ?? null;
  };
  const setHover = id => {
    if (id === hover) return;
    hover = id;
    stage.style.cursor = id ? 'pointer' : '';
    stage.dispatchEvent(new CustomEvent('piece', { detail: id }));
    redraw();
  };
  let onPick = () => {};
  stage.addEventListener('pointerdown', e => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, hit: pick(e) };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (drag?.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      spin.y += dx * 0.011;
      spin.x = Math.max(-0.8, Math.min(0.8, spin.x + dy * 0.006));
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      redraw();
    } else if (!drag && e.pointerType === 'mouse') setHover(pick(e));
  });
  const end = e => {
    if (drag?.id !== e.pointerId) return;
    if (e.type === 'pointerup' && drag.moved < 6 && drag.hit) onPick(drag.hit);
    drag = null;
    redraw();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', () => setHover(null));
  if (!reduced) addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    aim.x = e.clientX / innerWidth * 2 - 1;
    aim.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  resize();
  render(last);
  new ResizeObserver(() => { resize(); blank = false; render(last); }).observe(canvas);
  new ResizeObserver(() => { measure(); redraw(); }).observe(document.body);
  document.fonts?.ready.then(() => { measure(); redraw(); });
  if (!reduced) { last = performance.now(); raf = requestAnimationFrame(loop); }
  else addEventListener('scroll', redraw, { passive: true });

  return {
    setActive(id) { active = id; redraw(); },
    onPick(fn) { onPick = fn; },
  };
}
