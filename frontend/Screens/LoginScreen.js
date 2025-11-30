import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { auth } from "../Firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";

export default function LoginScreens({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleLogin = async () => {
    const { email, password } = form;

    if (!email || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter both email and password"
      );
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const idTokenResult = await user.getIdTokenResult(true);
      const role = idTokenResult.claims.role || null;

      if (role) await AsyncStorage.setItem("userRole", role);

      if (role === "flatmate") navigation.replace("Resident");
      else if (role === "roommate") navigation.replace("Roommate");
      else navigation.replace("Query");
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.heading, { backgroundColor: colors.header }]}>
        <Text style={styles.text}>Hello!</Text>
        <Text style={styles.subtext}>Let's find roomates</Text>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            borderBottomColor: isDarkMode ? colors.primary : "#e03a8f", // darker pink in light mode
            color: colors.text,
          },
        ]}
        placeholder="Email"
        placeholderTextColor={colors.placeholder}
        keyboardType="email-address"
        value={form.email}
        onChangeText={(value) => setForm({ ...form, email: value })}
      />

      <TextInput
        style={[
          styles.input,
          {
            borderBottomColor: isDarkMode ? colors.primary : "#e03a8f", // darker pink in light mode
            color: colors.text,
          },
        ]}
        placeholder="Password"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        value={form.password}
        onChangeText={(value) => setForm({ ...form, password: value })}
      />

      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: isDarkMode ? colors.primaryButton : "#e03a8f", // darker pink in light mode
            ...(isDarkMode && {
              shadowColor: colors.primaryButton,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 15,
              elevation: 8,
            }),
          },
        ]}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Login</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={[styles.register, { color: colors.text }]}>
          Don't have an account? Go to register
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  text: {
    fontSize: 50,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  heading: {
    height: "40%",
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
    justifyContent: "center",
  },
  subtext: {
    color: "white",
    textAlign: "center",
    fontSize: 20,
  },
  input: {
    width: "80%",
    alignSelf: "center",
    marginTop: 40,
    borderBottomWidth: 2,
    fontSize: 16,
    padding: 8,
  },
  button: {
    borderRadius: 30,
    width: 260,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    alignSelf: "center",
    marginTop: 70,
  },
  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  register: {
    margin: 25,
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
});
