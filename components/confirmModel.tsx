import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    InteractionManager,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel?: () => void; // Make optional, for explicit cancel button
  onDismiss?: () => void; // For back button / tap outside
}
const PURPLE = "#6D4AFF";
const WHITE = "#FFFFFF";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BG = "rgba(0,0,0,0.45)";
const OPEN_CONFIG = { duration: 20, useNativeDriver: true } as const;
const CLOSE_CONFIG = { duration: 100, useNativeDriver: true } as const;
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDestructive = true,
  icon = "trash-outline",
  onConfirm,
  onCancel, // This is for the explicit cancel button
  onDismiss, // This is for modal dismissal (back button, tap outside)
}) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const executingRef = useRef(false);
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) {
      executingRef.current = false;
      setInternalVisible(true);
      backdropOpacity.setValue(1);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, ...OPEN_CONFIG }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, { toValue: 1, ...OPEN_CONFIG }),
      ]).start();
    }
  }, [visible]);
  const animateClose = useCallback(
    (afterClose: () => void) => {
      Animated.parallel([
        // Use a shorter duration for dismissal animation
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setInternalVisible(false);
        InteractionManager.runAfterInteractions(afterClose);
      });
    },
    [backdropOpacity, cardScale, cardOpacity],
  );
  const handleCancel = useCallback(() => {
    if (executingRef.current) return;
    animateClose(onCancel || (() => {})); // Call onCancel if provided, else do nothing
  }, [animateClose, onCancel]);
  const handleConfirm = useCallback(() => {
    if (executingRef.current) return;
    executingRef.current = true;
    animateClose(onConfirm);
  }, [animateClose, onConfirm]);
  const handleDismiss = useCallback(() => {
    if (executingRef.current) return;
    animateClose(onDismiss || (() => {})); // Call onDismiss if provided, else do nothing
  }, [animateClose, onDismiss]);

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={internalVisible}
      animationType="none"
      onRequestClose={handleDismiss} // onRequestClose now calls handleDismiss
      hardwareAccelerated
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
        <Animated.View style={[st.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>
      <View style={st.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            st.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={st.iconBadge}>
            <Ionicons name={icon} size={28} color={PURPLE} />
          </View>
          <Text style={st.title}>{title}</Text>
          <Text style={st.message}>{message}</Text>
          <View style={st.divider} />
          <View style={st.buttonRow}>
            <TouchableOpacity
              style={st.cancelBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
              delayPressIn={0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={st.cancelTxt}>{cancelLabel}</Text>
            </TouchableOpacity>
            <View style={st.btnDivider} />
            <TouchableOpacity
              style={[st.confirmBtn]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              delayPressIn={0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  st.confirmTxt,
                  confirmDestructive && st.confirmTxtDestructive,
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  centerer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(32),
  },
  card: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: s(24),
    alignItems: "center",
    paddingTop: s(32),
    paddingBottom: s(0),
    paddingHorizontal: s(24),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: s(24),
      },
      android: {
        elevation: s(16),
      },
    }),
  },
  iconBadge: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(18),
  },
  title: {
    fontSize: ms(18),
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: vs(8),
  },
  message: {
    fontSize: ms(14),
    color: MUTED,
    textAlign: "center",
    lineHeight: vs(20),
    marginBottom: vs(28),
  },
  divider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    height: vs(52),
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTxt: {
    fontSize: ms(15),
    fontWeight: "600",
    color: MUTED,
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: vs(8),
  },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTxt: {
    fontSize: ms(15),
    fontWeight: "700",
    color: PURPLE,
  },
  confirmTxtDestructive: {
    color: "#6D4AFF",
    left: vs(1),
  },
});
export default React.memo(ConfirmModal);
