import * as Sentry from '@sentry/react-native';
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
}

export default Sentry.wrap(function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen 
          name="survey" 
          options={{
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="eod" 
          options={{
            gestureEnabled: false,
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
});