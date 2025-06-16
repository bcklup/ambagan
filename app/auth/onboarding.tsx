import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  RadioButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethodType = "qr_code" | "other";

export default function OnboardingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("qr_code");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState("");
  const theme = useTheme<AppTheme>();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need access to your photo library to upload your QR code."
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled) {
        setQrImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error("User not authenticated");
      }

      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create unique filename
      const fileExt = uri.split(".").pop();
      const fileName = `payment-qr/${
        userData.user.id
      }/${Date.now()}.${fileExt}`;

      console.log("Uploading image:", fileName);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .upload(fileName, blob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("user-uploads")
        .getPublicUrl(data.path);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error("Image upload failed:", error);
      return null;
    }
  };

  const handleCompleteProfile = async () => {
    try {
      setLoading(true);

      // Validate inputs
      if (!name.trim()) {
        Alert.alert("Error", "Please enter your name or nickname");
        return;
      }

      if (paymentMethod === "qr_code" && !qrImage) {
        Alert.alert("Error", "Please upload your InstaPay QR code screenshot");
        return;
      }

      if (paymentMethod === "other" && !paymentNotes.trim()) {
        Alert.alert("Error", "Please provide payment method details");
        return;
      }

      console.log("Completing profile setup...");

      // Upload QR image if provided
      let qrImageUrl: string | null = null;
      if (paymentMethod === "qr_code" && qrImage) {
        qrImageUrl = await uploadImage(qrImage);
        if (!qrImageUrl) {
          Alert.alert(
            "Error",
            "Failed to upload QR code image. Please try again."
          );
          return;
        }
      }

      // Update user metadata
      const { data: authData, error: authError } =
        await supabase.auth.updateUser({
          data: {
            name: name.trim(),
            onboarding_completed: true,
          },
        });

      if (authError) {
        console.error("Profile update error:", authError);
        Alert.alert("Error", authError.message);
        return;
      }

      // Save payment method to database
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error("User not authenticated");
      }

      const { error: paymentError } = await supabase
        .from("user_payment_methods")
        .insert({
          user_id: userData.user.id,
          type: paymentMethod,
          qr_image_url: qrImageUrl,
          notes: paymentMethod === "other" ? paymentNotes.trim() : null,
          is_default: true,
        });

      if (paymentError) {
        console.error("Payment method save error:", paymentError);
        Alert.alert(
          "Error",
          "Failed to save payment method. Please try again."
        );
        return;
      }

      console.log("Profile and payment method saved successfully");

      Alert.alert(
        "Welcome! 🎉",
        `Great to meet you, ${name.trim()}! Your profile and payment method are now set up.`,
        [
          {
            text: "Get Started",
            onPress: () => router.replace("/(tabs)"),
          },
        ]
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to complete profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 32,
    },
    logo: {
      marginBottom: 16,
    },
    appTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.colors.onBackground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: 8,
    },
    sectionContainer: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 16,
      lineHeight: 20,
    },
    input: {
      marginBottom: 12,
    },
    paymentCard: {
      padding: 16,
      marginBottom: 12,
      backgroundColor: theme.colors.surface,
    },
    paymentOption: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    paymentLabel: {
      marginLeft: 12,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    imageUploadContainer: {
      marginTop: 12,
    },
    imagePreview: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginTop: 12,
    },
    uploadButton: {
      marginTop: 12,
    },
    completeButton: {
      marginTop: 24,
      marginBottom: 16,
    },
    divider: {
      marginVertical: 20,
    },
  });

  const renderPaymentMethodSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Payment Method</Text>
      <Text style={styles.sectionSubtitle}>
        Choose how you&apos;d like to receive payments when others owe you
        money.
      </Text>

      <Card style={styles.paymentCard}>
        <TouchableOpacity
          style={styles.paymentOption}
          onPress={() => setPaymentMethod("qr_code")}
        >
          <RadioButton
            value="qr_code"
            status={paymentMethod === "qr_code" ? "checked" : "unchecked"}
            onPress={() => setPaymentMethod("qr_code")}
          />
          <Text style={styles.paymentLabel}>InstaPay QR Code Screenshot</Text>
        </TouchableOpacity>

        {paymentMethod === "qr_code" && (
          <View style={styles.imageUploadContainer}>
            <HelperText type="info">
              Upload a screenshot of your InstaPay QR code from your banking app
            </HelperText>

            {qrImage && (
              <Image source={{ uri: qrImage }} style={styles.imagePreview} />
            )}

            <Button
              mode="outlined"
              onPress={pickImage}
              style={styles.uploadButton}
              icon="camera"
            >
              {qrImage ? "Change QR Code" : "Upload QR Code"}
            </Button>
          </View>
        )}
      </Card>

      <Card style={styles.paymentCard}>
        <TouchableOpacity
          style={styles.paymentOption}
          onPress={() => setPaymentMethod("other")}
        >
          <RadioButton
            value="other"
            status={paymentMethod === "other" ? "checked" : "unchecked"}
            onPress={() => setPaymentMethod("other")}
          />
          <Text style={styles.paymentLabel}>
            Others (Cash, Manual Transfer, etc.)
          </Text>
        </TouchableOpacity>

        {paymentMethod === "other" && (
          <View style={styles.imageUploadContainer}>
            <TextInput
              label="Payment Method Details"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Cash only, BPI Account: 1234567890, GCash: 09123456789"
              multiline
              numberOfLines={3}
            />
            <HelperText type="info">
              Describe how others can pay you (account numbers, contact info,
              etc.)
            </HelperText>
          </View>
        )}
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Surface style={[styles.logo, { borderRadius: 32, padding: 16 }]}>
              <Text style={{ fontSize: 64, textAlign: "center" }}>🧾</Text>
            </Surface>
            <Text style={styles.appTitle}>Set Up Your Profile</Text>
            <Text style={styles.subtitle}>
              We need a few details to get you started
            </Text>
          </View>

          {/* Name Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <Text style={styles.sectionSubtitle}>
              This is how you&apos;ll appear to other members in sessions.
            </Text>

            <TextInput
              label="Your Name/Nickname"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              autoCapitalize="words"
              textContentType="name"
              placeholder="e.g., John, Johnny, JDoe"
            />
          </View>

          <Divider style={styles.divider} />

          {/* Payment Method Section */}
          {renderPaymentMethodSection()}

          <Button
            mode="contained"
            onPress={handleCompleteProfile}
            loading={loading}
            disabled={
              loading ||
              !name.trim() ||
              (paymentMethod === "qr_code" && !qrImage) ||
              (paymentMethod === "other" && !paymentNotes.trim())
            }
            style={styles.completeButton}
            icon="check"
            contentStyle={{ paddingVertical: 8 }}
          >
            {loading ? "Setting Up..." : "Complete Setup"}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
