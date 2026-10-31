import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

interface Props {
  scene: new () => Phaser.Scene;
  data: object;
  background: string;
  className?: string;
}

/** Mounts a Phaser game that fills its parent and tears it down on unmount. */
export function PhaserGame({ scene, data, background, className }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;

    // Canvas text needs the web fonts loaded first, or it renders in a fallback face.
    Promise.all([document.fonts.load('400 32px Bungee'), document.fonts.load('700 20px Rubik')])
      .catch(() => undefined)
      .then(() => {
        if (cancelled || !host.current) return;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host.current,
          backgroundColor: background,
          scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
          render: { antialias: true },
          input: { activePointers: 2 },
          banner: false,
          callbacks: {
            postBoot: (g) => {
              g.scene.add('main', scene, true, data);
            },
          },
        });
      });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
    // The scene and its data are fixed for the lifetime of a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className={className} style={{ position: 'absolute', inset: 0 }} />;
}
