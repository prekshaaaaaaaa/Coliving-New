import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../Firebase";
import { apiCall, API_BASE_URL } from "../config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io as ioClient } from "socket.io-client";
import Toast from "react-native-toast-message";

export default function ChatScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const { roomId, otherUserName, otherUserFirebaseUid } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) {
      Alert.alert("Error", "Chat room not found");
      navigation.goBack();
      return;
    }

    fetchMessages();

    // Initialize socket connection for realtime messages
    let isMounted = true;
    const initializeSocket = async () => {
      try {
        // Derive socket URL from API_BASE_URL if available
        const base = (API_BASE_URL && typeof API_BASE_URL === 'string') ? API_BASE_URL.replace(/\/$/, '') : 'http://127.0.0.1:5000';
        const socketUrl = base.replace(/\/api$/, '');

        const socket = ioClient(socketUrl, { transports: ['websocket'], reconnectionAttempts: 5 });
        socketRef.current = socket;

        socket.on('connect', async () => {
          // prefer numeric user id mapping when available
          const user = auth.currentUser;
          let userIdToSend = user?.uid;
          try {
            const mapped = await AsyncStorage.getItem(`numeric_user_id_${user?.uid}`);
            if (mapped && Number.isInteger(Number(mapped))) userIdToSend = String(Number(mapped));
          } catch (e) {}

          socket.emit('join', { roomId, userId: userIdToSend });
        });

        socket.on('new_message', ({ roomId: incomingRoomId, message }) => {
          if (!isMounted) return;
          if (String(incomingRoomId) !== String(roomId)) return;
          setMessages((prev) => {
            // avoid duplicates by message_id
            if (prev.some(m => String(m.message_id) === String(message.message_id))) return prev;
            return [...prev, message];
          });
          // scroll to bottom
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        socket.on('disconnect', () => {
          console.log('Socket disconnected');
        });
      } catch (e) {
        console.warn('Socket init failed', e.message || e);
      }
    };

    initializeSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        try { socketRef.current.emit('leave', { roomId }); } catch (e) {}
        try { socketRef.current.disconnect(); } catch (e) {}
      }
    };
  }, [roomId]);

  const fetchMessages = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      // Prefer numeric mapping saved in AsyncStorage when available
      let userIdForQuery = user.uid;
      try {
        const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
        if (mapped && Number.isInteger(Number(mapped))) userIdForQuery = String(Number(mapped));
      } catch (e) {
        // ignore
      }

      const response = await apiCall(`/api/chat/messages/${roomId}?userId=${userIdForQuery}`, {
        method: "GET",
      });

      if (response.success) {
        setMessages(response.data.messages || []);
        
        // Scroll to bottom when new messages arrive
        if (flatListRef.current && (response.data.messages || []).length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        // surface server-side error so user knows why chat failed to load
        Toast.show({ type: 'error', text1: 'Failed to load chat', text2: response.error || 'Unknown error' });
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      Toast.show({ type: 'error', text1: 'Failed to load chat', text2: error.message || 'Network error' });
    }
    finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const user = auth.currentUser;
    if (!user) return;

    const tempMessage = {
      message_id: `temp_${Date.now()}`,
      sender_id: user.uid,
      message_text: messageText,
      created_at: new Date().toISOString(),
      sender_name: user.displayName || "You",
      isTemp: true,
    };

    setMessages([...messages, tempMessage]);
    setMessageText("");
    setSending(true);

    try {
      const response = await apiCall("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          userId: user.uid,
          messageText: messageText.trim(),
        }),
      });

      if (response.success) {
        // Remove temp message and add real one, deduplicating by id
        const realMsg = response.data.message;
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => !m.isTemp);
          if (withoutTemp.some(m => String(m.message_id) === String(realMsg.message_id))) return withoutTemp;
          return [...withoutTemp, realMsg];
        });
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => !m.isTemp));
        Toast.show({
          type: "error",
          text1: "Failed to send",
          text2: "Please try again",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => !m.isTemp));
      Toast.show({
        type: "error",
        text1: "Failed to send",
        text2: "Please try again",
      });
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const user = auth.currentUser;
    const isMyMessage = item.sender_id === user?.uid || item.sender_name === "You";

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isMyMessage ? colors.primaryButton : colors.inputBackground,
            },
          ]}
        >
          {!isMyMessage && (
            <Text style={[styles.senderName, { color: colors.textSecondary }]}>
              {item.sender_name}
            </Text>
          )}
          <Text
            style={[
              styles.messageText,
              { color: isMyMessage ? "white" : colors.text },
            ]}
          >
            {item.message_text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: isMyMessage ? "rgba(255,255,255,0.7)" : colors.textSecondary },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading chat...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUserName || "Chat"}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.message_id?.toString() || item.temp_id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground }]}>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.inputBackground,
              borderColor: colors.border,
            },
          ]}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: colors.primaryButton },
            (!messageText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!messageText.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  messagesList: {
    padding: 15,
    paddingBottom: 10,
  },
  messageContainer: {
    marginBottom: 10,
  },
  myMessageContainer: {
    alignItems: "flex-end",
  },
  otherMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 18,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});

