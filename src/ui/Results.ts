import type { StageDef, StageResultRow, StagePoints } from '../data/types';
import type { ClassementKey } from '../data/appearance';
import { AWARDS } from '../data/appearance';
import type { Career } from '../career/Career';
import { formatTime, formatGap, hexColor, jerseyIconSvg } from './util';
import { badge, type BadgeId } from '../data/progression';

export class Results {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** Applique les résultats à la carrière puis affiche l'écran. */
  show(
    stage: StageDef,
    rows: StageResultRow[],
    points: StagePoints[],
    career: Career,
    suivi: {
      energieMin: number;
      colsEnTete: number;
      colsHcEnTete: number;
      sprintsTop3: number;
      aEteDansEchappee: boolean;
    },
    onContinue: () => void
  ): void {
    const playerRow = rows.find((r) => r.isPlayer)!;
    const playerPos = rows.indexOf(playerRow) + 1;
    if (playerPos === 1) career.addStageWin();

    const { xp, points: pts } = career.rewardForPosition(playerPos, rows.length);
    const { leveledUp, newLevel } = career.applyReward(xp, pts);
    const { gained, lost } = career.applyStage(rows, points);

    // badges et contrat : après l'enregistrement des temps, pour que les
    // classements soient à jour au moment de vérifier un maillot
    const bilan = career.bilanEtape({
      place: playerPos,
      total: rows.length,
      ecartVainqueur: playerRow.time - rows[0].time,
      typeEtape: stage.type,
      difficulte: career.save.difficulty,
      suivi,
      tourTermine: career.save.tour.finished,
      maillotsGagnes: career.save.tour.jerseysWon
    });
    career.persist();

    const tour = career.tourDef;
    const tourDone = career.save.tour.finished;
    const gc = career.gcTable();
    const playerGcPos = gc.findIndex((r) => r.isPlayer) + 1;

    const title =
      playerPos === 1 ? "VICTOIRE D'ÉTAPE" : playerPos <= 3 ? 'PODIUM' : 'ÉTAPE TERMINÉE';

    const stageRows = rows
      .slice(0, 12)
      .map(
        (r, i) => `
      <li class="${r.isPlayer ? 'me' : ''}">
        <span class="res-pos">${i + 1}</span>
        <span class="chip-dot" style="background:${hexColor(r.color)}"></span>
        <span class="res-name">${r.name}</span>
        <span class="res-time">${i === 0 ? formatTime(r.time) : formatGap(r.time - rows[0].time)}</span>
      </li>`
      )
      .join('');

    const gcRows = gc
      .slice(0, 10)
      .map(
        (r, i) => `
      <li class="${r.isPlayer ? 'me' : ''}">
        <span class="res-pos">${i + 1}</span>
        <span class="res-name">${r.name}</span>
        <span class="res-time">${i === 0 ? formatTime(r.time) : formatGap(r.gap)}</span>
      </li>`
      )
      .join('');

    // cérémonie protocolaire
    const worn = career.playerJersey();
    const ceremony = gained.length
      ? `
      <div class="ceremony">
        <div class="ceremony-head">Protocole d'arrivée</div>
        <div class="ceremony-jerseys">
          ${gained
            .map(
              (k) => `
            <div class="ceremony-jersey">
              ${jerseyIconSvg(AWARDS[k].cssColor, k === 'montagne')}
              <div class="cj-label">${AWARDS[k].label}</div>
              <div class="cj-sub">${
                worn === k
                  ? 'Tu le porteras au départ'
                  : 'Leader du classement — un autre maillot prime'
              }</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
      : '';

    const lostNote = lost.length
      ? `<p class="hint lost">Maillot perdu : ${lost.map((k) => AWARDS[k].short).join(', ')}</p>`
      : '';

    const podium = tourDone
      ? `
      <div class="tour-final">
        <h3>${tour.name} terminé</h3>
        <p>Tu termines <b>${playerGcPos}${playerGcPos === 1 ? 'er' : 'e'}</b> du classement général
        avec ${career.save.tour.stageWins} victoire${career.save.tour.stageWins > 1 ? 's' : ''} d'étape.</p>
        ${
          career.save.tour.jerseysWon.length
            ? `<div class="won-jerseys">${career.save.tour.jerseysWon
                .map((k) => jerseyIconSvg(AWARDS[k].cssColor, k === 'montagne'))
                .join('')}</div>`
            : ''
        }
      </div>`
      : '';

    this.root.innerHTML = `
      <div class="results-wrap">
        <div class="results-head ${playerPos === 1 ? 'gold' : ''}">
          <div class="results-title">${title}</div>
          <p class="results-sub">${stage.name} · ${playerPos}${playerPos === 1 ? 're' : 'e'} place</p>
        </div>
        ${ceremony}
        ${
          bilan.contrat
            ? `<div class="contrat-bilan ${bilan.contrat.reussi ? 'ok' : 'rate'}">
                 <div class="cb-titre">${bilan.contrat.reussi ? 'Contrat rempli' : 'Contrat manqué'}</div>
                 <div class="cb-texte">${bilan.contrat.texte}</div>
                 <div class="cb-points">${bilan.contrat.points > 0 ? '+' : ''}${bilan.contrat.points} points de carrière</div>
               </div>`
            : ''
        }
        ${
          bilan.badges.length
            ? `<div class="badges-gagnes">
                 <div class="bg-titre">${bilan.badges.length > 1 ? 'Nouveaux badges' : 'Nouveau badge'}</div>
                 <div class="bg-liste">
                   ${bilan.badges
                     .map((id: BadgeId) => {
                       const b = badge(id);
                       return `<div class="badge-carte ${b.rang}">
                                 <div class="bc-nom">${b.nom}</div>
                                 <div class="bc-desc">${b.description}</div>
                                 <div class="bc-pts">+${b.points} pts</div>
                               </div>`;
                     })
                     .join('')}
                 </div>
               </div>`
            : ''
        }
        <div class="results-cols">
          <div class="res-block">
            <h3>Classement de l'étape</h3>
            <ol class="res-list">${stageRows}</ol>
          </div>
          <div class="res-block">
            <h3>Classement général</h3>
            <ol class="res-list">${gcRows}</ol>
            ${lostNote}
          </div>
        </div>
        <div class="results-rewards">
          <span>+${xp} XP</span>
          <span>+${pts} point${pts > 1 ? 's' : ''} d'amélioration</span>
          ${leveledUp ? `<span class="lvl">Niveau ${newLevel} !</span>` : ''}
        </div>
        ${podium}
        <button class="btn-primary" data-action="continue">Continuer</button>
      </div>
    `;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="continue"]')!
      .addEventListener('click', onContinue);
  }
}
