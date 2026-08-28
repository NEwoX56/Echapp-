/** Nutriments pour 100 g, tels que renvoyés par OpenFoodFacts. */
export interface Nutriments {
  calories: number | null;
  energy_kj: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturated_fat: number | null;
  monounsaturated_fat: number | null;
  polyunsaturated_fat: number | null;
  trans_fat: number | null;
  proteins: number | null;
  fiber: number | null;
  salt: number | null;
  sodium: number | null;
  cholesterol: number | null;
  calcium: number | null;
  iron: number | null;
  vitamin_c: number | null;
  potassium: number | null;
  magnesium: number | null;
}

export type NutriscoreGrade = 'a' | 'b' | 'c' | 'd' | 'e' | null;
export type EcoscoreGrade = 'a' | 'b' | 'c' | 'd' | 'e' | null;

export interface Product {
  barcode: string;
  product_name: string;
  brand: string;
  image_url: string;
  /** Vrai si `image_url` vient d'un repli (catégorie / Higgsfield) et non d'OpenFoodFacts. */
  image_is_fallback: boolean;
  nutriscore: NutriscoreGrade;
  nova_group: 1 | 2 | 3 | 4 | null;
  ecoscore: EcoscoreGrade;
  nutriments: Nutriments;
  ingredients_text: string;
  ingredients_n: number | null;
  additives_tags: string[];
  additives_n: number;
  categories: string[];
  quantity: string;
}

export interface ScoredProduct extends Product {
  score: number;
}

export interface ScoreReason {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
}
