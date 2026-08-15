import type { RosterRider, RiderStats, Archetype } from '../data/types';
import {
  getRoster,
  setPatch,
  modifierStat,
  ajouterCoureur,
  retirerCoureur,
  restaurerCoureur,
  coureursRetires,
  estModifie,
  toutRestaurer,
  exporter,
  importer
} from '../data/rosterStore';
import { hexColor, toast } from './util';
import { PALETTE } from '../data/appearance';

/**
 * Éditeur de peloton.
 *
 * Permet de renommer les coureurs et les équipes, d'ajuster leurs
 * caractéristiques, d'en ajouter et d'en retirer — entièrement depuis le jeu,
 * sans recompiler ni installer quoi que ce soit. Les modifications sont
 * enregistrées dans le navigateur et s'appliquent à la prochaine étape.
 */

const ARCHETYPES: { id: Archetype; label: string }[] = [
  { id: 'sprinteur', label: 'Sprinteur' },
  { id: 'grimpeur', label: 'Grimpeur' },
  { id: 'rouleur', label: 'Rouleur' },
  { id: 'complet', label: 'Complet' }
];

const STATS: { id: keyof RiderStats; label: string }[] = [
  { id: 'flat', label: 'Plat' },
  { id: 'climb', label: 'Montagne' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'endurance', label: 'Endurance' }
];

export class RosterEditor {
  private root: HTMLElement;
  private ouvert: string | null = null;
  private onChange: () => void;

  constructor(root: HTMLElement, onChange: () => void) {
    this.root = root;
    this.onChange = onChange;
  }

  render(): string {
    const roster = getRoster();
    const retires = coureursRetires();

    const parEquipe = new Map<string, RosterRider[]>();
    for (const r of roster) {
      const l = parEquipe.get(r.team) ?? [];
      l.push(r);
      parEquipe.set(r.team, l);
    }

    const equipes = [...parEquipe.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([nom, coureurs]) => this.blocEquipe(nom, coureurs))
      .join('');

    return `
      <div class="panel-peloton">
        <div class="perso-block">
          <h3>Peloton <small>${roster.length} coureurs</small></h3>
          <p class="hint">
            Clique sur un coureur pour changer son nom, son équipe, son type et
            ses caractéristiques. Tout est enregistré dans ce navigateur et
            s'applique dès la prochaine étape.
          </p>
          <div class="peloton-actions">
            <button class="btn-secondary" data-roster="ajouter">Ajouter un coureur</button>
            <button class="btn-secondary" data-roster="exporter">Sauvegarder dans un fichier</button>
            <button class="btn-secondary" data-roster="importer">Charger un fichier</button>
            <button class="btn-danger" data-roster="restaurer-tout">Tout remettre d'origine</button>
            <input type="file" id="roster-fichier" accept="application/json,.json" hidden>
          </div>
        </div>
        ${equipes}
        ${
          retires.length
            ? `<div class="perso-block">
                 <h3>Coureurs retirés <small>${retires.length}</small></h3>
                 <div class="chip-row">
                   ${retires
                     .map(
                       (r) =>
                         `<button class="chip" data-restaurer="${r.id}">${r.name} ↩</button>`
                     )
                     .join('')}
                 </div>
               </div>`
            : ''
        }
      </div>`;
  }

  private blocEquipe(nom: string, coureurs: RosterRider[]): string {
    return `
      <div class="perso-block equipe-bloc">
        <div class="equipe-tete">
          <span class="chip-dot" style="background:${hexColor(coureurs[0].color)}"></span>
          <input class="equipe-nom" type="text" value="${this.echap(nom)}"
                 data-equipe="${this.echap(nom)}" maxlength="24">
          <small>${coureurs.length} coureur${coureurs.length > 1 ? 's' : ''}</small>
        </div>
        <div class="coureur-liste">
          ${coureurs.map((r) => this.ligneCoureur(r)).join('')}
        </div>
      </div>`;
  }

