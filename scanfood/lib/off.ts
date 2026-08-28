import 'server-only';

import { DEMO_LIST, DEMO_PRODUCTS } from './data/fixtures';
import { parseProduct, withScore } from './foodApi';
import type { ScoredProduct } from './types';

const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'ScanFood/1.0 (contact: github.com/NEwoX56/Echapp-)';
const TIMEOUT_MS = 8000;

/** Mode démo : sert le jeu de fixtures locales au lieu d'appeler OpenFoodFacts. */
export const DEMO_DATA = process.env.SCANFOOD_DEMO_DATA === '1';

async function offFetch(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Produit unique                                                      */
/* ------------------------------------------------------------------ */

/** Récupère un produit par code-barres. `null` si introuvable. */
export async function fetchProduct(barcode: string): Promise<ScoredProduct | null> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;

  if (DEMO_DATA) {
    const raw = DEMO_PRODUCTS[code];
    return raw ? withScore(parseProduct(raw)) : null;
  }

  const json = await offFetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
  if (!json || json.status === 0 || !json.product) return null;
  return withScore(parseProduct(json.product));
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Score de pertinence : correspondance exacte > commence par > contient.
 * Le classement OpenFoodFacts (popularité) sert de départage.
 */
function relevance(name: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query);
  if (!q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 700;
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n)) return 500;
  if (n.includes(q)) return 300;
  // Repli sur les mots significatifs : les articles et prépositions
  // (« de », « à », « aux ») matcheraient n'importe quoi.
  const words = q.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => n.includes(w)).length;
  return hits > 0 ? 100 + (hits / words.length) * 100 : 0;
}

/** Recherche par nom, triée côté client par pertinence puis popularité. */
export async function searchProducts(query: string, limit = 8): Promise<ScoredProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  let rawList: any[] = [];

  if (DEMO_DATA) {
    rawList = DEMO_LIST;
  } else {
    const url =
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
      `&search_simple=0&action=process&json=1&page_size=20&sort_by=unique_scans_n`;
    const json = await offFetch(url);
    rawList = Array.isArray(json?.products) ? json.products : [];
  }

  const parsed = rawList
    .map((raw) => {
      try {
        return withScore(parseProduct(raw));
      } catch {
        return null;
      }
    })
    .filter((p): p is ScoredProduct => Boolean(p) && Boolean(p!.barcode) && p!.product_name !== 'Produit sans nom');

  // OpenFoodFacts indexe déjà les catégories côté serveur ; en mode démo,
  // on élargit le champ de correspondance pour reproduire ce comportement
  // (c'est ce qui permet aux suggestions d'alternatives de fonctionner).
  const haystack = (p: ScoredProduct) =>
    DEMO_DATA
      ? `${p.product_name} ${p.brand} ${p.categories.join(' ')}`
      : `${p.product_name} ${p.brand}`;

  return parsed
    .map((p, index) => ({ p, r: relevance(haystack(p), q), index }))
    .filter((e) => (DEMO_DATA ? e.r > 0 : true))
    .sort((a, b) => (b.r - a.r) || (a.index - b.index))
    .slice(0, limit)
    .map((e) => e.p);
}

/* ------------------------------------------------------------------ */
/* Alternatives plus saines                                            */
/* ------------------------------------------------------------------ */

/**
 * Suggère des produits mieux notés dans la même catégorie.
 * Filtre : score strictement supérieur au produit courant ET ≥ 50.
 */
export async function findHealthierAlternatives(
  product: ScoredProduct,
  limit = 4,
): Promise<ScoredProduct[]> {
  const seed =
    product.categories[product.categories.length - 1] ||
    product.categories[0] ||
    product.product_name.split(/\s+/).slice(0, 2).join(' ');

  if (!seed) return [];

  const candidates = await searchProducts(seed, 20);

  return candidates
    .filter((c) => c.barcode !== product.barcode)
    .filter((c) => c.score > product.score && c.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
