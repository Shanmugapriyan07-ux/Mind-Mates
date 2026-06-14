import { Stack } from 'expo-router';

export default function SubScreensLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="chatScreen/[chatId]"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="userProfile/[userId]"
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack>
  );
}