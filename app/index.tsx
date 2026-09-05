// import React from 'react';
// import { View } from 'react-native';
// import { useStartup } from '../startup/useStartup';
// import AnimatedSplash from '../startup/animatedSplash';

// export default function Index() {
//   const { phase, onSplashAnimationComplete, onContentReady } = useStartup();
//   const contentReadyFired = React.useRef(false);

//   const handleContentLayout = React.useCallback(() => {
//     if (!contentReadyFired.current) {
//       contentReadyFired.current = true;
//       onContentReady();
//     }
//   }, [onContentReady]);

//   if (phase === 'booting' || phase === 'preloading') {
//     return null;
//   }

//   return (
//     <View style={{ flex: 1, backgroundColor: '#6D4AFF' }}>
//       <View
//         style={{ flex: 1 }}
//         onLayout={handleContentLayout}
//       >
//       </View>
//       {phase === 'splash_animating' && (
//         <AnimatedSplash onComplete={onSplashAnimationComplete} />
//       )}
//     </View>
//   );
// }

import React from 'react';
import { View } from 'react-native';

export default function Index() {
  return <View style={{ flex: 1, backgroundColor: '#6D4AFF' }} />;
}
