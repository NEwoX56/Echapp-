'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'scanfood:intro-seen';

/**
 * Générique d'intro — vidéo Higgsfield plein écran au premier lancement,
 * logo ScanFood en sérif qui se révèle, puis retrait en fondu.
 *
 * Ne se rejoue pas : l'état est mémorisé par navigateur.
 */
export function Splash({ videoUrl }: { videoUrl: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      seen = false; // stockage indisponible : on joue le générique une fois
    }
    if (seen) return;

    setVisible(true);
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* sans stockage, le générique rejouera — acceptable */
    }

    const timer = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] overflow-hidden bg-forest"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setVisible(false)}
          role="presentation"
        >
          <motion.video
            src={videoUrl}
            autoPlay
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.85, scale: 1 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-forest/40 via-forest/10 to-forest/80" aria-hidden />

          <div className="relative flex h-full flex-col items-center justify-center px-8">
            <div className="overflow-hidden">
              <motion.h1
                className="font-serif text-[2.75rem] leading-none tracking-[-0.03em] text-cream"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              >
                ScanFood
              </motion.h1>
            </div>
            <motion.span
              className="mt-5 h-px bg-cream/45"
              initial={{ width: 0 }}
              animate={{ width: '5.5rem' }}
              transition={{ delay: 1.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
            />
            <motion.p
              className="mt-5 text-eyebrow uppercase tracking-[0.16em] text-cream/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.8 }}
            >
              Scanne · Compare · Choisis mieux
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
