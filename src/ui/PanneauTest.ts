import type { StageDef, Periode, Meteo, StageType, Biome } from '../data/types';
import type { OptionsLibre } from '../race/Race';
import { TOURS } from '../data/tours';
import { creations, type TourCree } from '../data/creations';
import {
  analyser,
  genererEtape,
  genererTour,
  construireEtape,
  type ParamsEtape,
  type TourGenere
} from '../data/generateur';
import { profileSvg, TYPE_LABEL, toast } from './util';

/**
 * Onglet Test.
 *
 * Quatre ateliers derrière un même onglet : rouler sur n'importe quel
 * parcours sans conséquence, en écrire un aux curseurs, en faire écrire un
 * par une phrase, et gérer ce qu'on a créé. Rien de ce qui s'y passe ne
 * touche la carrière.
 */

export type OngletTest = 'rouler' | 'creer' | 'decrire' | 'creations';

export interface HotesTest {
  /** lance une séance libre sur une étape */
  lancer(stage: StageDef, options: OptionsLibre): void;
  /** enchaîne plusieurs étapes en séance libre */
  lancerSerie(stages: StageDef[], options: OptionsLibre): void;
  /** demande au menu de se reconstruire */
  rafraichir(): void;
}

const PERIODES: readonly (readonly [string, string])[] = [
  ['auto', "Heure de l'étape"],
  ['jour', 'Plein jour'],
  ['aube', 'Aube'],
  ['crepuscule', 'Crépuscule'],
  ['nuit', 'Nuit']
];
const METEOS: readonly (readonly [string, string])[] = [
  ['auto', "Météo de l'étape"],
  ['sec', 'Sec'],
  ['pluie', 'Pluie']
];
const TYPES: readonly (readonly [StageType, string])[] = [
  ['plaine', 'Plaine'],
  ['vallonnee', 'Vallonnée'],
  ['montagne', 'Montagne'],
  ['clm', 'Chrono']
];

const EXEMPLES = [
  'une étape de montagne avec arrivée au sommet',
  'un final au bord de la mer sous la pluie',
  'une classique pavée dans le vent',
  'une étape de nuit dans le sud',
  'un chrono court et nerveux',
  'une longue étape vallonnée à l’aube'
];

function chips(
  valeurs: readonly (readonly [string, string])[],
  actif: string,
  attr: string
): string {
  return valeurs
    .map(
      ([v, l]) =>
        `<button class="chip ${actif === v ? 'active' : ''}" data-${attr}="${v}">${l}</button>`
    )
    .join('');
}

export class PanneauTest {
  private hote: HotesTest;
  private onglet: OngletTest = 'rouler';

  /* ---- séance libre ---- */
  private source: 'jeu' | 'mes' = 'jeu';
  private tourId = TOURS[0].id;
  private stageId = TOURS[0].stages[0].id;
  private creationId = '';
  private periode: 'auto' | Periode = 'auto';
  private meteo: 'auto' | Meteo = 'auto';
  private seul = false;
  private sansFatigue = true;

  /* ---- créateur ---- */
  private params: ParamsEtape = {
    nom: '',
    type: 'vallonnee',
    longueur: 1,
    km: 165,
    seed: Math.floor(Math.random() * 90000) + 11,
    biome: 'tempere',
    mer: false,
    arriveeSommet: false,
    paves: false,
    vent: false
  };
  private apercuCree: StageDef | null = null;

  /* ---- générateur ---- */
  private texte = EXEMPLES[0];
  private nbEtapesTour = 5;
  private apercuGenere: StageDef | null = null;
  private apercuTour: TourGenere | null = null;

  /* ---- créations ---- */
  private tourOuvert = '';

  constructor(hote: HotesTest) {
    this.hote = hote;
  }

  /* ================================================================ */
  /* rendu                                                             */
  /* ================================================================ */

