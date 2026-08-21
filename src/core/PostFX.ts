import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Post-traitement léger : un bloom discret sur le soleil et les reflets, et
 * un vignettage à peine perceptible. Rien de spectaculaire — le jeu reste
 * volontairement stylisé, ce n'est qu'un léger supplément d'ambiance.
 *
 * Réservé aux qualités élevée et moyenne (voir Quality.ts) : l'EffectComposer
 * ajoute une passe de rendu complète en plus de la scène, ce que les machines
 * modestes ou un navigateur de console n'ont pas à payer.
 */

const VIGNETTE_SHADER = {
  uniforms: { tDiffuse: { value: null }, intensite: { value: 0.28 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float intensite;
    varying vec2 vUv;
    void main() {
      vec4 couleur = texture2D(tDiffuse, vUv);
      vec2 centre = vUv - 0.5;
      float dist = length(centre) * 1.35;
      float assombri = smoothstep(0.35, 1.1, dist) * intensite;
      gl_FragColor = vec4(couleur.rgb * (1.0 - assombri), couleur.a);
    }
  `
};

export class PostFX {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.Camera());
    this.composer.addPass(this.renderPass);

    // seuil élevé : seuls le soleil, le ciel et les surfaces vitrées très
    // claires dépassent — un bloom qui prendrait toute la scène en blanc
    // écraserait le style plutôt que de le souligner
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.45, 0.86);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new ShaderPass(VIGNETTE_SHADER));
    // reconvertit en sRGB avec le tone mapping du renderer : sans cette passe
    // finale, l'image composée reste en espace linéaire et paraît délavée
    this.composer.addPass(new OutputPass());

    this.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
