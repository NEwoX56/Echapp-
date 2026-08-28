import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col justify-center px-gutter">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-4 font-serif text-title">Produit non trouvé</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        Vérifie le code-barres, ou cherche le produit par son nom.
      </p>
      <div className="mt-10 grid gap-3">
        <Link href="/scanner" className="btn-primary">
          Scanner un produit
        </Link>
        <Link href="/" className="btn-ghost">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
