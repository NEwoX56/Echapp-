import type { StageDef } from '../data/types';
import type { Career } from '../career/Career';
import { SPECIALITES, specialite, type SpecialiteId } from '../data/progression';
import { profileSvg, TYPE_LABEL } from './util';

/**
 * Écran d'avant-course.
 *
 * C'est le moment où les quatre systèmes se rencontrent : on découvre sa forme
 * du jour, on accepte ou non le contrat proposé, et on choisit les spécialités
 * en conséquence. Un jour de méforme sur une étape de montagne, on refuse le
 * contrat de grimpeur et on part avec Sang-froid ; un jour de grande forme, on
 * accepte et on équipe Grimpeur né.
 *
 * Sans cet écran, les trois systèmes existeraient sans jamais dialoguer.
 */
export class BriefingEtape {
  private root: HTMLElement;
  private career: Career;
  private onDepart: () => void;
  private onRetour: () => void;
  private stage: StageDef | null = null;

  constructor(root: HTMLElement, career: Career, onDepart: () => void, onRetour: () => void) {
    this.root = root;
    this.career = career;
    this.onDepart = onDepart;
    this.onRetour = onRetour;
  }

  afficher(stage: StageDef): void {
    this.stage = stage;
    this.career.preparerEtape();
    this.render();
  }

  private render(): void {
    const stage = this.stage;
    if (!stage) return;
    const forme = this.career.forme;
    const contrat = this.career.contrat;
    const equipees = this.career.equipees;
    const libres = this.career.emplacements - equipees.length;

    const cartesSpec = SPECIALITES.filter((s) => this.career.aSpecialite(s.id))
      .map((s) => {
        const active = this.career.estEquipee(s.id);
        const conseillee = s.utile.includes(stage.type);
        return `<button class="spec-carte ${active ? 'active' : ''} ${conseillee ? 'conseillee' : ''}"
                        data-spec="${s.id}">
            <div class="sc-tete">
              <span class="sc-nom">${s.nom}</span>
              ${conseillee ? '<span class="sc-tag">adaptée</span>' : ''}
            </div>
            <div class="sc-desc">${s.description}</div>
          </button>`;
      })
      .join('');

    this.root.innerHTML = `
      <div class="briefing">
        <div class="br-entete">
          <div>
            <div class="br-sur">Prochaine étape</div>
            <h1 class="br-nom">${stage.name}</h1>
            <div class="br-meta">
              <span class="tag tag-${stage.type}">${TYPE_LABEL[stage.type]}</span>
              <span>${stage.displayKm} km</span>
              ${stage.climbs?.length ? `<span>${stage.climbs.length} col${stage.climbs.length > 1 ? 's' : ''}</span>` : ''}
              ${stage.sprints?.length ? '<span>sprint intermédiaire</span>' : ''}
            </div>
            <p class="br-desc">${stage.description}</p>
          </div>
          <div class="br-profil">${profileSvg(stage, 320, 78)}</div>
        </div>

        <div class="br-grille">
          <div class="br-bloc br-forme" style="--teinte:${forme?.couleur ?? '#9aa0ad'}">
            <div class="br-titre">Forme du jour</div>
            <div class="br-forme-val">${forme?.libelle ?? '—'}</div>
            <div class="br-forme-delta">${
              forme ? (forme.delta > 0 ? `+${forme.delta}` : forme.delta === 0 ? '±0' : `${forme.delta}`) : ''
            } sur toutes tes caractéristiques</div>
            <button class="btn-secondary petit" data-action="relancer"
                    ${this.career.points < 3 ? 'disabled' : ''}>
              Relancer · 3 pts
            </button>
          </div>

          <div class="br-bloc br-contrat">
            <div class="br-titre">Contrat du directeur</div>
            ${
              contrat
                ? `<div class="br-contrat-texte">« ${contrat.texte} »</div>
                   <div class="br-contrat-enjeu">
                     <span class="gain">+${contrat.recompense} pts si réussi</span>
                     <span class="perte">−${contrat.penalite} pts si manqué</span>
                   </div>
                   <div class="br-contrat-choix">
                     <button class="btn-primary petit ${contrat.accepte ? 'active' : ''}" data-contrat="oui">
                       ${contrat.accepte ? 'Contrat accepté' : 'Accepter'}
                     </button>
                     <button class="btn-secondary petit ${!contrat.accepte ? 'active' : ''}" data-contrat="non">
                       Refuser
                     </button>
                   </div>`
                : '<p class="hint">Pas de contrat aujourd&rsquo;hui.</p>'
            }
          </div>

          <div class="br-bloc br-spec">
            <div class="br-titre">
              Spécialités
              <small>${equipees.length} / ${this.career.emplacements} emplacement${this.career.emplacements > 1 ? 's' : ''}</small>
            </div>
            ${
              cartesSpec
                ? `<div class="spec-liste">${cartesSpec}</div>
                   <p class="hint">${
                     libres > 0
                       ? `Encore ${libres} emplacement${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''}.`
                       : 'Tous tes emplacements sont occupés. Clique pour retirer.'
                   }</p>`
                : `<p class="hint">Aucune spécialité débloquée. Rends-toi dans l'onglet Progression pour en acquérir avec tes points de carrière.</p>`
            }
          </div>
        </div>

        <div class="br-actions">
          <button class="btn-secondary" data-action="retour">Retour au menu</button>
          <button class="btn-primary grand" data-action="partir">
            Prendre le départ
            <small>${stage.name}</small>
          </button>
        </div>
      </div>
    `;
    this.bind();
  }

  private bind(): void {
    const q = <T extends Element>(s: string) => this.root.querySelector<T>(s);

    q<HTMLButtonElement>('[data-action="partir"]')?.addEventListener('click', () => this.onDepart());
    q<HTMLButtonElement>('[data-action="retour"]')?.addEventListener('click', () => this.onRetour());
    q<HTMLButtonElement>('[data-action="relancer"]')?.addEventListener('click', () => {
      if (this.career.relancerForme()) this.render();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-contrat]').forEach((b) => {
      b.addEventListener('click', () => {
        this.career.accepterContrat(b.dataset.contrat === 'oui');
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-spec]').forEach((b) => {
      b.addEventListener('click', () => {
        this.career.basculerEquipee(b.dataset.spec as SpecialiteId);
        this.render();
      });
    });
  }
}

/** carte de spécialité pour la boutique de l'onglet Progression */
export function carteAchatSpecialite(
  id: SpecialiteId,
  debloquee: boolean,
  points: number
): string {
  const s = specialite(id);
  return `<div class="achat-carte ${debloquee ? 'possede' : ''}">
      <div class="ac-tete">
        <span class="ac-nom">${s.nom}</span>
        ${debloquee ? '<span class="ac-ok">acquise</span>' : `<span class="ac-cout">${s.cout} pts</span>`}
      </div>
      <div class="ac-desc">${s.description}</div>
      ${
        debloquee
          ? ''
          : `<button class="btn-secondary petit" data-acheter-spec="${id}" ${points < s.cout ? 'disabled' : ''}>
               Débloquer
             </button>`
      }
    </div>`;
}
