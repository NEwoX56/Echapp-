import { Nav } from './Nav';

/** Gabarit d'écran : colonne étroite, marges généreuses, nav basse. */
export function Shell({
  children,
  nav = true,
}: {
  children: React.ReactNode;
  nav?: boolean;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-app px-gutter safe-t">
      <main className={nav ? 'pb-28' : 'pb-10'}>{children}</main>
      {nav && <Nav />}
    </div>
  );
}
