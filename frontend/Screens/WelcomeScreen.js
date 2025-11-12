import { StyleSheet, Text, View, Image, Pressable } from "react-native";
import React, { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { auth } from "../Firebase";

const WelcomeScreen = () => {
  const navigation = useNavigation();

  // Force light-theme colors on the welcome screen
  const colors = { background: '#ffffff', text: '#111111' };

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate("Main");
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigation]);

  const handleLoginPress = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        const role = idTokenResult.claims.role || null;
        const target = role === 'flatmate' ? 'Resident' : role === 'roommate' ? 'Roommate' : 'Query';
        navigation.reset({ index: 0, routes: [{ name: target }] });
        return;
      } catch (e) {
        console.error('WelcomeScreen login press: failed to read token claims', e);
      }
    }
    // If not logged in or token read failed, go to Login screen (reset to auth stack)
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Image
        style={{
          width: 300,
          height: 300,
          resizeMode: 'contain'
        }}
        source={require("../assets/Coliving Logo.png")}
      />
      <Text style={[styles.appName, { color: colors.text }]}>Co-Living Hub</Text>

      <Pressable onPress={handleLoginPress} style={styles.loginButton}>
        <Text style={styles.loginButtonText}>Login</Text>
      </Pressable>
    </View>
  );
};
export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 20,
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: '#e03a8f',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
