import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../Firebase";
import { apiCall } from "../config";
import RoleSelectionPopup from "../components/RoleSelectionPopup";
import { useTheme } from "../context/ThemeContext";

export default function QueryScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [popupVisible, setPopupVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleSelection = async (role) => {
    if (!user) {
      Alert.alert("Error", "User not logged in!");
      setPopupVisible(false);
      return;
    }

    setLoading(true);
    setPopupVisible(false);

    try {
      // Use the apiCall helper for better error handling
      const result = await apiCall("/setRole", {
        method: "POST",
        body: JSON.stringify({ uid: user.uid, role }),
      });

      if (!result.success) {
        Alert.alert(
          "Network Error",
          result.error ||
            "Failed to set role. Please check your connection and try again."
        );
        setLoading(false);
        setPopupVisible(true); // Show popup again on error
        return;
      }

      // Force token refresh to get updated claims
      await user.getIdToken(true);

      // Navigate based on role (use reset to clear stack)
      if (role === "flatmate") {
        navigation.reset({ index: 0, routes: [{ name: "Resident" }] });
      } else if (role === "roommate") {
        navigation.reset({ index: 0, routes: [{ name: "Roommate" }] });
      }
    } catch (error) {
      console.error("Role selection error:", error);
      Alert.alert(
        "Error",
        error.message || "An unexpected error occurred. Please try again."
      );
      setLoading(false);
      setPopupVisible(true); // Show popup again on error
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Setting up your profile...
          </Text>
        </View>
      )}

      <RoleSelectionPopup
        visible={popupVisible && !loading}
        onClose={() => setPopupVisible(false)}
        onSelectRole={handleRoleSelection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
});
