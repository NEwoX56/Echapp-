import type { Rider } from '../race/Rider';
import type { Track } from '../race/Track';
import type { StageDef } from '../data/types';

/**
 * Découpage de la course en groupes, à la manière d'une retransmission.
 *
 * Jusqu'ici le jeu ne connaissait que deux ensembles : l'échappée et le
 * peloton. Une course se fractionne en réalité en plusieurs paquets — un
 * homme seul devant, un contre-groupe, le peloton du maillot jaune, les
 * attardés. Ce sont ces paquets qu'un téléspectateur voit affichés, avec leur
 * effectif et leur retard sur la tête.
 *
 * Le regroupement se fait par distance : deux coureurs séparés de plus d'un
 * certain écart appartiennent à des groupes différents. C'est exactement le
 * critère utilisé sur la route, où l'on considère qu'un coureur est décroché
 * quand il n'a plus la roue.
 */

/**
 * Au-delà de cet écart, on change de groupe.
 *
 * Trop bas, le peloton se fragmente en une dizaine de paquets qui n'apprennent
 * rien ; trop haut, une échappée nette passe inaperçue.
 */
const SEPARATION = 34;

export interface GroupeCourse {
  /** libellé affiché : « Tête de la course », « Gr. Maillot Jaune »… */
  nom: string;
  effectif: number;
  /** retard sur la tête, en secondes affichées (0 pour le premier groupe) */
  retard: number;
  /** kilomètres restants, seulement pour le groupe de tête */
  kmRestants: number | null;
  /** distance au prochain sommet, pour le groupe de tête */
  kmSommet: number | null;
  /** le joueur est dans ce groupe */
  avecJoueur: boolean;
  /** ce groupe contient le porteur du maillot jaune */
  avecJaune: boolean;
}

