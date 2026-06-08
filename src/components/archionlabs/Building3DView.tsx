'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { BuildResult, ROOM_COLORS } from './BuildPanel';

export function Building3DView({ result }: { result: BuildResult }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !result?.rooms?.length) return;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog        = new THREE.FogExp2(0x050505, 0.014);

    const camera   = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.38));
    const sun = new THREE.DirectionalLight(0xffd580, 1.9);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x111827, 0x000000, 0.55));
    const fillLight = new THREE.PointLight(0x3b82f6, 0.35, 60);
    fillLight.position.set(-15, 8, -10);
    scene.add(fillLight);

    // Building geometry
    const rooms  = result.rooms;
    const minX   = Math.min(...rooms.map(r => r.x));
    const minY   = Math.min(...rooms.map(r => r.y));
    const maxX   = Math.max(...rooms.map(r => r.x + r.width));
    const maxY   = Math.max(...rooms.map(r => r.y + r.height));
    const cx     = (minX + maxX) / 2, cz = (minY + maxY) / 2;
    const span   = Math.max(maxX - minX, maxY - minY);
    const FH     = 3; // floor height in metres

    // Ground slab + grid
    const gMesh = new THREE.Mesh(
      new THREE.BoxGeometry(span + 8, 0.08, span + 8),
      new THREE.MeshStandardMaterial({ color: 0x0e0e0e }),
    );
    gMesh.position.y = -0.04;
    gMesh.receiveShadow = true;
    scene.add(gMesh);
    scene.add(new THREE.GridHelper(span + 14, Math.round(span + 14), 0x181818, 0x111111));

    // Room boxes
    rooms.forEach(room => {
      const col  = ROOM_COLORS[room.type] ?? ROOM_COLORS.default;
      const geo  = new THREE.BoxGeometry(room.width - 0.12, FH, room.height - 0.12);

      const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: col.hex, transparent: true, opacity: 0.52, roughness: 0.7, metalness: 0.08,
      }));
      solid.position.set(room.x + room.width / 2 - cx, FH / 2, room.y + room.height / 2 - cz);
      solid.castShadow = solid.receiveShadow = true;
      scene.add(solid);

      // Edge wireframe overlay
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: col.hex, transparent: true, opacity: 0.38 }),
      );
      wire.position.copy(solid.position);
      scene.add(wire);
    });

    // Roof cap
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX + 0.2, 0.16, maxY - minY + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x111827 }),
    );
    roof.position.set(0, FH + 0.08, 0);
    roof.castShadow = true;
    scene.add(roof);

    // Camera orbit state
    const orbit = { theta: Math.PI * 0.3, phi: 0.5, dist: span * 0.88 };
    const updateCamera = () => {
      camera.position.set(
        Math.sin(orbit.theta) * orbit.dist * Math.cos(orbit.phi),
        orbit.dist * Math.sin(orbit.phi) + FH / 2,
        Math.cos(orbit.theta) * orbit.dist * Math.cos(orbit.phi),
      );
      camera.lookAt(0, FH / 2, 0);
    };
    updateCamera();

    let autoRotate = true;
    let rafId = 0;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (autoRotate) {
        orbit.theta += 0.003;
        updateCamera();
      }
      renderer.render(scene, camera);
    };
    loop();

    // Mouse drag orbit
    const domEl = renderer.domElement;
    let mouseDown = false;
    let lastMX = 0, lastMY = 0;

    const onDown = (e: MouseEvent) => { mouseDown = true; lastMX = e.clientX; lastMY = e.clientY; autoRotate = false; };
    const onMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      orbit.theta -= (e.clientX - lastMX) * 0.012;
      orbit.phi    = Math.max(0.1, Math.min(1.3, orbit.phi - (e.clientY - lastMY) * 0.01));
      lastMX = e.clientX; lastMY = e.clientY;
      updateCamera();
    };
    const onUp   = () => { mouseDown = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      autoRotate   = false;
      orbit.dist   = Math.max(span * 0.22, Math.min(span * 3, orbit.dist * (e.deltaY > 0 ? 1.12 : 0.89)));
      updateCamera();
    };
    const onDbl  = () => { autoRotate = true; };
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };

    domEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    domEl.addEventListener('wheel',      onWheel, { passive: false });
    domEl.addEventListener('dblclick',   onDbl);
    window.addEventListener('resize',    onResize);

    return () => {
      cancelAnimationFrame(rafId);
      domEl.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      domEl.removeEventListener('wheel',      onWheel);
      domEl.removeEventListener('dblclick',   onDbl);
      window.removeEventListener('resize',    onResize);
      if (el.contains(domEl)) el.removeChild(domEl);
      renderer.dispose();
    };
  }, [result]);

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing relative">
      <div className="absolute bottom-3 left-3 z-10 text-[7px] font-mono text-white/25 leading-relaxed pointer-events-none">
        Drag: orbit · Scroll: zoom · Dblclick: auto-rotate
      </div>
    </div>
  );
}
