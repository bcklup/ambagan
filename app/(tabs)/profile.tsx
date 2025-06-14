import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { User } from "@supabase/supabase-js";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setDisplayName(user.user_metadata?.full_name || user.email || "");
      }
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
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    try {
      // In a real app, you'd save this to the user_payment_methods table
      setEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
        <View className="flex-1 justify-center items-center">
          <Text className="text-neutral-600 dark:text-neutral-400">
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <View className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <Text className="text-2xl font-bold text-text-light dark:text-text-dark">
          Profile
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400 mt-1">
          Manage your account and payment methods
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* User Info Section */}
        <View className="px-6 py-6">
          <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 bg-primary-500 rounded-full justify-center items-center mr-4">
                {user?.user_metadata?.avatar_url ? (
                  <Image
                    source={{ uri: user.user_metadata.avatar_url }}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <Text className="text-white text-xl font-bold">
                    {(user?.user_metadata?.full_name ||
                      user?.email ||
                      "U")[0].toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-text-light dark:text-text-dark">
                  {user?.user_metadata?.full_name || "User"}
                </Text>
                <Text className="text-neutral-600 dark:text-neutral-400">
                  {user?.email}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              className="bg-primary-500 rounded-xl py-3 flex-row items-center justify-center"
            >
              <Ionicons name="create-outline" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment Methods Section */}
          <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 mb-6">
            <Text className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Payment Methods
            </Text>

            <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="qr-code-outline" size={20} color="#519e8a" />
                <Text className="text-text-light dark:text-text-dark font-medium ml-2">
                  QR Code Payment
                </Text>
              </View>
              <Text className="text-neutral-600 dark:text-neutral-400 text-sm">
                {paymentNotes || "No payment method added yet"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              className="border border-primary-500 rounded-xl py-3 flex-row items-center justify-center"
            >
              <Ionicons name="add-outline" size={20} color="#519e8a" />
              <Text className="text-primary-500 font-semibold ml-2">
                Add Payment Method
              </Text>
            </TouchableOpacity>
          </View>

          {/* App Info Section */}
          <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 mb-6">
            <Text className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              App Information
            </Text>

            <View className="space-y-3">
              <View className="flex-row justify-between items-center py-2">
                <Text className="text-text-light dark:text-text-dark">
                  Version
                </Text>
                <Text className="text-neutral-600 dark:text-neutral-400">
                  1.0.0
                </Text>
              </View>

              <View className="flex-row justify-between items-center py-2">
                <Text className="text-text-light dark:text-text-dark">
                  Privacy Policy
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ea8ad" />
              </View>

              <View className="flex-row justify-between items-center py-2">
                <Text className="text-text-light dark:text-text-dark">
                  Terms of Service
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ea8ad" />
              </View>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-error-500 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="log-out-outline" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-semibold text-text-light dark:text-text-dark">
                Edit Profile
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#6f7c83" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-text-light dark:text-text-dark font-medium mb-2">
                Display Name
              </Text>
              <TextInput
                placeholder="Enter your display name"
                value={displayName}
                onChangeText={setDisplayName}
                className="bg-neutral-100 dark:bg-neutral-800 text-text-light dark:text-text-dark rounded-xl px-4 py-3"
                placeholderTextColor="#9ea8ad"
              />
            </View>

            <View className="mb-6">
              <Text className="text-text-light dark:text-text-dark font-medium mb-2">
                Payment Notes
              </Text>
              <TextInput
                placeholder="e.g., GCash: 09171234567, or Bank: BPI 123456789"
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                className="bg-neutral-100 dark:bg-neutral-800 text-text-light dark:text-text-dark rounded-xl px-4 py-3"
                placeholderTextColor="#9ea8ad"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              className="bg-primary-500 rounded-xl py-3 flex-row items-center justify-center"
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
