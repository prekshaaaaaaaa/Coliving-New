import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../Firebase";
import { apiCall } from "../config";
import SwipeableCard from "../components/SwipeableCard";
import Toast from "react-native-toast-message";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// NOTE: Removed demo/mock fallback data. App will now show empty state or server error
// messages when backend returns no matches or fails. This avoids showing sample users.

export default function MatchesScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Please login first");
        navigation.navigate("Login");
        return;
      }

      setLoading(true);

      // Get user role from token, fallback to DB if claim is missing
      let role = null;
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        role = idTokenResult.claims.role;
      } catch (e) {
        // ignore
      }

      // If role missing, try to fetch from backend by identifier
      if (!role) {
        try {
          // resolve identifier (numeric mapping or email or uid)
          let identifier = user.uid;
          const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
          if (mapped && Number.isInteger(Number(mapped))) identifier = String(Number(mapped));
          else if (user.email) identifier = user.email;

          const infoResp = await apiCall(`/api/debug/user-info/${encodeURIComponent(identifier)}`, { method: 'GET' });
          if (infoResp.success && infoResp.data && infoResp.data.user) {
            role = infoResp.data.user.user_type;
          }
        } catch (e) {
          // ignore
        }
      }

      setUserRole(role);

      // Determine identifier to send to backend: prefer numeric mapping stored locally,
      // otherwise send email (backend resolves email) or fallback to firebase uid.
      let identifier = user.uid;
      try {
        const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
        if (mapped && Number.isInteger(Number(mapped))) {
          identifier = String(Number(mapped));
        } else if (user.email) {
          identifier = user.email;
        }
      } catch (e) {
        // ignore and fallback to uid
      }

      // Fetch matches based on role
      const endpoint =
        role === "roommate"
          ? `/api/matches/roommate-matches/${identifier}`
          : `/api/matches/resident-matches/${identifier}`;

      const response = await apiCall(endpoint, {
        method: "GET",
      });

      setLoading(false);

      if (response.success) {
        const fetchedMatches = response.data.matches || [];
        setMatches(fetchedMatches);
        setCurrentIndex(0);
        setUsingMockData(false);

        if (fetchedMatches.length === 0) {
          // No matches returned from DB
          Toast.show({ type: 'info', text1: 'No Matches', text2: 'No matches found in the database.' });
        }
      } else {
        // API failed - surface error to user and keep empty list
        console.log('API failed fetching matches:', response.error);
        setMatches([]);
        setCurrentIndex(0);
        setUsingMockData(false);
        Toast.show({ type: 'error', text1: 'Fetch Failed', text2: response.error || 'Failed to fetch matches from server.' });
      }
    } catch (error) {
      setLoading(false);
      console.error("Error fetching matches:", error);
      setMatches([]);
      setCurrentIndex(0);
      setUsingMockData(false);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch matches from server.' });
    } finally {
      setLoading(false);
    }
  };

  // Accept (select) a match: store selection in DB and update UI
  const selectMatch = async (match) => {
    const currentMatch = match || matches[currentIndex];
    if (!currentMatch) return;

    if (!usingMockData) {
      try {
        const user = auth.currentUser;
        // resolve identifier: prefer numeric mapping, then email, then uid
        let identifier = user.uid;
        try {
          const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
          if (mapped && Number.isInteger(Number(mapped))) identifier = String(Number(mapped));
          else if (user.email) identifier = user.email;
        } catch (e) {
          // ignore
        }

        const response = await apiCall("/api/matches/action", {
          method: "POST",
          body: JSON.stringify({
            userId: identifier,
            matchId: currentMatch.matchId || currentMatch.id,
            action: "accept",
            matchType: currentMatch.type,
          }),
        });

        if (response.success) {
          if (response.data.isMatch) {
            Toast.show({
              type: "success",
              text1: "It's a Match! 🎉",
              text2: `You and ${currentMatch.name} liked each other!`,
              visibilityTime: 5000,
            });

            setTimeout(() => {
              Alert.alert(
                "New Match!",
                `You matched with ${currentMatch.name}! Check your matches to start chatting.`,
                [
                  {
                    text: "View Matches",
                    onPress: () => navigation.navigate("MatchedUsers"),
                  },
                  { text: "Continue", style: "cancel" },
                ]
              );
            }, 800);
          } else {
            Toast.show({
              type: "success",
              text1: "Selection Saved!",
              text2: `Waiting for ${currentMatch.name} to like you back`,
            });
          }
        } else {
          Toast.show({ type: "error", text1: "Error", text2: response.error || "Failed to save selection" });
        }
      } catch (error) {
        console.error("Error accepting match:", error);
        Toast.show({ type: "error", text1: "Error", text2: "Could not save selection" });
      }
    } else {
      // Mock data - just show toast
      Toast.show({
        type: "success",
        text1: "Match Accepted!",
        text2: `You've accepted ${currentMatch.name} (Demo)`,
      });
    }

    // Optimistically remove the match from the list and keep index sane
    setMatches((prev) => prev.filter((m) => m.id !== currentMatch.id));
    setCurrentIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, matches.length - 2))));
  };

  // Reject (delete) a match: remove selection from UI and mark rejected in DB
  const deleteMatch = async (match) => {
    const currentMatch = match || matches[currentIndex];
    if (!currentMatch) return;

    if (!usingMockData) {
      try {
        const user = auth.currentUser;
        let identifier = user.uid;
        try {
          const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
          if (mapped && Number.isInteger(Number(mapped))) identifier = String(Number(mapped));
          else if (user.email) identifier = user.email;
        } catch (e) {
          // ignore
        }

        const response = await apiCall("/api/matches/action", {
          method: "POST",
          body: JSON.stringify({
            userId: identifier,
            matchId: currentMatch.id,
            action: "reject",
            matchType: currentMatch.type,
          }),
        });

        if (!response.success) {
          Toast.show({ type: "error", text1: "Error", text2: response.error || "Failed to remove match" });
        }
      } catch (error) {
        console.error("Error rejecting match:", error);
        Toast.show({ type: "error", text1: "Error", text2: "Could not remove match" });
      }
    } else {
      Toast.show({ type: "info", text1: "Match Rejected", text2: `You've rejected ${currentMatch.name} (Demo)` });
    }

    // Remove the match locally
    setMatches((prev) => prev.filter((m) => m.id !== currentMatch.id));
    setCurrentIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, matches.length - 2))));
  };

  const moveToNext = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // No more matches
      Alert.alert(
        "No More Matches",
        "You've seen all available matches. Check back later for more!",
        [
          {
            text: "Refresh",
            onPress: fetchMatches,
          },
          {
            text: "OK",
            style: "cancel",
          },
        ]
      );
    }
  };

  const handleManualReject = () => {
    deleteMatch();
  };

  const handleManualAccept = () => {
    selectMatch();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Finding your perfect matches...
          </Text>
        </View>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Matches Yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Check back later as more users complete their profiles!
          </Text>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primaryButton }]}
            onPress={fetchMatches}
          >
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentMatch = matches[currentIndex];
  const remainingMatches = matches.length - currentIndex - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <Text style={styles.headerTitle}>Discover Matches</Text>
        <Text style={styles.headerSubtitle}>
          {remainingMatches + 1} {remainingMatches === 0 ? "match" : "matches"} remaining
        </Text>
      </View>

      {/* Cards Stack */}
      <View style={styles.cardsContainer}>
        {matches.slice(currentIndex, currentIndex + 2).map((match, index) => (
          <SwipeableCard
            key={match.id || index}
            match={match}
            onSwipeLeft={index === 0 ? () => deleteMatch(match) : undefined}
            onSwipeRight={index === 0 ? () => selectMatch(match) : undefined}
            index={index}
          />
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.rejectButton, { backgroundColor: "#FF3B30" }]}
          onPress={handleManualReject}
        >
          <Text style={styles.buttonIcon}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: "#34C759" }]}
          onPress={handleManualAccept}
        >
          <Text style={styles.buttonIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Info Text */}
      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
        Swipe right to accept, left to reject
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "white",
    fontSize: 14,
    marginTop: 5,
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
  },
  refreshButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 15,
  },
  backButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
    gap: 40,
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonIcon: {
    fontSize: 32,
    color: "white",
    fontWeight: "bold",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  infoText: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: 20,
  },
});

