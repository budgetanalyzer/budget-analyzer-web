// src/lib/animations.ts
// Centralized animation configuration for consistent motion throughout the app
// All animations use opacity-only fades (no x/y movement) for simplicity and accessibility

import { Transition, Variants } from 'framer-motion';

/**
 * Standard animation durations
 */
export const ANIMATION_DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
} as const;

/**
 * Standard easing function for all animations
 */
export const ANIMATION_EASING = 'easeInOut';

/**
 * Standard transition for simple fade animations
 */
export const fadeTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};

/**
 * Transition for layout animations (when elements move due to other elements appearing/disappearing)
 */
export const layoutTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};

/**
 * Simple fade in/out variants (for use with AnimatePresence)
 */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Fade in only (no exit animation)
 */
export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

/**
 * Simple opacity fade for currency conversion card
 * No height animation to avoid layout shift - space is reserved, content fades in/out
 */
export const expandVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Transition for expand animations
 */
export const expandTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};

/**
 * Horizontal open from right to left with fade on exit
 * Uses scaleX for smooth horizontal collapse while fading
 * Anchored on the right: opens from right to left, closes from left to right
 * Use for toolbars/panels that appear on the right side
 */
export const collapseFromRightVariants: Variants = {
  initial: { opacity: 0, scaleX: 0, transformOrigin: 'right' },
  animate: { opacity: 1, scaleX: 1, transformOrigin: 'right' },
  exit: { opacity: 0, scaleX: 0, transformOrigin: 'right' },
};

/**
 * Horizontal open from left to right with fade on exit
 * Uses scaleX for smooth horizontal collapse while fading
 * Anchored on the left: opens from left to right, closes from right to left
 * Use for toolbars/panels that appear on the left side
 */
export const collapseFromLeftVariants: Variants = {
  initial: { opacity: 0, scaleX: 0, transformOrigin: 'left' },
  animate: { opacity: 1, scaleX: 1, transformOrigin: 'left' },
  exit: { opacity: 0, scaleX: 0, transformOrigin: 'left' },
};

/**
 * Transition for horizontal collapse animations
 */
export const collapseTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};

/**
 * Slide up from bottom with fade
 * Use for floating action bars that appear at the bottom of the viewport
 */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 100 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 100 },
};

/**
 * Transition for slide up animations
 */
export const slideUpTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};
