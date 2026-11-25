import { LoadingManager, TextureLoader, AudioLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor(eventBus) {
    this.events = eventBus;
    this.cache = new Map();
    this.loading = new LoadingManager();
    this.textureLoader = new TextureLoader(this.loading);
    this.audioLoader = new AudioLoader(this.loading);
    this.gltfLoader = new GLTFLoader(this.loading);
    this.loading.onProgress = (url, loaded, total) => this.events?.emit('assets:progress', { url, loaded, total, progress: total ? loaded / total : 0 });
    this.loading.onError = (url) => this.events?.emit('assets:error', { url });
  }

  load(type, url) {
    const key = `${type}:${url}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const loader = { texture: this.textureLoader, audio: this.audioLoader, gltf: this.gltfLoader }[type];
    if (!loader) throw new Error(`Unsupported asset type: ${type}`);
    const promise = new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, (error) => reject(new Error(`Failed to load ${url}: ${error.message}`)));
    }).catch((error) => {
      this.cache.delete(key);
      this.events?.emit('assets:loadError', { url, error });
      throw error;
    });
    this.cache.set(key, promise);
    return promise;
  }

  clear() {
    for (const value of this.cache.values()) value.then((asset) => asset?.dispose?.()).catch(() => {});
    this.cache.clear();
  }
}
