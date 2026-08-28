import type {
  EcoscoreGrade,
  Nutriments,
  NutriscoreGrade,
  Product,
  ScoreReason,
  ScoredProduct,
} from './types';

/* ------------------------------------------------------------------ */
/* Images de repli par catégorie                                       */
/* ------------------------------------------------------------------ */

/**
 * Photothèque de repli, indexée par mot-clé de catégorie.
 * Utilisée uniquement quand OpenFoodFacts ne fournit aucune image ;
 * si `HIGGSFIELD_API_KEY` est configurée, une photo éditoriale est
 * générée à la place (voir `/api/higgsfield/product-image`).
 */
const CATEGORY_IMAGES: Array<{ keywords: string[]; url: string }> = [
  { keywords: ['chocolat', 'chocolate', 'cacao'], url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=70' },
  { keywords: ['biscuit', 'cookie', 'gateau', 'gâteau'], url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=70' },
  { keywords: ['chips', 'crisp', 'apéritif', 'aperitif'], url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=70' },
  { keywords: ['yaourt', 'yogurt', 'yoghurt', 'laitier', 'fromage'], url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=70' },
  { keywords: ['pain', 'bread', 'baguette', 'boulangerie'], url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=70' },
  { keywords: ['soda', 'cola', 'boisson gazeuse', 'limonade'], url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=70' },
  { keywords: ['eau', 'water', 'minérale'], url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=70' },
  { keywords: ['viande', 'meat', 'charcuterie', 'jambon', 'poulet'], url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=70' },
  { keywords: ['fruit', 'pomme', 'banane', 'agrume'], url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&q=70' },
  { keywords: ['légume', 'legume', 'vegetable', 'salade'], url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=70' },
  { keywords: ['sauce', 'ketchup', 'mayonnaise', 'moutarde'], url: 'https://images.unsplash.com/photo-1470114716159-e389f8712fda?w=600&q=70' },
  { keywords: ['protéine', 'proteine', 'protein', 'sportif'], url: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=70' },
  { keywords: ['pâte', 'pate', 'pasta', 'spaghetti', 'riz'], url: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=70' },
  { keywords: ['soupe', 'soup', 'potage', 'velouté'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=70' },
  { keywords: ['glace', 'ice cream', 'sorbet', 'dessert glacé'], url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=70' },
  { keywords: ['café', 'cafe', 'coffee', 'thé', 'the '], url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=70' },
  { keywords: ['confiture', 'jam', 'miel', 'pâte à tartiner'], url: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=70' },
  { keywords: ['pizza', 'quiche', 'tarte salée'], url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=70' },
];

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=600&q=70';

/** Retourne l'image de repli la plus pertinente pour un produit. */
export function fallbackImageFor(name: string, categories: string | string[]): string {
  const haystack = [name, Array.isArray(categories) ? categories.join(' ') : categories]
    .join(' ')
    .toLowerCase();
  for (const entry of CATEGORY_IMAGES) {
    if (entry.keywords.some((k) => haystack.includes(k))) return entry.url;
  }
  return DEFAULT_IMAGE;
}

/* ------------------------------------------------------------------ */
/* Parsing OpenFoodFacts                                               */
/* ------------------------------------------------------------------ */

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function grade(value: unknown): 'a' | 'b' | 'c' | 'd' | 'e' | null {
  const g = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['a', 'b', 'c', 'd', 'e'].includes(g) ? (g as 'a') : null;
}

/** Mappe la réponse brute OpenFoodFacts vers notre modèle `Product`. */
export function parseProduct(raw: Record<string, any>): Product {
  const n = (raw?.nutriments ?? {}) as Record<string, unknown>;

  const barcode = String(raw?.code ?? raw?._id ?? '').trim();
  const product_name = String(
    raw?.product_name_fr || raw?.product_name || raw?.generic_name_fr || raw?.generic_name || 'Produit sans nom',
  ).trim();
  const brand = String(raw?.brands ?? '').split(',')[0].trim();
  const categories = String(raw?.categories ?? '')
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean);

  const offImage = String(raw?.image_front_url || raw?.image_url || raw?.image_front_small_url || '').trim();
  const image_is_fallback = offImage.length === 0;

  const novaRaw = num(raw?.nova_group);
  const nova_group = novaRaw && novaRaw >= 1 && novaRaw <= 4 ? (Math.round(novaRaw) as 1 | 2 | 3 | 4) : null;

  const additives_tags: string[] = Array.isArray(raw?.additives_tags) ? raw.additives_tags : [];

  const nutriments: Nutriments = {
    calories: num(n['energy-kcal_100g']),
    energy_kj: num(n['energy_100g']) ?? num(n['energy-kj_100g']),
    carbohydrates: num(n['carbohydrates_100g']),
    sugars: num(n['sugars_100g']),
    fat: num(n['fat_100g']),
    saturated_fat: num(n['saturated-fat_100g']),
    monounsaturated_fat: num(n['monounsaturated-fat_100g']),
    polyunsaturated_fat: num(n['polyunsaturated-fat_100g']),
    trans_fat: num(n['trans-fat_100g']),
    proteins: num(n['proteins_100g']),
    fiber: num(n['fiber_100g']),
    salt: num(n['salt_100g']),
    sodium: num(n['sodium_100g']),
    cholesterol: num(n['cholesterol_100g']),
    calcium: num(n['calcium_100g']),
    iron: num(n['iron_100g']),
    vitamin_c: num(n['vitamin-c_100g']),
    potassium: num(n['potassium_100g']),
    magnesium: num(n['magnesium_100g']),
  };

  return {
    barcode,
    product_name,
    brand,
    image_url: offImage || fallbackImageFor(product_name, categories),
    image_is_fallback,
    nutriscore: grade(raw?.nutriscore_grade) as NutriscoreGrade,
    nova_group,
    ecoscore: grade(raw?.ecoscore_grade) as EcoscoreGrade,
    nutriments,
    ingredients_text: String(raw?.ingredients_text_fr || raw?.ingredients_text || '').trim(),
    ingredients_n: num(raw?.ingredients_n),
    additives_tags,
    additives_n: num(raw?.additives_n) ?? additives_tags.length,
    categories,
    quantity: String(raw?.quantity ?? '').trim(),
  };
}

/* ------------------------------------------------------------------ */
/* Score de santé                                                      */
/* ------------------------------------------------------------------ */

/**
 * Score de santé sur 100 — base 50, ajustée par le Nutri-Score, le groupe
 * NOVA, les nutriments clés pour 100 g, les additifs et l'Eco-Score.
 */
export function calculateHealthScore(product: Product): number {
  let score = 50;

  switch (product.nutriscore) {
    case 'a': score += 20; break;
    case 'b': score += 10; break;
    case 'c': break;
    case 'd': score -= 10; break;
    case 'e': score -= 20; break;
  }

  switch (product.nova_group) {
    case 1: score += 10; break;
    case 2: score += 5; break;
    case 3: score -= 5; break;
    case 4: score -= 15; break;
  }

  const { sugars, salt, saturated_fat, proteins, fiber } = product.nutriments;

  if (sugars !== null) {
    if (sugars > 20) score -= 10;
    else if (sugars > 10) score -= 5;
    else if (sugars < 3) score += 5;
  }

  if (salt !== null) {
    if (salt > 2) score -= 8;
    else if (salt > 1) score -= 4;
  }

  if (saturated_fat !== null) {
    if (saturated_fat > 10) score -= 8;
    else if (saturated_fat > 5) score -= 4;
  }

  if (proteins !== null) {
    if (proteins > 15) score += 8;
    else if (proteins > 8) score += 4;
  }

  if (fiber !== null) {
    if (fiber > 6) score += 8;
    else if (fiber > 3) score += 4;
  }

  const additives = product.additives_n;
  if (additives > 8) score -= 12;
  else if (additives > 4) score -= 6;
  else if (additives === 0) score += 5;

  switch (product.ecoscore) {
    case 'a': score += 5; break;
    case 'b': score += 3; break;
    case 'c': break;
    case 'd': score -= 3; break;
    case 'e': score -= 5; break;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Attache le score de santé au produit. */
export function withScore(product: Product): ScoredProduct {
  return { ...product, score: calculateHealthScore(product) };
}

/* ------------------------------------------------------------------ */
/* Helpers d'affichage                                                 */
/* ------------------------------------------------------------------ */

export function getScoreColor(score: number): 'forest' | 'ink' | 'terracotta' {
  if (score >= 70) return 'forest';
  if (score >= 50) return 'ink';
  if (score >= 30) return 'terracotta';
  return 'terracotta';
}

export function getScoreColorHex(score: number): string {
  if (score >= 70) return '#1F3D2B';
  if (score >= 50) return '#4A4A46';
  if (score >= 30) return '#C2683B';
  return '#A34E27';
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return 'Excellent';
  if (score >= 50) return 'Correct';
  if (score >= 30) return 'Médiocre';
  return 'À éviter';
}

/** Puces explicatives : pourquoi ce produit obtient ce score. */
export function getScoreReasons(product: Product): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const { sugars, salt, saturated_fat, proteins, fiber } = product.nutriments;

  if (product.nutriscore) {
    const tone = ['a', 'b'].includes(product.nutriscore) ? 'good' : product.nutriscore === 'c' ? 'neutral' : 'bad';
    reasons.push({ label: `Nutri-Score ${product.nutriscore.toUpperCase()}`, tone });
  }

  if (product.nova_group === 4) reasons.push({ label: 'Produit ultra-transformé', tone: 'bad' });
  else if (product.nova_group === 1) reasons.push({ label: 'Aliment brut ou peu transformé', tone: 'good' });
  else if (product.nova_group === 3) reasons.push({ label: 'Produit transformé', tone: 'neutral' });

  if (sugars !== null) {
    if (sugars > 20) reasons.push({ label: 'Très riche en sucres', tone: 'bad' });
    else if (sugars > 10) reasons.push({ label: 'Teneur élevée en sucres', tone: 'bad' });
    else if (sugars < 3) reasons.push({ label: 'Faible teneur en sucres', tone: 'good' });
  }

  if (salt !== null) {
    if (salt > 2) reasons.push({ label: 'Très salé', tone: 'bad' });
    else if (salt > 1) reasons.push({ label: 'Teneur en sel élevée', tone: 'bad' });
  }

  if (saturated_fat !== null) {
    if (saturated_fat > 10) reasons.push({ label: 'Beaucoup de graisses saturées', tone: 'bad' });
    else if (saturated_fat <= 1.5) reasons.push({ label: 'Peu de graisses saturées', tone: 'good' });
  }

  if (proteins !== null && proteins > 15) reasons.push({ label: 'Riche en protéines', tone: 'good' });
  if (fiber !== null && fiber > 6) reasons.push({ label: 'Riche en fibres', tone: 'good' });
  else if (fiber !== null && fiber > 3) reasons.push({ label: 'Source de fibres', tone: 'good' });

  if (product.additives_n === 0) reasons.push({ label: 'Aucun additif', tone: 'good' });
  else if (product.additives_n > 8) reasons.push({ label: `${product.additives_n} additifs`, tone: 'bad' });
  else if (product.additives_n > 4) reasons.push({ label: `${product.additives_n} additifs`, tone: 'bad' });
  else reasons.push({ label: `${product.additives_n} additif${product.additives_n > 1 ? 's' : ''}`, tone: 'neutral' });

  if (product.ecoscore && ['a', 'b'].includes(product.ecoscore)) {
    reasons.push({ label: `Eco-Score ${product.ecoscore.toUpperCase()}`, tone: 'good' });
  }

  return reasons;
}

/** `en:e330` → `E330`. */
export function formatAdditives(tags: string[]): string[] {
  return tags
    .map((tag) => tag.split(':').pop() ?? tag)
    .map((code) => code.trim().toUpperCase().replace(/^E-?/, 'E'))
    .filter(Boolean);
}
