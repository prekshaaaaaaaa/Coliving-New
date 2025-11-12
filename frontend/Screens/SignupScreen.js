import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { auth } from "../Firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";

const SignupScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const getErrorMessage = (error) => {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "This email is already registered. Try logging in.";
      case "auth/weak-password":
        return "Password should be at least 6 characters long.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection.";
      default:
        return error.message || "An unexpected error occurred.";
    }
  };

  const handleSignup = async () => {
    const { email, password, confirmPassword } = form;

    if (!email || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      Alert.alert("Success", "Account created successfully!", [
        {
          text: "OK",
          onPress: () => {
            setForm({ email: "", password: "", confirmPassword: "" });
            navigation.navigate("Query");
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Signup Failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.innerContainer}>
          {/* Header Section */}
          <View style={[styles.heading, { backgroundColor: colors.header }]}>
            <Text style={styles.title}>Hello!</Text>
            <Text style={styles.subtitle}>Let's create a new account</Text>
          </View>

          {/* Form Fields */}
          <TextInput
            ref={emailRef}
            style={[
              styles.input,
              {
                borderBottomColor: isDarkMode ? colors.primary : "#e03a8f",
                color: colors.text,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={form.email}
            onChangeText={(value) => setForm({ ...form, email: value })}
            editable={!loading}
          />

          <TextInput
            ref={passwordRef}
            style={[
              styles.input,
              {
                borderBottomColor: isDarkMode ? colors.primary : "#e03a8f",
                color: colors.text,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            value={form.password}
            onChangeText={(value) => setForm({ ...form, password: value })}
            editable={!loading}
          />

          <TextInput
            ref={confirmPasswordRef}
            style={[
              styles.input,
              {
                borderBottomColor: isDarkMode ? colors.primary : "#e03a8f",
                color: colors.text,
              },
            ]}
            placeholder="Confirm Password"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignup}
            value={form.confirmPassword}
            onChangeText={(value) =>
              setForm({ ...form, confirmPassword: value })
            }
            editable={!loading}
          />

          {/* Sign Up Button */}
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: isDarkMode ? colors.primaryButton : "#e03a8f",
                opacity: loading ? 0.7 : 1,
                ...(isDarkMode && {
                  shadowColor: colors.primaryButton,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 15,
                  elevation: 8,
                }),
              },
            ]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </Pressable>

          {/* Login Link */}
          <Pressable onPress={() => navigation.navigate("Login")} disabled={loading}>
            <Text style={[styles.loginText, { color: colors.text }]}>
              Already have an account? <Text style={styles.loginLink}>Login</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    paddingTop: 40,
  },
  heading: {
    height: "35%",
    minHeight: 220,
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
    justifyContent: "center",
    paddingTop: 60,
  },
  title: {
    fontSize: 48,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    marginTop: 8,
    opacity: 0.9,
  },
  input: {
    borderBottomWidth: 2,
    width: "80%",
    alignSelf: "center",
    marginTop: 32,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  button: {
    borderRadius: 30,
    width: 260,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 50,
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  loginText: {
    marginTop: 24,
    fontSize: 15,
    textAlign: "center",
  },
  loginLink: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});