  private ligneCoureur(r: RosterRider): string {
    const ouvert = this.ouvert === r.id;
    const moyenne = Math.round(
      (r.stats.flat + r.stats.climb + r.stats.sprint + r.stats.endurance) / 4
    );
    return `
      <div class="coureur ${ouvert ? 'ouvert' : ''}">
        <button class="coureur-tete" data-ouvrir="${r.id}">
          <span class="chip-dot" style="background:${hexColor(r.color)}"></span>
          <span class="c-nom">${this.echap(r.name)}${estModifie(r.id) ? ' <i>modifié</i>' : ''}</span>
          <span class="c-type">${ARCHETYPES.find((a) => a.id === r.archetype)?.label ?? r.archetype}</span>
          <span class="c-age">${r.age} ans</span>
          <span class="c-moy">${moyenne}</span>
          <span class="c-fleche">${ouvert ? '▾' : '▸'}</span>
        </button>
        ${ouvert ? this.detailCoureur(r) : ''}
      </div>`;
  }

  private detailCoureur(r: RosterRider): string {
    return `
      <div class="coureur-detail">
        <div class="cd-grille">
          <label class="field">
            <span>Nom</span>
            <input type="text" maxlength="26" value="${this.echap(r.name)}" data-champ="name" data-id="${r.id}">
          </label>
          <label class="field">
            <span>Équipe</span>
            <input type="text" maxlength="24" value="${this.echap(r.team)}" data-champ="team" data-id="${r.id}">
          </label>
          <label class="field">
            <span>Âge <small>(25 ans ou moins : maillot blanc)</small></span>
            <input type="number" min="18" max="42" value="${r.age}" data-champ="age" data-id="${r.id}">
          </label>
        </div>

        <div class="field">
          <span>Type de coureur</span>
          <div class="chip-row">
            ${ARCHETYPES.map(
              (a) =>
                `<button class="chip ${a.id === r.archetype ? 'active' : ''}"
                         data-archetype="${a.id}" data-id="${r.id}">${a.label}</button>`
            ).join('')}
          </div>
        </div>

        <div class="field">
          <span>Couleur du maillot</span>
          <div class="sw-row">
            ${PALETTE.map(
              (c) =>
                `<button class="sw ${c.value === r.color ? 'active' : ''}"
                         style="background:${hexColor(c.value)}" title="${c.label}"
                         data-couleur="${c.value}" data-id="${r.id}"></button>`
            ).join('')}
          </div>
        </div>

        <div class="field">
          <span>Caractéristiques</span>
          ${STATS.map(
            (s) => `
            <div class="stat-edit">
              <span class="stat-label">${s.label}</span>
              <input type="range" min="1" max="99" value="${Math.round(r.stats[s.id])}"
                     data-stat="${s.id}" data-id="${r.id}">
              <b class="stat-val" id="val-${r.id}-${s.id}">${Math.round(r.stats[s.id])}</b>
            </div>`
          ).join('')}
        </div>

        <div class="cd-actions">
          ${estModifie(r.id) ? `<button class="btn-secondary" data-restaurer-un="${r.id}">Remettre d'origine</button>` : ''}
          <button class="btn-danger" data-retirer="${r.id}">Retirer du peloton</button>
        </div>
      </div>`;
  }

  private echap(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  /** à appeler après chaque rendu du panneau */
  bind(): void {
    const r = this.root;

    r.querySelectorAll<HTMLButtonElement>('[data-ouvrir]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.ouvrir!;
        this.ouvert = this.ouvert === id ? null : id;
        this.onChange();
      });
    });

    r.querySelectorAll<HTMLInputElement>('[data-champ]').forEach((inp) => {
      const maj = () => {
        const id = inp.dataset.id!;
        const champ = inp.dataset.champ!;
        if (champ === 'age') {
          const v = Number(inp.value);
          if (v >= 18 && v <= 42) setPatch(id, { age: v });
        } else if (champ === 'name') {
          setPatch(id, { name: inp.value.trim() || 'Coureur' });
        } else if (champ === 'team') {
          const t = inp.value.trim() || 'Sans équipe';
          setPatch(id, { team: t, appearance: { sponsor: t.slice(0, 12).toUpperCase() } });
        }
      };
      inp.addEventListener('change', () => {
        maj();
        this.onChange();
      });
      inp.addEventListener('blur', maj);
    });

    // renommer une équipe entière
    r.querySelectorAll<HTMLInputElement>('[data-equipe]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const ancien = inp.dataset.equipe!;
        const nouveau = inp.value.trim();
        if (!nouveau || nouveau === ancien) return;
        for (const c of getRoster().filter((x) => x.team === ancien)) {
          setPatch(c.id, {
            team: nouveau,
            appearance: { sponsor: nouveau.slice(0, 12).toUpperCase() }
          });
        }
        toast(`Équipe renommée : ${nouveau}`);
        this.onChange();
      });
    });

    r.querySelectorAll<HTMLButtonElement>('[data-archetype]').forEach((b) => {
      b.addEventListener('click', () => {
        setPatch(b.dataset.id!, { archetype: b.dataset.archetype as Archetype });
        this.onChange();
      });
    });

    r.querySelectorAll<HTMLButtonElement>('[data-couleur]').forEach((b) => {
      b.addEventListener('click', () => {
        const c = Number(b.dataset.couleur);
        setPatch(b.dataset.id!, {
          color: c,
          appearance: { jerseyPrimary: c, helmet: c }
        });
        this.onChange();
      });
    });

    // les curseurs mettent à jour la valeur sans reconstruire tout le panneau
    r.querySelectorAll<HTMLInputElement>('[data-stat]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.dataset.id!;
        const stat = inp.dataset.stat as keyof RiderStats;
        const v = Number(inp.value);
        const aff = r.querySelector(`#val-${id}-${stat}`);
        if (aff) aff.textContent = String(v);
        modifierStat(id, stat, v);
      });
    });

    r.querySelector<HTMLButtonElement>('[data-roster="ajouter"]')?.addEventListener('click', () => {
      this.ouvert = ajouterCoureur();
      toast('Coureur ajouté au peloton');
      this.onChange();
    });

    r.querySelectorAll<HTMLButtonElement>('[data-retirer]').forEach((b) => {
      b.addEventListener('click', () => {
        retirerCoureur(b.dataset.retirer!);
        this.ouvert = null;
        this.onChange();
      });
    });

    r.querySelectorAll<HTMLButtonElement>('[data-restaurer]').forEach((b) => {
      b.addEventListener('click', () => {
        restaurerCoureur(b.dataset.restaurer!);
        this.onChange();
      });
    });

    r.querySelectorAll<HTMLButtonElement>('[data-restaurer-un]').forEach((b) => {
      b.addEventListener('click', () => {
        restaurerCoureur(b.dataset.restaurerUn!);
        this.onChange();
      });
    });

    r.querySelector<HTMLButtonElement>('[data-roster="restaurer-tout"]')?.addEventListener(
      'click',
      () => {
        if (confirm('Remettre tout le peloton comme à l\'origine ?')) {
          toutRestaurer();
          this.ouvert = null;
          this.onChange();
        }
      }
    );

    // sauvegarde par fichier : sur une machine verrouillée, c'est le seul
    // moyen de conserver son travail si le stockage du navigateur est effacé
    r.querySelector<HTMLButtonElement>('[data-roster="exporter"]')?.addEventListener('click', () => {
      const blob = new Blob([exporter()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'echappee-peloton.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Fichier téléchargé');
    });

    const champFichier = r.querySelector<HTMLInputElement>('#roster-fichier');
    r.querySelector<HTMLButtonElement>('[data-roster="importer"]')?.addEventListener('click', () => {
      champFichier?.click();
    });
    champFichier?.addEventListener('change', async () => {
      const f = champFichier.files?.[0];
      if (!f) return;
      const res = importer(await f.text());
      toast(res.message);
      if (res.ok) {
        this.ouvert = null;
        this.onChange();
      }
      champFichier.value = '';
    });
  }
}
