'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

import { mediaApi } from '@/lib/api';
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
  return new Promise((resolve, reject) => {
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
    manager.onError = (url) => {
      console.warn('Texture load warning:', url);
      // Не блокируем просмотр при битой текстуре
      done();
    };
    materials.preload();
    // Нет map_Kd — onLoad не придёт; закрываем после двух кадров.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!loadStarted) done();
      });
    });
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
    setStatus('loading');
    setError(null);

    const width = () => host.clientWidth || 640;
    const height = () => Math.max(host.clientHeight || 480, 360);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eef5);

    const camera = new THREE.PerspectiveCamera(40, width() / height(), 0.01, 10000);
    camera.position.set(0, 40, 120);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'highp',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(width(), height(), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.zoomSpeed = 1.15;
    controls.rotateSpeed = 0.85;

    const hemi = new THREE.HemisphereLight(0xfff4ec, 0x9eb4c8, 0.65);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff8f0, 1.25);
    key.position.set(90, 140, 70);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00015;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xddeeff, 0.5);
    fill.position.set(-100, 60, -40);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(-40, 30, 120);
    scene.add(rim);

    let root: THREE.Object3D | null = null;
    let frame = 0;
    const blobUrls: string[] = [];

    function fitCameraToObject(object: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fitDist = (maxDim * 1.05) / (2 * Math.tan((Math.PI * camera.fov) / 360));
      camera.position.set(fitDist * 0.55, fitDist * 0.4, fitDist * 1.05);
      camera.near = Math.max(fitDist / 200, 0.01);
      camera.far = fitDist * 200;
      camera.updateProjectionMatrix();

      key.shadow.camera.left = -maxDim;
      key.shadow.camera.right = maxDim;
      key.shadow.camera.top = maxDim;
      key.shadow.camera.bottom = -maxDim;
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = fitDist * 8;
      key.shadow.camera.updateProjectionMatrix();

      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.15;
      controls.maxDistance = fitDist * 6;
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
      renderer.setSize(w, h, false);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

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

    function filesFromBuffer(buffer: ArrayBuffer): Map<string, Uint8Array> {
      if (isZipBuffer(buffer)) return unzipStore(buffer);
      // Сырой .obj одним файлом
      const map = new Map<string, Uint8Array>();
      map.set('model.obj', new Uint8Array(buffer));
      return map;
    }

    void loadBuffer()
      .then(async (buffer) => {
        if (disposed) return;
        const files = filesFromBuffer(buffer);
        const objEntry = findEntry(files, (n) => n.endsWith('.obj'));
        if (!objEntry) throw new Error('В архиве нет файла .obj');

        const [objName, objData] = objEntry;
        const objText = new TextDecoder().decode(objData);

        // Индекс файлов по basename для MTL map_Kd
        const byBase = new Map<string, Uint8Array>();
        for (const [name, data] of files) {
          byBase.set(basename(name).toLowerCase(), data);
        }

        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          const key = basename(url).toLowerCase();
          const data = byBase.get(key) ?? byBase.get(decodeURIComponent(key));
          if (!data) return url;
          const lower = key;
          const mime = lower.endsWith('.png')
            ? 'image/png'
            : lower.endsWith('.webp')
              ? 'image/webp'
              : lower.endsWith('.bmp')
                ? 'image/bmp'
                : 'image/jpeg';
          const blobUrl = URL.createObjectURL(new Blob([data], { type: mime }));
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

        const fallbackMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0xf3d5c4),
          roughness: 0.35,
          metalness: 0,
          clearcoat: 0.25,
          envMapIntensity: 0.9,
          side: THREE.DoubleSide,
        });

        group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (!mat) continue;
            const std = mat as THREE.MeshStandardMaterial;
            if (std.map) {
              std.map.colorSpace = THREE.SRGBColorSpace;
              std.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            std.side = THREE.DoubleSide;
            if ('roughness' in std && std.roughness == null) std.roughness = 0.45;
            std.needsUpdate = true;
          }
          if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
            mesh.material = fallbackMat;
          }
        });

        root = group;
        scene.add(group);
        fitCameraToObject(group);

        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(1, 96),
          new THREE.MeshStandardMaterial({
            color: 0xd5dde8,
            roughness: 0.92,
            metalness: 0,
          }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.scale.setScalar(maxDim * 1.5);
        floor.position.y = box.min.y - maxDim * 0.015;
        scene.add(floor);

        setStatus('ready');
      })
      .catch((err) => {
        if (disposed) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить цветную 3D-модель');
        setStatus('error');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      envTex.dispose();
      pmrem.dispose();
      for (const u of blobUrls) URL.revokeObjectURL(u);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      if (root) scene.remove(root);
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
