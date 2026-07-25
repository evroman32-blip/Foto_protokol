'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { mediaApi } from '@/lib/api';

type StlViewerProps = {
  /** id MediaAsset — загрузка через API (без CORS к S3) */
  mediaId: string;
  /** запасной presigned URL */
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
    setStatus('loading');
    setError(null);

    const width = () => host.clientWidth || 640;
    const height = () => Math.max(host.clientHeight || 420, 320);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 5000);
    camera.position.set(0, 40, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width(), height());
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(80, 120, 60);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-60, 40, -80);
    scene.add(ambient, key, fill);

    let mesh: THREE.Mesh | null = null;
    let frame = 0;

    function fitCameraToObject(object: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fitDist = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360));
      camera.position.set(fitDist * 0.6, fitDist * 0.45, fitDist * 1.15);
      camera.near = Math.max(fitDist / 100, 0.01);
      camera.far = fitDist * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
    }

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      if (disposed || !host) return;
      const w = width();
      const h = height();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const loader = new STLLoader();

    async function loadBuffer(): Promise<ArrayBuffer> {
      try {
        return await mediaApi.fetchContent(mediaId);
      } catch (primaryErr) {
        if (!fallbackUrl) throw primaryErr;
        const res = await fetch(fallbackUrl);
        if (!res.ok) throw primaryErr;
        return res.arrayBuffer();
      }
    }

    void loadBuffer()
      .then((buffer) => {
        if (disposed) return;
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
          color: 0xc4c9d1,
          metalness: 0.05,
          roughness: 0.55,
          flatShading: false,
        });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        fitCameraToObject(mesh);
        setStatus('ready');
      })
      .catch((err) => {
        if (disposed) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить STL-модель');
        setStatus('error');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      if (mesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
        scene.remove(mesh);
      }
      renderer.dispose();
      host.replaceChildren();
    };
  }, [mediaId, fallbackUrl]);

  return (
    <div className={`relative h-[70vh] w-full overflow-hidden rounded border border-border ${className ?? ''}`}>
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
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[10px] text-white">
          ЛКМ — вращение · колёсико — зум · ПКМ — сдвиг
        </div>
      ) : null}
    </div>
  );
}
