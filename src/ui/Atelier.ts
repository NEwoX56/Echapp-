import type { Race } from '../race/Race';
import {
  CATALOGUE,
  LIBELLE_CATEGORIE,
  modele,
  type CategorieObjet
} from '../monde/Catalogue';
import { preparerVignettes, vignette } from '../monde/Vignettes';

/**
 * Atelier de terrain.
 *
 * L'interface qui accompagne le vol libre : où l'on est sur le parcours, à
 * quelle vitesse on se déplace, et — quand l'édition est ouverte — la
 * palette d'objets à poser. Elle est volontairement posée sur les bords :
 * l'intérêt du mode est de regarder le paysage, pas le panneau.
 */

export interface ActionsAtelier {
  /** reprendre le vélo */
  rouler(): void;
  /** enregistrer les objets posés dans la création */
  enregistrer(): void;
  /** revenir au menu */
  quitter(): void;
}

export class Atelier {
  private root: HTMLElement;
  private race: Race | null = null;
  private actions: ActionsAtelier | null = null;
  private categorie: CategorieObjet = 'nature';
  private edition = false;
  private replie = false;
  private titre = '';
  /** dernier libellé affiché, pour ne réécrire le DOM que s'il change */
  private derniereLigne = '';
  /** dernier état connu de la palette, pour suivre les réglages faits à la manette */
  private dernierModele = '';
  private dernierReglage = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'screen-atelier';
    this.root.className = 'screen hidden';
    parent.appendChild(this.root);
  }

  ouvrir(race: Race, actions: ActionsAtelier, opts: { edition: boolean; titre: string }): void {
    this.race = race;
    this.actions = actions;
    this.edition = opts.edition;
    this.titre = opts.titre;
    this.construire();
  }

  fermer(): void {
    this.race = null;
    this.actions = null;
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v || !this.race);
  }

  /* ---------------------------------------------------------------- */

  private construire(): void {
    const r = this.race;
    if (!r) return;
    this.root.innerHTML = `
      <div class="atelier">
        <div class="atl-bandeau">
          <span class="atl-mode">${this.edition ? 'Atelier' : 'Vol libre'}</span>
          <span class="atl-titre">${this.titre}</span>
          <span class="atl-info" id="atl-ligne">—</span>
          <span class="atl-sep"></span>
          <button class="atl-btn" data-atl="rouler">Rouler <kbd>V</kbd></button>
          ${this.edition ? '<button class="atl-btn primaire" data-atl="enregistrer">Enregistrer</button>' : ''}
          <button class="atl-btn" data-atl="quitter">Quitter <kbd>Échap</kbd></button>
        </div>

        <div class="atl-flanc ${this.replie ? 'replie' : ''}" id="atl-flanc">
          <button class="atl-poignee" data-atl="replier" title="Replier le panneau">${this.replie ? '›' : '‹'}</button>
          <div class="atl-flanc-corps">
            ${this.edition ? this.rendrePalette() : this.rendreVisite()}
            ${this.rendreDeplacement()}
          </div>
        </div>

        <div class="atl-aide">
          <b>ZQSD</b> ou <b>flèches</b> se déplacer · <b>Espace/Maj</b> monter, descendre ·
          <b>glisser la souris</b> regarder · <b>molette</b> vitesse · <b>T</b> turbo
          ${this.edition ? ' · <b>clic</b> ou <b>A</b> poser · <b>X</b> retirer · <b>R</b> pivoter · <b>+/-</b> taille · <b>LB/RB</b> changer de modèle' : ''}
        </div>
      </div>`;
    this.brancher();
  }

  private rendreVisite(): string {
    return `
      <div class="atl-bloc">
        <h4>Visite libre</h4>
        <p class="atl-hint">
          La course est en pause tant que la caméra vole : personne n'avance,
          rien ne se termine dans ton dos. Reprends le vélo quand tu veux.
        </p>
      </div>`;
  }

  private rendrePalette(): string {
    preparerVignettes();
    const cats = Object.keys(LIBELLE_CATEGORIE) as CategorieObjet[];
    const modeles = CATALOGUE.filter((m) => m.categorie === this.categorie);
    const r = this.race!;
    return `
      <div class="atl-bloc">
        <h4>Palette</h4>
        <div class="atl-cats">
          ${cats
            .map(
              (c) =>
                `<button class="atl-cat ${c === this.categorie ? 'active' : ''}" data-atl-cat="${c}">${LIBELLE_CATEGORIE[c]}</button>`
            )
            .join('')}
        </div>
        <div class="atl-grille">
          ${modeles
            .map(
              (m) =>
                `<button class="atl-modele ${m.id === r.atelierType ? 'active' : ''}" data-atl-modele="${m.id}">
                   ${vignette(m.id) ? `<img src="${vignette(m.id)}" alt="" />` : ''}
                   <span class="atl-modele-nom">${m.nom}</span>
                   <small>${m.hauteur} m</small>
                 </button>`
            )
            .join('')}
        </div>
      </div>

      <div class="atl-bloc">
        <h4>Réglages</h4>
        <label class="atl-reglage">
          <span>Taille <b id="atl-ech">${r.atelierEchelle.toFixed(2)}×</b></span>
          <input type="range" id="atl-echelle" min="0.25" max="4" step="0.05" value="${r.atelierEchelle}" />
        </label>
        <label class="atl-reglage">
          <span>Orientation <b id="atl-rot">${Math.round((r.atelierRotation * 180) / Math.PI)}°</b></span>
          <input type="range" id="atl-rotation" min="0" max="360" step="5" value="${Math.round((r.atelierRotation * 180) / Math.PI)}" />
        </label>
        <div class="atl-boutons">
          <button class="atl-btn" data-atl="annuler">Annuler le dernier</button>
          <button class="atl-btn danger" data-atl="vider">Tout retirer</button>
        </div>
      </div>`;
  }

  private rendreDeplacement(): string {
    const r = this.race!;
    return `
      <div class="atl-bloc">
        <h4>Se déplacer</h4>
        <label class="atl-reglage">
          <span>Point du parcours <b id="atl-pos">—</b></span>
          <input type="range" id="atl-parcours" min="0" max="1000" step="1" value="0" />
        </label>
        <div class="atl-boutons">
          <button class="atl-btn" data-atl="depart">Départ</button>
          <button class="atl-btn" data-atl="milieu">Mi-parcours</button>
          <button class="atl-btn" data-atl="arrivee">Arrivée</button>
        </div>
        <label class="atl-reglage">
          <span>Vitesse de vol <b id="atl-vit">${Math.round(r.volVitesse)} m/s</b></span>
          <input type="range" id="atl-vitesse" min="4" max="200" step="2" value="${Math.round(r.volVitesse)}" />
        </label>
      </div>`;
  }

  /* ---------------------------------------------------------------- */

  private brancher(): void {
    const r = this.race;
    const a = this.actions;
    if (!r || !a) return;
    const q = <T extends Element>(s: string) => this.root.querySelector<T>(s);

    this.root.querySelectorAll<HTMLButtonElement>('[data-atl]').forEach((b) => {
      b.addEventListener('click', () => {
        switch (b.dataset.atl) {
          case 'rouler':
            a.rouler();
            break;
          case 'enregistrer':
            a.enregistrer();
            break;
          case 'quitter':
            a.quitter();
            break;
          case 'replier':
            this.replie = !this.replie;
            this.construire();
            break;
          case 'annuler':
            r.annulerDernierObjet();
            break;
          case 'vider':
            if (confirm('Retirer tous les objets posés sur ce parcours ?')) r.viderObjets();
            break;
          case 'depart':
            r.allerA(0);
            break;
          case 'milieu':
            r.allerA(r.track.length * 0.5);
            break;
          case 'arrivee':
            r.allerA(r.track.length);
            break;
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-atl-cat]').forEach((b) => {
      b.addEventListener('click', () => {
        this.categorie = b.dataset.atlCat as CategorieObjet;
        this.construire();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-atl-modele]').forEach((b) => {
      b.addEventListener('click', () => {
        r.atelierType = b.dataset.atlModele!;
        this.root
          .querySelectorAll('[data-atl-modele]')
          .forEach((x) => x.classList.toggle('active', x === b));
      });
    });

    const ech = q<HTMLInputElement>('#atl-echelle');
    ech?.addEventListener('input', () => {
      r.atelierEchelle = Number(ech.value);
      const t = q<HTMLElement>('#atl-ech');
      if (t) t.textContent = `${r.atelierEchelle.toFixed(2)}×`;
    });
    const rot = q<HTMLInputElement>('#atl-rotation');
    rot?.addEventListener('input', () => {
      r.atelierRotation = (Number(rot.value) * Math.PI) / 180;
      const t = q<HTMLElement>('#atl-rot');
      if (t) t.textContent = `${rot.value}°`;
    });
    const vit = q<HTMLInputElement>('#atl-vitesse');
    vit?.addEventListener('input', () => {
      r.volVitesse = Number(vit.value);
      const t = q<HTMLElement>('#atl-vit');
      if (t) t.textContent = `${vit.value} m/s`;
    });
    const parcours = q<HTMLInputElement>('#atl-parcours');
    parcours?.addEventListener('input', () => {
      r.allerA((Number(parcours.value) / 1000) * r.track.length);
    });
  }

  /**
   * Rafraîchissement léger : seul le bandeau change à chaque image, et il ne
   * se réécrit que si son texte a bougé.
   */
  rafraichir(): void {
    const r = this.race;
    if (!r || this.root.classList.contains('hidden')) return;

    /*
     * Le modèle, la taille et l'orientation se changent aussi au clavier et
     * à la manette, sans passer par ce panneau. Il se remet donc à jour
     * depuis l'état réel de l'atelier plutôt que d'être la seule source de
     * vérité — sinon la palette montrerait un arbre pendant qu'on pose des
     * maisons.
     */
    if (this.edition) {
      if (r.atelierType !== this.dernierModele) {
        this.dernierModele = r.atelierType;
        const cat = modele(r.atelierType)?.categorie;
        if (cat && cat !== this.categorie) {
          this.categorie = cat;
          this.construire();
        } else {
          this.root
            .querySelectorAll<HTMLElement>('[data-atl-modele]')
            .forEach((b) => b.classList.toggle('active', b.dataset.atlModele === r.atelierType));
        }
      }
      const reglage = `${r.atelierEchelle.toFixed(2)}|${r.atelierRotation.toFixed(3)}`;
      if (reglage !== this.dernierReglage) {
        this.dernierReglage = reglage;
        const degres = Math.round(((r.atelierRotation * 180) / Math.PI) % 360);
        this.majChamp('#atl-ech', `${r.atelierEchelle.toFixed(2)}×`);
        this.majChamp('#atl-rot', `${degres}°`);
        this.majCurseur('#atl-echelle', String(r.atelierEchelle));
        this.majCurseur('#atl-rotation', String(degres));
      }
    }

    const p = r.pointSurvole;
    const km = (p.dist / r.track.length) * r.stage.displayKm;
    const ligne = `km ${km.toFixed(1)} / ${r.stage.displayKm} · ${Math.round(r.volVitesse)} m/s · ${r.nombreObjets} objet${r.nombreObjets > 1 ? 's' : ''}`;
    if (ligne !== this.derniereLigne) {
      this.derniereLigne = ligne;
      const el = this.root.querySelector<HTMLElement>('#atl-ligne');
      if (el) el.textContent = ligne;
      const pos = this.root.querySelector<HTMLElement>('#atl-pos');
      if (pos) pos.textContent = `km ${km.toFixed(1)}`;
      this.majCurseur('#atl-parcours', String(Math.round((p.dist / r.track.length) * 1000)));
      this.majCurseur('#atl-vitesse', String(Math.round(r.volVitesse)));
      this.majChamp('#atl-vit', `${Math.round(r.volVitesse)} m/s`);
    }
  }

  private majChamp(sel: string, texte: string): void {
    const el = this.root.querySelector<HTMLElement>(sel);
    if (el) el.textContent = texte;
  }

  /** n'écrase pas un curseur que le joueur est en train de manipuler */
  private majCurseur(sel: string, valeur: string): void {
    const el = this.root.querySelector<HTMLInputElement>(sel);
    if (el && document.activeElement !== el) el.value = valeur;
  }
}
