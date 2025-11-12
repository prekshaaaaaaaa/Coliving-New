// App.js
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { auth } from "./Firebase";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from "react-native-toast-message";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import LoginScreen from "./Screens/LoginScreen";
import SignupScreen from "./Screens/SignupScreen";
import WelcomeScreen from "./Screens/WelcomeScreen";
import QueryScreen from "./Screens/QueryScreen";
import MainScreen from "./Screens/MainScreen";
import ResidentScreen from "./Screens/ResidentScreen";
import RoommateScreen from "./Screens/RoommateScreen";
import ProfileScreen from "./Screens/ProfileScreen";
import AdharScreen from "./Screens/AdharScreen";
import MatchesScreen from "./Screens/MatchesScreen";
import MatchedUsersScreen from "./Screens/MatchedUsersScreen";
import ChatScreen from "./Screens/ChatScreen";
import SimpleChatScreen from "./Screens/SimpleChatScreen";

const Stack = createNativeStackNavigator();

function AppContent() {
  const { colors } = useTheme();
  const [initialRoute, setInitialRoute] = useState("Welcome");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get latest ID token including custom claims
          const idTokenResult = await user.getIdTokenResult(true);
          const role = idTokenResult.claims.role || null;

          // If the user already submitted preferences, skip the Resident/Roommate form screens
          try {
            const submitted = await AsyncStorage.getItem(`preferences_submitted_${user.uid}`);
            if (submitted === 'true') {
              setInitialRoute('Main');
            } else if (role === "flatmate") setInitialRoute("Resident");
            else if (role === "roommate") setInitialRoute("Roommate");
            else setInitialRoute("Query");
          } catch (e) {
            // on error reading storage, fallback to role-based routing
            if (role === "flatmate") setInitialRoute("Resident");
            else if (role === "roommate") setInitialRoute("Roommate");
            else setInitialRoute("Query");
          }
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          setInitialRoute("Login");
        }
      } else {
        setInitialRoute("Login");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {  
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Query" component={QueryScreen} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Roommate" component={RoommateScreen} />
          <Stack.Screen name="Resident" component={ResidentScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Matches" component={MatchesScreen} />
          <Stack.Screen name="MatchedUsers" component={MatchedUsersScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="SimpleChat" component={SimpleChatScreen} />
          <Stack.Screen name="Adhar" component={AdharScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <Toast position="top" visibilityTime={3000} topOffset={50} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
