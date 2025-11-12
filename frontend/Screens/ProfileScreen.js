import React, { useState } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Modal, ScrollView, Switch } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "../context/ThemeContext";
import { FontAwesome, Feather, MaterialIcons } from "@expo/vector-icons";
import { getAuth, updateProfile } from "firebase/auth";
import { app } from "../Firebase"; 
import { apiCall } from "../config";

const auth = getAuth(app);
const DEFAULT_PROFILE_PIC = require("../assets/profile.png"); 
const ProfileScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefs, setPrefs] = useState({});
  const [role, setRole] = useState(null);

  const email = auth.currentUser?.email || "";

  // Load cached name and profile image when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const cachedImage = await AsyncStorage.getItem("profileImage");
        if (cachedImage) setProfileImage(cachedImage);

        const cachedName = await AsyncStorage.getItem("userName");
        if (cachedName) setName(cachedName);
        else if (auth.currentUser?.displayName) setName(auth.currentUser.displayName);
      })();
    }, [])
  );

  const handleSaveName = async () => {
    if (!auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      await AsyncStorage.setItem("userName", name);
      setEditingName(false);
      Alert.alert("Success", "Name updated");
    } catch (err) {
      console.error(err);
      Alert.alert("Failed to save name");
    }
  };

  const handleUploadPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required to select photos");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      setUploading(true);
      await AsyncStorage.setItem("profileImage", uri);
      setProfileImage(uri);
      Alert.alert("Success", "Profile picture updated");
    } catch (err) {
      console.error(err);
      Alert.alert("Upload failed", err.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("profileImage");
      await AsyncStorage.removeItem("userName");
      // Remove 'preferences submitted' marker so forms show again after next login
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          await AsyncStorage.removeItem(`preferences_submitted_${uid}`);
        }
      } catch (e) {
        console.warn('Failed clearing submitted flag on logout', e);
      }
      setProfileImage(null);
      setEditingName(false);
      await auth.signOut();
      navigation.replace("Welcome");
    } catch (err) {
      console.error(err);
      Alert.alert("Error logging out");
    }
  };

  const openPreferences = async () => {
    // Determine role from token or AsyncStorage
    setPrefsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Not logged in', 'Please login to edit preferences');
        setPrefsLoading(false);
        return;
      }
      let resolvedRole = null;
      try {
        const token = await user.getIdTokenResult(true);
        resolvedRole = token.claims.role || null;
      } catch (e) {
        // fallback
        const stored = await AsyncStorage.getItem('userRole');
        resolvedRole = stored;
      }
      setRole(resolvedRole);

      // Determine identifier to send: prefer numeric mapping stored locally, otherwise email, then uid
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

      // Fetch preferences from backend
      const endpoint = resolvedRole === 'flatmate' ? '/get-resident-preferences/' : '/get-roommate-preferences/';
      const res = await apiCall(`/api/preferences${endpoint}${encodeURIComponent(identifier)}`);
      if (!res.success) {
        // If no saved prefs, open empty form
        console.warn('Preferences fetch:', res.error);
        setPrefs({});
        setShowPrefs(true);
        setPrefsLoading(false);
        return;
      }
  setPrefs(res.data.preferences || {});
      setShowPrefs(true);
    } catch (err) {
      console.error('Failed to load preferences', err);
      Alert.alert('Error', 'Failed to load preferences');
    } finally {
      setPrefsLoading(false);
    }
  };

  const savePreferences = async () => {
    setPrefsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Not logged in');
        setPrefsLoading(false);
        return;
      }
      // Choose backend-resolvable identifier: numeric mapping (if present) > email > uid
      let identifier = user.uid;
      try {
        const mapped = await AsyncStorage.getItem(`numeric_user_id_${user.uid}`);
        if (mapped && Number.isInteger(Number(mapped))) identifier = String(Number(mapped));
        else if (user.email) identifier = user.email;
      } catch (e) {
        // ignore
      }

      let payload = {};
      if (role === 'flatmate') {
        // resident preferences
        payload = {
          propertyLocation: prefs.property_location || null,
          rent: prefs.rent || null,
          description: prefs.description || null,
          religiousPref: prefs.religious_pref || null,
          roommateFoodPref: prefs.roommate_food_pref || null,
          smokes: prefs.smokes || false,
          roommateSmokesOk: prefs.roommate_smokes_ok || false,
          roommateAgePref: prefs.roommate_age_pref || null,
          roommateGenderPref: prefs.roommate_gender_pref || null,
          environmentPref: prefs.environment_pref || null,
          curfewTime: prefs.curfew_time || null,
          works: prefs.works || false,
          roommateNightOk: prefs.roommate_night_ok || false,
          profession: prefs.profession || null,
          relationshipStatus: prefs.relationship_status || null,
          roommatePetsOk: prefs.roommate_pets_ok || false,
          extraRequirements: prefs.extra_requirements || null,
          drinks: prefs.drinks || false,
          roommateDrinksOk: prefs.roommate_drinks_ok || false,
          cleanliness: prefs.cleanliness || null,
          roommateCookingPref: prefs.roommate_cooking_pref || null,
          roommateGuestsOk: prefs.roommate_guests_ok || false,
        };
        const res = await apiCall('/api/preferences/save-resident-preferences', { method: 'POST', body: JSON.stringify({ userId: identifier, preferences: payload }) });
        if (!res.success) return Alert.alert('Save failed', res.error || 'Unknown');
        // store numeric mapping if server returns one
        try {
          const maybeUserId = res.data?.userId || res.data?.user_id;
          if (maybeUserId && Number.isInteger(Number(maybeUserId))) {
            await AsyncStorage.setItem(`numeric_user_id_${auth.currentUser.uid}`, String(maybeUserId));
          }
        } catch (e) { /* ignore */ }
      } else {
        // roommate preferences
        payload = {
          currentLocation: prefs.current_location || null,
          religiousPreferences: prefs.religious_pref || null,
          dietaryPreference: prefs.food_type || null,
          smokes: !!prefs.smokes,
          drinks: !!prefs.drinks,
          dietaryRestrictions: prefs.dietary_restrictions || null,
          comfortableWithSmokingOrDrinking: prefs.roommate_smokes_ok || false,
          ageGroupPreference: prefs.roommate_age_pref || null,
          genderPreference: prefs.roommate_gender_pref || null,
          environmentPreference: prefs.environment_pref || null,
          curfewTimings: prefs.curfew_time || null,
          pets: prefs.pet_details || null,
          profession: prefs.profession || null,
          schedule: prefs.work_study_schedule || null,
          okayWithIrregularSchedule: prefs.roommate_night_ok || false,
          relationshipStatus: prefs.relationship_status || null,
          backgroundPreference: prefs.profession_pref || null,
          cleanlinessHabits: prefs.cleanliness || null,
          cookingPreference: prefs.cooking_pref || null,
          extraExpectations: prefs.extra_expectations || null,
        };
        const res = await apiCall('/api/preferences/save-roommate-preferences', { method: 'POST', body: JSON.stringify({ userId: identifier, preferences: payload }) });
        if (!res.success) return Alert.alert('Save failed', res.error || 'Unknown');
        try {
          const maybeUserId = res.data?.userId || res.data?.user_id;
          if (maybeUserId && Number.isInteger(Number(maybeUserId))) {
            await AsyncStorage.setItem(`numeric_user_id_${auth.currentUser.uid}`, String(maybeUserId));
          }
        } catch (e) { /* ignore */ }
      }
      // mark submitted
      try { await AsyncStorage.setItem(`preferences_submitted_${auth.currentUser.uid}`, 'true'); } catch(e){/*ignore*/}
      Alert.alert('Saved', 'Preferences saved successfully');
      setShowPrefs(false);
    } catch (err) {
      console.error('Save preferences error', err);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setPrefsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.avatarWrapper}>
          <Image
            source={profileImage ? { uri: profileImage } : DEFAULT_PROFILE_PIC}
            style={styles.avatar}
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <View style={styles.inputRow}>
          <FontAwesome name="user" size={22} color="#f3439b" style={styles.inputIcon} />
          {editingName ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              onBlur={handleSaveName}
            />
          ) : (
            <Text style={[styles.input, { color: name ? "#222" : "#aaa" }]}>{name || "Name"}</Text>
          )}
          <TouchableOpacity onPress={() => setEditingName(true)} style={styles.editIconBtn}>
            <Feather name="edit-2" size={20} color="#f3439b" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <MaterialIcons name="email" size={22} color="#f3439b" style={styles.inputIcon} />
          <Text style={[styles.input, { color: "#222" }]}>{email}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, { marginTop: 15 }]} 
          onPress={() => navigation.navigate("MatchedUsers")}
        >
          <MaterialIcons name="favorite" size={22} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.buttonText}>My Matches</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={openPreferences}>
          <MaterialIcons name="settings" size={22} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.buttonText}>My Preferences</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleUploadPhoto} disabled={uploading}>
          <Feather name="camera" size={22} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.buttonText}>Upload New Photo</Text>
          {uploading && <ActivityIndicator color="#fff" style={{ marginLeft: 10 }} />}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showPrefs} animationType="slide">
        <View style={{ flex: 1, padding: 16, backgroundColor: isDarkMode ? '#000' : '#fff' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#f3439b' }}>Edit Preferences ({role || 'unknown'})</Text>
          {prefsLoading && <ActivityIndicator color={isDarkMode ? '#f3439b' : '#f3439b'} />}
          <ScrollView>
            {/* Build question sets similar to RoommateScreen but without the card/pagination */}
            {role === 'flatmate' ? (
              // Resident questions
              <View>
                {residentQuestions.map((q) => (
                  <View key={q.name} style={profileStyles.questionContainer}>
                      <Text style={[profileStyles.questionText, { color: isDarkMode ? '#fff' : '#111' }]}>{q.question}</Text>
                      {renderQuestionForModal(q, prefs, setPrefs, colors, isDarkMode)}
                  </View>
                ))}
              </View>
            ) : (
              // Roommate questions
              <View>
                {roommateQuestions.map((q) => (
                  <View key={q.name} style={profileStyles.questionContainer}>
                    <Text style={profileStyles.questionText}>{q.question}</Text>
                    {renderQuestionForModal(q, prefs, setPrefs, colors, isDarkMode)}
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 20 }} />
            <TouchableOpacity style={[styles.button, { marginBottom: 12, backgroundColor: '#f3439b' }]} onPress={savePreferences} disabled={prefsLoading}>
              <Text style={styles.buttonText}>{prefsLoading ? 'Saving...' : 'Save Preferences'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, { backgroundColor: isDarkMode ? '#222' : '#666' }]} onPress={() => setShowPrefs(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topSection: { backgroundColor: "#f9b6d2", alignItems: "center", paddingVertical: 60 },
  avatarWrapper: { width: 140, height: 140, borderRadius: 70, overflow: "hidden", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  formSection: { flex: 1, paddingHorizontal: 24, marginTop: 30 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: "#f9b6d2", borderRadius: 30, paddingHorizontal: 16, marginBottom: 18, height: 54 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 18, color: "#f3439b" },
  editIconBtn: { marginLeft: 8, padding: 4 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#f3439b", borderRadius: 30, height: 54, marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12 }
});

export default ProfileScreen;

// --- Helper data and renderers for the modal (kept below to avoid clutter) ---

const roommateQuestions = [
  { name: 'current_location', type: 'text', question: 'Where are you currently living?' },
  { name: 'max_rent', type: 'text', question: 'What is the maximum rent that you can pay?' },
  { name: 'roommate_gender_pref', type: 'dropdown', question: 'What gender(s) are you comfortable sharing a space with?', options: ['Male', 'Female', 'Any'] },
  { name: 'curfew_time', type: 'text', question: 'Do you have any specific curfew timings for yourself or expect your roommate to follow?' },
  { name: 'roommate_age_pref', type: 'text', question: 'Do you have any age group preference for your roommate?' },
  { name: 'smokes', type: 'radio', question: 'Do you smoke?', options: ['Yes', 'No'] },
  { name: 'drinks', type: 'radio', question: 'Do you drink alcohol?', options: ['Yes', 'No'] },
  { name: 'roommate_smokes_ok', type: 'radio', question: 'Are you comfortable if your roommate smokes or drinks?', options: ['Yes', 'No'] },
  { name: 'religious_pref', type: 'text', question: 'Do you have any religious or cultural preferences that should be considered?' },
  { name: 'food_type', type: 'dropdown', question: 'Are you vegetarian or non-vegetarian?', options: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'No Preference'] },
  { name: 'dietary_restrictions', type: 'text', question: "Do you have any dietary restrictions or food habits your roommate should know?" },
  { name: 'environment_pref', type: 'dropdown', question: 'Do you prefer a quiet environment or a social/party-friendly one?', options: ['Quiet', 'Social/Party-Friendly'] },
  { name: 'pet_details', type: 'text', question: 'Do you own pets or plan to keep one? If yes, what kind?' },
  { name: 'profession', type: 'text', question: 'What is your profession?' },
  { name: 'work_study_schedule', type: 'dropdown', question: 'Do you work/study? If yes, what\'s your schedule?', options: ['Day Shift', 'Night Shift', 'Flexible', 'Not Working/Studying'] },
  { name: 'roommate_night_ok', type: 'radio', question: 'Are you okay if your roommate works in a night shift or has an irregular schedule?', options: ['Yes', 'No'] },
  { name: 'relationship_status', type: 'dropdown', question: 'Are you married, single, or in a relationship?', options: ['Single', 'Married', 'In a Relationship'] },
  { name: 'profession_pref', type: 'dropdown', question: 'Do you prefer living with someone of similar background/profession or are you flexible?', options: ['Similar', 'Flexible'] },
  { name: 'cleanliness', type: 'dropdown', question: 'What are your cleanliness/organization habits?', options: ['Messy', 'Neat', 'Moderate'] },
  { name: 'cooking_pref', type: 'dropdown', question: 'Do you like to cook at home or prefer outside food?', options: ['Home', 'Outside', 'No Preference'] },
  { name: 'extra_expectations', type: 'text', question: 'Any extra expectations from your roommate (quiet study time, shared meals, equal chores, guests allowed, etc.)?' },
];

const residentQuestions = [
  { name: 'property_location', type: 'text', question: 'Property Location' },
  { name: 'rent', type: 'text', question: 'Rent' },
  { name: 'description', type: 'text', question: 'Description' },
  { name: 'roommate_food_pref', type: 'text', question: 'Roommate Food Preference' },
  { name: 'smokes', type: 'radio', question: 'Do you smoke?', options: ['Yes', 'No'] },
  { name: 'cleanliness', type: 'dropdown', question: 'Cleanliness', options: ['Messy', 'Moderate', 'Neat'] },
  { name: 'environment_pref', type: 'dropdown', question: 'Environment Preference', options: ['Quiet', 'Social/Party-Friendly'] },
  { name: 'curfew_time', type: 'text', question: 'Curfew Time' },
  { name: 'works', type: 'radio', question: 'Do you work?', options: ['Yes', 'No'] },
  { name: 'roommate_night_ok', type: 'radio', question: 'Okay with night shifts?', options: ['Yes', 'No'] },
  { name: 'profession', type: 'text', question: 'Profession' },
  { name: 'relationship_status', type: 'dropdown', question: 'Relationship Status', options: ['Single', 'Married', 'In a Relationship'] },
  { name: 'roommate_pets_ok', type: 'radio', question: 'Okay with pets?', options: ['Yes', 'No'] },
  { name: 'extra_requirements', type: 'text', question: 'Extra Requirements' },
  { name: 'drinks', type: 'radio', question: 'Do you drink?', options: ['Yes', 'No'] },
  { name: 'roommate_drinks_ok', type: 'radio', question: 'Okay with drinking roommates?', options: ['Yes', 'No'] },
  { name: 'roommate_cooking_pref', type: 'dropdown', question: 'Roommate Cooking Preference', options: ['Home', 'Outside', 'No Preference'] },
  { name: 'roommate_guests_ok', type: 'radio', question: 'Okay with guests?', options: ['Yes', 'No'] },
];

const renderQuestionForModal = (q, prefs, setPrefs, colors, isDarkMode) => {
  const value = prefs[q.name] == null ? '' : String(prefs[q.name]);
  switch (q.type) {
    case 'text':
      return (
        <TextInput
          style={[styles.modalInput, { borderColor: isDarkMode ? '#333' : '#ddd', backgroundColor: isDarkMode ? '#111' : '#fff', color: isDarkMode ? '#fff' : '#000' }]}
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={value}
          onChangeText={(t) => setPrefs({ ...prefs, [q.name]: t })}
        />
      );
    case 'radio':
      return (
        <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
            {q.options.map((opt) => (
            <TouchableOpacity key={opt} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 }} onPress={() => setPrefs({ ...prefs, [q.name]: opt })}>
              <View style={{ height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: isDarkMode ? '#666' : '#999', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                {value === opt && <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: '#f3439b' }} />}
              </View>
              <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'dropdown':
      return (
        <View style={{ borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? '#333' : '#ddd', overflow: 'hidden', marginTop: 6, backgroundColor: isDarkMode ? '#111' : '#fff' }}>
          <Picker selectedValue={value} onValueChange={(itemValue) => setPrefs({ ...prefs, [q.name]: itemValue })}>
            <Picker.Item label="Select..." value="" color={isDarkMode ? '#888' : '#999'} />
            {q.options.map((opt) => <Picker.Item key={opt} label={opt} value={opt} color={isDarkMode ? '#fff' : '#000'} />)}
          </Picker>
        </View>
      );
    default:
      return null;
  }
};

const profileStyles = StyleSheet.create({
  questionContainer: { marginBottom: 18 },
  questionText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
