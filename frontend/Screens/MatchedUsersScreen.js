import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../Firebase";
import { apiCall } from "../config";
import Toast from "react-native-toast-message";

const DEFAULT_PROFILE_PIC = require("../assets/profile.png");

export default function MatchedUsersScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMutualMatches();
    
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchMutualMatches();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchMutualMatches = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Please login first");
        navigation.navigate("Login");
        return;
      }

      setLoading(true);

      // prefer numeric mapping then email then firebase uid
      let identifier = user.uid;
      try {
        const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
        if (mapped && Number.isInteger(Number(mapped))) identifier = String(Number(mapped));
        else if (user.email) identifier = user.email;
      } catch (e) {
        // ignore
      }

      const response = await apiCall(`/api/matches/mutual-matches/${identifier}`, {
        method: "GET",
      });

      setLoading(false);

      if (response.success) {
        const fetchedMatches = (response.data.matches || []).map(match => ({
          matchId: match.matchId,
          other: match.other,
          matchedOn: match.matchedOn,
          status: match.status,
        }));
        setMatches(fetchedMatches);
      } else {
        Alert.alert("Error", response.error || "Failed to fetch matches");
      }
    } catch (error) {
      setLoading(false);
      console.error("Error fetching mutual matches:", error);
      setMatches([]);
    }
  };

  const openChat = (match) => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return Alert.alert('Error', 'Please login first');

        Toast.show({ type: 'info', text1: 'Opening chat...', visibilityTime: 1000 });

        // Prefer numeric mapping for current user when available
        let myId = user.uid;
        try {
          const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
          if (mapped && Number.isInteger(Number(mapped))) myId = String(Number(mapped));
        } catch (e) {}

        // Determine other user's id (prefer numeric if present). If not available,
        // try alternatives (firebase uid or email) so backend can resolve.
        const other = match.other || {};
        let otherId = other.userId || other.user_id || other.id || match.other_user_id || match.otherId;
        let otherFallback = null;
        if (!otherId) {
          otherFallback = other.firebase_uid || match.other_user_firebase_uid || other.email || match.other_user_email || null;
        }

        if (match.chat_room_id) {
          navigation.navigate('SimpleChat', {
            roomId: match.chat_room_id,
            otherUserName: other.name || match.other_user_name,
            otherUserFirebaseUid: other.firebase_uid || match.other_user_firebase_uid,
          });
          return;
        }

        // Build request payload. If otherId missing, include fallback in otherIdentifier
        const payload = { userId: myId };
        if (otherId) payload.otherUserId = otherId;
        else if (otherFallback) payload.otherIdentifier = otherFallback;
        else {
          return Alert.alert('Error', 'Cannot determine other user identifier to open chat');
        }

        // Create or get a chat room
        const resp = await apiCall('/api/chat/rooms/get-or-create', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        console.log('get-or-create response', resp);

        if (resp.success && resp.data?.chatRoomId) {
          navigation.navigate('SimpleChat', {
            roomId: resp.data.chatRoomId,
            otherUserName: other.name || match.other_user_name,
            otherUserFirebaseUid: other.firebase_uid || match.other_user_firebase_uid,
          });
        } else {
          Alert.alert('Error', resp.error || 'Unable to create chat room');
        }
      } catch (e) {
        console.error('openChat error', e);
        Alert.alert('Error', 'Unable to open chat');
      }
    })();
  };

  const renderMatchItem = ({ item }) => {
    const matchDate = new Date(item.matchedOn);
    const formattedDate = matchDate.toLocaleDateString();

    return (
      <TouchableOpacity
        style={[styles.matchCard, { backgroundColor: colors.cardBackground }]}
        onPress={() => openChat(item)}
      >
        <View style={styles.matchContent}>
          <Image source={DEFAULT_PROFILE_PIC} style={styles.profileImage} />
          <View style={styles.matchInfo}>
            <Text style={[styles.matchName, { color: colors.text }]}>
              {item.other?.name || "User"}
            </Text>
            <Text style={[styles.matchType, { color: colors.textSecondary }]}>
              {item.other?.type === "resident" ? "Resident" : "Roommate"}
            </Text>
            <Text style={[styles.matchDate, { color: colors.textSecondary }]}>
              Matched on {formattedDate}
            </Text>
          </View>
          <View style={styles.chatButton}>
            <Text style={[styles.chatButtonText, { color: colors.primaryButton }]}>
              💬
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading your matches...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <Text style={styles.headerTitle}>Your Matches</Text>
        <Text style={styles.headerSubtitle}>
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Matches Yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Start swiping to find your perfect match!
          </Text>
          <TouchableOpacity
            style={[styles.discoverButton, { backgroundColor: colors.primaryButton }]}
            onPress={() => navigation.navigate("Matches")}
          >
            <Text style={styles.buttonText}>Discover Matches</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatchItem}
          keyExtractor={(item) => item.matchId?.toString() || item.other?.userId?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  discoverButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  listContent: {
    padding: 15,
  },
  matchCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  matchContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  matchType: {
    fontSize: 14,
    marginBottom: 4,
  },
  matchDate: {
    fontSize: 12,
  },
  chatButton: {
    padding: 10,
  },
  chatButtonText: {
    fontSize: 24,
  },
});

