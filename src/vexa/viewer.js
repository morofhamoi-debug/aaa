import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function mountGiftViewer(container, modelUrl) {
  if (!container || !modelUrl) return () => {};
  let disposed = false;
  let frame = 0;
  let renderer;
  let controls;
  let model;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f4);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  camera.position.set(3.2, 2.15, 4.1);

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    container.innerHTML = '<div class="viewer-fallback">3D-просмотр недоступен в этом браузере</div>';
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.setSize(container.clientWidth || 320, container.clientHeight || 320);
  renderer.domElement.setAttribute('aria-label', 'Интерактивная 3D-модель подарка');
  container.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8295, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.PointLight(0x9b8cff, 24, 16);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 1.4;
  controls.maxDistance = 9;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.3;
  controls.target.set(0, 0.1, 0);

  const loader = new GLTFLoader();
  loader.load(modelUrl, (gltf) => {
    if (disposed) return;
    model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    model.position.sub(center);
    model.scale.setScalar(2.15 / maxAxis);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => { material.envMapIntensity = 1.1; });
      }
    });
    scene.add(model);
    controls.target.set(0, 0, 0);
  }, undefined, () => {
    if (!disposed) container.innerHTML = '<div class="viewer-fallback">Не удалось загрузить 3D-модель</div>';
  });

  const resize = () => {
    if (disposed) return;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const animate = () => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
    if (model) {
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry?.dispose();
        for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
          if (!material) continue;
          for (const value of Object.values(material)) {
            if (value?.isTexture) value.dispose();
          }
          material.dispose();
        }
      });
    }
    renderer.domElement.remove();
  };
}
