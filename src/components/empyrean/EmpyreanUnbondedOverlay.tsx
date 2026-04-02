import { motion } from 'framer-motion';

interface EmpyreanUnbondedOverlayProps {
  isUnbonded: boolean;
}

export function EmpyreanUnbondedOverlay({ isUnbonded }: EmpyreanUnbondedOverlayProps) {
  if (!isUnbonded) return null;

  return (
    <>
      {/* Filter layer — crushes the dragon art into a dark silhouette */}
      <div
        className="fixed inset-0 pointer-events-none z-[2]"
        style={{
          backdropFilter: 'brightness(0.08) saturate(0) contrast(1.4)',
          WebkitBackdropFilter: 'brightness(0.08) saturate(0) contrast(1.4)',
        }}
      />

      {/* Subtle dark blue-grey wash for emotional tone */}
      <div
        className="fixed inset-0 pointer-events-none z-[3]"
        style={{
          backgroundColor: 'rgba(15, 18, 25, 0.4)',
        }}
      />

      {/* Vignette — darker at edges */}
      <div
        className="fixed inset-0 pointer-events-none z-[4]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.4) 80%)',
        }}
      />

      {/* Faint text — the silence made visible */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="fixed inset-0 pointer-events-none z-[6] flex items-center justify-center"
      >
        <p
          className="font-cinzel italic text-sm tracking-wider text-center px-12 leading-relaxed"
          style={{
            color: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          The silence where a bond should be
        </p>
      </motion.div>
    </>
  );
}
