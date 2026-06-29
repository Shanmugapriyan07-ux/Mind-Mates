import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Image,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ms, s, vs } from "@/utils/scale";
import images from "@/constants/images";

// ─── Constants ────────────────────────────────────────────────────────────────
const AGREED_KEY = "mindmates_community_agreed_v1";
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

// FIX 2: Responsive popup height — never too tall, never too small
const POPUP_W = Math.min(SCREEN_W * 0.88, 420); // max 420dp wide
const POPUP_MAX_H =
  SCREEN_H < 680 ? SCREEN_H * 0.90   // small phones
  : SCREEN_H < 800 ? SCREEN_H * 0.84 // normal phones
  : SCREEN_H * 0.78;                  // large phones / tablets

const BRAND = {
  purple:    "#6D4AFF",
  purpleSoft:"#EDE9FE",
  white:     "#FFFFFF",
  offWhite:  "#F9F8FF",
  text:      "#0F0A1E",
  sub:       "#6B7280",
  border:    "#EEEBFF",
  divider:   "#F0EEF8",
  overlay:   "rgba(10,6,30,0.62)",
};

const GUIDELINES = [
  {
    icon:  "heart" as const,
    color: "#6D4AFF",
    bg:    "rgba(109,74,255,0.10)",
    title: "Treat everyone with respect",
    body:  "Be kind, welcoming, and respectful. Harassment, bullying, hate speech, or abusive behaviour are not allowed.",
  },
  {
    icon:  "people" as const,
    color: "#6D4AFF",
    bg:    "rgba(109,74,255,0.10)",
    title: "Build genuine connections",
    body:  "MindMates helps people with similar interests discover and support one another. Build authentic friendships.",
  },
  {
    icon:  "chatbubbles" as const,
    color: "#00B4D8",
    bg:    "rgba(0,180,216,0.10)",
    title: "Communicate thoughtfully",
    body:  "Respect personal boundaries and differences. Positive conversations create a healthy community.",
  },
  {
    icon:  "shield-checkmark" as const,
    color: "#22C55E",
    bg:    "rgba(34,197,94,0.10)",
    title: "Respect privacy",
    body:  "Never share personal information, photos, or conversations without permission.",
  },
  {
    icon:  "ban" as const,
    color: "#F59E0B",
    bg:    "rgba(245,158,11,0.10)",
    title: "No scams or fake profiles",
    body:  "Impersonation, spam, and inappropriate content are not permitted and may result in restrictions.",
  },
  {
    icon:  "star" as const,
    color: "#A855F7",
    bg:    "rgba(168,85,247,0.10)",
    title: "Help build a positive space",
    body:  "Everyone plays a role in making MindMates a place where friendships grow and people feel welcome.",
  },
];

