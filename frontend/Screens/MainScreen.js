import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";

const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Image source={require("../assets/Coliving Logo(2).jpeg")} style={styles.logo} />

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Login")}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white", 
    paddingHorizontal: 20,
  },
  logo: {
    width: 425,
    height: 425,
    marginBottom: 40,
    resizeMode: "contain",
  },
  button: {
    backgroundColor: "#f3439b", 
    height: 55,
    width: "60%",
    borderRadius: 30,
    justifyContent: "center",
    elevation: 3,
  },
  buttonText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "beige",
  },
});
