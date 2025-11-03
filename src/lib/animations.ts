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
 * Height expansion with fade (for collapsible panels)
 * Uses overflow: hidden to prevent content from peeking out during animation
 * Both height and opacity animate together for smooth, symmetric transitions
 */
export const expandVariants: Variants = {
  initial: { height: 0, opacity: 0, overflow: 'hidden' },
  animate: { height: 'auto', opacity: 1, overflow: 'visible' },
  exit: { height: 0, opacity: 0, overflow: 'hidden' },
};

/**
 * Transition for expand animations
 */
export const expandTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};

/**
 * Horizontal collapse with fade (for sidebars, toolbars, inline elements)
 * Uses scaleX for smooth horizontal collapse while fading
 * Anchored on the right: opens from right to left, closes from left to right
 */
export const collapseHorizontalVariants: Variants = {
  initial: { opacity: 0, scaleX: 0, transformOrigin: 'right' },
  animate: { opacity: 1, scaleX: 1, transformOrigin: 'right' },
  exit: { opacity: 0, scaleX: 0, transformOrigin: 'right' },
};

/**
 * Transition for horizontal collapse animations
 */
export const collapseTransition: Transition = {
  duration: ANIMATION_DURATION.normal,
  ease: ANIMATION_EASING,
};
