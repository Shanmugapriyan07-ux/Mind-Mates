import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const SkillCardSkeleton = () => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 150], // Moves the shimmer across the card
  });

  return (
    <View style={styles.card}>
      {/* Icon Placeholder */}
      <View style={styles.iconPlaceholder}>
        <AnimatedGradient
          colors={['#f2f2f2', '#e1e1e1', '#f2f2f2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.shimmer, { transform: [{ translateX }] }]}
        />
      </View>
      
      {/* Text Placeholder */}
      <View style={styles.textPlaceholder}>
         <View  />
      </View>

      {/* Checkmark Circle Placeholder */}
      <View style={styles.checkCircle} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '45%', // Matches your 2-column grid
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    margin: '2.5%',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    overflow: 'hidden',
  },
  textPlaceholder: {
    width: '80%',
    height: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
  },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default SkillCardSkeleton;