/**
 * Plein écran.
 *
 * Sur le navigateur d'une console, les boutons de la manette servent aussi à
 * piloter l'interface du navigateur : Y ouvre un menu, B revient en arrière,
 * et ces appuis ne parviennent jamais à la page. Le plein écran retire cette
 * interface et rend la manette au jeu.
 *
 * L'API exige un geste utilisateur : la demande doit partir d'un clic ou
 * d'une pression de touche, jamais d'un appel différé.
 */

type Cible = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

type Doc = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

export function fullscreenActif(): boolean {
  const d = document as Doc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
}

export function fullscreenDisponible(): boolean {
  const e = document.documentElement as Cible;
  return !!(e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen);
}

export async function entrerFullscreen(): Promise<boolean> {
  if (fullscreenActif()) return true;
  const e = document.documentElement as Cible;
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' });
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else if (e.msRequestFullscreen) await e.msRequestFullscreen();
    else return false;
    return true;
  } catch {
    // refus du navigateur (geste utilisateur manquant, politique de sécurité)
    return false;
  }
}

export async function sortirFullscreen(): Promise<void> {
  const d = document as Doc;
  if (!fullscreenActif()) return;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    else if (d.msExitFullscreen) await d.msExitFullscreen();
  } catch {
    /* sortie refusée : sans conséquence */
  }
}

export async function basculerFullscreen(): Promise<boolean> {
  if (fullscreenActif()) {
    await sortirFullscreen();
    return false;
  }
  return entrerFullscreen();
}

/** notifie les changements d'état, y compris ceux déclenchés par Échap */
export function surChangementFullscreen(cb: (actif: boolean) => void): void {
  const h = () => cb(fullscreenActif());
  document.addEventListener('fullscreenchange', h);
  document.addEventListener('webkitfullscreenchange', h);
  document.addEventListener('MSFullscreenChange', h);
}
