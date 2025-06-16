import { AppTheme } from "@/lib/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SessionScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

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
    iconContainer: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: 8,
      textAlign: "center",
    },
    sessionId: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      fontFamily: "monospace",
      marginBottom: 16,
    },
    description: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 24,
    },
    backButton: {
      marginTop: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Session Icon */}
        <Surface
          style={[styles.iconContainer, { borderRadius: 32, padding: 16 }]}
        >
          <Text style={{ fontSize: 64, textAlign: "center" }}>👥</Text>
        </Surface>

        <Text style={styles.title}>Session Details</Text>
        <Text style={styles.sessionId}>ID: {id}</Text>
        <Text style={styles.description}>
          Session management features are coming soon! This will include member
          management, order tracking, and bill splitting functionality.
        </Text>

        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.backButton}
          icon="arrow-left"
        >
          Back to Dashboard
        </Button>
      </View>
    </SafeAreaView>
  );
}
