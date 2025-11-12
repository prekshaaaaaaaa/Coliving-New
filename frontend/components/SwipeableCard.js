import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;
const ROTATION_MULTIPLIER = 0.1;

const SwipeableCard = ({ match, onSwipeLeft, onSwipeRight, index }) => {
  const { colors, isDarkMode } = useTheme();
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-30deg", "0deg", "30deg"],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right - Accept
          Animated.spring(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: gestureState.dy },
            useNativeDriver: false,
          }).start(() => {
            if (typeof onSwipeRight === "function") onSwipeRight();
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - Reject
          Animated.spring(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gestureState.dy },
            useNativeDriver: false,
          }).start(() => {
            if (typeof onSwipeLeft === "function") onSwipeLeft();
          });
        } else {
          // Return to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const cardStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate },
    ],
  };

  const leftOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const rightOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const prefs = match.preferences || {};

  return (
    <Animated.View
      style={[styles.card, cardStyle, { backgroundColor: colors.cardBackground }]}
      {...panResponder.panHandlers}
    >
      {/* Reject Overlay */}
      <Animated.View
        style={[styles.overlay, styles.rejectOverlay, { opacity: leftOpacity }]}
      >
        <Text style={styles.rejectOverlayText}>NOPE</Text>
      </Animated.View>

      {/* Accept Overlay */}
      <Animated.View
        style={[styles.overlay, styles.acceptOverlay, { opacity: rightOpacity }]}
      >
        <Text style={styles.acceptOverlayText}>LIKE</Text>
      </Animated.View>

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Profile Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require("../assets/profile.png")}
            style={styles.profileImage}
          />
          <View style={[styles.scoreBadge, { backgroundColor: colors.primaryButton }]}>
            <Text style={styles.scoreText}>{match.compatibilityScore}%</Text>
          </View>
        </View>

        {/* Name and Basic Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.name, { color: colors.text }]}>
            {match.name || "User"}
          </Text>
          <Text style={[styles.matchType, { color: colors.textSecondary }]}>
            {match.type === "resident" ? "Resident" : "Roommate"}
          </Text>
        </View>

        {/* Preferences */}
        <View style={styles.preferencesSection}>
          {prefs.profession && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Profession:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>{prefs.profession}</Text>
            </View>
          )}

          {prefs.maxRent && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Budget:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>{prefs.maxRent}</Text>
            </View>
          )}

          {prefs.dietaryPreference && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Diet:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>
                {prefs.dietaryPreference}
              </Text>
            </View>
          )}

          {prefs.environmentPreference && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Environment:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>
                {prefs.environmentPreference}
              </Text>
            </View>
          )}

          {prefs.cleanlinessHabits && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Cleanliness:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>
                {prefs.cleanlinessHabits}
              </Text>
            </View>
          )}

          {prefs.schedule && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Schedule:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>{prefs.schedule}</Text>
            </View>
          )}

          {prefs.currentLocation && (
            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: colors.label }]}>Location:</Text>
              <Text style={[styles.prefValue, { color: colors.text }]}>
                {prefs.currentLocation}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 40,
    height: "85%",
    alignSelf: "center",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  overlay: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 20,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  rejectOverlay: {
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  acceptOverlay: {
    borderColor: "#34C759",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
  },
  rejectOverlayText: {
    fontSize: 64,
    fontWeight: "bold",
    letterSpacing: 4,
    color: "#FF3B30",
  },
  acceptOverlayText: {
    fontSize: 64,
    fontWeight: "bold",
    letterSpacing: 4,
    color: "#34C759",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: "#f3439b",
  },
  scoreBadge: {
    position: "absolute",
    top: 10,
    right: SCREEN_WIDTH / 2 - 100,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scoreText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  matchType: {
    fontSize: 16,
  },
  preferencesSection: {
    flex: 1,
  },
  prefRow: {
    flexDirection: "row",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  prefLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
    minWidth: 100,
  },
  prefValue: {
    fontSize: 16,
    flex: 1,
  },
});

export default SwipeableCard;

