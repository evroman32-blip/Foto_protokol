'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

import { mediaApi } from '@/lib/api';
import { createSafeWebGLRenderer } from '@/lib/webgl-renderer';
import { isZipBuffer, unzipStore } from '@/lib/zip-store';

type ObjViewerProps = {
  mediaId: string;
  fallbackUrl?: string;
  className?: string;
};

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, '').split('?')[0] ?? path;
}

function findEntry(map: Map<string, Uint8Array>, pred: (name: string) => boolean): [string, Uint8Array] | null {
  for (const [name, data] of map) {
    if (pred(name.toLowerCase())) return [name, data];
  }
  return null;
}

function preloadMaterials(
  materials: MTLLoader.MaterialCreator,
  manager: THREE.LoadingManager,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let loadStarted = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    manager.onStart = () => {
      loadStarted = true;
    };
    manager.onLoad = done;
    manager.onError = () => done();
    materials.preload();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!loadStarted) done();
      });
    });
  });
}

function toStandardMaterial(
  src: THREE.Material,
  renderer: THREE.WebGLRenderer,
  fallbackColor: THREE.Color,
): THREE.MeshStandardMaterial {
  const phong = src as THREE.MeshPhongMaterial;
  const map = 'map' in phong && phong.map ? phong.map : null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
  }
  const color =
    'color' in phong && phong.color instanceof THREE.Color
      ? phong.color.clone()
      : fallbackColor.clone();

  return new THREE.MeshStandardMaterial({
    name: src.name || 'scan',
    color: map ? new THREE.Color(0xffffff) : color,
    map,
    roughness: 0.5,
    metalness: 0,
    envMapIntensity: 0,
    side: THREE.DoubleSide,
  });
}

export function ObjViewer({ mediaId, fallbackUrl, className }: ObjViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mediaId) return;

    let disposed = false;
    let frame = 0;
    const blobUrls: string[] = [];
    const createdMaterials: THREE.Material[] = [];

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
    // Без ACES/PMREM — меньше шансов сломать контекст во встроенном браузере
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    host.replaceChildren(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(60, 100, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-50, 40, -30);
    scene.add(fill);

    let root: THREE.Object3D | null = null;

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

        const files = isZipBuffer(buffer)
          ? unzipStore(buffer)
          : new Map<string, Uint8Array>([['model.obj', new Uint8Array(buffer)]]);

        const objEntry = findEntry(files, (n) => n.endsWith('.obj'));
        if (!objEntry) throw new Error('В архиве нет файла .obj');

        const objText = new TextDecoder().decode(objEntry[1]);
        const byBase = new Map<string, Uint8Array>();
        for (const [name, data] of files) {
          byBase.set(basename(name).toLowerCase(), data);
        }

        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          const keyName = basename(url).toLowerCase();
          const data = byBase.get(keyName) ?? byBase.get(decodeURIComponent(keyName));
          if (!data) return url;
          const mime = keyName.endsWith('.png')
            ? 'image/png'
            : keyName.endsWith('.webp')
              ? 'image/webp'
              : keyName.endsWith('.bmp')
                ? 'image/bmp'
                : 'image/jpeg';
          const blobUrl = URL.createObjectURL(new Blob([data.slice()], { type: mime }));
          blobUrls.push(blobUrl);
          return blobUrl;
        });

        let materials: MTLLoader.MaterialCreator | null = null;
        const mtlEntry = findEntry(files, (n) => n.endsWith('.mtl'));
        if (mtlEntry) {
          const mtlLoader = new MTLLoader(manager);
          mtlLoader.setMaterialOptions({ side: THREE.DoubleSide });
          materials = mtlLoader.parse(new TextDecoder().decode(mtlEntry[1]), '');
          await preloadMaterials(materials, manager);
        }
        if (disposed) return;

        const objLoader = new OBJLoader(manager);
        if (materials) objLoader.setMaterials(materials);
        const group = objLoader.parse(objText);

        const fallbackColor = new THREE.Color(0xf3d5c4);
        const fallbackMat = new THREE.MeshStandardMaterial({
          color: fallbackColor,
          roughness: 0.45,
          metalness: 0,
          side: THREE.DoubleSide,
        });
        createdMaterials.push(fallbackMat);

        group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const list = Array.isArray(mesh.material)
            ? mesh.material
            : mesh.material
              ? [mesh.material]
              : [];
          if (!list.length) {
            mesh.material = fallbackMat;
            return;
          }
          const converted = list.map((mat) => {
            if (!mat) return fallbackMat;
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }
              mat.side = THREE.DoubleSide;
              mat.envMapIntensity = 0;
              mat.needsUpdate = true;
              return mat;
            }
            const std = toStandardMaterial(mat, renderer, fallbackColor);
            createdMaterials.push(std);
            return std;
          });
          mesh.material = converted.length === 1 ? converted[0] : converted;
        });

        root = group;
        scene.add(group);
        fitCameraToObject(group);
        if (!disposed) setStatus('ready');
      } catch (err) {
        if (disposed) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить 3D-модель');
        setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      for (const u of blobUrls) URL.revokeObjectURL(u);
      for (const mat of createdMaterials) mat.dispose();
      if (root) {
        root.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.isMesh) m.geometry?.dispose();
        });
      }
      // Только dispose — БЕЗ forceContextLoss (он отключал GPU до перезапуска браузера)
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
          Загрузка цветной 3D-модели…
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-4">
          <div className="alert-error max-w-md text-sm">{error}</div>
        </div>
      ) : null}
      {status === 'ready' ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white">
          Цветной скан · ЛКМ — вращение · колёсико — зум · ПКМ — сдвиг
        </div>
      ) : null}
    </div>
  );
}
