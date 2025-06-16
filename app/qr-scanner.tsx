import { AppTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QRScannerScreen() {
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
        {/* QR Code Icon */}
        <Surface
          style={[styles.iconContainer, { borderRadius: 32, padding: 16 }]}
        >
          <Text style={{ fontSize: 64, textAlign: "center" }}>📱</Text>
        </Surface>

        <Text style={styles.title}>QR Code Scanner</Text>
        <Text style={styles.description}>
          QR code scanning functionality is coming soon! This will allow you to
          quickly join sessions by scanning QR codes.
        </Text>

        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.backButton}
          icon="arrow-left"
        >
          Go Back
        </Button>
      </View>
    </SafeAreaView>
  );
}
