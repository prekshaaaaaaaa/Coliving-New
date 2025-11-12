import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../Firebase';
import { apiCall, API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io as ioClient } from 'socket.io-client';
import Toast from 'react-native-toast-message';

export default function SimpleChatScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { roomId, otherUserName, otherUserFirebaseUid } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef(null);
  const socketRef = useRef(null);
  const numericUserIdRef = useRef(null);

  useEffect(() => {
    if (!roomId) {
      Alert.alert('Error', 'Chat room not found');
      navigation.goBack();
      return;
    }

    let mounted = true;

    const fetchMessages = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        let userIdForQuery = user.uid;
        try {
          const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
          if (mapped && Number.isInteger(Number(mapped))) userIdForQuery = String(Number(mapped));
        } catch (e) {}

        // Save numeric mapping for socket handlers
        if (userIdForQuery && Number.isInteger(Number(userIdForQuery))) {
          numericUserIdRef.current = String(Number(userIdForQuery));
        }

        const resp = await apiCall(`/api/chat/messages/${roomId}?userId=${userIdForQuery}`, { method: 'GET' });
        if (resp.success) {
          if (!mounted) return;
          setMessages(resp.data.messages || []);
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        } else {
          Toast.show({ type: 'error', text1: 'Failed to load chat', text2: resp.error });
        }
      } catch (e) {
        console.warn('fetchMessages error', e.message || e);
        Toast.show({ type: 'error', text1: 'Failed to load chat', text2: e.message || 'Network' });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMessages();

    // init socket
    const initSocket = async () => {
      try {
        const base = API_BASE_URL && typeof API_BASE_URL === 'string' ? API_BASE_URL.replace(/\/$/, '') : 'http://127.0.0.1:5000';
        const socketUrl = base;
        const socket = ioClient(socketUrl, { transports: ['websocket'], reconnectionAttempts: 5 });
        socketRef.current = socket;

        socket.on('connect', async () => {
          const user = auth.currentUser;
          let userIdToSend = user?.uid;
          try {
            const mapped = await AsyncStorage.getItem(`numeric_user_id_${user?.uid}`);
            if (mapped && Number.isInteger(Number(mapped))) userIdToSend = String(Number(mapped));
          } catch (e) {}
          socket.emit('join', { roomId, userId: userIdToSend });
        });

        socket.on('new_message', ({ roomId: rId, message }) => {
          if (String(rId) !== String(roomId)) return;
          setMessages(prev => {
            // If this message already exists by id, ignore
            if (prev.some(m => String(m.message_id) === String(message.message_id))) return prev;

            // If the incoming message was sent by this client, try to replace a matching temp message
            const myNumeric = numericUserIdRef.current;
            if (myNumeric && String(message.sender_id) === String(myNumeric)) {
              // Find first temp message with identical text
              const tempIndex = prev.findIndex(m => m.isTemp && m.message_text === message.message_text);
              if (tempIndex !== -1) {
                const copy = [...prev];
                copy[tempIndex] = message; // replace temp with real
                return copy;
              }
            }

            // Otherwise append
            return [...prev, message];
          });
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        });

        socket.on('disconnect', () => console.log('socket disconnected'));
      } catch (e) {
        console.warn('socket init failed', e.message || e);
      }
    };

    initSocket();

    return () => {
      mounted = false;
      try { socketRef.current?.emit('leave', { roomId }); } catch (e) {}
      try { socketRef.current?.disconnect(); } catch (e) {}
    };
  }, [roomId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    const user = auth.currentUser;
    if (!user) return;

    // Resolve numeric user id: prefer AsyncStorage mapping, else ask backend debug endpoint
    let numericUserId = null;
    try {
      const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
      if (mapped && Number.isInteger(Number(mapped))) numericUserId = String(Number(mapped));
    } catch (e) {}

    if (!numericUserId) {
      try {
        const resp = await apiCall(`/api/debug/user-info/${encodeURIComponent(user.uid)}`, { method: 'GET' });
        if (resp.success && resp.data?.user?.user_id) numericUserId = String(resp.data.user.user_id);
      } catch (e) {
        console.warn('user-info lookup failed', e.message || e);
      }
    }

    if (!numericUserId || !Number.isInteger(Number(numericUserId))) {
      Toast.show({ type: 'error', text1: 'Unable to send', text2: 'User mapping to numeric id not found. Ensure backend has a users row for you or sign up via the app.' });
      return;
    }

    setSending(true);
    const temp = {
      message_id: `tmp_${Date.now()}`,
      sender_id: numericUserId,
      message_text: text.trim(),
      created_at: new Date().toISOString(),
      sender_name: user.displayName || 'You',
      isTemp: true,
    };
    setMessages(prev => [...prev, temp]);
    setText('');

    try {
      const resp = await apiCall('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ roomId: Number(roomId), userId: Number(numericUserId), messageText: text.trim() }),
      });
      if (resp.success) {
        const real = resp.data.message;
        setMessages(prev => {
          const withoutTemp = prev.filter(m => !m.isTemp);
          if (withoutTemp.some(m => String(m.message_id) === String(real.message_id))) return withoutTemp;
          return [...withoutTemp, real];
        });
      } else {
        setMessages(prev => prev.filter(m => !m.isTemp));
        Toast.show({ type: 'error', text1: 'Send failed', text2: resp.error || 'Try again' });
      }
    } catch (e) {
      console.error('send error', e);
      setMessages(prev => prev.filter(m => !m.isTemp));
      Toast.show({ type: 'error', text1: 'Send failed', text2: e.message || 'Network' });
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const user = auth.currentUser;
    const isMine = String(item.sender_id) === String(user?.uid) || item.sender_name === 'You';
    return (
      <View style={[styles.msgRow, isMine ? styles.myRow : styles.otherRow]}>
        <View style={[styles.bubble, { backgroundColor: isMine ? colors.primaryButton : colors.cardBackground }]}>
          {!isMine && <Text style={[styles.sender, { color: colors.textSecondary }]}>{item.sender_name}</Text>}
          <Text style={[styles.body, { color: isMine ? '#fff' : colors.text }]}>{item.message_text}</Text>
          <Text style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{otherUserName || 'Chat'}</Text>
        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primaryButton} /></View>
      ) : (
        <FlatList ref={flatRef} data={messages} renderItem={renderItem} keyExtractor={(i, idx) => String(i.message_id || idx)} contentContainerStyle={styles.list} onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })} />
      )}

      <View style={[styles.inputRow, { backgroundColor: colors.cardBackground }]}> 
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
          multiline={false}
          maxLength={500}
          keyboardType="default"
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={send}
          accessible={true}
          accessibilityLabel="Type a message"
        />
        <TouchableOpacity onPress={send} style={[styles.sendBtn, { backgroundColor: colors.primaryButton }]} disabled={!text.trim() || sending}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: 'white', fontSize: 22, fontWeight: '700' },
  title: { color: 'white', fontSize: 18, fontWeight: '700' },
  list: { padding: 12, paddingBottom: 10 },
  msgRow: { marginBottom: 10 },
  myRow: { alignItems: 'flex-end' },
  otherRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12 },
  sender: { fontSize: 12, marginBottom: 4 },
  body: { fontSize: 16, marginBottom: 6 },
  time: { fontSize: 11, alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', padding: 20, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 20, marginRight: 10, maxHeight: 100 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendText: { color: 'white', fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
