'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Overlay plein écran de célébration — vidéo Higgsfield en fond,
 * nom du gagnant révélé au masque par-dessus, fondu de sortie.
 *
 * Tant que la vidéo n'est pas prête, un aplat crème tient la place :
 * la chorégraphie typographique se joue quoi qu'il arrive.
 */
export function VictoryOverlay({
  open,
  videoUrl,
  eyebrow,
  name,
  score,
  durationMs = 4200,
  onDone,
}: {
  open: boolean;
  videoUrl: string | null;
  eyebrow: string;
  name: string;
  score: number;
  durationMs?: number;
  onDone: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] overflow-hidden bg-forest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          onClick={onDone}
          role="dialog"
          aria-label={`${eyebrow} : ${name}`}
        >
          {/* Placeholder crème pendant la génération / le chargement. */}
          <AnimatePresence>
            {!ready && (
              <motion.div
                className="absolute inset-0 bg-cream-deep"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            )}
          </AnimatePresence>

          {videoUrl && (
            <motion.video
              key={videoUrl}
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onCanPlay={() => setReady(true)}
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 0.8, scale: 1 }}
              transition={{ duration: 2.2, ease: EASE }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-forest/55 via-forest/15 to-forest/90" aria-hidden />

          <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
            <motion.p
              className="text-eyebrow uppercase tracking-[0.16em] text-cream/65"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7, ease: EASE }}
            >
              {eyebrow}
            </motion.p>

            {/* Révélation au masque : le nom monte depuis sous la ligne. */}
            <div className="mt-5 overflow-hidden">
              <motion.h2
                className="font-serif text-[2rem] leading-tight tracking-[-0.02em] text-cream"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.6, duration: 1, ease: EASE }}
              >
                {name}
              </motion.h2>
            </div>

            <motion.span
              className="mt-6 h-px bg-cream/40"
              initial={{ width: 0 }}
              animate={{ width: '4rem' }}
              transition={{ delay: 1.25, duration: 0.8, ease: EASE }}
              aria-hidden
            />

            <motion.p
              className="tnum mt-6 font-serif text-[3.25rem] leading-none text-cream"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.45, duration: 0.9, ease: EASE }}
            >
              {score}
              <span className="ml-1 font-sans text-[0.875rem] text-cream/60">/100</span>
            </motion.p>

            <motion.p
              className="absolute bottom-14 text-[0.75rem] text-cream/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4, duration: 0.8 }}
            >
              Touche pour continuer
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
