import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import * as AuthSession from "expo-auth-session";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Avatar, Button, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// Complete auth sessions when returning to the app
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const theme = useTheme<AppTheme>();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (
        !supabaseUrl ||
        !supabaseKey ||
        supabaseUrl === "" ||
        supabaseKey === ""
      ) {
        Alert.alert(
          "Configuration Error",
          "Supabase is not configured. Please create a .env file with your Supabase credentials.\n\nSee the setup instructions for details."
        );
        return;
      }

      console.log("Attempting Google sign in...");

      // Generate proper redirect URI for Expo Go
      const redirectUri = AuthSession.makeRedirectUri();

      console.log("Generated redirect URI:", redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
        },
      });

      console.log("OAuth response:", { data, error });

      if (error) {
        console.error("OAuth error:", error);
        Alert.alert("Authentication Error", error.message);
      } else if (data?.url) {
        console.log("Opening OAuth URL:", data.url);

        // Use AuthSession for proper OAuth handling in Expo Go
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        );

        console.log("Auth session result:", result);

        if (result.type === "success" && result.url) {
          // Parse the returned URL for auth tokens
          const url = new URL(result.url);
          const fragment = url.hash.substring(1); // Remove the # character
          const params = new URLSearchParams(fragment);

          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          console.log("Auth tokens found:", {
            accessToken: !!accessToken,
            refreshToken: !!refreshToken,
          });

          if (accessToken && refreshToken) {
            // Set the session in Supabase
            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

            if (sessionError) {
              console.error("Session error:", sessionError);
              Alert.alert(
                "Authentication Error",
                "Failed to establish session"
              );
            } else {
              console.log("Session established successfully!");
              // The auth listener in index.tsx will handle the redirect
            }
          } else {
            console.log("No auth tokens found in URL");
            Alert.alert(
              "Authentication Error",
              "No authentication tokens received"
            );
          }
        } else if (result.type === "cancel") {
          console.log("User cancelled authentication");
        } else {
          console.log("Authentication failed:", result);
        }
      } else {
        console.log("No URL returned from OAuth request");
        Alert.alert("Error", "No authentication URL received");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert(
        "Error",
        "An unexpected error occurred. Check the console for details."
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 64,
    },
    logo: {
      marginBottom: 16,
    },
    appTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.colors.onBackground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 18,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: 8,
    },
    welcomeContainer: {
      marginBottom: 48,
    },
    welcomeTitle: {
      fontSize: 20,
      fontWeight: "600",
      textAlign: "center",
      color: theme.colors.onBackground,
      marginBottom: 8,
    },
    welcomeText: {
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      lineHeight: 24,
    },
    signInButton: {
      width: "100%",
      marginTop: 32,
    },
    setupButton: {
      width: "100%",
      marginTop: 16,
    },
    disclaimerContainer: {
      marginTop: 32,
    },
    disclaimerText: {
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 20,
    },
    featuresContainer: {
      paddingHorizontal: 32,
      paddingBottom: 32,
    },
    featureRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    featureItem: {
      flex: 1,
      alignItems: "center",
    },
    featureChip: {
      marginBottom: 8,
    },
    featureText: {
      fontSize: 12,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
    },
  });

  const showSetupInstructions = () => {
    Alert.alert(
      "Updated Setup Instructions! 🔧",
      "For Expo Go:\n\n1. Use 'https://auth.expo.io/@your-username/ambagan' as redirect URI in Google OAuth\n2. Also add your Supabase callback URL\n3. The app will handle the rest automatically!\n\nCheck console logs for the exact redirect URI being used.",
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <Avatar.Text
            size={96}
            label="A"
            style={[styles.logo, { backgroundColor: theme.colors.primary }]}
            labelStyle={{ color: theme.colors.onPrimary, fontSize: 40 }}
          />
          <Text style={styles.appTitle}>Ambagan</Text>
          <Text style={styles.subtitle}>Split bills with friends easily</Text>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome to Ambagan</Text>
          <Text style={styles.welcomeText}>
            Create potluck sessions, add orders, and split bills with your
            friends. Everything syncs automatically.
          </Text>
        </View>

        {/* Sign In Button */}
        <Button
          mode="outlined"
          onPress={handleGoogleSignIn}
          loading={loading}
          disabled={loading}
          style={styles.signInButton}
          contentStyle={{ paddingVertical: 8 }}
          icon="google"
        >
          {loading ? "Opening browser..." : "Continue with Google"}
        </Button>

        {/* Setup Instructions Button */}
        <Button
          mode="text"
          onPress={showSetupInstructions}
          style={styles.setupButton}
          contentStyle={{ paddingVertical: 4 }}
          icon="information-outline"
        >
          Setup Instructions
        </Button>

        {/* Additional Info */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>

      {/* Bottom Features */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Chip
              style={styles.featureChip}
              textStyle={{ fontSize: 18 }}
              mode="outlined"
            >
              🍕
            </Chip>
            <Text style={styles.featureText}>Track Orders</Text>
          </View>

          <View style={styles.featureItem}>
            <Chip
              style={styles.featureChip}
              textStyle={{ fontSize: 18 }}
              mode="outlined"
            >
              👥
            </Chip>
            <Text style={styles.featureText}>Split Bills</Text>
          </View>

          <View style={styles.featureItem}>
            <Chip
              style={styles.featureChip}
              textStyle={{ fontSize: 18 }}
              mode="outlined"
            >
              💰
            </Chip>
            <Text style={styles.featureText}>Easy Payments</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