// ─── GuidelineRow ─────────────────────────────────────────────────────────────
const GuidelineRow = ({
  icon, color, bg, title, body, index,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string; bg: string; title: string; body: string; index: number;
}) => (
  <View style={[gr.row, index > 0 && gr.rowBorder]}>
    <View style={[gr.iconWrap, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={s(18)} color={color} />
    </View>
    <View style={gr.text}>
      <Text style={gr.title}>{title}</Text>
      <Text style={gr.body}>{body}</Text>
    </View>
  </View>
);

const gr = StyleSheet.create({
  row: {
    flexDirection:   "row",
    alignItems:      "flex-start",
    paddingVertical: vs(10),
    gap:             s(12),
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: BRAND.divider,
  },
  iconWrap: {
    width:          s(36),
    height:         s(36),
    borderRadius:   s(10),
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    marginTop:      vs(1),
  },
  text:  { flex: 1 },
  title: { fontSize: ms(13.5), fontWeight: "700", color: BRAND.text, marginBottom: vs(2) },
  body:  { fontSize: ms(12), color: BRAND.sub, lineHeight: ms(17) },
});

// ─── CommunityGuidelinesSheet ─────────────────────────────────────────────────
export const CommunityGuidelinesSheet: React.FC = () => {
  // FIX 2: Three states — never render during the async check
  // "checking" → reading AsyncStorage, render nothing
  // "visible"  → show popup
  // "hidden"   → agreed or error, render nothing forever
  const [state, setState] = useState<"checking" | "visible" | "hidden">("checking");

  // FIX 1: Center popup — scale + fade animation instead of slideY
  const scale      = useRef(new Animated.Value(0.88)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const bgOpacity  = useRef(new Animated.Value(0)).current;
  const animDone   = useRef(false);

  // FIX 2: Read storage once. Show only if never agreed.
  useEffect(() => {
    AsyncStorage.getItem(AGREED_KEY)
      .then((val) => {
        if (val === "true") {
          // Already agreed — never show
          setState("hidden");
        } else {
          setState("visible");
          // FIX 1: Animate in as centered popup (scale + fade)
          Animated.parallel([
            Animated.spring(scale, {
              toValue:         1,
              useNativeDriver: true,
              damping:         22,
              stiffness:       280,
              mass:            0.8,
            }),
            Animated.timing(opacity, {
              toValue:         1,
              duration:        220,
              useNativeDriver: true,
            }),
            Animated.timing(bgOpacity, {
              toValue:         1,
              duration:        280,
              useNativeDriver: true,
            }),
          ]).start();
        }
      })
      .catch(() => setState("hidden"));
  }, []);

  const animateOut = (then: () => void) => {
    if (animDone.current) return;
    animDone.current = true;
    Animated.parallel([
      Animated.timing(scale, {
        toValue:         0.92,
        duration:        200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        180,
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue:         0,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start(() => then());
  };

  // FIX 2: Write storage BEFORE hiding so crash can't lose the value
  const handleAgree = () => {
    animateOut(async () => {
      try {
        await AsyncStorage.setItem(AGREED_KEY, "true");
      } catch {}
      setState("hidden");
    });
  };

  // FIX 2: "Not Now" — dismiss visually but do NOT write storage.
  // Next time user opens the app and comes to home, it reappears.
  // We set state to "hidden" only for THIS session — next mount it
  // will read storage again, find no value, and show again.
  const handleNotNow = () => {
    animateOut(() => setState("hidden"));
  };

  if (state !== "visible") return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      // FIX 2: Block hardware back — force user to make a choice
      onRequestClose={() => {/* intentionally blocked */}}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Dimmed backdrop — tap does nothing (forces button choice) */}
      <Animated.View style={[sh.backdrop, { opacity: bgOpacity }]} />

      {/* FIX 1: Center container — flexbox centering, not bottom anchor */}
      <View style={sh.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            sh.popup,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Logo */}
          <View style={sh.logoRow}>
            <Image source={images.icon} style={sh.logo} />
          </View>

          {/* Headline */}
          <Text style={sh.headline}>
            Welcome to <Text style={sh.headlineBrand}>MindMates</Text>
          </Text>

          {/* Subhead */}
          <Text style={sh.subhead}>
            Find friends who share your interests and passions — help us build
            a community based on kindness, trust, and genuine connections.
          </Text>

          {/* Divider */}
          <View style={sh.divider} />

          {/* Scrollable guidelines */}
          <ScrollView
            style={sh.scroll}
            contentContainerStyle={sh.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            {GUIDELINES.map((g, i) => (
              <GuidelineRow key={g.title} index={i} {...g} />
            ))}

            {/* Footer */}
            <View style={sh.footerNote}>
              <Text style={sh.footerText}>
                By continuing, you agree to follow our{" "}
                <Text style={sh.footerLink}>Community Guidelines</Text>
                {" "}and help make MindMates a safe place for everyone.
              </Text>
              <View style={sh.footerHint}>
                <Ionicons name="shield-outline" size={s(11)} color={BRAND.sub} />
                <Text style={sh.footerHintText}>
                  Reviewable anytime in Settings.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Divider above buttons */}
          <View style={sh.divider} />

          {/* Action buttons */}
          <View style={sh.actions}>
            <TouchableOpacity
              style={sh.btnSecondary}
              onPress={handleNotNow}
              activeOpacity={0.7}
            >
              <Text style={sh.btnSecondaryText}>Not Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={sh.btnPrimary}
              onPress={handleAgree}
              activeOpacity={0.85}
            >
              <Text style={sh.btnPrimaryText}>I Agree &amp; Continue</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND.overlay,
  },

  // FIX 1: Full-screen flex container that centers the popup
  centerer: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: s(20),
  },

  // FIX 1: Popup card — fixed width, max height, rounded all corners
  popup: {
    backgroundColor:  BRAND.white,
    borderRadius:     s(24),
    width:            POPUP_W,
    maxHeight:        POPUP_MAX_H,
    paddingTop:       vs(20),
    paddingHorizontal: s(20),
    paddingBottom:    vs(16),
    // Premium card shadow
    shadowColor:      "#000",
    shadowOffset:     { width: 0, height: 8 },
    shadowOpacity:    0.18,
    shadowRadius:     24,
    elevation:        20,
    // Prevent content overflow
    overflow:         "hidden",
  },

  logoRow: {
    alignItems:   "center",
    marginBottom: vs(10),
  },
  logo: {
    width:        s(45),
    height:       s(45),
    borderRadius: s(13),
  },

  headline: {
    fontSize:      ms(20),
    fontWeight:    "800",
    color:         BRAND.text,
    textAlign:     "center",
    letterSpacing: -0.3,
    marginBottom:  vs(6),
  },
  headlineBrand: {
    color: BRAND.purple,
  },

  subhead: {
    fontSize:          ms(12.5),
    color:             BRAND.sub,
    textAlign:         "center",
    lineHeight:        ms(18.5),
    marginBottom:      vs(12),
    paddingHorizontal: s(2),
  },

  divider: {
    height:          1,
    backgroundColor: BRAND.divider,
    marginVertical:  vs(6),
  },

  // FIX 2: Scroll area fills remaining space between header and buttons
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: vs(4),
  },

  footerNote: {
    marginTop:      vs(10),
    paddingTop:     vs(10),
    borderTopWidth: 1,
    borderTopColor: BRAND.divider,
    gap:            vs(5),
  },
  footerText: {
    fontSize:   ms(11),
    color:      BRAND.sub,
    textAlign:  "center",
    lineHeight: ms(16),
  },
  footerLink: {
    color:      BRAND.purple,
    fontWeight: "600",
  },
  footerHint: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            s(4),
  },
  footerHintText: {
    fontSize: ms(10.5),
    color:    BRAND.sub,
  },

  actions: {
    flexDirection: "row",
    gap:           s(10),
    marginTop:     vs(10),
  },

  btnSecondary: {
    flex:            1,
    paddingVertical: vs(13),
    borderRadius:    s(12),
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1.5,
    borderColor:     BRAND.border,
    backgroundColor: BRAND.offWhite,
  },
  btnSecondaryText: {
    fontSize:   ms(14),
    fontWeight: "600",
    color:      BRAND.sub,
  },

  btnPrimary: {
    flex:            1.65,
    paddingVertical: vs(13),
    borderRadius:    s(12),
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: BRAND.purple,
    elevation:       4,
    shadowColor:     BRAND.purple,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.30,
    shadowRadius:    10,
  },
  btnPrimaryText: {
    fontSize:      ms(14),
    fontWeight:    "700",
    color:         BRAND.white,
    letterSpacing: 0.1,
  },
});

export default CommunityGuidelinesSheet;