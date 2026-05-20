import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Types ─────────────────────────────────────────────────────
export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Constants ────────────────────────────────────────────────
const PURPLE  = '#6D4AFF';
const WHITE   = '#FFFFFF';
const TEXT    = '#111827';
const MUTED   = '#6B7280';
const BG      = 'rgba(0,0,0,0.45)';

const OPEN_CONFIG  = { duration: 20, useNativeDriver: true } as const;
const CLOSE_CONFIG = { duration: 100, useNativeDriver: true } as const;

// ── Component ────────────────────────────────────────────────
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel    = 'Confirm',
  cancelLabel     = 'Cancel',
  confirmDestructive = true,
  icon            = 'trash-outline',
  onConfirm,
  onCancel,
}) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const executingRef = useRef(false);
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const cardScale       = useRef(new Animated.Value(1)).current;
  const cardOpacity     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      executingRef.current = false;
      setInternalVisible(true);
      backdropOpacity.setValue(1);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1,    ...OPEN_CONFIG }),
        Animated.spring(cardScale,       { toValue: 1,    friction: 7, tension: 160, useNativeDriver: true }),
        Animated.timing(cardOpacity,     { toValue: 1,    ...OPEN_CONFIG }),
      ]).start();
    }
  }, [visible]);
  const animateClose = useCallback((afterClose: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, ...CLOSE_CONFIG }),
      Animated.timing(cardScale,       { toValue: 0.88, ...CLOSE_CONFIG }),
      Animated.timing(cardOpacity,     { toValue: 0,    ...CLOSE_CONFIG }),
    ]).start(() => {
      setInternalVisible(false);
      InteractionManager.runAfterInteractions(afterClose);
    });
  }, [backdropOpacity, cardScale, cardOpacity]);
  const handleCancel = useCallback(() => {
    if (executingRef.current) return;
    animateClose(onCancel);
  }, [animateClose, onCancel]);
  const handleConfirm = useCallback(() => {
    if (executingRef.current) return;
    executingRef.current = true;
    animateClose(onConfirm);
  }, [animateClose, onConfirm]);
  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={internalVisible}
      animationType="none"      
      onRequestClose={handleCancel}
      hardwareAccelerated       
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>
      <View style={s.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            s.card,
            {
              opacity:   cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={s.iconBadge}>
            <Ionicons name={icon} size={28} color={PURPLE} />
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.divider} />
          <View style={s.buttonRow}>
            {/* Cancel */}
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
              delayPressIn={0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.cancelTxt}>{cancelLabel}</Text>
            </TouchableOpacity>

            {/* Divider vertical */}
            <View style={s.btnDivider} />

            {/* Confirm */}
            <TouchableOpacity
              style={[s.confirmBtn]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              delayPressIn={0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  s.confirmTxt,
                  confirmDestructive && s.confirmTxtDestructive,
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

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  centerer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 24,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 0,
    paddingHorizontal: 24,
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: MUTED,
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: PURPLE,
  },
  confirmTxtDestructive: {
    color: '#6D4AFF',
    left:1
  },
});

export default React.memo(ConfirmModal);

