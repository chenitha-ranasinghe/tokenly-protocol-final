'use client';

/**
 * Building3D — Production BIM / 3D Model Viewer
 *
 * Supports three rendering modes:
 *  1. Procedural (BuildResult rooms from ArchionLabs Build panel)
 *  2. GLB/GLTF   (Three.js GLTFLoader, zero setup required)
 *  3. IFC        (web-ifc-three, requires WASM file in /public/)
 *
 * WebXR Augmented Reality:
 *  - Detects navigator.xr support at mount
 *  - "Enter AR" button appears when immersive-ar is available
 *  - Renders the loaded model in AR space with hit-test for floor placement
 *
 * Setup for IFC support (one-time):
 *   npm install web-ifc-three web-ifc
 *   cp node_modules/web-ifc/web-ifc.wasm public/
 *   cp node_modules/web-ifc/web-ifc-mt.wasm public/   (optional, multi-threaded)
 *
 * No setup needed for GLB — Three.js handles it natively.
 */

import React, {
  useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import * as THREE from 'three';
import type { BuildResult } from './BuildPanel';
import { ROOM_COLORS } from './BuildPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelType = 'procedural' | 'glb' | 'ifc';

export interface Building3DProps {
  buildResult:   BuildResult | null;
  watermark:     boolean;
  watermarkText: string;
  modelUrl?:     string;
  modelType?:    ModelType;
  onXRSessionStart?: () => void;
  onXRSessionEnd?:   () => void;
}

export interface Building3DHandle {
  resetCamera:    () => void;
  toggleWireframe: () => void;
  captureFrame:   () => string | null;  // returns data URL
}

// ── Helper: draw watermark overlay ───────────────────────────────────────────

function drawWatermark(canvas: HTMLCanvasElement, text: string, enabled: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width  = canvas.offsetWidth  || 640;
  canvas.height = canvas.offsetHeight || 360;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!enabled) return;

  // Layer 1 — diagonal text pattern
  ctx.save();
  ctx.rotate(-Math.PI / 7);
  ctx.font      = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = 'rgba(163,126,44,0.09)';
  for (let x = -canvas.width; x < canvas.width * 2; x += 210) {
    for (let y = -canvas.height; y < canvas.height * 2; y += 55) {
      ctx.fillText('TOKENLY BUILD · CONFIDENTIAL', x, y);
    }
  }
  ctx.restore();

  // Layer 2 — bottom-right stamp
  ctx.font      = 'bold 8px "Courier New", monospace';
  ctx.fillStyle = 'rgba(163,126,44,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(text, canvas.width - 10, canvas.height - 10);
}

// ── Main Component ────────────────────────────────────────────────────────────