  render(): string {
    const onglets: readonly (readonly [OngletTest, string])[] = [
      ['rouler', 'Rouler & explorer'],
      ['creer', 'Créer un parcours'],
      ['decrire', 'Décrire une idée'],
      ['creations', `Mes créations (${creations.etapes().length})`]
    ];
    return `
      <div class="panel-params panel-test">
        <div class="test-onglets">
          ${onglets
            .map(
              ([id, l]) =>
                `<button class="test-onglet ${this.onglet === id ? 'active' : ''}" data-test-onglet="${id}">${l}</button>`
            )
            .join('')}
        </div>
        ${
          this.onglet === 'rouler'
            ? this.rendreRouler()
            : this.onglet === 'creer'
              ? this.rendreCreer()
              : this.onglet === 'decrire'
                ? this.rendreDecrire()
                : this.rendreCreations()
        }
      </div>`;
  }

  /* ---------------- rouler & explorer ---------------- */

  /** étape actuellement choisie dans l'onglet « rouler » */
  private etapeChoisie(): StageDef | null {
    if (this.source === 'mes') {
      return creations.etape(this.creationId) ?? creations.etapes()[0] ?? null;
    }
    const t = TOURS.find((x) => x.id === this.tourId) ?? TOURS[0];
    return t.stages.find((s) => s.id === this.stageId) ?? t.stages[0];
  }

  private rendreRouler(): string {
    const etape = this.etapeChoisie();
    const tour = TOURS.find((t) => t.id === this.tourId) ?? TOURS[0];
    const mes = creations.etapes();

    return `
      <div class="perso-block">
        <h3>Séance libre <small>rien n'est enregistré</small></h3>
        <p class="hint">
          Roule sur n'importe quel parcours, ou décolle et va voir le paysage
          de près : la touche <b>V</b> détache la caméra du coureur, et la
          course se met en pause tant que tu voles. <b>Échap</b> (ou <b>B</b> à
          la manette) ramène au menu.
        </p>
      </div>

      <div class="perso-block">
        <h3>Parcours</h3>
        <div class="chip-row">
          ${chips(
            [
              ['jeu', 'Étapes du jeu'],
              ['mes', `Mes créations (${mes.length})`]
            ],
            this.source,
            'test-source'
          )}
        </div>
        ${
          this.source === 'jeu'
            ? `<div class="chip-row">${chips(TOURS.map((t) => [t.id, t.name] as const), tour.id, 'test-tour')}</div>
               <div class="chip-row">${chips(
                 tour.stages.map((s) => [s.id, `${TYPE_LABEL[s.type]} · ${s.name}`] as const),
                 etape?.id ?? '',
                 'test-etape'
               )}</div>`
            : mes.length
              ? `<div class="chip-row">${chips(
                  mes.map((s) => [s.id, `${TYPE_LABEL[s.type]} · ${s.name}`] as const),
                  etape?.id ?? '',
                  'test-creation'
                )}</div>`
              : `<p class="hint">Aucune création pour l'instant. Passe par <b>Créer un parcours</b> ou <b>Décrire une idée</b>.</p>`
        }
        ${
          etape
            ? `<div class="test-apercu">
                 ${profileSvg(etape, 420, 74)}
                 <p class="hint">${etape.description}</p>
               </div>`
            : ''
        }
      </div>

      <div class="perso-block">
        <h3>Conditions</h3>
        <div class="chip-row">${chips(PERIODES, this.periode, 'test-periode')}</div>
        <div class="chip-row">${chips(METEOS, this.meteo, 'test-meteo')}</div>
        <div class="chip-row">
          ${chips(
            [
              ['peloton', 'Avec le peloton'],
              ['seul', 'Seul sur la route']
            ],
            this.seul ? 'seul' : 'peloton',
            'test-adv'
          )}
        </div>
        <div class="chip-row">
          ${chips(
            [
              ['oui', 'Énergie illimitée'],
              ['non', 'Fatigue normale']
            ],
            this.sansFatigue ? 'oui' : 'non',
            'test-fatigue'
          )}
        </div>
      </div>

