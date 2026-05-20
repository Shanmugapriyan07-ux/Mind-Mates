import images from "@/constants/images";
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
export default function AuthLoadingScreen(): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={ls.container}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Image source={images.splash} style={ls.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const ls = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  logo: { width: 80, height: 80 },
  text: { color: "#fff", fontSize: 16, fontWeight: "600", opacity: 0.85 },
});
