import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ style }) => {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isDarkMode ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [isDarkMode]);

  const circleTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });

  return (
    <TouchableOpacity
      style={[styles.toggleContainer, style, { backgroundColor: colors.cardBackground, borderColor: '#f3439b' }]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <View style={[styles.toggle, { backgroundColor: isDarkMode ? '#f3439b' : '#E0E0E0' }]}>
        <Animated.View
          style={[
            styles.toggleCircle,
            {
              transform: [{ translateX: circleTranslateX }],
            },
          ]}
        />
      </View>
      <Text style={[styles.toggleText, { color: '#f3439b' }]}>
        {isDarkMode ? '🌙' : '☀️'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginRight: 6,
  },
  toggleActive: {
    backgroundColor: '#f3439b',
  },
  toggleCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ThemeToggle;

