import React, { useState, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { auth } from "../Firebase";
import { onAuthStateChanged } from "firebase/auth";
import { apiCall } from "../config";

const DEFAULT_PROFILE_PIC = require("../assets/profile.png");

// Animated Button Component
const AnimatedButton = ({ children, style, onPress, colors, isDarkMode }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
      <Pressable
        style={[
          style,
          isDarkMode && {
            shadowColor: '#f3439b',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 15,
            elevation: 8,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// Full 20 questions with input type
const questionsList = [
  { type: "text", question: "Where do you live (location of the accommodation)?" },
  { type: "text", question: "What rent do you expect from the roommate?" },
  { type: "dropdown", question: "Do you have any gender preference for your roommate?", options: ["Male", "Female", "Any"] },
  { type: "text", question: "Do you have any age group preference for your roommate?" },
  { type: "text", question: "Do you want to keep any curfew timings for your roommate?" },
  { type: "radio", question: "Do you smoke?", options: ["Yes", "No"] },
  { type: "radio", question: "Are you comfortable if your roommate smokes or drinks?", options: ["Yes", "No"] },
  { type: "radio", question: "Do you drink?", options: ["Yes", "No"] },
  { type: "text", question: "Do you have any religious preference for your roommate? If yes, please explain." },
  { type: "dropdown", question: "Do you prefer your roommate to be vegetarian or non-vegetarian?", options: ["Vegetarian", "Non-Vegetarian", "Vegan", "No Preference"] },
  { type: "dropdown", question: "Do you prefer a roommate who enjoys partying or one who prefers staying in?", options: ["Party", "Stay-in", "No Preference"] },
  { type: "radio", question: "Do you work?", options: ["Yes", "No"] },
  { type: "radio", question: "Do you have any issues if your roommate works a night shift?", options: ["Yes", "No"] },
  { type: "text", question: "What is your profession?" },
  { type: "dropdown", question: "Are you married or single?", options: ["Single", "Married", "In a Relationship"] },
  { type: "radio", question: "Are you comfortable if your roommate owns a pet?", options: ["Yes", "No"] },
  { type: "text", question: "Do you have any extra preferences/requirements for your roommate?" },
  { type: "radio", question: "Are you comfortable if your roommate drinks?", options: ["Yes", "No"] },
  { type: "dropdown", question: "What are your cleanliness/organization habits?", options: ["Neat", "Moderate", "Messy"] },
  { type: "dropdown", question: "Do you prefer a roommate who cooks at home or one who prefers outside food?", options: ["Home", "Outside", "No Preference"] },
  { type: "radio", question: "Are you comfortable if your roommate invites guests over?", options: ["Yes", "No"] },
];

export default function ResidentScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const [form, setForm] = useState(() => {
    const initial = {};
    questionsList.forEach((_, i) => (initial[i] = ""));
    return initial;
  });
  const [page, setPage] = useState(0);
  const questionsPerPage = 5;

  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Glow animation for dark mode
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (isDarkMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [isDarkMode]);

  // Redirect to Login if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigation.replace("Login");
      }
    });
    return unsubscribe;
  }, [navigation]);

  // If preferences were already submitted for this user, skip the form until they logout
  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const submitted = await AsyncStorage.getItem(`preferences_submitted_${user.uid}`);
        if (submitted === "true") {
          navigation.replace("Main");
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [navigation]);
  
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  useFocusEffect(
    React.useCallback(() => {
      if (route?.params?.userName) setUserName(route.params.userName);

      (async () => {
        const cachedImage = await AsyncStorage.getItem("profileImage");
        if (cachedImage) setProfileImage(cachedImage);
        else setProfileImage(Image.resolveAssetSource(DEFAULT_PROFILE_PIC).uri);
      })();
    }, [route])
  );

  const startIndex = page * questionsPerPage;
  const currentQuestions = questionsList.slice(startIndex, startIndex + questionsPerPage);
  const totalPages = Math.ceil(questionsList.length / questionsPerPage);

  const handleNext = () => {
    for (let i = startIndex; i < startIndex + currentQuestions.length; i++) {
      if (!form[i] || form[i].trim() === "") {
        Alert.alert("Incomplete Form", "Please answer all questions before proceeding.");
        return;
      }
    }

    if (page < totalPages - 1) {
      setPage(page + 1);
    } else {
      // final submit: save preferences locally and to server
      (async () => {
        const saved = await savePreferences();
        if (saved) {
          Alert.alert("Success", "Preferences Saved! Please verify your Aadhaar.", [
            {
              text: "Verify Aadhaar",
              onPress: () => navigation.navigate("Adhar"),
            },
          ]);
        }
      })();
    }
  };

  const handlePrevious = () => {
    if (page > 0) setPage(page - 1);
  };

  const renderQuestion = (q, key) => {
    switch (q.type) {
      case "text":
        return (
          <TextInput
            style={[
              styles(colors, isDarkMode).input,
              { color: colors.text, backgroundColor: colors.inputBackground }
            ]}
            value={form[key]}
            onChangeText={(value) => setForm({ ...form, [key]: value })}
            placeholder="Your answer"
            placeholderTextColor={colors.placeholder}
          />
        );
      case "radio":
        return (
          <View style={{ flexDirection: "row", marginTop: 8, flexWrap: "wrap" }}>
            {q.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles(colors, isDarkMode).radioOption}
                onPress={() => setForm({ ...form, [key]: opt })}
              >
                <View style={[
                  styles(colors, isDarkMode).radioCircle,
                  { borderColor: colors.radioBorder }
                ]}>
                  {form[key] === opt && (
                    <View style={[
                      styles(colors, isDarkMode).radioSelected,
                      { backgroundColor: colors.radioSelected }
                    ]} />
                  )}
                </View>
                <Text style={styles(colors, isDarkMode).radioText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case "dropdown":
        return (
          <View style={[
            styles(colors, isDarkMode).pickerContainer,
            { backgroundColor: colors.inputBackground, borderColor: colors.border }
          ]}>
            <Picker
              selectedValue={form[key]}
              onValueChange={(itemValue) => setForm({ ...form, [key]: itemValue })}
              style={[styles(colors, isDarkMode).picker, { color: colors.text }]}
              dropdownIconColor={colors.label}
            >
              <Picker.Item label="Select..." value="" color={colors.placeholder} />
              {q.options.map((opt) => (
                <Picker.Item
                  key={opt}
                  label={opt}
                  value={opt}
                  color="#000000"
                />
              ))}
            </Picker>
          </View>
        );
      default:
        return null;
    }
  };

  // FIXED: Robust API call to save preferences in the database
  const savePreferences = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Please login first");
        return false;
      }

      setIsSaving(true);

      const preferences = {
        propertyLocation: form[0] || "",
        rent: form[1] || "",
        roommateGenderPref: form[2] || "",
        roommateAgePref: form[3] || "",
        curfewTime: form[4] || "",
        smokes: form[5] === "Yes",
        roommateSmokesOk: form[6] === "Yes",
        drinks: form[7] === "Yes",
        religiousPref: form[8] || "",
        roommateFoodPref: form[9] || "",
        environmentPref: form[10] || "",
        works: form[11] === "Yes",
        roommateNightOk: form[12] === "No",
        profession: form[13] || "",
        relationshipStatus: form[14] || "",
        roommatePetsOk: form[15] === "Yes",
        extraRequirements: form[16] || "",
        roommateDrinksOk: form[17] === "Yes",
        cleanliness: form[18] || "",
        roommateCookingPref: form[19] || "",
        roommateGuestsOk: form[20] === "Yes",
      };

      // Save locally first (fallback)
      await AsyncStorage.setItem(
        `resident_preferences_${user.uid}`,
        JSON.stringify(preferences)
      );

      // Mark that preferences have been submitted so the form won't show again until logout
      try {
        await AsyncStorage.setItem(`preferences_submitted_${user.uid}`, "true");
      } catch (e) {
        console.warn("Failed to set submitted flag:", e);
      }

      // Determine identifier to send: prefer numeric mapping stored locally,
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

      // Send to server
      const serverResp = await apiCall("/api/preferences/save-resident-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: identifier,
          preferences,
        }),
      });

      // If server returned numeric user id (for newly created or normalized users), store mapping
      try {
        const maybeUserId = serverResp?.data?.userId || serverResp?.data?.user_id;
        if (maybeUserId && Number.isInteger(Number(maybeUserId))) {
          await AsyncStorage.setItem(`numeric_user_id_${user.uid}`, String(maybeUserId));
        }
      } catch (e) {
        // ignore mapping failures
      }

      setIsSaving(false);

      if (!serverResp?.success) {
        console.error("Server error:", serverResp?.error || serverResp);
        Alert.alert(
          "Save Failed",
          serverResp?.error || "Failed to save to server. Data saved locally."
        );
        return false;
      }

      console.log("Preferences saved to database successfully");
      return true;
    } catch (err) {
      setIsSaving(false);
      console.error("Error saving preferences:", err);
      Alert.alert("Error", "An error occurred. Data is saved locally.");
      return false;
    }
  };

  return (
    <View style={[styles(colors, isDarkMode).container, { backgroundColor: colors.background }]}>
      {isDarkMode && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: glowOpacity,
              backgroundColor: '#f3439b',
              borderRadius: 20,
            },
          ]}
          pointerEvents="none"
        />
      )}
      <View style={[styles(colors, isDarkMode).header, { backgroundColor: colors.header }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles(colors, isDarkMode).headerTitle}>Co-Living Spaces</Text>
            <Text style={styles(colors, isDarkMode).headerSubtitle}>Welcome!</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile", { userName })}
              style={styles(colors, isDarkMode).profileCircle}
            >
              <Image
                source={profileImage ? { uri: profileImage } : DEFAULT_PROFILE_PIC}
                style={styles(colors, isDarkMode).profileImage}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles(colors, isDarkMode).scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles(colors, isDarkMode).card}>
          <Text style={[styles(colors, isDarkMode).progressText, { color: colors.label }]}>
            Card {page + 1} of {totalPages}
          </Text>

          {currentQuestions.map((q, index) => {
            const key = startIndex + index;
            return (
              <View key={key} style={styles(colors, isDarkMode).questionContainer}>
                <Text style={[styles(colors, isDarkMode).questionText, { color: colors.label }]}>
                  {q.question}
                </Text>
                {renderQuestion(q, key)}
              </View>
            );
          })}

          <View style={styles(colors, isDarkMode).buttonContainer}>
            {page > 0 && (
              <AnimatedButton
                style={[
                  styles(colors, isDarkMode).button,
                  styles(colors, isDarkMode).prevButton,
                  { backgroundColor: colors.secondaryButton }
                ]}
                onPress={handlePrevious}
                colors={colors}
                isDarkMode={isDarkMode}
              >
                <Text style={styles(colors, isDarkMode).buttonText}>Previous</Text>
              </AnimatedButton>
            )}
            <AnimatedButton
              style={[
                styles(colors, isDarkMode).button,
                { backgroundColor: colors.primaryButton },
                isSaving && { opacity: 0.6 } // subtle visual feedback
              ]}
              onPress={handleNext}
              colors={colors}
              isDarkMode={isDarkMode}
              disabled={isSaving}
            >
              <Text style={styles(colors, isDarkMode).buttonText}>
                {isSaving
                  ? "Saving..."
                  : page === totalPages - 1
                    ? "Submit Preferences"
                    : "Next"}
              </Text>
            </AnimatedButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      borderBottomLeftRadius: 35,
      borderBottomRightRadius: 35,
      padding: 15,
      marginBottom: 20,
      height: 150,
    },
    headerTitle: {
      color: "white",
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 40,
    },
    headerSubtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 5,
    },
    profileCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 20,
      overflow: "hidden",
    },
    profileImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    scrollContent: {
      paddingHorizontal: 15,
      paddingBottom: 20,
    },
    card: {
      padding: 20,
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      ...(isDarkMode && {
        shadowColor: '#f3439b',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
      }),
    },
    progressText: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 20,
      textAlign: "center",
    },
    questionContainer: {
      marginBottom: 24,
    },
    questionText: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
    },
    input: {
      borderRadius: 25,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      minHeight: 50,
    },
    radioOption: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 20,
      marginBottom: 10,
    },
    radioCircle: {
      height: 22,
      width: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      height: 12,
      width: 12,
      borderRadius: 6,
    },
    radioText: {
      marginLeft: 8,
      fontSize: 16,
      color: colors.text,
    },
    pickerContainer: {
      borderRadius: 25,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: 5,
    },
    picker: {
      height: 50,
      width: "100%",
    },
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 30,
      gap: 10,
    },
    button: {
      borderRadius: 25,
      paddingVertical: 15,
      flex: 1,
      alignItems: "center",
    },
    prevButton: {
      opacity: 0.8,
    },
    buttonText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 16,
    },
  });