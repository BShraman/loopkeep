import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True when the app is running inside Expo Go (as opposed to a development or
 * standalone build). Expo Go on Android dropped `expo-notifications` support in
 * SDK 53, so notification work must be skipped there to avoid errors — it will
 * run normally in a dev/standalone build.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
