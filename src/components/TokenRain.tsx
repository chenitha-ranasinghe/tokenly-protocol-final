"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const TOKEN_COUNT = 80;

const TokenRain: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // --- SCENE ---
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, 0.025);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.z = 12;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4; // Brighter highlights
        mountRef.current.appendChild(renderer.domElement);

        // --- EXTREME LUXURY LIGHTING RIG ---
        const ambientLight = new THREE.AmbientLight(0x002B16, 1.2); // Deeper Jade base
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(8, 12, 10);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xA37E2C, 2.0); // Extreme Gold
        fillLight.position.set(-6, -4, -8);
        scene.add(fillLight);

        const rimLight = new THREE.PointLight(0x00f0a8, 4.0, 25); // Intense Emerald Glow Core
        rimLight.position.set(0, 0, -2);
        scene.add(rimLight);

        // --- GEOMETRY ---
        const ticketShape = new THREE.Shape();
        const w = 0.2, h = 0.12, notch = 0.015;
        ticketShape.moveTo(-w, -h);
        ticketShape.lineTo(-w, h);
        for (let x = -w; x < w - notch; x += notch * 2) {
            ticketShape.lineTo(x + notch, h + notch * 0.6);
            ticketShape.lineTo(x + notch * 2, h);
        }
        ticketShape.lineTo(w, h);
        ticketShape.lineTo(w, -h);
        for (let x = w; x > -w + notch; x -= notch * 2) {
            ticketShape.lineTo(x - notch, -h - notch * 0.6);
            ticketShape.lineTo(x - notch * 2, -h);
        }
        ticketShape.lineTo(-w, -h);

        const geometry = new THREE.ExtrudeGeometry(ticketShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3 });
        geometry.computeVertexNormals();

        // --- MATERIAL (Rolex High-Metalness Gold) ---
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xE8B841,
            metalness: 1.0,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            reflectivity: 1,
            side: THREE.DoubleSide,
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, material, TOKEN_COUNT);
        scene.add(instancedMesh);

        // --- TOKEN KINETICS ---
        const dummy = new THREE.Object3D();
        const tokens = Array.from({ length: TOKEN_COUNT }, () => {
            const depth = Math.random();
            return {
                basePos: new THREE.Vector3(),
                pos: new THREE.Vector3(
                    (Math.random() - 0.5) * 30,
                    Math.random() * 24 - 12,
                    -1 + depth * -14
                ),
                rot: new THREE.Euler(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ),
                rSpeed: {
                    x: (Math.random() - 0.5) * 0.004,
                    y: (Math.random() - 0.5) * 0.006,
                    z: (Math.random() - 0.5) * 0.002,
                },
                drift: (Math.random() - 0.5) * 0.003,
                vel: 0.002 + Math.random() * 0.005,
                scale: 0.6 + depth * 0.9,
                velocity: new THREE.Vector3() // For magnetic repulsion physics
            };
        });

        // Set colors based on depth to simulate fog fade
        const color = new THREE.Color();
        let i = 0;
        tokens.forEach((t) => {
            const d = (t.pos.z + 15) / 14;
            color.setHex(0xFFDF73).lerp(new THREE.Color(0x3B2C05), 1 - d);
            instancedMesh.setColorAt(i++, color);
        });
        if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

        // --- MOUSE PHYSICS PARALLAX ---
        const mouse = new THREE.Vector2(-9999, -9999);
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 6); 
        const intersectPoint = new THREE.Vector3();

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener("mousemove", onMouseMove);

        // --- ANIMATION LOOP ---
        let frame: number;
        let time = 0;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            time += 0.002;

            // Camera subtle breath
            camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.02;
            camera.position.y += (mouse.y * 1.0 - camera.position.y) * 0.02;
            camera.lookAt(0, 0, -5);

            // Calculate exact mouse position in 3D space
            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, intersectPoint);

            tokens.forEach((t, idx) => {
                // Gravity & Drift
                t.pos.y -= t.vel;
                t.pos.x += t.drift + Math.sin(time + idx) * 0.0008;

                // Repulsion Physics
                const dist = t.pos.distanceTo(intersectPoint);
                if (dist < 4.0) {
                    const force = (4.0 - dist) * 0.02;
                    const dir = new THREE.Vector3().subVectors(t.pos, intersectPoint).normalize();
                    t.velocity.add(dir.multiplyScalar(force));
                }

                // Apply velocity and drag
                t.pos.add(t.velocity);
                t.velocity.multiplyScalar(0.9); // Friction

                // Reset logic
                if (t.pos.y < -12) {
                    t.pos.y = 14;
                    t.pos.x = (Math.random() - 0.5) * 30;
                    t.velocity.set(0,0,0);
                }

                t.rot.x += t.rSpeed.x + t.velocity.length() * 0.1;
                t.rot.y += t.rSpeed.y + t.velocity.length() * 0.1;
                t.rot.z += t.rSpeed.z;

                dummy.position.copy(t.pos);
                dummy.rotation.copy(t.rot);
                dummy.scale.setScalar(t.scale);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(idx, dummy.matrix);
            });

            instancedMesh.instanceMatrix.needsUpdate = true;
            renderer.render(scene, camera);
        };
        animate();

        // --- RESIZE ---
        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", onResize);

        // --- CLEANUP ---
        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            cancelAnimationFrame(frame);
            if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={mountRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
                opacity: 0.85,
                background: "radial-gradient(circle at 50% 50%, rgba(5,5,5,0) 0%, rgba(5,5,5,1) 90%)"
            }}
        />
    );
};

export default TokenRain;
