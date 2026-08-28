'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { ScoreSmall } from '@/components/Score';
import { VideoThumb } from '@/components/VideoThumb';
import type { BattleRecord, ScanRecord, TournamentRecord } from '@/lib/records';

type Tab = 'scans' | 'battles' | 'tournaments';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'scans', label: 'Scans' },
  { id: 'battles', label: 'Combats' },
  { id: 'tournaments', label: 'Tournois' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function HistoryTabs({
  scans,
  battles,
  tournaments,
}: {
  scans: ScanRecord[];
  battles: BattleRecord[];
  tournaments: TournamentRecord[];
}) {
  const [tab, setTab] = useState<Tab>('scans');

  return (
    <div className="pt-8">
      <div className="flex gap-7 rule-b pb-3">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className="relative pb-2">
            <span className={`text-[0.875rem] ${tab === id ? 'text-ink' : 'text-ink-mute'}`}>{label}</span>
            {tab === id && (
              <motion.span
                layoutId="history-tab"
                className="absolute -bottom-[13px] left-0 right-0 h-px bg-forest"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="pt-8"
        >
          {tab === 'scans' &&
            (scans.length === 0 ? (
              <EmptyState
                image="rayon"
                title="Aucun scan pour le moment"
                body="Chaque produit consulté vient s’ajouter ici, du plus récent au plus ancien."
                cta={{ href: '/scanner', label: 'Scanner un produit' }}
              />
            ) : (
              <ul className="space-y-3">
                {scans.map((scan) => (
                  <li key={scan.id}>
                    <ProductCard
                      barcode={scan.barcode}
                      name={scan.product_name}
                      brand={scan.brand}
                      imageUrl={scan.image_url}
                      score={scan.score}
                      meta={formatDate(scan.created_at)}
                    />
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'battles' &&
            (battles.length === 0 ? (
              <EmptyState
                image="verre"
                title="Pas encore de duel"
                body="Deux produits, deux scores, un vainqueur. Le résultat se garde ici."
                cta={{ href: '/combat', label: 'Lancer le combat' }}
              />
            ) : (
              <ul className="space-y-4">
                {battles.map((battle) => {
                  const aWon = battle.winner === 'a';
                  const bWon = battle.winner === 'b';
                  return (
                    <li key={battle.id} className="border border-rule bg-white p-4">
                      <p className="eyebrow">{formatDate(battle.created_at)}</p>

                      <div className="mt-4 flex gap-4">
                        {battle.victory_video_url && (
                          <div className="w-20 shrink-0">
                            <VideoThumb
                              src={battle.victory_video_url}
                              label={`Victoire : ${aWon ? battle.product_a_name : battle.product_b_name}`}
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-3">
                          {(['a', 'b'] as const).map((side) => {
                            const won = side === 'a' ? aWon : bWon;
                            const name = side === 'a' ? battle.product_a_name : battle.product_b_name;
                            const score = side === 'a' ? battle.product_a_score : battle.product_b_score;
                            return (
                              <div key={side} className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate font-serif text-[0.9375rem] leading-snug ${
                                      won ? 'text-forest' : 'text-ink-soft'
                                    }`}
                                  >
                                    {name}
                                  </p>
                                  {won && <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-forest">Vainqueur</p>}
                                </div>
                                <ScoreSmall value={score} />
                              </div>
                            );
                          })}

                          {battle.winner === 'tie' && (
                            <p className="text-[0.75rem] uppercase tracking-[0.16em] text-ink-mute">Match nul</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}

          {tab === 'tournaments' &&
            (tournaments.length === 0 ? (
              <EmptyState
                image="pain"
                title="Aucun tournoi joué"
                body="Mets plusieurs références en lice et laisse le classement trancher."
                cta={{ href: '/tournament', label: 'Lancer le tournoi' }}
              />
            ) : (
              <ul className="space-y-4">
                {tournaments.map((tournament) => (
                  <li key={tournament.id} className="border border-rule bg-white p-4">
                    <p className="eyebrow">
                      {formatDate(tournament.created_at)} · {tournament.product_count} produits
                    </p>

                    <div className="mt-4 flex gap-4">
                      {tournament.coronation_video_url && (
                        <div className="w-20 shrink-0">
                          <VideoThumb
                            src={tournament.coronation_video_url}
                            label={`Couronnement : ${tournament.winner_name}`}
                          />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-mute">Champion</p>
                        <p className="mt-2 font-serif text-[1.0625rem] leading-snug text-forest">
                          {tournament.winner_name}
                        </p>
                        <div className="mt-3">
                          <ScoreSmall value={tournament.winner_score} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