const Building3D = forwardRef<Building3DHandle, Building3DProps>(function Building3D(
  { buildResult, watermark, watermarkText, modelUrl, modelType = 'procedural', onXRSessionStart, onXRSessionEnd },
  ref
) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const overlayRef     = useRef<HTMLCanvasElement>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef  = useRef<THREE.Group | null>(null);
  const orbitRef       = useRef({ theta: Math.PI * 0.28, phi: 0.48, dist: 12 });
  const autoRotateRef  = useRef(true);
  const rafRef         = useRef<number>(0);
  const xrSessionRef   = useRef<XRSession | null>(null);

  const [status,      setStatus]      = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadMsg,     setLoadMsg]     = useState('');
  const [arSupported, setArSupported] = useState(false);
  const [inAR,        setInAR]        = useState(false);
  const [wireframe,   setWireframe]   = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // ── Check WebXR support once on mount ─────────────────────────────────────
  useEffect(() => {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported('immersive-ar').then(supported => {
      setArSupported(supported);
    }).catch(() => setArSupported(false));
  }, []);

  // ── Wait for container to have real dimensions ─────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.clientWidth >= 4 && el.clientHeight >= 4) { setCanvasReady(true); return; }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth >= 4 && el.clientHeight >= 4) setCanvasReady(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Watermark ──────────────────────────────────────────────────────────────
  const refreshWatermark = useCallback(() => {
    const oc = overlayRef.current;
    if (oc) drawWatermark(oc, watermarkText, watermark);
  }, [watermark, watermarkText]);

  useEffect(() => { refreshWatermark(); }, [refreshWatermark]);

  // ── Expose imperative handle ───────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    resetCamera() {
      autoRotateRef.current = true;
      orbitRef.current = { theta: Math.PI * 0.28, phi: 0.48, dist: 12 };
    },
    toggleWireframe() {
      setWireframe(w => {
        const next = !w;
        sceneRef.current?.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            const mat = (obj as THREE.Mesh).material;
            if (Array.isArray(mat)) {
              mat.forEach(m => { if ((m as THREE.MeshStandardMaterial).wireframe !== undefined) (m as THREE.MeshStandardMaterial).wireframe = next; });
            } else {
              if ((mat as THREE.MeshStandardMaterial).wireframe !== undefined) (mat as THREE.MeshStandardMaterial).wireframe = next;
            }
          }
        });
        return next;
      });
    },
    captureFrame(): string | null {
      const r = rendererRef.current;
      if (!r) return null;
      r.render(sceneRef.current!, cameraRef.current!);
      return r.domElement.toDataURL('image/png');
    },
  }));

  // ── Main Three.js setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasReady) return;
    const el = containerRef.current;
    if (!el) return;

    const w = Math.max(el.clientWidth,  4);
    const h = Math.max(el.clientHeight, 4);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060606);
    scene.fog        = new THREE.FogExp2(0x060606, 0.013);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.05, 1000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.xr.enabled        = true; // Enable WebXR on the renderer
    rendererRef.current        = renderer;
    el.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffd580, 2.0);
    sun.position.set(20, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x112233, 0x000000, 0.5));
    const fillA = new THREE.PointLight(0x3b82f6, 0.3, 80);
    fillA.position.set(-15, 8, -10); scene.add(fillA);
    const fillB = new THREE.PointLight(0xa37e2c, 0.18, 60);
    fillB.position.set(10, 3, 15); scene.add(fillB);

    // Ground + grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.GridHelper(50, 50, 0x191919, 0x111111));

    // Group for loaded/procedural model (makes resetting easy)
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // ── Load model or build procedural ──────────────────────────────────────
    let cancelled = false;

    async function loadContent() {
      if (!modelUrl || modelType === 'procedural') {
        buildProcedural(modelGroup, buildResult);
        fitCamera(modelGroup, orbitRef, camera);
        setStatus('ready');
        return;
      }

      setStatus('loading');
      setLoadMsg(`Loading ${modelType.toUpperCase()} model…`);

      try {
        if (modelType === 'glb') {
          await loadGLB(modelUrl, modelGroup, (pct) => {
            if (!cancelled) setLoadMsg(`Parsing geometry… ${pct}%`);
          });
        } else if (modelType === 'ifc') {
          await loadIFC(modelUrl, modelGroup, (msg) => {
            if (!cancelled) setLoadMsg(msg);
          });
        }
        if (!cancelled) {
          fitCamera(modelGroup, orbitRef, camera);
          setStatus('ready');
          setLoadMsg('');
        }
      } catch (err: unknown) {
        console.error('[Building3D] Model load error:', err);
        if (!cancelled) {
          setStatus('error');
          setLoadMsg(
            err instanceof Error ? err.message : 'Failed to load model file.'
          );
          // Fallback: show procedural rooms
          buildProcedural(modelGroup, buildResult);
          fitCamera(modelGroup, orbitRef, camera);
        }
      }
    }

    loadContent();

    // ── Manual orbit controls ────────────────────────────────────────────────
    const domEl = renderer.domElement;
    let dragging = false, lastX = 0, lastY = 0;

    const updateCamera = () => {
      const { theta, phi, dist } = orbitRef.current;
      camera.position.set(
        Math.sin(theta) * dist * Math.cos(phi),
        dist * Math.sin(phi) + 1.5,
        Math.cos(theta) * dist * Math.cos(phi)
      );
      camera.lookAt(0, 1.5, 0);
    };

    const onDown  = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; autoRotateRef.current = false; };
    const onMove  = (e: MouseEvent) => {
      if (!dragging) return;
      orbitRef.current.theta -= (e.clientX - lastX) * 0.011;
      orbitRef.current.phi    = Math.max(0.05, Math.min(1.45, orbitRef.current.phi - (e.clientY - lastY) * 0.009));
      lastX = e.clientX; lastY = e.clientY;
      updateCamera();
    };
    const onUp    = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      autoRotateRef.current = false;
      orbitRef.current.dist = Math.max(1.5, Math.min(120, orbitRef.current.dist * (e.deltaY > 0 ? 1.12 : 0.89)));
      updateCamera();
    };
    const onDbl = () => { autoRotateRef.current = true; };

    // Touch support
    let lastPinchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        autoRotateRef.current = false;
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.hypot(dx, dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        orbitRef.current.theta -= (e.touches[0].clientX - lastX) * 0.011;
        orbitRef.current.phi    = Math.max(0.05, Math.min(1.45, orbitRef.current.phi - (e.touches[0].clientY - lastY) * 0.009));
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        updateCamera();
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d  = Math.hypot(dx, dy);
        orbitRef.current.dist *= lastPinchDist / d;
        orbitRef.current.dist = Math.max(1.5, Math.min(120, orbitRef.current.dist));
        lastPinchDist = d;
        updateCamera();
      }
    };
    const onTouchEnd = () => { dragging = false; };

    const onResize = () => {
      const rw = Math.max(el.clientWidth, 4);
      const rh = Math.max(el.clientHeight, 4);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
      refreshWatermark();
    };

    domEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    domEl.addEventListener('wheel',      onWheel, { passive: false });
    domEl.addEventListener('dblclick',   onDbl);
    domEl.addEventListener('touchstart', onTouchStart, { passive: false });
    domEl.addEventListener('touchmove',  onTouchMove,  { passive: false });
    domEl.addEventListener('touchend',   onTouchEnd);
    window.addEventListener('resize',    onResize);

    updateCamera();

    // ── Render loop ──────────────────────────────────────────────────────────
    const renderLoop = () => {
      rafRef.current = requestAnimationFrame(renderLoop);
      if (autoRotateRef.current && !xrSessionRef.current) {
        orbitRef.current.theta += 0.0025;
        updateCamera();
      }
      renderer.render(scene, camera);
    };
    renderLoop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      domEl.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      domEl.removeEventListener('wheel',      onWheel);
      domEl.removeEventListener('dblclick',   onDbl);
      domEl.removeEventListener('touchstart', onTouchStart);
      domEl.removeEventListener('touchmove',  onTouchMove);
      domEl.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('resize',    onResize);
      if (el.contains(domEl)) el.removeChild(domEl);
      renderer.dispose();
      sceneRef.current   = null;
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasReady, modelUrl, modelType, buildResult]);

  // ── WebXR AR Session ───────────────────────────────────────────────────────
  const enterAR = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer || !navigator.xr) return;

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'light-estimation'],
        // @ts-expect-error — dom-overlay config
        domOverlay: { root: containerRef.current },
      });

      xrSessionRef.current = session;
      autoRotateRef.current = false;
      setInAR(true);
      onXRSessionStart?.();

      renderer.xr.setSession(session);

      // XR render loop (replaces rAF loop during session)
      renderer.setAnimationLoop((_timestamp, frame) => {
        if (!frame) return;
        renderer.render(sceneRef.current!, cameraRef.current!);
      });

      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
        xrSessionRef.current  = null;
        autoRotateRef.current = true;
        setInAR(false);
        onXRSessionEnd?.();
        // Restart standard rAF loop
        const renderLoop = () => {
          rafRef.current = requestAnimationFrame(renderLoop);
          if (autoRotateRef.current) {
            orbitRef.current.theta += 0.0025;
            cameraRef.current!.position.set(
              Math.sin(orbitRef.current.theta) * orbitRef.current.dist * Math.cos(orbitRef.current.phi),
              orbitRef.current.dist * Math.sin(orbitRef.current.phi) + 1.5,
              Math.cos(orbitRef.current.theta) * orbitRef.current.dist * Math.cos(orbitRef.current.phi),
            );
            cameraRef.current!.lookAt(0, 1.5, 0);
          }
          renderer.render(sceneRef.current!, cameraRef.current!);
        };
        renderLoop();
      });
    } catch (err) {
      console.error('[Building3D] WebXR session failed:', err);
    }
  }, [onXRSessionStart, onXRSessionEnd]);

  const exitAR = useCallback(async () => {
    await xrSessionRef.current?.end();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing select-none">
      {/* Three.js canvas mount point */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Watermark overlay */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <div className="w-10 h-10 border-2 border-[var(--rolex-gold)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] animate-pulse">
            {loadMsg || 'Loading…'}
          </p>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute bottom-10 left-3 right-3 z-20 px-3 py-2 bg-red-900/80 border border-red-500/40">
          <p className="text-[9px] font-mono text-red-300 uppercase tracking-wide">
            Model load failed — showing floor plan preview instead
          </p>
          <p className="text-[8px] font-mono text-red-400/70 mt-1 truncate">{loadMsg}</p>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <p className="text-[7px] font-mono text-white/25 leading-relaxed">
          Drag · Scroll · Dblclick: auto-rotate
          {modelType !== 'procedural' && modelUrl && ` · ${modelType.toUpperCase()} model loaded`}
        </p>
        <div className="flex gap-2 pointer-events-auto">
          {/* Wireframe toggle */}
          {status === 'ready' && (
            <button
              onClick={() => {
                setWireframe(w => {
                  const next = !w;
                  sceneRef.current?.traverse(obj => {
                    if ((obj as THREE.Mesh).isMesh) {
                      const mat = (obj as THREE.Mesh).material;
                      (Array.isArray(mat) ? mat : [mat]).forEach(m => {
                        const mm = m as THREE.MeshStandardMaterial;
                        if (mm.wireframe !== undefined) mm.wireframe = next;
                      });
                    }
                  });
                  return next;
                });
              }}
              className="px-2 py-1 bg-black/60 border border-white/10 text-[7px] font-mono text-white/50 hover:text-white hover:border-white/20 transition-colors"
            >
              {wireframe ? 'SOLID' : 'WIRE'}
            </button>
          )}

          {/* WebXR AR button */}
          {arSupported && !inAR && status === 'ready' && (
            <button
              onClick={enterAR}
              className="px-2 py-1 bg-[var(--rolex-gold)]/90 text-black text-[7px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)] transition-colors"
            >
              ◎ ENTER AR
            </button>
          )}
          {inAR && (
            <button
              onClick={exitAR}
              className="px-2 py-1 bg-red-600 text-white text-[7px] font-mono font-bold uppercase tracking-widest hover:bg-red-500 transition-colors"
            >
              EXIT AR
            </button>
          )}
        </div>
      </div>

      {/* AR hint when not supported */}
      {!arSupported && status === 'ready' && (
        <div className="absolute top-3 right-3 pointer-events-none">
          <p className="text-[7px] font-mono text-white/20 uppercase tracking-widest">AR: not available in this browser</p>
        </div>
      )}
    </div>
  );
});

