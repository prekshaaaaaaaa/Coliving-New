import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const RoleSelectionPopup = ({ visible, onClose, onSelectRole }) => {
  const { colors, isDarkMode } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim1 = useRef(new Animated.Value(0)).current;
  const sparkleAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      rotateAnim.setValue(0);
      sparkleAnim1.setValue(0);
      sparkleAnim2.setValue(0);

      // Animate popup entrance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(sparkleAnim1, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(sparkleAnim1, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.delay(500),
            Animated.timing(sparkleAnim2, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(sparkleAnim2, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    }
  }, [visible]);

  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sparkle1Opacity = sparkleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const sparkle2Opacity = sparkleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 245, 238, 0.98)' }]}>
        <Animated.View
          style={[
            styles.popupContainer,
            {
              transform: [{ scale }],
              opacity: opacityAnim,
              backgroundColor: colors.cardBackground,
              ...(isDarkMode && {
                shadowColor: '#f3439b',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 25,
                elevation: 15,
              }),
            },
          ]}
        >
          {/* Decorative Background Elements */}
          <View style={styles.decorativeContainer}>
            {/* Animated rotating circle */}
            <Animated.View
              style={[
                styles.rotatingCircle,
                { transform: [{ rotate }] },
              ]}
            >
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Circle
                  cx="60"
                  cy="60"
                  r="55"
                  fill="none"
                  stroke="#f3439b"
                  strokeWidth="3"
                  strokeDasharray="8 8"
                />
              </Svg>
            </Animated.View>

            {/* Success Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Svg width={60} height={60} viewBox="0 0 60 60">
                  <Circle cx="30" cy="30" r="28" fill="#FFB84D" />
                  <Path
                    d="M18 30 L26 38 L42 22"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            </View>

            {/* Decorative small circles */}
            <View style={[styles.decorativeCircle, { top: 20, left: 20 }]}>
              <Svg width={12} height={12}>
                <Circle cx="6" cy="6" r="5" fill="#f3439b" />
              </Svg>
            </View>
            <View style={[styles.decorativeCircle, { top: 30, right: 25 }]}>
              <Svg width={8} height={8}>
                <Circle cx="4" cy="4" r="3" fill="#f799c0" />
              </Svg>
            </View>
            <View style={[styles.decorativeCircle, { bottom: 25, left: 30 }]}>
              <Svg width={10} height={10}>
                <Circle cx="5" cy="5" r="4" fill="#f3439b" opacity="0.6" />
              </Svg>
            </View>
            <View style={[styles.decorativeCircle, { bottom: 20, right: 20 }]}>
              <Svg width={12} height={12}>
                <Circle cx="6" cy="6" r="5" fill="#f799c0" opacity="0.7" />
              </Svg>
            </View>

            {/* Animated Sparkle decorations */}
            <Animated.View
              style={[
                styles.sparkle,
                { top: 15, right: 15, opacity: sparkle1Opacity },
              ]}
            >
              <Text style={styles.sparkleText}>✨</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.sparkle,
                { bottom: 15, left: 15, opacity: sparkle2Opacity },
              ]}
            >
              <Text style={styles.sparkleText}>✨</Text>
            </Animated.View>
          </View>

          {/* Content */}
          <Text style={[styles.title, { color: colors.text }]}>Choose Your Role</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Select how you want to use Coliving
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.roleButton,
                {
                  backgroundColor: colors.primaryButton,
                  ...(isDarkMode && {
                    shadowColor: colors.primaryButton,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                    elevation: 8,
                  }),
                },
              ]}
              onPress={() => onSelectRole('roommate')}
            >
              <Text style={styles.roleButtonText}>
                Searching for Roommates
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.roleButton,
                {
                  backgroundColor: colors.primaryButton,
                  ...(isDarkMode && {
                    shadowColor: colors.primaryButton,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                    elevation: 8,
                  }),
                },
              ]}
              onPress={() => onSelectRole('flatmate')}
            >
              <Text style={styles.roleButtonText}>
                Searching House for Roommates
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  decorativeContainer: {
    width: 140,
    height: 140,
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatingCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
  },
  iconContainer: {
    position: 'absolute',
    zIndex: 2,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB84D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorativeCircle: {
    position: 'absolute',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  roleButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  roleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default RoleSelectionPopup;

