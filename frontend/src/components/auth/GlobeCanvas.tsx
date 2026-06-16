"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props { size?: number }

export function GlobeCanvas({ size = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene & camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 2.65;

    // ── Earth ─────────────────────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    const earthTex = loader.load("/textures/earth.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.MeshPhongMaterial({
      map:      earthTex,
      specular: new THREE.Color(0x2a2a50),
      shininess: 14,
    });
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 80), earthMat);
    scene.add(earthMesh);

    // ── Atmosphere — outer rim (BackSide = visible around the limb) ───────────
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x3366ff,
        transparent: true,
        opacity: 0.09,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    ));

    // Thin inner haze
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.008, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x6699ff,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      }),
    ));

    // ── Lighting ──────────────────────────────────────────────────────────────
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.5);
    sun.position.set(-2.0, 0.8, 1.8);
    scene.add(sun);

    // Dim blue fill for the dark side so it's not pure black
    scene.add(new THREE.AmbientLight(0x0d1133, 0.55));

    // ── Animate ───────────────────────────────────────────────────────────────
    let rafId = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      earthMesh.rotation.y += 0.0018;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      earthTex.dispose();
      earthMat.dispose();
    };
  }, [size]);

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: "block" }}
        aria-hidden="true"
      />
    </div>
  );
}
