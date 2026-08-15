import type { StageDef, StageType } from '../data/types';

export const TYPE_LABEL: Record<StageType, string> = {
  plaine: 'Plaine',
  vallonnee: 'Vallonnée',
  montagne: 'Montagne',
  clm: 'Contre-la-montre'
};

export const TYPE_COLOR: Record<StageType, string> = {
  plaine: '#35c47c',
  vallonnee: '#e8a33d',
  montagne: '#d6382c',
  clm: '#4aa3df'
};

export interface RadarDot {
  progress: number;
  color: number;
  isPlayer: boolean;
  threat: number;
  teammate: boolean;
  fuyard?: boolean;
}

/**
 * Profil altimétrique avec les coureurs positionnés dessus.
 * Le joueur est un losange jaune, les menaces au général sont cerclées de rouge,
 * les équipiers en bleu clair.
 */
export function profileRadarSvg(
  stage: StageDef,
  width: number,
  height: number,
  dots: RadarDot[],
  climbs: { at: number; category: number }[] = [],
  sprints: { at: number }[] = []
): string {
  const pts = stage.profile;
  const maxAlt = Math.max(...pts.map((p) => p[1]), 20);
  const pad = 4;
  const x = (t: number) => pad + t * (width - pad * 2);
  const y = (a: number) => height - pad - (a / maxAlt) * (height - pad * 2);

  let path = `M ${x(0)} ${height - pad}`;
  const steps = 70;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path += ` L ${x(t).toFixed(1)} ${y(altAt(pts, t)).toFixed(1)}`;
  }
  path += ` L ${x(1)} ${height - pad} Z`;

  const color = TYPE_COLOR[stage.type];

  const markers = [
    ...climbs.map(
      (c) =>
        `<line x1="${x(c.at).toFixed(1)}" y1="${pad}" x2="${x(c.at).toFixed(1)}" y2="${height - pad}"
           stroke="#d6382c" stroke-width="1" stroke-dasharray="2 2" opacity="0.65"/>`
    ),
    ...sprints.map(
      (sp) =>
        `<line x1="${x(sp.at).toFixed(1)}" y1="${pad}" x2="${x(sp.at).toFixed(1)}" y2="${height - pad}"
           stroke="#2f9e5b" stroke-width="1" stroke-dasharray="2 2" opacity="0.65"/>`
    )
  ].join('');

  // les autres coureurs d'abord, le joueur par-dessus
  const others = dots
    .filter((d) => !d.isPlayer)
    .map((d) => {
      const cx = x(d.progress);
      const cy = y(altAt(pts, d.progress));
      const fill = '#' + d.color.toString(16).padStart(6, '0');
      // un fuyard est cerclé d'orange : on doit le repérer d'un coup d'œil
      const stroke = d.fuyard
        ? '#ff9c3d'
        : d.teammate
          ? '#6fd0ff'
          : d.threat > 0.7
            ? '#ff5a45'
            : '#15161a';
      const w = d.fuyard ? 2 : d.teammate || d.threat > 0.7 ? 1.5 : 0.9;
      const r = d.fuyard ? 3.1 : 2.6;
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
    })
    .join('');

  const me = dots.find((d) => d.isPlayer);
  const player = me
    ? (() => {
        const cx = x(me.progress);
        const cy = y(altAt(pts, me.progress));
        return `<path d="M ${cx.toFixed(1)} ${(cy - 4.6).toFixed(1)}
                  L ${(cx + 4).toFixed(1)} ${cy.toFixed(1)}
                  L ${cx.toFixed(1)} ${(cy + 4.6).toFixed(1)}
                  L ${(cx - 4).toFixed(1)} ${cy.toFixed(1)} Z"
                  fill="#ffd633" stroke="#15161a" stroke-width="1.4"/>`;
      })()
    : '';

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">
    <path d="${path}" fill="${color}33" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    ${markers}${others}${player}
  </svg>`;
}

/** Profil altimétrique en SVG. markerT optionnel : position du coureur (0..1). */
export function profileSvg(stage: StageDef, width: number, height: number, markerT = -1): string {
  const pts = stage.profile;
  const maxAlt = Math.max(...pts.map((p) => p[1]), 20);
  const pad = 3;
  const x = (t: number) => pad + t * (width - pad * 2);
  const y = (a: number) => height - pad - (a / maxAlt) * (height - pad * 2);

  let path = `M ${x(0)} ${height - pad}`;
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path += ` L ${x(t).toFixed(1)} ${y(altAt(pts, t)).toFixed(1)}`;
  }
  path += ` L ${x(1)} ${height - pad} Z`;

  const color = TYPE_COLOR[stage.type];
  let marker = '';
  if (markerT >= 0) {
    const mt = Math.min(1, Math.max(0, markerT));
    marker = `<circle cx="${x(mt).toFixed(1)}" cy="${y(altAt(pts, mt)).toFixed(1)}" r="3.4" fill="#ffd633" stroke="#17181c" stroke-width="1.4"/>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">
    <path d="${path}" fill="${color}33" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
    ${marker}
  </svg>`;
}

function altAt(pts: [number, number][], t: number): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, a0] = pts[i - 1];
      const [t1, a1] = pts[i];
      const k = (t - t0) / (t1 - t0);
      const s = (1 - Math.cos(k * Math.PI)) / 2;
      return a0 + (a1 - a0) * s;
    }
  }
  return pts[pts.length - 1][1];
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}'${sec.toFixed(1).padStart(4, '0')}"`;
}

export function formatGap(s: number): string {
  if (s < 0.05) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s - m * 60);
  return m > 0 ? `+ ${m}'${String(sec).padStart(2, '0')}"` : `+ ${sec}"`;
}

export function hexColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function toast(msg: string): void {
  const host = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2400);
}

/** petite icône de maillot en SVG (pour les classements et le protocole) */
export function jerseyIconSvg(color: string, dots = false): string {
  const pattern = dots
    ? `<g fill="#d6382c">
         <circle cx="17" cy="20" r="2.6"/><circle cx="27" cy="16" r="2.6"/>
         <circle cx="37" cy="20" r="2.6"/><circle cx="22" cy="29" r="2.6"/>
         <circle cx="32" cy="29" r="2.6"/><circle cx="27" cy="38" r="2.6"/>
       </g>`
    : '';
  return `<svg viewBox="0 0 54 50" width="46" height="43" aria-hidden="true">
    <path d="M14 8 L22 5 Q27 9 32 5 L40 8 L47 14 L41 20 L39 17 V45 H15 V17 L13 20 L7 14 Z"
      fill="${color}" stroke="#15161a" stroke-width="2" stroke-linejoin="round"/>
    ${pattern}
  </svg>`;
}