export default Building3D;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build Three.js geometry from ArchionLabs floor-plan rooms. */
function buildProcedural(group: THREE.Group, buildResult: BuildResult | null) {
  // Clear existing
  while (group.children.length) group.remove(group.children[0]);

  const FH    = 3;
  const rooms = buildResult?.rooms ?? [];

  if (rooms.length > 0) {
    const minX = Math.min(...rooms.map(r => r.x));
    const minY = Math.min(...rooms.map(r => r.y));
    const maxX = Math.max(...rooms.map(r => r.x + r.width));
    const maxY = Math.max(...rooms.map(r => r.y + r.height));
    const cx   = (minX + maxX) / 2;
    const cz   = (minY + maxY) / 2;

    // Floor slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX + 0.4, 0.1, maxY - minY + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    slab.position.y = -0.05;
    slab.receiveShadow = true;
    group.add(slab);

    rooms.forEach(room => {
      const col = ROOM_COLORS[room.type] ?? ROOM_COLORS['default'];
      const geo = new THREE.BoxGeometry(room.width - 0.12, FH, room.height - 0.12);

      const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: col.hex, transparent: true, opacity: 0.52,
        roughness: 0.65, metalness: 0.08,
      }));
      solid.position.set(
        room.x + room.width  / 2 - cx,
        FH / 2,
        room.y + room.height / 2 - cz
      );
      solid.castShadow = solid.receiveShadow = true;
      group.add(solid);

      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: col.hex, transparent: true, opacity: 0.35 })
      );
      wire.position.copy(solid.position);
      group.add(wire);
    });

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX + 0.2, 0.18, maxY - minY + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x111827 })
    );
    roof.position.set(0, FH + 0.09, 0);
    roof.castShadow = true;
    group.add(roof);
  } else {
    // Placeholder blocks when no floor plan loaded
    [0x3b82f6, 0xa37e2c, 0x22c55e].forEach((hex, i) => {
      const h   = 3 + i * 0.6;
      const geo = new THREE.BoxGeometry(3.8, h, 3.8);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: hex, transparent: true, opacity: 0.5,
      }));
      mesh.position.set((i - 1) * 5, h / 2, 0);
      mesh.castShadow = true;
      group.add(mesh);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.4 })
      );
      wire.position.copy(mesh.position);
      group.add(wire);
    });
  }
}

