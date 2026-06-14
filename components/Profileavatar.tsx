import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Animated,
  StyleSheet, ViewStyle,
} from 'react-native';
const loadedUris = new Set<string>();
const COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706',
  '#DC2626', '#0891B2', '#65A30D', '#9333EA',
];
const nameColor = (name: string): string =>
  COLORS[name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
const nameInitials = (name: string): string =>
  name.trim().split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
interface Props {
  uri?:   string | null;
  name?:  string | null;
  size?:  number;
  style?: ViewStyle;
}
export const ProfileAvatar: React.FC<Props> = ({
  uri,
  name  = '',
  size  = 56,
  style,
}) => {
  const alreadyLoaded  = !!uri && loadedUris.has(uri);
  const [, setReady] = useState(alreadyLoaded);
  const fadeAnim = useRef(new Animated.Value(alreadyLoaded ? 1 : 0)).current;
  useEffect(() => {
    if (!uri) { setReady(false); fadeAnim.setValue(0); return; }
    if (
      loadedUris.has(uri)        ||
      uri.startsWith('file://')  ||
      uri.startsWith('data:')    ||
      uri.startsWith('blob:')
    ) {
      setReady(true);
      fadeAnim.setValue(1);
    } else {
      setReady(false);
      fadeAnim.setValue(0);
    }
  }, [uri]);

  const onLoad = () => {
    if (uri) loadedUris.add(uri);
    setReady(true);
    Animated.timing(fadeAnim, {
      toValue:         1,
      duration:        220,
      useNativeDriver: true,
    }).start();
  };
  const onError = () => {
    if (uri) loadedUris.delete(uri);
    setReady(false);
    fadeAnim.setValue(0);
  };
  const bg       = name ? nameColor(name) : '#7C3AED';
  const fontSize = size * 0.34;
  return (
    <View style={[
      s.wrap,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      style,
    ]}>
      {!!name && (
        <Text style={[s.initials, { fontSize }]} numberOfLines={1}>
          {nameInitials(name)}
        </Text>
      )}
      {!!uri && (
        <Animated.Image
          source={{
            uri,
            cache: alreadyLoaded ? 'force-cache' : 'default',
          }}
          style={[
            s.img,
            { width: size, height: size, borderRadius: size / 2 },
            { opacity: fadeAnim },
          ]}
          onLoad={onLoad}
          onError={onError}
        />
      )}
    </View>
  );
};
export const clearAvatarCache = (url: string) => {
  loadedUris.delete(url);
};
export const clearAllAvatarCache = () => {
  loadedUris.clear();
};
const s = StyleSheet.create({
  wrap:     { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#fff', fontWeight: '700', position: 'absolute' },
  img:      { position: 'absolute', top: 0, left: 0, resizeMode: 'cover' },
});

export default ProfileAvatar;