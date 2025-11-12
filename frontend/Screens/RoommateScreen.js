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
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { auth } from "../Firebase";
import { onAuthStateChanged } from "firebase/auth";
import { apiCall } from "../config";
import AadhaarUpload from "./AdharScreen";

const DEFAULT_PROFILE_PIC = require("../assets/profile.png");

const AnimatedButton = ({
  children,
  style,
  onPress,
  colors,
  isDarkMode,
  disabled,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
      <Pressable
        style={[
          style,
          isDarkMode &&
            !disabled && {
              shadowColor: "#f3439b",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 15,
              elevation: 8,
            },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const questionsList = [
  { type: "text", question: "Where are you currently living?" },
  { type: "text", question: "What is the maximum rent that you can pay?" },
  {
    type: "dropdown",
    question: "What gender(s) are you comfortable sharing a space with?",
    options: ["Male", "Female", "Any"],
  },
  {
    type: "text",
    question:
      "Do you have any specific curfew timings for yourself or expect your roommate to follow?",
  },
  {
    type: "text",
    question: "Do you have any age group preference for your roommate?",
  },
  { type: "radio", question: "Do you smoke?", options: ["Yes", "No"] },
  { type: "radio", question: "Do you drink alcohol?", options: ["Yes", "No"] },
  {
    type: "radio",
    question: "Are you comfortable if your roommate smokes or drinks?",
    options: ["Yes", "No"],
  },
  {
    type: "text",
    question:
      "Do you have any religious or cultural preferences that should be considered?",
  },
  {
    type: "dropdown",
    question: "Are you vegetarian or non-vegetarian?",
    options: ["Vegetarian", "Non-Vegetarian", "Vegan", "No Preference"],
  },
  {
    type: "text",
    question:
      "Do you have any dietary restrictions or food habits your roommate should know?",
  },
  {
    type: "dropdown",
    question:
      "Do you prefer a quiet environment or a social/party-friendly one?",
    options: ["Quiet", "Social/Party-Friendly"],
  },
  {
    type: "text",
    question: "Do you own pets or plan to keep one? If yes, what kind?",
  },
  { type: "text", question: "What is your profession?" },
  {
    type: "dropdown",
    question: "Do you work/study? If yes, what's your schedule?",
    options: ["Day Shift", "Night Shift", "Flexible", "Not Working/Studying"],
  },
  {
    type: "radio",
    question:
      "Are you okay if your roommate works in a night shift or has an irregular schedule?",
    options: ["Yes", "No"],
  },
  {
    type: "dropdown",
    question: "Are you married, single, or in a relationship?",
    options: ["Single", "Married", "In a Relationship"],
  },
  {
    type: "dropdown",
    question:
      "Do you prefer living with someone of similar background/profession or are you flexible?",
    options: ["Similar", "Flexible"],
  },
  {
    type: "dropdown",
    question: "What are your cleanliness/organization habits?",
    options: ["Messy", "Neat", "Moderate"],
  },
  {
    type: "dropdown",
    question: "Do you like to cook at home or prefer outside food?",
    options: ["Home", "Outside", "No Preference"],
  },
  {
    type: "text",
    question:
      "Any extra expectations from your roommate (quiet study time, shared meals, equal chores, guests allowed, etc.)?",
  },
];

export default function RoommateScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const [form, setForm] = useState(() => {
    const initial = {};
    questionsList.forEach((_, i) => (initial[i] = ""));
    return initial;
  });

  const [page, setPage] = useState(0);
  const questionsPerPage = 5;
  const totalPages = Math.ceil(questionsList.length / questionsPerPage);
  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
      if (!user) navigation.replace("Login");
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
  const currentQuestions = questionsList.slice(
    startIndex,
    startIndex + questionsPerPage
  );

  const savePreferences = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "Please login first");
      return false;
    }

    setIsSaving(true);

    const preferences = {
      name: userName || "User",
      currentLocation: form[0] || "",
      maxRent: form[1] || "",
      genderPreference: form[2] || "",
      curfewTimings: form[3] || "",
      ageGroupPreference: form[4] || "",
      smokes: form[5] || "",
      drinks: form[6] || "",
      comfortableWithSmoking: form[7] || "",
      comfortableWithDrinking: form[7] || "",
      religiousPreferences: form[8] || "",
      dietaryPreference: form[9] || "",
      dietaryRestrictions: form[10] || "",
      environmentPreference: form[11] || "",
      pets: form[12] || "",
      profession: form[13] || "",
      schedule: form[14] || "",
      okayWithIrregularSchedule: form[15] || "",
      relationshipStatus: form[16] || "",
      backgroundPreference: form[17] || "",
      cleanlinessHabits: form[18] || "",
      cookingPreference: form[19] || "",
      extraExpectations: form[20] || "",
    };

    try {
      // Save locally first (offline-first)
      await AsyncStorage.setItem(
        `roommate_preferences_${user.uid}`,
        JSON.stringify(preferences)
      );

      // Mark that preferences have been submitted so the form won't show again until logout
      try {
        await AsyncStorage.setItem(`preferences_submitted_${user.uid}`, "true");
      } catch (e) {
        console.warn("Failed to set submitted flag:", e);
      }

      // Determine userId to send: prefer numeric mapping (if stored), then email, then uid
      let userIdToSend = null;
      try {
        const numericId = await AsyncStorage.getItem(
          `numeric_user_id_${user.uid}`
        );
        if (numericId && Number.isInteger(Number(numericId))) {
          userIdToSend = Number(numericId);
        }
      } catch (e) {
        // ignore
      }

      if (!userIdToSend) {
        if (user.email) userIdToSend = user.email; // backend supports email fallback
        else userIdToSend = user.uid;
      }

      // Try to upload to server with retries
      const maxAttempts = 3;
      let attempt = 0;
      let lastError = null;

      while (attempt < maxAttempts) {
        attempt += 1;
        const resp = await apiCall("/api/preferences/save-roommate-preferences", {
          method: "POST",
          body: JSON.stringify({ userId: userIdToSend, preferences }),
        });

        if (resp.success) {
          // If server returned a numeric user_id in data (for example after create), store mapping
          try {
            const maybeUserId = resp.data?.user_id || resp.data?.userId;
            if (maybeUserId && Number.isInteger(Number(maybeUserId))) {
              await AsyncStorage.setItem(
                `numeric_user_id_${user.uid}`,
                String(maybeUserId)
              );
            }
          } catch (e) {
            // ignore mapping failures
          }

          setIsSaving(false);
          Alert.alert("Success", "Preferences saved successfully.");
          return true;
        }

        lastError = resp.error || "Unknown error";

        // If server says user not found, try to create a user (best-effort)
        if (
          attempt === 1 &&
          lastError.toLowerCase().includes("user not found") &&
          user.email
        ) {
          // Attempt to create minimal user via debug route (include placeholder aadhar_no to satisfy schema)
          const placeholderAadhar = ("P" + Date.now()).slice(-12).padStart(12, "0");
          const createResp = await apiCall("/api/debug/create-user", {
            method: "POST",
            body: JSON.stringify({
              name: user.displayName || user.email,
              email: user.email,
              aadhar_no: placeholderAadhar,
            }),
          });

          if (createResp.success && createResp.data && createResp.data.user_id) {
            // store numeric id mapping and retry immediately
            const newId = createResp.data.user_id;
            await AsyncStorage.setItem(`numeric_user_id_${user.uid}`, String(newId));
            userIdToSend = newId;
            continue; // retry send immediately
          } else {
            // couldn't create user; fall through to retry/backoff
            lastError = createResp.error || lastError;
          }
        }

        // Backoff before retrying
        const backoffMs = 800 * attempt;
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      // If we reach here, all attempts failed
      console.warn("Failed to sync preferences to server:", lastError);
      setIsSaving(false);
      Alert.alert(
        "Saved Locally",
        "Preferences were saved locally but could not be sent to the server.\nReason: " +
          (lastError || "Network/server error") +
          "\n\nYou can try again when your network is available or check the server IP in config.js"
      );
      return true;
    } catch (err) {
      console.error("Error in savePreferences:", err);
      setIsSaving(false);
      Alert.alert("Error", "Failed to save preferences locally. Please try again.");
      return false;
    }
  };

  const handleNext = async () => {
    for (let i = startIndex; i < startIndex + currentQuestions.length; i++) {
      if (!form[i] || form[i].trim() === "") {
        Alert.alert(
          "Incomplete Form",
          "Please answer all questions before proceeding."
        );
        return;
      }
    }

    if (page < totalPages - 1) {
      setPage(page + 1);
    } else {
      const saved = await savePreferences();
      if (saved) {
        Alert.alert(
          "Success",
          "Preferences Saved! Please verify your Aadhaar.",
          [
            {
              text: "Verify Aadhaar",
              onPress: () => navigation.navigate("Adhar"),
            },
          ]
        );
      }
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
              { color: colors.text, backgroundColor: colors.inputBackground },
            ]}
            value={form[key]}
            onChangeText={(value) => setForm({ ...form, [key]: value })}
            placeholder="Your answer"
            placeholderTextColor={colors.placeholder}
          />
        );
      case "radio":
        return (
          <View
            style={{ flexDirection: "row", marginTop: 8, flexWrap: "wrap" }}
          >
            {q.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles(colors, isDarkMode).radioOption}
                onPress={() => setForm({ ...form, [key]: opt })}
              >
                <View
                  style={[
                    styles(colors, isDarkMode).radioCircle,
                    { borderColor: colors.radioBorder },
                  ]}
                >
                  {form[key] === opt && (
                    <View
                      style={[
                        styles(colors, isDarkMode).radioSelected,
                        { backgroundColor: colors.radioSelected },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles(colors, isDarkMode).radioText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case "dropdown":
        return (
          <View
            style={[
              styles(colors, isDarkMode).pickerContainer,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Picker
              selectedValue={form[key]}
              onValueChange={(itemValue) =>
                setForm({ ...form, [key]: itemValue })
              }
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

  return (
    <View
      style={[
        styles(colors, isDarkMode).container,
        { backgroundColor: colors.background },
      ]}
    >
      {isDarkMode && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: glowOpacity,
              backgroundColor: "#f3439b",
              borderRadius: 20,
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View
        style={[
          styles(colors, isDarkMode).header,
          { backgroundColor: colors.header },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={styles(colors, isDarkMode).headerTitle}>
              Co-Living Spaces
            </Text>
            <Text style={styles(colors, isDarkMode).headerSubtitle}>
              Welcome!
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile", { userName })}
              style={styles(colors, isDarkMode).profileCircle}
            >
              <Image
                source={
                  profileImage ? { uri: profileImage } : DEFAULT_PROFILE_PIC
                }
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
          <Text style={styles(colors, isDarkMode).progressText}>
            Card {page + 1} of {totalPages}
          </Text>

          {currentQuestions.map((q, index) => {
            const key = startIndex + index;
            return (
              <View
                key={key}
                style={styles(colors, isDarkMode).questionContainer}
              >
                <Text style={styles(colors, isDarkMode).questionText}>
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
                  { backgroundColor: colors.secondaryButton },
                ]}
                onPress={handlePrevious}
                colors={colors}
                isDarkMode={isDarkMode}
              >
                <Text style={styles(colors, isDarkMode).buttonText}>
                  Previous
                </Text>
              </AnimatedButton>
            )}
            <AnimatedButton
              style={[
                styles(colors, isDarkMode).button,
                { backgroundColor: colors.primaryButton },
                isSaving && { opacity: 0.6 },
              ]}
              onPress={handleNext}
              colors={colors}
              isDarkMode={isDarkMode}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles(colors, isDarkMode).buttonText}>
                  {page === totalPages - 1 ? "Submit Preferences" : "Next"}
                </Text>
              )}
            </AnimatedButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
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
    headerSubtitle: { color: "white", fontSize: 18, marginTop: 5 },
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
    profileImage: { width: 50, height: 50, borderRadius: 25 },
    scrollContent: { paddingHorizontal: 15, paddingBottom: 20 },
    card: {
      padding: 20,
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      ...(isDarkMode && {
        shadowColor: "#f3439b",
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
      color: colors.label,
    },
    questionContainer: { marginBottom: 24 },
    questionText: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
      color: colors.label,
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
    picker: {
      height: 50,
      width: "100%",
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
    radioSelected: { height: 12, width: 12, borderRadius: 6 },
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
    prevButton: { opacity: 0.8 },
    buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  });