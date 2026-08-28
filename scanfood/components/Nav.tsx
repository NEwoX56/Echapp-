'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Home, ScanLine, Swords, User } from 'lucide-react';

const ITEMS = [
  { href: '/', label: 'Accueil', Icon: Home },
  { href: '/scanner', label: 'Scanner', Icon: ScanLine },
  { href: '/combat', label: 'Combat', Icon: Swords },
  { href: '/favorites', label: 'Favoris', Icon: Heart },
  { href: '/profile', label: 'Profil', Icon: User },
];

/** Barre de navigation basse — line-icons fins, séparée par une ligne. */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-cream/95 backdrop-blur-sm safe-b">
      <ul className="mx-auto flex max-w-app items-stretch justify-between px-2">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1.5 py-3 transition-colors duration-300"
              >
                <Icon
                  size={19}
                  strokeWidth={1.25}
                  className={active ? 'text-forest' : 'text-ink-faint'}
                  aria-hidden
                />
                <span
                  className={`text-[0.625rem] tracking-[0.08em] ${
                    active ? 'text-ink' : 'text-ink-faint'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
