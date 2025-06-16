import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { User } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import ImageViewing from "react-native-image-viewing";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Divider,
  HelperText,
  IconButton,
  List,
  Modal,
  Portal,
  RadioButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethod = {
  id: string;
  user_id: string;
  type: "qr_code" | "cash" | "bank_transfer" | "gcash" | "paymaya" | "other";
  qr_image_url: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type EditModalType = "name" | "payment" | null;

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Modal states
  const [editModal, setEditModal] = useState<EditModalType>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [viewQrModal, setViewQrModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState("");
  const [paymentType, setPaymentType] = useState<"qr_code" | "other">(
    "qr_code"
  );
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState("");

  const theme = useTheme<AppTheme>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchUserProfile(), fetchPaymentMethod()]);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setEditName(user?.user_metadata?.name || "");
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchPaymentMethod = async () => {
    try {
      const { data, error } = await supabase
        .from("user_payment_methods")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error fetching payment method:", error);
      } else {
        setPaymentMethod(data || null);
      }
    } catch (error) {
      console.error("Error fetching payment method:", error);
    }
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Please enter your name or nickname");
      return;
    }

    setModalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: editName.trim() },
      });

      if (error) {
        console.error("Name update error:", error);
        Alert.alert("Error", error.message);
      } else {
        await fetchUserProfile();
        setEditModal(null);
        Alert.alert("Success", "Your name has been updated!");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to update name. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

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
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        // Validate the selected image
        if (!selectedImage.uri) {
          Alert.alert("Error", "Invalid image selected. Please try again.");
          return;
        }

        if (
          selectedImage.fileSize &&
          selectedImage.fileSize > 5 * 1024 * 1024
        ) {
          Alert.alert(
            "Error",
            "Image is too large. Please select an image smaller than 5MB."
          );
          return;
        }

        setQrImage(selectedImage.uri);
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

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length === 0) {
        throw new Error("Failed to read image file or file is empty");
      }

      // Convert base64 to ArrayBuffer using base64-arraybuffer
      const { decode } = await import("base64-arraybuffer");
      const arrayBuffer = decode(base64);

      if (arrayBuffer.byteLength === 0) {
        throw new Error("Failed to convert image to binary data");
      }

      // Create unique filename with proper extension
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `payment-qr/${
        userData.user.id
      }/${Date.now()}.${fileExt}`;

      // Upload ArrayBuffer to Supabase storage
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .upload(fileName, arrayBuffer, {
          cacheControl: "3600",
          upsert: true, // Allow overwriting corrupted files
          contentType: `image/${fileExt === "png" ? "png" : "jpeg"}`,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        throw error;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("user-uploads")
        .getPublicUrl(data.path);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error("Image upload failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      Alert.alert(
        "Upload Failed",
        `Failed to upload image: ${errorMessage}. Please try selecting the image again.`
      );
      return null;
    }
  };

  const handleSavePaymentMethod = async () => {
    try {
      setModalLoading(true);

      if (
        paymentType === "qr_code" &&
        !qrImage &&
        !paymentMethod?.qr_image_url
      ) {
        Alert.alert("Error", "Please upload your QR code screenshot");
        return;
      }

      if (paymentType === "other" && !paymentNotes.trim()) {
        Alert.alert("Error", "Please provide payment method details");
        return;
      }

      let qrImageUrl: string | null = paymentMethod?.qr_image_url || null;

      if (paymentType === "qr_code" && qrImage) {
        qrImageUrl = await uploadImage(qrImage);
        if (!qrImageUrl) {
          Alert.alert(
            "Error",
            "Failed to upload QR code image. Please try again."
          );
          return;
        }
      }

      const paymentData = {
        user_id: user?.id,
        type: paymentType,
        qr_image_url: paymentType === "qr_code" ? qrImageUrl : null,
        notes: paymentType === "other" ? paymentNotes.trim() : null,
        is_default: true, // Always default since there's only one
      };

      let error;
      if (paymentMethod) {
        // Update existing payment method
        const result = await supabase
          .from("user_payment_methods")
          .update(paymentData)
          .eq("id", paymentMethod.id);
        error = result.error;
      } else {
        // Create new payment method
        const result = await supabase
          .from("user_payment_methods")
          .insert(paymentData);
        error = result.error;
      }

      if (error) {
        console.error("Payment method save error:", error);
        Alert.alert(
          "Error",
          "Failed to save payment details. Please try again."
        );
      } else {
        await fetchPaymentMethod();
        closePaymentModal();
        Alert.alert(
          "Success",
          `Payment details ${paymentMethod ? "updated" : "saved"} successfully!`
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to save payment details. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const openPaymentModal = (editMode: boolean = false) => {
    setPaymentType(
      paymentMethod?.type === "qr_code"
        ? "qr_code"
        : paymentMethod
        ? "other"
        : "qr_code"
    );
    setQrImage(null);
    setPaymentNotes(paymentMethod?.notes || "");
    setEditModal("payment");
  };

  const closePaymentModal = () => {
    setEditModal(null);
    setQrImage(null);
    setPaymentNotes("");
    setPaymentType("qr_code");
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.error("Sign out error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
              setSigningOut(false);
            } else {
              router.replace("/auth/login");
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

  const getDisplayName = () => {
    return user?.user_metadata?.name || user?.phone || user?.email || "User";
  };

  const getAvatarLabel = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case "qr_code":
        return "InstaPay QR Code";
      case "gcash":
        return "GCash";
      case "paymaya":
        return "PayMaya";
      case "bank_transfer":
        return "Bank Transfer";
      case "cash":
        return "Cash";
      default:
        return "Other";
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method.type) {
      case "qr_code":
        return "qrcode";
      case "gcash":
      case "paymaya":
        return "cellphone";
      case "bank_transfer":
        return "bank";
      case "cash":
        return "cash";
      default:
        return "wallet";
    }
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
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: 12,
    },
    userCard: {
      backgroundColor: theme.colors.surface,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
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
    paymentCard: {
      backgroundColor: theme.colors.surface,
      marginBottom: 8,
    },
    paymentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    paymentTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.onSurface,
    },
    defaultBadge: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "500",
    },
    paymentActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    emptyPayments: {
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      fontStyle: "italic",
      padding: 24,
    },
    signOutButton: {
      marginTop: 16,
    },
    modal: {
      margin: 20,
    },
    modalCard: {
      padding: 24,
      backgroundColor: theme.colors.surface,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 16,
    },
    input: {
      marginBottom: 16,
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
    imagePreview: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginTop: 12,
    },
    uploadButton: {
      marginTop: 12,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 24,
    },
    modalButton: {
      marginLeft: 8,
    },
    viewQrContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    viewQrButton: {
      marginLeft: 8,
    },
    errorText: {
      color: theme.colors.error,
      fontWeight: "bold",
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account and preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
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
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => setEditModal("name")}
                />
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Payment Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <Card style={styles.userCard}>
            <Card.Content>
              {paymentMethod ? (
                <View>
                  <View style={styles.userInfo}>
                    <List.Icon
                      icon={getPaymentMethodIcon(paymentMethod)}
                      color={theme.colors.primary}
                    />
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>
                        {getPaymentMethodLabel(paymentMethod)}
                      </Text>
                      <Text style={styles.userContact}>
                        {paymentMethod.notes || "For receiving payments"}
                      </Text>
                    </View>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => openPaymentModal()}
                    />
                  </View>

                  {/* View QR Code Button - only show for QR code payment methods */}
                  {paymentMethod.type === "qr_code" &&
                    paymentMethod.qr_image_url && (
                      <View style={styles.viewQrContainer}>
                        <Button
                          mode="outlined"
                          compact
                          icon="eye"
                          onPress={() => setViewQrModal(true)}
                          style={styles.viewQrButton}
                        >
                          View QR Code
                        </Button>
                      </View>
                    )}
                </View>
              ) : (
                <View style={styles.userInfo}>
                  <List.Icon
                    icon="wallet-outline"
                    color={theme.colors.onSurfaceVariant}
                  />
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>No payment details set</Text>
                    <Text style={styles.userContact}>
                      Add how you want to receive payments
                    </Text>
                  </View>
                  <IconButton
                    icon="plus"
                    size={20}
                    onPress={() => openPaymentModal()}
                  />
                </View>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <Surface style={{ borderRadius: 12 }}>
            <List.Item
              title="Version"
              description="1.0.0"
              left={(props) => <List.Icon {...props} icon="information" />}
            />
            <Divider />
            <List.Item
              title="About Ambagan"
              description="Split bills with friends easily"
              left={(props) => <List.Icon {...props} icon="heart" />}
            />
          </Surface>
        </View>

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
      </ScrollView>

      {/* Edit Name Modal */}
      <Portal>
        <Modal
          visible={editModal === "name"}
          onDismiss={() => setEditModal(null)}
          contentContainerStyle={styles.modal}
        >
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Name</Text>

            <TextInput
              label="Your Name/Nickname"
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              style={styles.input}
              autoCapitalize="words"
              textContentType="name"
            />

            <HelperText type="info">
              This is how you&apos;ll appear to other members in sessions.
            </HelperText>

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => setEditModal(null)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleUpdateName}
                loading={modalLoading}
                disabled={modalLoading || !editName.trim()}
                style={styles.modalButton}
              >
                Save
              </Button>
            </View>
          </Card>
        </Modal>

        {/* Edit Payment Method Modal */}
        <Modal
          visible={editModal === "payment"}
          onDismiss={closePaymentModal}
          contentContainerStyle={styles.modal}
        >
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {paymentMethod
                ? "Edit Payment Details"
                : "Set Up Payment Details"}
            </Text>

            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentType("qr_code")}
            >
              <RadioButton
                value="qr_code"
                status={paymentType === "qr_code" ? "checked" : "unchecked"}
                onPress={() => setPaymentType("qr_code")}
              />
              <Text style={styles.paymentLabel}>
                InstaPay QR Code Screenshot
              </Text>
            </TouchableOpacity>

            {paymentType === "qr_code" && (
              <View>
                <HelperText type="info">
                  Upload a screenshot of your InstaPay QR code from your banking
                  app
                </HelperText>

                {(qrImage || paymentMethod?.qr_image_url) && (
                  <Image
                    source={{
                      uri: qrImage || paymentMethod?.qr_image_url || "",
                    }}
                    style={styles.imagePreview}
                  />
                )}

                <Button
                  mode="outlined"
                  onPress={pickImage}
                  style={styles.uploadButton}
                  icon="camera"
                >
                  {qrImage || paymentMethod?.qr_image_url
                    ? "Change QR Code"
                    : "Upload QR Code"}
                </Button>
              </View>
            )}

            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentType("other")}
            >
              <RadioButton
                value="other"
                status={paymentType === "other" ? "checked" : "unchecked"}
                onPress={() => setPaymentType("other")}
              />
              <Text style={styles.paymentLabel}>
                Others (Cash, Manual Transfer, etc.)
              </Text>
            </TouchableOpacity>

            {paymentType === "other" && (
              <View>
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
                  Describe how others can pay you (account numbers, contact
                  info, etc.)
                </HelperText>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={closePaymentModal}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSavePaymentMethod}
                loading={modalLoading}
                disabled={
                  modalLoading ||
                  (paymentType === "qr_code" &&
                    !qrImage &&
                    !paymentMethod?.qr_image_url) ||
                  (paymentType === "other" && !paymentNotes.trim())
                }
                style={styles.modalButton}
              >
                {paymentMethod ? "Update" : "Save"}
              </Button>
            </View>
          </Card>
        </Modal>

        {/* View QR Code Modal */}
        <ImageViewing
          images={
            paymentMethod?.qr_image_url
              ? [{ uri: paymentMethod.qr_image_url }]
              : []
          }
          imageIndex={0}
          visible={viewQrModal}
          onRequestClose={() => setViewQrModal(false)}
          HeaderComponent={() => (
            <View
              style={{
                position: "absolute",
                top: 50,
                left: 0,
                right: 0,
                zIndex: 1,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  fontWeight: "600",
                }}
              >
                Payment Details
              </Text>
              <IconButton
                icon="close"
                size={28}
                iconColor="white"
                onPress={() => setViewQrModal(false)}
                style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
              />
            </View>
          )}
        />
      </Portal>
    </SafeAreaView>
  );
}
