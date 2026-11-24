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

export function mountMetal(canvas, { reduced }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  scene.environment = studio(renderer);
  const cam = new PerspectiveCamera(30, 1, 0.1, 50);

  const gold = new MeshPhysicalMaterial({ color: 0xe3a02a, metalness: 1, roughness: 0.2, clearcoat: 0.15, clearcoatRoughness: 0.1 });
  const rhodium = new MeshPhysicalMaterial({ color: 0xe9ecf1, metalness: 1, roughness: 0.12 });

  const root = new Group();
  scene.add(root);
  const S = 1 / 40;
  const items = Object.entries(PIECES).map(([id, pts]) => {
    const shape = new Shape(pts.map(([x, y]) => new Vector2((x - 50) * S, (60 - y) * S)));
    const g = new ExtrudeGeometry(shape, {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.045, bevelOffset: -0.045, bevelSegments: 4,
    });
    g.translate(0, 0, -0.25);
    const mesh = new Mesh(g, id === 'erp' ? rhodium : gold);
    mesh.userData.id = id;
    root.add(mesh);
    return { id, mesh, off: new Vector3(...OFFSET[id]), pos: reduced ? new Vector3() : new Vector3(...FROM[id]), vel: new Vector3() };
  });

  let active = null, hover = null, spread = 0, raf = 0, visible = true, last = 0, drag = null;
  const rot = { x: 0, y: reduced ? -0.42 : -0.95, vx: 0, vy: 0 };
  const aim = { x: 0, y: 0 };
  const spin = { x: 0, y: 0 };
  const target = new Vector3();
  const touch = matchMedia('(hover: none)').matches;

  function step(dt) {
    for (const it of items) {
      target.copy(it.off).multiplyScalar(spread + (active === it.id || hover === it.id ? 1 : 0));
      if (reduced) it.pos.copy(target);
      else for (const a of ['x', 'y', 'z']) {
        it.vel[a] += ((target[a] - it.pos[a]) * 70 - it.vel[a] * 13) * dt;
        it.pos[a] += it.vel[a] * dt;
      }
      it.mesh.position.copy(it.pos);
    }
    if (!drag) { const k = Math.exp(-dt * 2.2); spin.x *= k; spin.y *= k; }
    const ty = -0.42 + aim.x * 0.5 + spin.y, tx = 0.1 + aim.y * 0.25 + spin.x;
    if (reduced) { rot.x = tx; rot.y = ty; } else {
      rot.vx += ((tx - rot.x) * 34 - rot.vx * 9) * dt; rot.x += rot.vx * dt;
      rot.vy += ((ty - rot.y) * 34 - rot.vy * 9) * dt; rot.y += rot.vy * dt;
    }
    root.rotation.set(rot.x, rot.y, 0);
  }
  function render(t) {
    const dt = Math.min(Math.max((t - last) / 1000, 0), 0.25);
    last = t;
    const n = Math.ceil(dt / 0.012) || 1; // subpasos: estable aunque caigan cuadros
    for (let i = 0; i < n; i++) step(dt / n);
    if (touch && !reduced) aim.x = Math.sin(t / 1900) * 0.6; // sin mouse, se mece sola para lucir el reflejo
    if (!reduced) root.position.y = Math.sin(t / 1600) * 0.045;
    renderer.render(scene, cam);
  }
  function loop(t) { render(t); if (visible) raf = requestAnimationFrame(loop); }
  // Con movimiento reducido no hay bucle: solo se redibuja ante un cambio.
  const redraw = () => { if (reduced) render(last); };

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.position.z = Math.max(8.4, 7.4 / cam.aspect);
    cam.updateProjectionMatrix();
    render(last);
  }

  const ray = new Raycaster(), p = new Vector2();
  const pick = e => {
    const r = canvas.getBoundingClientRect();
    p.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(p, cam);
    return ray.intersectObjects(root.children)[0]?.object.userData.id ?? null;
  };
  const setHover = id => {
    if (id === hover) return;
    hover = id;
    canvas.style.cursor = id ? 'pointer' : '';
    canvas.dispatchEvent(new CustomEvent('piece', { detail: id }));
    redraw();
  };
  let onPick = () => {};
  canvas.addEventListener('pointerdown', e => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, hit: pick(e) };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
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
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => setHover(null));
  if (!reduced) addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    aim.x = e.clientX / innerWidth * 2 - 1;
    aim.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  new ResizeObserver(resize).observe(canvas);
  resize();
  if (!reduced) new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(canvas);

  return {
    setActive(id) { active = id; redraw(); },
    setSpread(v) { spread = v; redraw(); },
    onPick(fn) { onPick = fn; },
  };
}
