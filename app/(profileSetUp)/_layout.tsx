import { Stack } from "expo-router";
import React from "react";
export default function ProfileSetUpLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:   false,
        gestureEnabled: false,
        animation:     "slide_from_right",
      }}
    />
  );
}