import * as THREE from 'three';
import { buildRider, type RiderVisual } from '../models/RiderModel';
import type { RiderAppearance } from '../data/appearance';

/** Petit rendu 3D tournant du coureur, utilisé dans l'atelier. */
export class RiderPreview {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  private visual: RiderVisual | null = null;
  private pivot = new THREE.Group();
  private raf = 0;
  private last = 0;
  private angle = 0.6;
  private dragging = false;
  private lastX = 0;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x33363d, 1.15));
    const key = new THREE.DirectionalLight(0xfff2d0, 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const kc = key.shadow.camera;
    kc.near = 0.5;
    kc.far = 14;
    kc.left = -1.9;
    kc.right = 1.9;
    kc.top = 1.9;
    kc.bottom = -1.9;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0f0, 1.1);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    this.scene.add(this.pivot);

    // socle
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.8 })
    );
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    this.scene.add(disc);
  }

  mount(canvas: HTMLCanvasElement, appearance: RiderAppearance): void {
    this.canvas = canvas;
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return; // pas de WebGL disponible : on laisse le canvas vide
      }
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      // réutilisation impossible sur un autre canvas : on recrée
      this.renderer.dispose();
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    }
    this.resize();
    this.setAppearance(appearance);

    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);

    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.loop(this.last);
  }

  private onDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
  };
  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.angle -= (e.clientX - this.lastX) * 0.01;
    this.lastX = e.clientX;
  };
  private onUp = (): void => {
    this.dragging = false;
  };

  setAppearance(a: RiderAppearance): void {
    if (this.visual) {
      this.pivot.remove(this.visual.group);
      this.visual.dispose();
    }
    this.visual = buildRider(a);
    this.pivot.add(this.visual.group);
  }

  private resize(): void {
    if (!this.renderer || !this.canvas) return;
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 260;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (t: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.renderer || !this.visual) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.resize();
    if (!this.dragging) this.angle += dt * 0.35;
    this.pivot.rotation.y = this.angle;
    // pédalage lent de démonstration
    this.visual.update(dt, 5.5, 0, 0.5);

    const r = 2.45;
    this.camera.position.set(Math.sin(0.3) * r, 1.28, Math.cos(0.3) * r);
    this.camera.lookAt(0, 0.86, 0);
    this.renderer.render(this.scene, this.camera);
  };

  unmount(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas?.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas = null;
  }
}
