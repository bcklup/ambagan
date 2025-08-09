import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

export default function QRScannerScreen() {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [joining, setJoining] = useState(false);
  const scannedRef = useRef(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || scannedRef.current) return;

    scannedRef.current = true;
    setScanning(false);
    setJoining(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Error", "You must be logged in to join a session");
        resetScanner();
        return;
      }

      // Use the QR token to join the session
      const userName = user.user_metadata?.name;
      const userPhone = user.phone;

      // Determine the best name to use
      let memberName = "Anonymous";
      if (userName) {
        memberName = userName;
      } else if (userPhone) {
        memberName = userPhone;
      }

      console.log("Joining session with name:", memberName, {
        userName,
        userPhone,
      });

      const { data: result, error } = await supabase.rpc("join_session_by_qr", {
        qr_token: data,
        member_name: memberName,
      });

      if (error) {
        throw error;
      }

      if (result) {
        // Get the session ID from the member record
        const { data: memberData, error: memberError } = await supabase
          .from("members")
          .select("session_id")
          .eq("id", result)
          .single();

        if (memberError) {
          throw memberError;
        }

        Alert.alert("Success!", "You've successfully joined the session!", [
          {
            text: "Go to Session",
            onPress: () => {
              router.replace({
                pathname: "/session/[id]",
                params: { id: memberData.session_id },
              });
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error("Error joining session:", error);

      let errorMessage = "Failed to join session";
      if (error.message?.includes("Invalid or inactive session")) {
        errorMessage = "Invalid or inactive session QR code";
      } else if (error.message?.includes("already a member")) {
        errorMessage = "You're already a member of this session";
      }

      Alert.alert("Error", errorMessage, [
        {
          text: "Try Again",
          onPress: resetScanner,
        },
        {
          text: "Go Back",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setJoining(false);
    }
  };

  const resetScanner = () => {
    scannedRef.current = false;
    setScanning(true);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    camera: {
      flex: 1,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    scanArea: {
      width: 250,
      height: 250,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: 12,
      backgroundColor: "transparent",
    },
    instructions: {
      position: "absolute",
      bottom: 100,
      left: 20,
      right: 20,
      alignItems: "center",
    },
    instructionText: {
      color: "#FFFFFF",
      textAlign: "center",
      fontSize: 16,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      padding: 12,
      borderRadius: 8,
    },
    permissionContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    permissionTitle: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: 16,
      textAlign: "center",
    },
    permissionDescription: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 24,
    },
    joiningOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    joiningContent: {
      backgroundColor: theme.colors.surface,
      padding: 24,
      borderRadius: 12,
      alignItems: "center",
      minWidth: 200,
    },
  });

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Join Session" />
        </Appbar.Header>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Join Session" />
        </Appbar.Header>
        <View style={styles.permissionContainer}>
          <Surface style={{ borderRadius: 32, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 64, textAlign: "center" }}>📷</Text>
          </Surface>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionDescription}>
            We need access to your camera to scan QR codes and join sessions.
          </Text>
          <Button
            mode="contained"
            onPress={requestPermission}
            style={{ paddingHorizontal: 5 }}
          >
            Grant Camera Permission
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Scan QR Code" />
      </Appbar.Header>

      <View style={styles.content}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          {/* Scanning overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {scanning
                ? "Point your camera at a session QR code to join"
                : "Processing QR code..."}
            </Text>
          </View>

          {/* Joining overlay */}
          {joining && (
            <View style={styles.joiningOverlay}>
              <View style={styles.joiningContent}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  variant="titleMedium"
                  style={{ marginTop: 16, textAlign: "center" }}
                >
                  Joining Session...
                </Text>
              </View>
            </View>
          )}
        </CameraView>
      </View>
    </View>
  );
}
