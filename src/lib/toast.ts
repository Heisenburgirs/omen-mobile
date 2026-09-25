import { ToastAndroid } from "react-native";

export function showErrorToast(message: string) {
  ToastAndroid.show(message, ToastAndroid.LONG);
}
/** A short confirmation that an action happened, e.g. a watchlist change. */
export function showToast(message: string) {
  ToastAndroid.show(message, ToastAndroid.SHORT);
}