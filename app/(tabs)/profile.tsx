import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const theme = useTheme<AppTheme>();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("Profile: User data:", user);
      setUser(user);
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          console.log("Signing out...");
          setSigningOut(true);
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.error("Sign out error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
              setSigningOut(false);
            } else {
              console.log("Successfully signed out");
              setTimeout(() => {
                router.replace("/auth/login");
              }, 100);
            }
          } catch (error) {
            console.error("Unexpected sign out error:", error);
            Alert.alert("Error", "Failed to sign out. Please try again.");
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 24,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.colors.onBackground,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
    },
    content: {
      flex: 1,
      padding: 24,
    },
    userCard: {
      marginBottom: 24,
      backgroundColor: theme.colors.surface,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    userDetails: {
      marginLeft: 16,
      flex: 1,
    },
    userName: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    userContact: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    signOutButton: {
      marginTop: 24,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getDisplayName = () => {
    return user?.user_metadata?.name || user?.phone || user?.email || "User";
  };

  const getAvatarLabel = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account and preferences</Text>
      </View>

      <View style={styles.content}>
        {/* User Info Card */}
        <Card style={styles.userCard}>
          <Card.Content>
            <View style={styles.userInfo}>
              <Avatar.Text
                size={64}
                label={getAvatarLabel()}
                style={{ backgroundColor: theme.colors.primary }}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{getDisplayName()}</Text>
                <Text style={styles.userContact}>
                  {user?.phone || user?.email || "No contact info"}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* App Info */}
        <Surface style={{ borderRadius: 12, marginBottom: 24 }}>
          <List.Item
            title="Version"
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information" />}
          />
          <List.Item
            title="About Ambagan"
            description="Split bills with friends easily"
            left={(props) => <List.Icon {...props} icon="heart" />}
          />
        </Surface>

        {/* Sign Out Button */}
        <Button
          mode="contained"
          onPress={handleSignOut}
          icon="logout"
          buttonColor={theme.colors.error}
          style={styles.signOutButton}
          loading={signingOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing Out..." : "Sign Out"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
