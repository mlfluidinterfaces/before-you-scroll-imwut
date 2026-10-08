const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || "your-eas-project-id";
const UPDATES_URL =
	process.env.EXPO_UPDATES_URL || "https://u.expo.dev/your-eas-project-id";

export default {
	expo: {
		name: "Screentime App",
		slug: "screentime-collection",
		version: "1.0.51",
		orientation: "portrait",
		// Main app icon (1024x1024 recommended)
		icon: "./assets/images/icon.png",
		scheme: "screentimeapp",
		userInterfaceStyle: "automatic",
		newArchEnabled: true,
	// iOS Configuration
	ios: {
		runtimeVersion: "1.0.51",
		supportsTablet: true,
			bundleIdentifier: "com.fluidinterfaces.screentimeApp",
			// iOS will automatically generate all required icon sizes from the main icon
			icon: "./assets/images/icon.png",
			googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST
				? "./GoogleService-Info.plist"
				: "./GoogleService-Info.plist",
		},
	// Android Configuration
	android: {
		runtimeVersion: "1.0.51",
		// Adaptive icon for Android 8.0+ (adaptive-icon.png should be 1024x1024)
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#ffffff",
			// Optional: can also set monochromeImage for themed icons
		},
			edgeToEdgeEnabled: true,
			googleServicesFile: process.env.GOOGLE_SERVICES_JSON
				? "./google-services.json"
				: "./google-services.json",
			package: "com.fluidinterfaces.screentimeApp",
		},
		web: {
			bundler: "metro",
			output: "static",
			favicon: "./assets/images/favicon.png",
		},
		// Splash screen configuration
		splash: {
			image: "./assets/images/splash-icon.png",
			resizeMode: "contain",
			backgroundColor: "#ffffff",
		},
		plugins: [
			"expo-localization",
			"expo-router",
			"expo-notifications",
			"@react-native-firebase/app",
			"@react-native-firebase/app-distribution",
			[
				"expo-splash-screen",
				{
					image: "./assets/images/splash-icon.png",
					imageWidth: 200,
					resizeMode: "contain",
					backgroundColor: "#ffffff",
				},
			],
			"expo-secure-store",
			[
				"expo-updates",
				{
					username: process.env.EAS_UPDATES_USERNAME || "your-expo-username",
				},
			],
			[
				"@sentry/react-native/expo",
				{
					url: process.env.SENTRY_URL || "https://sentry.io/",
					project: process.env.SENTRY_PROJECT || "your-sentry-project",
					organization: process.env.SENTRY_ORG || "your-sentry-org",
				},
			],
		],
		experiments: {
			typedRoutes: true,
		},
		updates: {
			url: UPDATES_URL,
		},
		extra: {
			router: {},
			eas: {
				projectId: EAS_PROJECT_ID,
			},
		},
		owner: process.env.EXPO_OWNER || "your-expo-username",
	},
};
