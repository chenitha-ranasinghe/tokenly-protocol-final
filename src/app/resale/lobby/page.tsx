'use client';

/**
 * /resale/lobby — VR Personal Lobby (Completed)
 *
 * Full implementation of the second-hand VR lobby:
 *  - Three.js WebGL scene with category-distinct item shapes
 *  - Raycasting click interaction → detail sidebar panel
 *  - Floating price labels via CSS overlay synced to 3D positions
 *  - Location-aware pricing (nearby items glow gold)
 *  - WebXR AR entry via navigator.xr
 *  - "List for Sale" and "View Listing" actions from detail panel
 *  - Manual orbit controls (drag to rotate, scroll to zoom)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { authFetch } from '@/lib/client';
import { X, ExternalLink, MapPin, Tag, Layers, ShoppingBag } from 'lucide-react';

interface LobbyItem {
  id:        string;
  title:     string;
  price:     number;
  grade:     string;
  district:  string;
  category:  string;
  seller_id?: string;
}

interface Label3D { id: string; price: number; world: THREE.Vector3; }

// ── Category geometry map ─────────────────────────────────────────────────────
function makeItemGeometry(category: string): THREE.BufferGeometry {
  const cat = category?.toLowerCase() ?? '';
  if (cat.includes('watch'))     return new THREE.CylinderGeometry(0.22, 0.22, 0.06, 32);
  if (cat.includes('bag'))       return new THREE.BoxGeometry(0.7, 0.5, 0.25);
  if (cat.includes('electron'))  return new THREE.BoxGeometry(0.35, 0.7, 0.08);
  if (cat.includes('card'))      return new THREE.BoxGeometry(0.55, 0.78, 0.01);
  if (cat.includes('spirit'))    return new THREE.CylinderGeometry(0.1, 0.12, 0.8, 16);
  // Default: sneaker-like box
  return new THREE.BoxGeometry(0.7, 0.3, 0.28);
}

const GRADE_COLORS: Record<string, number> = {
  DS:        0xa37e2c,
  VNDS:      0x6b9bd2,
  'Used-A':  0x4caf50,
  'Used-B':  0xff9800,
  'Used-C':  0xf44336,
};

const DISTRICTS = ['Colombo', 'Gampaha', 'Kandy', 'Galle', 'Jaffna'];

export default function ResaleLobbyPage() {
  const router = useRouter();
  const mountRef     = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef    = useRef<THREE.Mesh[]>([]);
  const rafRef       = useRef<number>(0);
  const orbitRef     = useRef({ theta: 0, phi: 0.3, dist: 8 });
  const isDragging   = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });
  const xrSessionRef = useRef<XRSession | null>(null);

  const [items,          setItems]          = useState<LobbyItem[]>([]);
  const [buyerDistrict,  setBuyerDistrict]  = useState('Colombo');
  const [selected,       setSelected]       = useState<LobbyItem | null>(null);
  const [labels,         setLabels]         = useState<Label3D[]>([]);
  const [arSupported,    setArSupported]    = useState(false);
  const [inAR,           setInAR]           = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [labelTick,      setLabelTick]      = useState(0);

  // ── Fetch listings ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    authFetch(`/api/resale/listings?buyer_district=${encodeURIComponent(buyerDistrict)}`)
      .then(r => r.json())
      .then(data => {
        const listings = (data.listings ?? []) as LobbyItem[];
        setItems(listings.slice(0, 12));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [buyerDistrict]);

  // ── Check WebXR ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then(s => setArSupported(s)).catch(() => {});
    }
  }, []);

  // ── Build / rebuild Three.js scene when items change ──────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const w = el.clientWidth  || 800;
    const h = el.clientHeight || 480;

    // Renderer
    let renderer = rendererRef.current;
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.xr.enabled = true;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      el.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    }
    renderer.setSize(w, h);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.04);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100);
    cameraRef.current = camera;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const spot = new THREE.SpotLight(0xffd700, 2.5, 25, Math.PI / 6, 0.5);
    spot.position.set(0, 8, 4);
    spot.castShadow = true;
    scene.add(spot);
    const fill = new THREE.PointLight(0x3366ff, 0.4, 20);
    fill.position.set(-6, 3, -4);
    scene.add(fill);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 0.7, roughness: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lines
    scene.add(new THREE.GridHelper(20, 20, 0x111111, 0x0e0e0e));

    // Back wall
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 6),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    wall.position.set(0, 3, -5);
    scene.add(wall);

    // Place items
    const meshes: THREE.Mesh[] = [];
    const newLabels: Label3D[] = [];
    const cols = 4;
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });

    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * 2.6;
      const z = -row * 2.4;

      // Pedestal
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), shelfMat);
      pedestal.position.set(x, 0.06, z);
      pedestal.receiveShadow = true;
      scene.add(pedestal);

      // Item
      const geo  = makeItemGeometry(item.category);
      const isNearby = item.district === buyerDistrict;
      const baseColor = GRADE_COLORS[item.grade] ?? 0x444444;
      const mat  = new THREE.MeshStandardMaterial({
        color:     isNearby ? 0xa37e2c : baseColor,
        emissive:  isNearby ? new THREE.Color(0x3d2e10) : new THREE.Color(0x000000),
        emissiveIntensity: isNearby ? 0.4 : 0,
        metalness: 0.5,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.52, z);
      mesh.castShadow = true;
      mesh.userData  = { item, index: i };
      scene.add(mesh);
      meshes.push(mesh);

      // Halo ring for nearby items
      if (isNearby) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.6, 0.02, 8, 32),
          new THREE.MeshBasicMaterial({ color: 0xa37e2c, transparent: true, opacity: 0.6 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.02, z);
        scene.add(ring);
      }

      // Label position data
      newLabels.push({
        id:    item.id,
        price: item.price,
        world: new THREE.Vector3(x, 1.15, z),
      });
    });

    meshesRef.current = meshes;
    setLabels(newLabels);

    // Update camera position
    const updateCamera = () => {
      const { theta, phi, dist } = orbitRef.current;
      camera.position.set(
        Math.sin(theta) * dist * Math.cos(phi),
        dist * Math.sin(phi) + 0.8,
        Math.cos(theta) * dist * Math.cos(phi)
      );
      camera.lookAt(0, 0.5, -2);
    };
    updateCamera();

    // Animate
    let frame = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      // Gentle bob on selected item
      meshes.forEach((m, i) => {
        const isSelected = selected?.id === (m.userData.item as LobbyItem).id;
        m.position.y = 0.52 + (isSelected ? Math.sin(frame * 3) * 0.05 : 0);
        m.rotation.y += isSelected ? 0.015 : 0.004;
      });
      frame += 0.016;
      setLabelTick(t => t + 1);
      renderer!.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight || 480;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer!.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      scene.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, buyerDistrict]);

  // ── Orbit controls ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!el) return;

    const down = (e: MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const up   = () => { isDragging.current = false; };
    const move = (e: MouseEvent) => {
      if (!isDragging.current) return;
      orbitRef.current.theta -= (e.clientX - lastMouse.current.x) * 0.012;
      orbitRef.current.phi    = Math.max(0.1, Math.min(1.2, orbitRef.current.phi - (e.clientY - lastMouse.current.y) * 0.008));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      const c = cameraRef.current;
      if (c) { const { theta, phi, dist } = orbitRef.current; c.position.set(Math.sin(theta)*dist*Math.cos(phi), dist*Math.sin(phi)+0.8, Math.cos(theta)*dist*Math.cos(phi)); c.lookAt(0,0.5,-2); }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.dist = Math.max(3, Math.min(18, orbitRef.current.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
      const c = cameraRef.current; if (c) { const { theta, phi, dist } = orbitRef.current; c.position.set(Math.sin(theta)*dist*Math.cos(phi), dist*Math.sin(phi)+0.8, Math.cos(theta)*dist*Math.cos(phi)); c.lookAt(0,0.5,-2); }
    };
    el.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); el.removeEventListener('wheel', wheel); };
  }, [items]);

  // ── Raycasting click ───────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = mountRef.current;
    const camera = cameraRef.current;
    const scene  = sceneRef.current;
    if (!el || !camera || !scene) return;

    const rect = el.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      ((e.clientY - rect.top)  / rect.height) * -2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(meshesRef.current);
    if (hits.length > 0) {
      const item = hits[0].object.userData.item as LobbyItem;
      setSelected(prev => prev?.id === item.id ? null : item);
    } else {
      setSelected(null);
    }
  }, []);

  // ── Project 3D label to screen ─────────────────────────────────────────────
  const project = useCallback((world: THREE.Vector3): { x: number; y: number } | null => {
    const el = mountRef.current;
    const camera = cameraRef.current;
    if (!el || !camera) return null;
    const v = world.clone().project(camera);
    return {
      x: ((v.x + 1) / 2) * el.clientWidth,
      y: ((-v.y + 1) / 2) * (el.clientHeight || 480),
    };
  }, [labelTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebXR ─────────────────────────────────────────────────────────────────
  const enterAR = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer || !navigator.xr) return;
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
    });
    xrSessionRef.current = session;
    setInAR(true);
    renderer.xr.setSession(session);
    renderer.setAnimationLoop((_: number, frame: XRFrame | null) => {
      if (!frame) return;
      renderer.render(sceneRef.current!, cameraRef.current!);
    });
    session.addEventListener('end', () => {
      renderer.setAnimationLoop(null);
      xrSessionRef.current = null;
      setInAR(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="px-4 py-6 border-b border-[var(--border-dark)]">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-end gap-4">
          <div>
            <Link href="/resale" className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors">
              ← Resale Marketplace
            </Link>
            <h1 className="text-2xl font-light tracking-tight mt-2 text-white">VR Personal Lobby</h1>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1 uppercase tracking-widest">
              Gold items are near your district · Drag to orbit · Click item to inspect · Scroll to zoom
            </p>
          </div>
          <div className="flex items-center gap-3">
            {arSupported && !inAR && (
              <button onClick={enterAR}
                className="px-3 py-2 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors">
                ◎ Enter AR
              </button>
            )}
            {inAR && (
              <button onClick={() => xrSessionRef.current?.end()}
                className="px-3 py-2 bg-red-600 text-white text-[9px] font-mono font-bold uppercase tracking-widest">
                Exit AR
              </button>
            )}
            <select
              className="bg-[#0a0a0a] border border-[var(--border-dark)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] focus:outline-none focus:border-[var(--rolex-gold)]"
              value={buyerDistrict}
              onChange={e => { setBuyerDistrict(e.target.value); setSelected(null); }}
            >
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* 3D Canvas */}
        <div className="relative flex-1 cursor-grab active:cursor-grabbing">
          <div ref={mountRef} className="w-full h-full" onClick={handleCanvasClick} />

          {/* Floating price labels */}
          {labels.map(lbl => {
            const pos = project(lbl.world);
            if (!pos) return null;
            const isSelected = selected?.id === lbl.id;
            return (
              <div key={lbl.id} className="absolute pointer-events-none transition-all duration-150"
                style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}>
                <div className={`px-2 py-1 text-[8px] font-mono font-bold whitespace-nowrap border ${
                  isSelected
                    ? 'bg-[var(--rolex-gold)] text-black border-[var(--rolex-gold)]'
                    : 'bg-black/80 text-[var(--rolex-gold)] border-[var(--rolex-gold)]/30'
                }`}>
                  LKR {lbl.price.toLocaleString()}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/80">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] animate-pulse">
                Loading vault lobby…
              </div>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <ShoppingBag size={32} className="text-[var(--text-muted)] mb-4" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                No listings in the lobby
              </p>
              <Link href="/resale"
                className="mt-4 px-4 py-2 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors">
                Create a Listing →
              </Link>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-72 border-l border-[var(--border-dark)] bg-[#0a0a0a] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-dark)]">
              <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">
                ASSET DETAIL
              </p>
              <button onClick={() => setSelected(null)}>
                <X size={14} className="text-[var(--text-muted)] hover:text-white transition-colors" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Grade badge */}
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-widest border"
                  style={{ borderColor: `#${(GRADE_COLORS[selected.grade] ?? 0x444444).toString(16).padStart(6, '0')}`, color: `#${(GRADE_COLORS[selected.grade] ?? 0x444444).toString(16).padStart(6, '0')}` }}>
                  {selected.grade}
                </span>
                {selected.district === buyerDistrict && (
                  <span className="px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-widest bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/30 text-[var(--rolex-gold)]">
                    NEARBY
                  </span>
                )}
              </div>

              {/* Name */}
              <div>
                <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">ASSET</p>
                <p className="text-sm text-white font-medium leading-snug">{selected.title}</p>
              </div>

              {/* Price */}
              <div className="bg-[#050505] border border-[var(--border-dark)] p-3">
                <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  PRICE INCL. LOGISTICS
                </p>
                <p className="text-xl font-mono text-[var(--rolex-gold)] font-bold">
                  LKR {selected.price.toLocaleString()}
                </p>
              </div>

              {/* Meta */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)]">
                  <MapPin size={10} className="text-[var(--rolex-gold)]" />
                  <span>{selected.district}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)]">
                  <Layers size={10} className="text-[var(--rolex-gold)]" />
                  <span>{selected.category || 'Collectible'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)]">
                  <Tag size={10} className="text-[var(--rolex-gold)]" />
                  <span>Grade: {selected.grade}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[var(--border-dark)] space-y-2">
              <Link href={`/resale/${selected.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors">
                <ExternalLink size={11} /> View Full Listing
              </Link>
              <Link href="/resale"
                className="flex items-center justify-center gap-2 w-full py-3 border border-[var(--border-dark)] text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:border-white/20 hover:text-white transition-colors">
                <ShoppingBag size={11} /> List Your Own
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
