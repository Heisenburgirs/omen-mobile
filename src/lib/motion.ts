import { Easing } from "react-native";

// One manner of moving for everything that opens and closes (sheets,
// drawers, pushed screens, the trade dock): it arrives quickly and settles
// gently, and it leaves a little faster than it came, gathering speed on
// the way out. Snappy: under a fifth of a second in, quicker out.
export const motion = {
  /** Opening. */
  enter: 180,
  /** Closing. */
  exit: 130,
  /** Arrive fast, settle slowly. */
  easeOut: Easing.bezier(0.22, 1, 0.36, 1),
  /** Leave gently, then go. */
  easeIn: Easing.bezier(0.4, 0, 0.9, 0.6),
};
/** The duration and curve for a move to shown (true) or hidden (false). */
export const transition = (visible: boolean, reduceMotion = false) => ({
  duration: reduceMotion ? 0 : visible ? motion.enter : motion.exit,
  easing: visible ? motion.easeOut : motion.easeIn,
});
