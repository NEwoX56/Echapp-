import type { ScoredProduct } from './types';

export interface ScanRecord {
  id: string;
  userId: string;
  barcode: string;
  product_name: string;
  brand: string;
  score: number;
  image_url: string;
  nutriscore: string | null;
  nova_group: number | null;
  ecoscore: string | null;
  product_data: ScoredProduct;
  created_at: string;
}

export interface FavoriteRecord {
  id: string;
  userId: string;
  barcode: string;
  product_name: string;
  brand: string;
  score: number;
  image_url: string;
  product_data: ScoredProduct;
  created_at: string;
}

export interface BattleRecord {
  id: string;
  userId: string;
  product_a_barcode: string;
  product_a_name: string;
  product_a_score: number;
  product_a_image: string;
  product_a_brand: string;
  product_a_data: ScoredProduct;
  product_b_barcode: string;
  product_b_name: string;
  product_b_score: number;
  product_b_image: string;
  product_b_brand: string;
  product_b_data: ScoredProduct;
  winner: 'a' | 'b' | 'tie';
  victory_video_url: string | null;
  created_at: string;
}

export interface TournamentEntry {
  barcode: string;
  product_name: string;
  brand: string;
  score: number;
  image_url: string;
}

export interface TournamentRecord {
  id: string;
  userId: string;
  products: TournamentEntry[];
  winner_name: string;
  winner_score: number;
  winner_image: string;
  product_count: number;
  coronation_video_url: string | null;
  created_at: string;
}

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  createdAt: string;
}