      <div class="test-lancements">
        <button class="btn-primary grand" data-action="test-rouler" ${etape ? '' : 'disabled'}>
          Rouler<small>${etape ? `${etape.name} · ${etape.displayKm} km` : '—'}</small>
        </button>
        <button class="btn-primary grand secondaire" data-action="test-explorer" ${etape ? '' : 'disabled'}>
          Explorer en vol libre<small>caméra libre, course en pause</small>
        </button>
        <button class="btn-primary grand secondaire" data-action="test-atelier" ${etape ? '' : 'disabled'}>
          Ouvrir l'atelier<small>poser des objets sur la carte</small>
        </button>
      </div>`;
  }

  /* ---------------- créateur ---------------- */

  private rendreCreer(): string {
    const p = this.params;
    const apercu = this.apercuCree ?? this.construire();
    return `
      <div class="perso-block">
        <h3>Créer un parcours</h3>
        <p class="hint">
          Choisis le terrain et l'ambiance, puis relance le tirage jusqu'à ce
          que le profil te plaise. Le reste — cols, sprints, paysages
          traversés — s'écrit tout seul autour de tes réglages.
        </p>
      </div>

      <div class="perso-block">
        <h3>Identité</h3>
        <label class="field">
          <span>Nom de l'étape</span>
          <input type="text" id="creer-nom" maxlength="42" placeholder="laisse vide pour un nom inventé" value="${p.nom.replace(/"/g, '&quot;')}" />
        </label>
        <div class="chip-row">${chips(TYPES, p.type, 'creer-type')}</div>
      </div>

      <div class="perso-block">
        <h3>Format</h3>
        <label class="atl-reglage">
          <span>Longueur du parcours <b>${Math.round(p.longueur * 100)} %</b></span>
          <input type="range" id="creer-longueur" min="0.6" max="1.6" step="0.05" value="${p.longueur}" />
        </label>
        <label class="atl-reglage">
          <span>Distance affichée <b>${p.km} km</b></span>
          <input type="range" id="creer-km" min="15" max="280" step="1" value="${p.km}" />
        </label>
      </div>

      <div class="perso-block">
        <h3>Ambiance</h3>
        <div class="chip-row">${chips(PERIODES, p.periode ?? 'auto', 'creer-periode')}</div>
        <div class="chip-row">${chips(METEOS, p.meteo ?? 'auto', 'creer-meteo')}</div>
        <div class="chip-row">
          ${chips(
            [
              ['tempere', 'Région tempérée'],
              ['mediterraneen', 'Région méditerranéenne']
            ],
            p.biome,
            'creer-biome'
          )}
        </div>
      </div>

      <div class="perso-block">
        <h3>Ingrédients</h3>
        <div class="chip-row">
          <button class="chip ${p.mer ? 'active' : ''}" data-creer-bascule="mer">Bord de mer</button>
          <button class="chip ${p.arriveeSommet ? 'active' : ''}" data-creer-bascule="sommet">Arrivée au sommet</button>
          <button class="chip ${p.paves ? 'active' : ''}" data-creer-bascule="paves">Secteurs pavés</button>
          <button class="chip ${p.vent ? 'active' : ''}" data-creer-bascule="vent">Zone de bordures</button>
        </div>
      </div>

      <div class="perso-block">
        <h3>Aperçu <small>graine ${p.seed}</small></h3>
        ${this.carteEtape(apercu)}
        <div class="chip-row">
          <button class="chip" data-action="creer-retirage">Autre tirage</button>
        </div>
      </div>

      <div class="test-lancements">
        <button class="btn-primary grand" data-action="creer-enregistrer">
          Enregistrer<small>dans mes créations</small>
        </button>
        <button class="btn-primary grand secondaire" data-action="creer-essayer">
          Essayer tout de suite<small>séance libre</small>
        </button>
        <button class="btn-primary grand secondaire" data-action="creer-atelier">
          Enregistrer et meubler<small>ouvre l'atelier</small>
        </button>
      </div>`;
  }

  /** étape correspondant aux réglages courants */
  private construire(): StageDef {
    this.apercuCree = construireEtape(this.params);
    return this.apercuCree;
  }

  /* ---------------- générateur ---------------- */

  private rendreDecrire(): string {
    const lu = analyser(this.texte);
    return `
      <div class="perso-block">
        <h3>Décrire une idée</h3>
        <p class="hint">
          Écris ce que tu veux voir, en français : « une étape de montagne au
          bord de la mer, la nuit, avec arrivée au sommet ». Le jeu lit les
          mots qu'il connaît et en tire un parcours cohérent — ou un tour
          entier.
        </p>
        <label class="field">
          <span>Ta description</span>
          <input type="text" id="gen-texte" maxlength="180" value="${this.texte.replace(/"/g, '&quot;')}" />
        </label>
        <div class="chip-row">
          ${EXEMPLES.map((e, i) => `<button class="chip" data-gen-exemple="${i}">${e}</button>`).join('')}
        </div>
        <p class="hint">
          Compris : <b>${TYPE_LABEL[lu.type]}</b>${lu.mer ? ', bord de mer' : ''}${lu.biome === 'mediterraneen' ? ', région du sud' : ''}${lu.paves ? ', pavés' : ''}${lu.vent ? ', bordures' : ''}${lu.periode ? `, ${lu.periode}` : ''}${lu.meteo === 'pluie' ? ', pluie' : ''}${lu.arriveeSommet ? ', arrivée au sommet' : ''}.
          ${lu.reconnus.length ? `<br /><small>Mots reconnus : ${lu.reconnus.join(', ')}</small>` : '<br /><small>Aucun mot-clé reconnu : étape de plaine par défaut.</small>'}
        </p>
        <div class="chip-row">
          <button class="chip actif-fort" data-action="gen-etape">Générer une étape</button>
          <button class="chip actif-fort" data-action="gen-tour">Générer un tour</button>
          ${chips(
            [3, 5, 7, 9].map((n) => [String(n), `${n} étapes`] as const),
            String(this.nbEtapesTour),
            'gen-nb'
          )}
        </div>
      </div>

      ${
        this.apercuGenere
          ? `<div class="perso-block">
               <h3>Étape générée</h3>
               ${this.carteEtape(this.apercuGenere)}
               <div class="test-lancements">
                 <button class="btn-primary grand" data-action="gen-enregistrer">Enregistrer</button>
                 <button class="btn-primary grand secondaire" data-action="gen-essayer">Essayer</button>
                 <button class="btn-primary grand secondaire" data-action="gen-etape">Relancer</button>
               </div>
             </div>`
          : ''
      }
      ${
        this.apercuTour
          ? `<div class="perso-block">
               <h3>${this.apercuTour.name} <small>${this.apercuTour.region}</small></h3>
               <div class="test-liste">
                 ${this.apercuTour.stages.map((s, i) => this.carteEtape(s, i + 1)).join('')}
               </div>
               <div class="test-lancements">
                 <button class="btn-primary grand" data-action="gen-tour-enregistrer">Enregistrer le tour</button>
                 <button class="btn-primary grand secondaire" data-action="gen-tour-essayer">Enchaîner les étapes</button>
                 <button class="btn-primary grand secondaire" data-action="gen-tour">Relancer</button>
               </div>
             </div>`
          : ''
      }`;
  }

  /* ---------------- mes créations ---------------- */

  private rendreCreations(): string {
    const etapes = creations.etapes();
    const tours = creations.tours();
    return `
      <div class="perso-block">
        <h3>Mes créations</h3>
        <p class="hint">
          Tes parcours sont enregistrés dans ce navigateur. Exporte-les pour
          les garder ou les partager : le fichier se réimporte ici, et sur
          n'importe quelle autre machine.
        </p>
        <div class="chip-row">
          <button class="chip" data-action="cre-exporter">Exporter tout</button>
          <button class="chip" data-action="cre-importer">Importer un fichier</button>
          <button class="chip" data-action="cre-nouveau-tour">Nouveau tour</button>
          ${etapes.length ? '<button class="chip danger" data-action="cre-tout-effacer">Tout effacer</button>' : ''}
        </div>
      </div>

      ${
        tours.length
          ? `<div class="perso-block">
               <h3>Mes tours</h3>
               ${tours.map((t) => this.carteTour(t, etapes)).join('')}
             </div>`
          : ''
      }

      <div class="perso-block">
        <h3>Mes étapes <small>${etapes.length}</small></h3>
        ${
          etapes.length
            ? `<div class="test-liste">${etapes.map((s) => this.carteEtape(s, undefined, true)).join('')}</div>`
            : `<p class="hint">Rien encore. Va dans <b>Créer un parcours</b> ou <b>Décrire une idée</b>.</p>`
        }
      </div>`;
  }

  private carteTour(t: TourCree, etapes: StageDef[]): string {
    const ouvert = this.tourOuvert === t.id;
    const dedans = t.etapes.map((id) => etapes.find((e) => e.id === id)).filter(Boolean) as StageDef[];
    const dehors = etapes.filter((e) => !t.etapes.includes(e.id));
    return `
      <div class="test-tour ${ouvert ? 'ouvert' : ''}">
        <div class="test-tour-tete">
          <button class="test-tour-nom" data-cre-tour="${t.id}">${t.name}</button>
          <span class="stage-meta">${t.region} · ${dedans.length} étape${dedans.length > 1 ? 's' : ''}</span>
          <button class="chip" data-cre-tour-jouer="${t.id}" ${dedans.length ? '' : 'disabled'}>Enchaîner</button>
          <button class="chip danger" data-cre-tour-suppr="${t.id}">Supprimer</button>
        </div>
        ${
          ouvert
            ? `<div class="test-tour-corps">
                 <ol class="test-tour-liste">
                   ${dedans
                     .map(
                       (s, i) =>
                         `<li><span>${i + 1}. ${s.name}</span>
                            <span class="stage-meta">${TYPE_LABEL[s.type]} · ${s.displayKm} km</span>
                            <button class="chip" data-cre-tour-monter="${t.id}|${s.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
                            <button class="chip" data-cre-tour-retirer="${t.id}|${s.id}">Retirer</button>
                          </li>`
                     )
                     .join('') || '<li class="stage-meta">Tour vide.</li>'}
                 </ol>
                 ${
                   dehors.length
                     ? `<div class="chip-row">${dehors
                         .map(
                           (s) =>
                             `<button class="chip" data-cre-tour-ajouter="${t.id}|${s.id}">+ ${s.name}</button>`
                         )
                         .join('')}</div>`
                     : '<p class="hint">Toutes tes étapes sont déjà dans ce tour.</p>'
                 }
               </div>`
            : ''
        }
      </div>`;
  }

  /** carte d'étape : profil, résumé, et actions quand elle nous appartient */
  private carteEtape(s: StageDef, numero?: number, gestion = false): string {
    const cols = s.climbs?.length ?? 0;
    const tags = [
      TYPE_LABEL[s.type],
      `${s.displayKm} km`,
      cols ? `${cols} col${cols > 1 ? 's' : ''}` : '',
      s.paves?.length ? 'pavés' : '',
      s.vent?.length ? 'bordures' : '',
      s.mer ? 'mer' : '',
      s.periode && s.periode !== 'jour' ? s.periode : '',
      s.meteo === 'pluie' ? 'pluie' : ''
    ].filter(Boolean);
    return `
      <div class="test-carte">
        <div class="test-carte-tete">
          <b>${numero ? `${numero}. ` : ''}${s.name}</b>
          <span class="stage-meta">${tags.join(' · ')}</span>
        </div>
        ${profileSvg(s, 420, 66)}
        <p class="stage-desc">${s.description}</p>
        ${
          gestion
            ? `<div class="chip-row">
                 <button class="chip" data-cre-rouler="${s.id}">Rouler</button>
                 <button class="chip" data-cre-explorer="${s.id}">Explorer</button>
                 <button class="chip" data-cre-atelier="${s.id}">Atelier</button>
                 <button class="chip" data-cre-dupliquer="${s.id}">Dupliquer</button>
                 <button class="chip danger" data-cre-supprimer="${s.id}">Supprimer</button>
                 ${s.objets?.length ? `<span class="stage-meta">${s.objets.length} objet(s) posé(s)</span>` : ''}
               </div>`
            : ''
        }
      </div>`;
  }

  /* ================================================================ */
  /* liaison                                                           */
  /* ================================================================ */

  private options(extra: Partial<OptionsLibre> = {}): OptionsLibre {
    return {
      seul: this.seul,
      sansFatigue: this.sansFatigue,
      explorer: false,
      atelier: false,
      ...extra
    };
  }

  /** applique heure et météo forcées : ce sont des champs de l'étape */
  private conditionner(base: StageDef): StageDef {
    const s: StageDef = { ...base };
    if (this.periode !== 'auto') s.periode = this.periode;
    if (this.meteo !== 'auto') s.meteo = this.meteo;
    return s;
  }

  bind(root: HTMLElement): void {
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
    const tous = (sel: string, fn: (b: HTMLButtonElement) => void) =>
      root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) =>
        b.addEventListener('click', () => fn(b))
      );

    tous('[data-test-onglet]', (b) => {
      this.onglet = b.dataset.testOnglet as OngletTest;
      this.hote.rafraichir();
    });

    /* ---- rouler ---- */
    tous('[data-test-source]', (b) => {
      this.source = b.dataset.testSource as 'jeu' | 'mes';
      if (this.source === 'mes' && !creations.etape(this.creationId)) {
        this.creationId = creations.etapes()[0]?.id ?? '';
      }
      this.hote.rafraichir();
    });
    tous('[data-test-tour]', (b) => {
      this.tourId = b.dataset.testTour!;
      this.stageId = (TOURS.find((t) => t.id === this.tourId) ?? TOURS[0]).stages[0].id;
      this.hote.rafraichir();
    });
    tous('[data-test-etape]', (b) => {
      this.stageId = b.dataset.testEtape!;
      this.hote.rafraichir();
    });
    tous('[data-test-creation]', (b) => {
      this.creationId = b.dataset.testCreation!;
      this.hote.rafraichir();
    });
    tous('[data-test-periode]', (b) => {
      this.periode = b.dataset.testPeriode as 'auto' | Periode;
      this.hote.rafraichir();
    });
    tous('[data-test-meteo]', (b) => {
      this.meteo = b.dataset.testMeteo as 'auto' | Meteo;
      this.hote.rafraichir();
    });
    tous('[data-test-adv]', (b) => {
      this.seul = b.dataset.testAdv === 'seul';
      this.hote.rafraichir();
    });
    tous('[data-test-fatigue]', (b) => {
      this.sansFatigue = b.dataset.testFatigue === 'oui';
      this.hote.rafraichir();
    });

    const lancerChoisie = (extra: Partial<OptionsLibre>) => {
      const e = this.etapeChoisie();
      if (e) this.hote.lancer(this.conditionner(e), this.options(extra));
    };
    q<HTMLButtonElement>('[data-action="test-rouler"]')?.addEventListener('click', () =>
      lancerChoisie({})
    );
    q<HTMLButtonElement>('[data-action="test-explorer"]')?.addEventListener('click', () =>
      lancerChoisie({ explorer: true, seul: true })
    );
    q<HTMLButtonElement>('[data-action="test-atelier"]')?.addEventListener('click', () =>
      lancerChoisie({ explorer: true, atelier: true, seul: true })
    );

    /* ---- créateur ---- */
    const nom = q<HTMLInputElement>('#creer-nom');
    nom?.addEventListener('change', () => {
      this.params.nom = nom.value.trim();
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    tous('[data-creer-type]', (b) => {
      this.params.type = b.dataset.creerType as StageType;
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    tous('[data-creer-periode]', (b) => {
      const v = b.dataset.creerPeriode!;
      this.params.periode = v === 'auto' ? undefined : (v as Periode);
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    tous('[data-creer-meteo]', (b) => {
      const v = b.dataset.creerMeteo!;
      this.params.meteo = v === 'auto' ? undefined : (v as Meteo);
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    tous('[data-creer-biome]', (b) => {
      this.params.biome = b.dataset.creerBiome as Biome;
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    tous('[data-creer-bascule]', (b) => {
      const k = b.dataset.creerBascule!;
      if (k === 'mer') this.params.mer = !this.params.mer;
      if (k === 'sommet') this.params.arriveeSommet = !this.params.arriveeSommet;
      if (k === 'paves') this.params.paves = !this.params.paves;
      if (k === 'vent') this.params.vent = !this.params.vent;
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    const longueur = q<HTMLInputElement>('#creer-longueur');
    longueur?.addEventListener('change', () => {
      this.params.longueur = Number(longueur.value);
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    const km = q<HTMLInputElement>('#creer-km');
    km?.addEventListener('change', () => {
      this.params.km = Number(km.value);
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="creer-retirage"]')?.addEventListener('click', () => {
      this.params.seed = Math.floor(Math.random() * 90000) + 11;
      this.apercuCree = null;
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="creer-enregistrer"]')?.addEventListener('click', () => {
      const s = creations.enregistrer(this.apercuCree ?? this.construire());
      toast(`« ${s.name} » enregistrée`);
      this.apercuCree = null;
      this.params.seed = Math.floor(Math.random() * 90000) + 11;
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="creer-essayer"]')?.addEventListener('click', () => {
      this.hote.lancer(this.apercuCree ?? this.construire(), this.options());
    });
    q<HTMLButtonElement>('[data-action="creer-atelier"]')?.addEventListener('click', () => {
      const s = creations.enregistrer(this.apercuCree ?? this.construire());
      this.hote.lancer(s, this.options({ explorer: true, atelier: true, seul: true }));
    });

    /* ---- générateur ---- */
    const texte = q<HTMLInputElement>('#gen-texte');
    texte?.addEventListener('change', () => {
      this.texte = texte.value;
      this.hote.rafraichir();
    });
    tous('[data-gen-exemple]', (b) => {
      this.texte = EXEMPLES[Number(b.dataset.genExemple)];
      this.hote.rafraichir();
    });
    tous('[data-gen-nb]', (b) => {
      this.nbEtapesTour = Number(b.dataset.genNb);
      this.hote.rafraichir();
    });
    tous('[data-action="gen-etape"]', () => {
      this.texte = texte?.value ?? this.texte;
      this.apercuGenere = genererEtape(this.texte);
      this.apercuTour = null;
      this.hote.rafraichir();
    });
    tous('[data-action="gen-tour"]', () => {
      this.texte = texte?.value ?? this.texte;
      this.apercuTour = genererTour(this.texte, this.nbEtapesTour);
      this.apercuGenere = null;
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="gen-enregistrer"]')?.addEventListener('click', () => {
      if (!this.apercuGenere) return;
      creations.enregistrer(this.apercuGenere);
      toast(`« ${this.apercuGenere.name} » enregistrée`);
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="gen-essayer"]')?.addEventListener('click', () => {
      if (this.apercuGenere) this.hote.lancer(this.apercuGenere, this.options());
    });
    q<HTMLButtonElement>('[data-action="gen-tour-enregistrer"]')?.addEventListener('click', () => {
      const t = this.apercuTour;
      if (!t) return;
      const ids = t.stages.map((s) => creations.enregistrer(s).id);
      creations.creerTour(t.name, t.region, ids);
      toast(`« ${t.name} » enregistré — ${ids.length} étapes`);
      this.apercuTour = null;
      this.onglet = 'creations';
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="gen-tour-essayer"]')?.addEventListener('click', () => {
      if (this.apercuTour) this.hote.lancerSerie(this.apercuTour.stages, this.options());
    });

    /* ---- créations ---- */
    tous('[data-cre-rouler]', (b) => {
      const s = creations.etape(b.dataset.creRouler!);
      if (s) this.hote.lancer(this.conditionner(s), this.options());
    });
    tous('[data-cre-explorer]', (b) => {
      const s = creations.etape(b.dataset.creExplorer!);
      if (s) this.hote.lancer(this.conditionner(s), this.options({ explorer: true, seul: true }));
    });
    tous('[data-cre-atelier]', (b) => {
      const s = creations.etape(b.dataset.creAtelier!);
      if (s) {
        this.hote.lancer(
          this.conditionner(s),
          this.options({ explorer: true, atelier: true, seul: true })
        );
      }
    });
    tous('[data-cre-dupliquer]', (b) => {
      creations.dupliquer(b.dataset.creDupliquer!);
      this.hote.rafraichir();
    });
    tous('[data-cre-supprimer]', (b) => {
      const s = creations.etape(b.dataset.creSupprimer!);
      if (s && confirm(`Supprimer « ${s.name} » ?`)) {
        creations.supprimer(s.id);
        this.hote.rafraichir();
      }
    });
    tous('[data-cre-tour]', (b) => {
      this.tourOuvert = this.tourOuvert === b.dataset.creTour ? '' : b.dataset.creTour!;
      this.hote.rafraichir();
    });
    tous('[data-cre-tour-suppr]', (b) => {
      creations.supprimerTour(b.dataset.creTourSuppr!);
      this.hote.rafraichir();
    });
    tous('[data-cre-tour-jouer]', (b) => {
      const d = creations.tourDef(b.dataset.creTourJouer!);
      if (d) this.hote.lancerSerie(d.stages, this.options());
    });
    const paire = (v: string) => v.split('|');
    tous('[data-cre-tour-ajouter]', (b) => {
      const [tid, sid] = paire(b.dataset.creTourAjouter!);
      const t = creations.tours().find((x) => x.id === tid);
      if (t && !t.etapes.includes(sid)) {
        t.etapes.push(sid);
        creations.majTour(t);
        this.hote.rafraichir();
      }
    });
    tous('[data-cre-tour-retirer]', (b) => {
      const [tid, sid] = paire(b.dataset.creTourRetirer!);
      const t = creations.tours().find((x) => x.id === tid);
      if (t) {
        t.etapes = t.etapes.filter((e) => e !== sid);
        creations.majTour(t);
        this.hote.rafraichir();
      }
    });
    tous('[data-cre-tour-monter]', (b) => {
      const [tid, sid] = paire(b.dataset.creTourMonter!);
      const t = creations.tours().find((x) => x.id === tid);
      const i = t?.etapes.indexOf(sid) ?? -1;
      if (t && i > 0) {
        [t.etapes[i - 1], t.etapes[i]] = [t.etapes[i], t.etapes[i - 1]];
        creations.majTour(t);
        this.hote.rafraichir();
      }
    });
    q<HTMLButtonElement>('[data-action="cre-nouveau-tour"]')?.addEventListener('click', () => {
      const nom = prompt('Nom du tour ?', 'Mon tour');
      if (!nom) return;
      const t = creations.creerTour(nom, prompt('Région ?', 'Pays inventé') ?? '', []);
      this.tourOuvert = t.id;
      this.hote.rafraichir();
    });
    q<HTMLButtonElement>('[data-action="cre-exporter"]')?.addEventListener('click', () => {
      const blob = new Blob([creations.exporter()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'echappee-creations.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    q<HTMLButtonElement>('[data-action="cre-importer"]')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', async () => {
        const f = input.files?.[0];
        if (!f) return;
        try {
          const r = creations.importer(await f.text());
          toast(`${r.etapes} étape(s) et ${r.tours} tour(s) importés`);
        } catch {
          toast('Fichier de créations illisible');
        }
        this.hote.rafraichir();
      });
      input.click();
    });
    q<HTMLButtonElement>('[data-action="cre-tout-effacer"]')?.addEventListener('click', () => {
      if (confirm('Effacer toutes tes créations ? Cette action est définitive.')) {
        creations.toutEffacer();
        this.hote.rafraichir();
      }
    });
  }
}
