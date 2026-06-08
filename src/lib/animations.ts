import { Variants } from 'framer-motion';

// ===== SHARED ANIMATION VARIANTS =====
// Single source of truth — used across all pages

export const CA_STAGGER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export const CA_STAGGER_FAST: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export const CA_ITEM: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(3px)' },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 220, damping: 24 }
  }
};

export const CA_ITEM_HERO: Variants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 100, damping: 20 }
  }
};

export const FADE_IN: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } }
};

export const SCALE_IN: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } }
};

export const SLIDE_UP: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
};

export const CA_ITEM_PULSE: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

export const CA_DANGER_PULSE: Variants = {
  animate: {
    opacity: [0.4, 1, 0.4],
    transition: { duration: 1.5, repeat: Infinity, ease: "linear" }
  }
};
