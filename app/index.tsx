// app/index.tsx (or _layout.tsx — wherever your root is)
import React from 'react';
import { View } from 'react-native';
import { useStartup } from '../startup/useStartup';
import AnimatedSplash from '../startup/animatedSplash';
import RootLayout from './_layout'; // your actual app

export default function Index() {
  const { phase, onSplashAnimationComplete, onContentReady } = useStartup();
  const contentReadyFired = React.useRef(false);

  const handleContentLayout = React.useCallback(() => {
    if (!contentReadyFired.current) {
      contentReadyFired.current = true;
      onContentReady();
    }
  }, [onContentReady]);

  if (phase === 'booting' || phase === 'preloading') {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{ flex: 1 }}
        onLayout={handleContentLayout}
      >
        <RootLayout />
      </View>
      {phase === 'splash_animating' && (
        <AnimatedSplash onComplete={onSplashAnimationComplete} />
      )}
    </View>
  );
}