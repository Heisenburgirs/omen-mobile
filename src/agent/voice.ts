import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { showToast } from "../lib/toast";
import { useLatest } from "./use-latest";

// Speaking to the agent: the platform's speech recognizer (Android's, or the
// browser's) turns speech into the message draft as the user talks. Nothing
// is recorded or sent anywhere by OMEN; the text lands in the input for the
// user to read and send.
export function useVoiceInput(onTranscript: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const handler = useLatest(onTranscript);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (text) handler.current(text, event.isFinal);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (event.error === "aborted" || event.error === "no-speech") return;
    showToast(event.error === "not-allowed" ? "Allow the microphone to talk to your agent." : "Couldn't hear that. Try again.");
  });

  const toggle = useCallback(async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      // The first tap asks for the microphone. Once the user has said no for
      // good, Android stops showing the prompt, so the tap opens OMEN's
      // settings where it can be turned on.
      let permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain !== false) {
        permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      }
      if (!permission.granted) {
        if (Platform.OS !== "web" && permission.canAskAgain === false) {
          showToast("Turn on the microphone for OMEN in Settings.");
          void Linking.openSettings().catch(() => undefined);
        } else {
          showToast("Allow the microphone to talk to your agent.");
        }
        return;
      }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        showToast("Speech recognition isn't available on this device.");
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: false });
    } catch {
      showToast("Couldn't start listening. Try again.");
    }
  }, [listening]);

  return { listening, toggle };
}
