'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { mediaApi } from '@/lib/api';
import { createSafeWebGLRenderer } from '@/lib/webgl-renderer';

type StlViewerProps = {
  mediaId: string;
  fallbackUrl?: string;
  className?: string;
};

export function StlViewer({ mediaId, fallbackUrl, className }: StlViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mediaId) return;

    let disposed = false;
    let frame = 0;
    let mesh: THREE.Mesh | null = null;

    setStatus('loading');
    setError(null);

    const width = () => host.clientWidth || 640;
    const height = () => Math.max(host.clientHeight || 480, 360);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createSafeWebGLRenderer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WebGL недоступен');
      setStatus('error');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eef5);

    const camera = new THREE.PerspectiveCamera(40, width() / height(), 0.1, 100000);
    camera.position.set(0, 40, 120);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width(), height(), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    host.replaceChildren(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(80, 120, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-70, 40, -40);
    scene.add(fill);

    function fitCameraToObject(object: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fitDist = (maxDim * 1.1) / (2 * Math.tan((Math.PI * camera.fov) / 360));
      camera.position.set(fitDist * 0.55, fitDist * 0.4, fitDist * 1.05);
      camera.near = Math.max(fitDist / 500, 0.01);
      camera.far = fitDist * 500;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.1;
      controls.maxDistance = fitDist * 8;
      controls.update();
    }

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const w = width();
      const h = height();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    ro.observe(host);

    const loader = new STLLoader();

    void (async () => {
      try {
        let buffer: ArrayBuffer;
        try {
          buffer = await mediaApi.fetchContent(mediaId);
        } catch (primaryErr) {
          if (!fallbackUrl) throw primaryErr;
          const res = await fetch(fallbackUrl);
          if (!res.ok) throw primaryErr;
          buffer = await res.arrayBuffer();
        }
        if (disposed) return;

        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xf3d5c4),
          roughness: 0.35,
          metalness: 0,
          side: THREE.DoubleSide,
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        fitCameraToObject(mesh);
        if (!disposed) setStatus('ready');
      } catch (err) {
        if (disposed) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить STL-модель');
        setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      if (mesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
      renderer.dispose();
      host.replaceChildren();
    };
  }, [mediaId, fallbackUrl]);

  return (
    <div
      className={`relative h-[75vh] w-full overflow-hidden rounded border border-border bg-[#e8eef5] ${className ?? ''}`}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-600">
          Загрузка 3D-модели…
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-4">
          <div className="alert-error max-w-md text-sm">{error}</div>
        </div>
      ) : null}
      {status === 'ready' ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white">
          ЛКМ — вращение · колёсико — зум · ПКМ — сдвиг
        </div>
      ) : null}
    </div>
  );
}
