import * as THREE from 'three';

/** Стабильный WebGL-контекст. Не вызывать forceContextLoss при unmount — ломает следующий просмотр. */
export function createSafeWebGLRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
  return new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: true,
  });
}
