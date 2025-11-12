import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const DEFAULT_PROFILE_PIC = require("../assets/profile.png");

const AnimatedButton = ({ children, style, onPress, disabled }) => {
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={style}
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

export default function AadhaarUpload({ navigation, route }) {
  const [file, setFile] = useState(null);
  const [shareCode, setShareCode] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState(null);

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

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "*/*",
          "application/xml",
          "text/xml",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const pickedFile = result.assets[0];

      if (!pickedFile.name.toLowerCase().endsWith(".xml")) {
        Alert.alert(
          "Invalid file",
          "Please select a valid Aadhaar XML file (.xml)"
        );
        return;
      }

      setFile(pickedFile);
    } catch (err) {
      console.error("File pick error:", err);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert("Please select an Aadhaar XML file first");
      return;
    }
    if (!shareCode.trim()) {
      Alert.alert("Please enter your Aadhaar Share Code");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("aadhaarXml", {
        uri: file.uri,
        name: file.name || "aadhaar.xml",
        type: "application/xml",
      });
      formData.append("shareCode", shareCode);
      formData.append("userId", "123");

      const response = await axios.post(
        "http://172.20.44.17:5000/api/upload-aadhaar",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      Alert.alert("Success", response.data.message, [
        {
          text: "OK",
          onPress: () => navigation.navigate("Match"),
        },
      ]);
      setFile(null);
      setShareCode("");
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload failed", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={styles.headerTitle}>Co-Living Spaces</Text>
            <Text style={styles.headerSubtitle}>Aadhaar Verification</Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Profile", { userName })}
            style={styles.profileCircle}
          >
            <Image
              source={
                profileImage ? { uri: profileImage } : DEFAULT_PROFILE_PIC
              }
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 15 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Upload your Aadhaar XML to complete verification
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Step 1: Select Aadhaar XML File</Text>
            <AnimatedButton style={styles.button} onPress={pickFile}>
              <Text style={styles.buttonText}>
                {file ? "Change File" : "Select XML File"}
              </Text>
            </AnimatedButton>

            {file && (
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>✓ {file.name}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Step 2: Enter Share Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Aadhaar Share Code"
              placeholderTextColor="#999"
              secureTextEntry
              value={shareCode}
              onChangeText={setShareCode}
            />
          </View>

          <AnimatedButton
            style={[
              styles.button,
              styles.submitButton,
              (!file || !shareCode) && styles.disabledButton,
            ]}
            onPress={uploadFile}
            disabled={!file || !shareCode}
          >
            <Text style={styles.buttonText}>✓ Upload & Verify</Text>
          </AnimatedButton>

          <TouchableOpacity
            style={styles.stepsToggle}
            onPress={() => setShowSteps(!showSteps)}
          >
            <Text style={styles.stepsToggleText}>
              {showSteps
                ? "Hide Instructions ▲"
                : "How to Download Aadhaar XML? ▼"}
            </Text>
          </TouchableOpacity>

          {showSteps && (
            <View style={styles.stepsBox}>
              <Text style={styles.stepTitle}>Download Steps:</Text>
              <Text style={styles.step}>
                1️⃣ Visit: https://myaadhaar.uidai.gov.in/offline-ekyc
              </Text>
              <Text style={styles.step}>
                2️⃣ Enter Aadhaar Number / VID + Security Code
              </Text>
              <Text style={styles.step}>
                3️⃣ Click "Send OTP" and enter OTP received
              </Text>
              <Text style={styles.step}>
                4️⃣ Set a Share Code (remember this!)
              </Text>
              <Text style={styles.step}>
                5️⃣ Click Download to get ZIP file with XML
              </Text>
              <Text style={styles.step}>
                6️⃣ Extract the XML file and upload here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    backgroundColor: "#f3439b",
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
  card: {
    padding: 20,
    backgroundColor: "white",
    marginHorizontal: 15,
    borderRadius: 20,
    elevation: 5,
    shadowColor: "#d85094",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    borderColor: "#d85094",
    borderWidth: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f3439b",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f3439b",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#f3439b",
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitButton: {
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#ffcce0",
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  fileInfo: {
    marginTop: 10,
    backgroundColor: "#fff0f7",
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#f3439b",
  },
  fileName: {
    fontSize: 14,
    color: "#f3439b",
    fontWeight: "600",
  },
  input: {
    borderBottomWidth: 2,
    borderColor: "#f35aa6",
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  stepsToggle: {
    marginTop: 20,
    alignItems: "center",
  },
  stepsToggleText: {
    color: "#f3439b",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  stepsBox: {
    marginTop: 15,
    backgroundColor: "#fff0f7",
    padding: 18,
    borderRadius: 15,
    borderColor: "#f3439b",
    borderWidth: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f3439b",
    marginBottom: 12,
  },
  step: {
    fontSize: 14,
    color: "#333",
    marginBottom: 10,
    lineHeight: 20,
    paddingLeft: 5,
  },
});