/** nom de famille seul, comme sur les incrustations télévisées */
function nomCourt(nom: string): string {
  const parts = nom.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function calculerGroupes(
  riders: Rider[],
  track: Track,
  stage: StageDef,
  joueur: Rider,
  porteurJaune: string | undefined,
  facteurTemps: number,
  maxGroupes = 3
): GroupeCourse[] {
  const actifs = riders.filter((r) => !r.finished).sort((a, b) => b.dist - a.dist);
  if (!actifs.length) return [];

  /*
   * Vitesse de référence pour convertir les mètres d'écart en secondes.
   *
   * Le plancher compte : au départ, tout le monde roule à trois ou quatre
   * unités par seconde, et diviser un écart par une vitesse aussi faible
   * produisait des retards de plusieurs heures affichés dans le bandeau.
   */
  const v = Math.max(11, actifs.reduce((s, r) => s + r.speed, 0) / actifs.length);

  const paquets: Rider[][] = [[actifs[0]]];
  for (let i = 1; i < actifs.length; i++) {
    const precedent = actifs[i - 1];
    if (precedent.dist - actifs[i].dist > SEPARATION) paquets.push([actifs[i]]);
    else paquets[paquets.length - 1].push(actifs[i]);
  }

  const teteDist = paquets[0][0].dist;
  const restant = Math.max(0, track.length - teteDist);
  const kmRestants = (restant / track.length) * stage.displayKm;

  // prochain sommet devant la tête de course
  let kmSommet: number | null = null;
  let meilleur = Infinity;
  for (const c of track.climbs) {
    const d = c.dist - teteDist;
    if (d > 0 && d < meilleur) meilleur = d;
  }
  if (Number.isFinite(meilleur)) kmSommet = (meilleur / track.length) * stage.displayKm;

  const groupes: GroupeCourse[] = paquets.map((p, i) => {
    const avecJoueur = p.includes(joueur);
    const avecJaune = !!porteurJaune && p.some((r) => r.id === porteurJaune);
    let nom: string;
    if (i === 0) nom = 'Tête de la course';
    else if (avecJaune) nom = 'Gr. Maillot Jaune';
    else if (avecJoueur) nom = 'Ton groupe';
    else nom = `Gr. ${nomCourt(p[0].name)}`;

    return {
      nom,
      effectif: p.length,
      // plafonné à une heure : au-delà, un écart n'a plus de sens en course
      retard: i === 0 ? 0 : Math.min(3600, ((teteDist - p[0].dist) / v) * facteurTemps),
      kmRestants: i === 0 ? kmRestants : null,
      kmSommet: i === 0 ? kmSommet : null,
      avecJoueur,
      avecJaune
    };
  });

  /*
   * On ne garde que les groupes qui comptent : la tête, celui du maillot
   * jaune, celui du joueur, puis les plus fournis. Afficher huit paquets
   * remplirait l'écran sans rien apprendre.
   */
  if (groupes.length <= maxGroupes) return groupes;
  const retenus = [groupes[0]];
  const reste = groupes.slice(1);
  for (const g of reste) {
    if ((g.avecJaune || g.avecJoueur) && retenus.length < maxGroupes) retenus.push(g);
  }
  for (const g of reste.sort((a, b) => b.effectif - a.effectif)) {
    if (retenus.length >= maxGroupes) break;
    if (!retenus.includes(g)) retenus.push(g);
  }
  return retenus.sort((a, b) => a.retard - b.retard);
}

/* ------------------------------------------------------------------ */
/* Emblèmes des grands tours                                          */
/* ------------------------------------------------------------------ */

/**
 * Chaque tour a son emblème, dessiné en SVG et donc net à toute taille.
 * Ce sont des créations originales pour les épreuves du jeu : sommet pour le
 * Tour des Cimes, vague pour la Ronde du Littoral, chaîne traversée pour la
 * Grande Traversée, couronne pour La Couronne, soleil sur les collines pour
 * le Tour du Midi.
 */
export function logoTour(tourId: string): string {
  const cadre = (contenu: string, fond: string) => `
    <svg viewBox="0 0 56 56" width="100%" height="100%" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#15161a" stroke="${fond}" stroke-width="2.5"/>
      ${contenu}
    </svg>`;

  switch (tourId) {
    case 'littoral':
      return cadre(
        `<path d="M11 34 Q17 27 23 34 T35 34 T47 34" fill="none" stroke="#3fa9f5" stroke-width="3" stroke-linecap="round"/>
         <path d="M11 41 Q17 34 23 41 T35 41 T47 41" fill="none" stroke="#1fb8a6" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>
         <circle cx="28" cy="19" r="6" fill="#ffd633"/>`,
        '#3fa9f5'
      );
    case 'traversee':
      return cadre(
        `<path d="M8 40 L20 22 L28 32 L37 14 L48 40 Z" fill="none" stroke="#a8e02c" stroke-width="2.6" stroke-linejoin="round"/>
         <path d="M8 40 L48 40" stroke="#f4f4f0" stroke-width="2.6" stroke-linecap="round"/>
         <circle cx="37" cy="14" r="3.2" fill="#ffd633"/>`,
        '#a8e02c'
      );
    case 'couronne':
      return cadre(
        `<path d="M12 38 L12 22 L20 29 L28 17 L36 29 L44 22 L44 38 Z" fill="none" stroke="#ffd633" stroke-width="2.6" stroke-linejoin="round"/>
         <path d="M12 42 L44 42" stroke="#ffd633" stroke-width="3" stroke-linecap="round"/>`,
        '#ffd633'
      );
    case 'midi':
      return cadre(
        `<circle cx="28" cy="20" r="7" fill="#e8935a"/>
         <path d="M8 40 Q18 28 28 36 T48 40" fill="none" stroke="#c9793d" stroke-width="3" stroke-linecap="round"/>
         <path d="M8 46 Q18 38 28 44 T48 46" fill="none" stroke="#8a5a34" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>`,
        '#e8935a'
      );
    default:
      return cadre(
        `<path d="M9 40 L22 18 L30 30 L36 22 L47 40 Z" fill="none" stroke="#ffd633" stroke-width="2.6" stroke-linejoin="round"/>
         <path d="M18.5 27 L25.5 27" stroke="#f4f4f0" stroke-width="2.4" stroke-linecap="round"/>
         <path d="M33 28.5 L38 28.5" stroke="#f4f4f0" stroke-width="2.2" stroke-linecap="round"/>`,
        '#ffd633'
      );
  }
}

/** petites icônes du bandeau, dans le même trait que les emblèmes */
export const ICONES = {
  drapeau: `<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <rect x="2" y="4" width="4" height="4" fill="#f4f4f0"/><rect x="10" y="4" width="4" height="4" fill="#f4f4f0"/>
      <rect x="6" y="8" width="4" height="4" fill="#f4f4f0"/><rect x="14" y="8" width="4" height="4" fill="#f4f4f0"/>
      <rect x="2" y="12" width="4" height="4" fill="#f4f4f0"/><rect x="10" y="12" width="4" height="4" fill="#f4f4f0"/>
    </svg>`,
  montagne: `<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <path d="M2 16 L8 5 L12 11 L14 8 L18 16 Z" fill="none" stroke="#f4f4f0" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`,
  ecart: `<svg viewBox="0 0 22 14" width="18" height="12" aria-hidden="true">
      <path d="M2 7 L20 7" stroke="#15161a" stroke-width="1.8"/>
      <path d="M6 3 L2 7 L6 11" fill="none" stroke="#15161a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 3 L20 7 L16 11" fill="none" stroke="#15161a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
};

/** maillot miniature, comme les pastilles de couleur d'une retransmission */
export function pastilleMaillot(couleur: string, pois = false): string {
  return `<svg viewBox="0 0 24 22" width="17" height="16" aria-hidden="true">
    <path d="M6 4 L9.5 2.5 Q12 5 14.5 2.5 L18 4 L21 7 L18.5 9.5 L17.5 8 V20 H6.5 V8 L5.5 9.5 L3 7 Z"
      fill="${couleur}" stroke="#15161a" stroke-width="1.3" stroke-linejoin="round"/>
    ${pois ? '<circle cx="9" cy="11" r="1.5" fill="#d6382c"/><circle cx="14.5" cy="9" r="1.5" fill="#d6382c"/><circle cx="12" cy="15" r="1.5" fill="#d6382c"/>' : ''}
  </svg>`;
}