/** Load a GLB/GLTF model using Three.js GLTFLoader. */
async function loadGLB(
  url: string,
  group: THREE.Group,
  onProgress: (pct: number) => void
): Promise<void> {
  // Dynamic import so GLTFLoader is not bundled unless needed
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        // Clear procedural content
        while (group.children.length) group.remove(group.children[0]);

        const model = gltf.scene;
        model.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = obj.receiveShadow = true;
          }
        });
        group.add(model);
        resolve();
      },
      (progress) => {
        if (progress.total > 0) {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

/** Load an IFC model using web-ifc-three. Requires WASM in /public/. */
async function loadIFC(
  url: string,
  group: THREE.Group,
  onStatus: (msg: string) => void
): Promise<void> {
  onStatus('Initialising IFC WASM module…');

  let loader: any;

  try {
    // Dynamic import — only pulled in when an IFC file is actually loaded
    const mod = await import('web-ifc-three/IFCLoader');
    loader = new mod.IFCLoader();
  } catch {
    throw new Error(
      'web-ifc-three is not installed. Run: npm install web-ifc-three web-ifc\n' +
      'Then copy: cp node_modules/web-ifc/web-ifc.wasm public/'
    );
  }

  onStatus('Loading IFC geometry…');

  // WASM is served from /public/ root
  await loader.ifcManager.setWasmPath('/');

  const model = await loader.loadAsync(url, (e: ProgressEvent) => {
    if (e.total > 0) onStatus(`Parsing IFC… ${Math.round((e.loaded / e.total) * 100)}%`);
  });

  while (group.children.length) group.remove(group.children[0]);
  model.traverse((obj: any) => {
    if ((obj as THREE.Mesh).isMesh) obj.castShadow = obj.receiveShadow = true;
  });
  group.add(model);
}

/** Auto-fit camera distance to enclose the loaded model's bounding box. */
function fitCamera(
  group: THREE.Group,
  orbitRef: React.MutableRefObject<{ theta: number; phi: number; dist: number }>,
  camera: THREE.PerspectiveCamera
) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = (camera.fov * Math.PI) / 180;
  orbitRef.current.dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.6;
}
