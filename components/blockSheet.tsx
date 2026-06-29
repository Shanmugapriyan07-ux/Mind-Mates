import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
interface MenuItem {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
  dividerAfter?: boolean;
}
interface Props {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
}
export const ChatMenuSheet = ({ visible, onClose, items }: Props) => {
  const progress = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      progress.value = withSpring(1, {
        damping: 20,
        stiffness: 300,
        mass: 0.6,
      });
    } else {
      progress.value = withTiming(
        0,
        {
          duration: 150,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(setShouldRender)(false);
        },
      );
    }
  }, [visible]);

  const CARD_WIDTH = 220;
  const animatedStyle = useAnimatedStyle(() => {
    const scale = 0.85 + progress.value * 0.15;
    const translateY = -8 + progress.value * 8;
    const translateX = (CARD_WIDTH / 2) * (1 - scale);
    return {
      opacity: progress.value,
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.3,
  }));

  if (!shouldRender) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#000" },
            backdropStyle,
          ]}
          pointerEvents="none"
        />
      </Pressable>
      <Animated.View
        style={[m.card, { width: CARD_WIDTH }, animatedStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        {items.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={m.item}
              onPress={() => {
                onClose();
                setTimeout(item.onPress, 120);
              }}
              activeOpacity={0.65}
            >
              <Ionicons
                name={item.icon as any}
                size={18}
                color={item.color ?? "#6D4AFF"}
              />
              <Text style={[m.label, item.color ? { color: item.color } : {}]}>
                {item.label}
              </Text>
            </TouchableOpacity>
            {item.dividerAfter && index < items.length - 1 && (
              <View style={m.divider} />
            )}
          </View>
        ))}
      </Animated.View>
    </Modal>
  );
};
export default ChatMenuSheet;
const m = StyleSheet.create({
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(24),
  },
  card: {
    position: "absolute",
    top: vs(70),
    right: s(32),
    backgroundColor: "#FFFFFF",
    borderRadius: s(8),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: s(15),
    shadowOffset: { width: s(5), height: s(4) },
    elevation: s(5),
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
    paddingHorizontal: s(18),
    paddingVertical: s(12),
  },
  label: {
    fontSize: ms(15),
    fontWeight: "400",
    color: "#1a1a1a",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
});
