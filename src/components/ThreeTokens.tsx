'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeTokens() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#030303', 0.03); // Deep space fade

    // CAMERA
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mountRef.current.appendChild(renderer.domElement);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const goldLight1 = new THREE.DirectionalLight(0xF4D068, 2);
    goldLight1.position.set(10, 20, 10);
    scene.add(goldLight1);

    const pointLight = new THREE.PointLight(0xffffff, 1, 30);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    // TOKENS (InstancedMesh for hyper-performance)
    const tokenCount = 40; // Optimized for smoothness
    // Golden Ticket geometry (small, thin rectangular cards)
    const geometry = new THREE.BoxGeometry(0.8, 0.4, 0.02);
    
    // Rolex Gold Material with premium ticket sheen (PBR)
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xF4D068,
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
      ior: 2.5
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, tokenCount);
    
    // Physics State Array
    const dummy = new THREE.Object3D();
    const tokenData: {x: number, y: number, z: number, rx: number, ry: number, rz: number, speed: number, rotSpeedX: number, rotSpeedY: number}[] = [];

    for (let i = 0; i < tokenCount; i++) {
      const x = (Math.random() - 0.5) * 45;
      const y = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 20 - 5;
      
      const rx = Math.random() * Math.PI;
      const ry = Math.random() * Math.PI;
      const rz = Math.random() * Math.PI;

      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      tokenData.push({
        x, y, z, rx, ry, rz,
        speed: Math.random() * 0.012 + 0.005, 
        rotSpeedX: (Math.random() - 0.5) * 0.008,
        rotSpeedY: (Math.random() - 0.5) * 0.012,
      });
    }

    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(instancedMesh);

    // ANIMATION LOOP
    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      time += 0.005;
      for (let i = 0; i < tokenCount; i++) {
        const data = tokenData[i];
        data.y -= data.speed;
        data.x += Math.sin(time + i) * 0.003;
        data.rx += data.rotSpeedX;
        data.ry += data.rotSpeedY;
        if (data.y < -22) {
          data.y = 22;
          data.x = (Math.random() - 0.5) * 45;
        }
        dummy.position.set(data.x, data.y, data.z);
        dummy.rotation.set(data.rx, data.ry, data.rz);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // RESIZE HANDLER
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // CLEANUP
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      mountRef.current?.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6 // Subtle background blending
      }} 
    />
  );
}
