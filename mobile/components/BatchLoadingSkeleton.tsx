import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

export const BatchLoadingSkeleton: React.FC = () => {
  // Animation References
  const spinValue = useRef(new Animated.Value(0)).current;
  const auraPulse = useRef(new Animated.Value(0.85)).current;

  // 3 Bouncing Staggered Dots
  const dot1Y = useRef(new Animated.Value(0)).current;
  const dot2Y = useRef(new Animated.Value(0)).current;
  const dot3Y = useRef(new Animated.Value(0)).current;

  const dot1Scale = useRef(new Animated.Value(0.7)).current;
  const dot2Scale = useRef(new Animated.Value(0.7)).current;
  const dot3Scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // 1. Continuous 360° Orbit Rotation Loop
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 2. Pod Aura Pulse Loop
    const auraAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulse, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(auraPulse, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Helper for Staggered Wave Bouncing Dots
    const createBounceAnimation = (yAnim: Animated.Value, scaleAnim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(yAnim, {
                toValue: -9,
                duration: 320,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1.25,
                duration: 320,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(yAnim, {
                toValue: 2,
                duration: 320,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 0.7,
                duration: 320,
                useNativeDriver: true,
              }),
            ]),
          ])
        ),
      ]);
    };

    const anim1 = createBounceAnimation(dot1Y, dot1Scale, 0);
    const anim2 = createBounceAnimation(dot2Y, dot2Scale, 160);
    const anim3 = createBounceAnimation(dot3Y, dot3Scale, 320);

    spinAnimation.start();
    auraAnimation.start();
    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      spinAnimation.stop();
      auraAnimation.stop();
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [spinValue, auraPulse, dot1Y, dot2Y, dot3Y, dot1Scale, dot2Scale, dot3Scale]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Outer Glowing Pod Wrapper */}
      <Animated.View style={[styles.auraWrapper, { transform: [{ scale: auraPulse }] }]}>
        <View style={styles.glassPod}>
          {/* Orbiting Spinner Ring Icon */}
          <Animated.View style={[styles.spinnerRingWrap, { transform: [{ rotate: spin }] }]}>
            <View style={styles.spinnerArc} />
          </Animated.View>

          {/* 3 Staggered Bouncing Wave Dots */}
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                styles.dot1,
                { transform: [{ translateY: dot1Y }, { scale: dot1Scale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                styles.dot2,
                { transform: [{ translateY: dot2Y }, { scale: dot2Scale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                styles.dot3,
                { transform: [{ translateY: dot3Y }, { scale: dot3Scale }] },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  auraWrapper: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  glassPod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  spinnerRingWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  spinnerArc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: '#0066FF',
    borderRightColor: '#0066FF',
    position: 'absolute',
    top: -2.5,
    left: -2.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginHorizontal: 4,
  },
  dot1: {
    backgroundColor: '#0066FF',
  },
  dot2: {
    backgroundColor: '#2563EB',
  },
  dot3: {
    backgroundColor: '#3B82F6',
  },
});
