import { usePrivy } from "../src/lib/privy";
import { isConfigured, configurationError } from "../src/config";
import { LaunchReady, LaunchScreen } from "../src/components/launch-screen";
import { WelcomeScreen } from "../src/screens/welcome";
import { SessionScreen } from "../src/screens/session";

function SessionEntry() {
  const { isReady, error } = usePrivy();
  if (!isReady && !error) return <LaunchScreen />;
  return (
    <LaunchReady>
      <SessionScreen />
    </LaunchReady>
  );
}

export default function Index() {
  return isConfigured ? (
    <SessionEntry />
  ) : (
    <LaunchReady>
      <WelcomeScreen setupMessage={configurationError() || undefined} />
    </LaunchReady>
  );
}
