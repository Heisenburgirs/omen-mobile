import { Easing } from "react-native";

// One manner of moving for everything that opens and closes (sheets,
// drawers, pushed screens, the trade dock): it arrives quickly and settles
// gently, and it leaves a little faster than it came, gathering speed on
// the way out. Short enough to never be waited for, long enough to be seen
// as movement rather than a jump.
export const motion = {
  /** Opening. */
  enter: 300,
  /** Closing. */
  exit: 220,
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
