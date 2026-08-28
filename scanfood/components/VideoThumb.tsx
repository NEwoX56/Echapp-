'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

/**
 * Miniature vidéo légère : muette, sans autoplay, lecture à la demande.
 * Le placeholder crème tient la place tant que rien n'est chargé.
 */
export function VideoThumb({ src, label }: { src: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Mettre en pause : ${label}` : `Lire : ${label}`}
      className="relative block aspect-[9/16] w-full overflow-hidden border border-rule bg-cream-deep"
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onEnded={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />
      {!playing && (
        <span className="absolute inset-0 flex items-center justify-center bg-cream/35">
          <Play size={18} strokeWidth={1.25} className="text-ink" aria-hidden />
        </span>
      )}
    </button>
  );
}
