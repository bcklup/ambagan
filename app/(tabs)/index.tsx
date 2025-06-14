import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Session {
  id: string;
  name: string;
  created_at: string;
  member_count?: number;
  order_count?: number;
  total_amount?: number;
  is_creator: boolean;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get sessions where user is creator or member
      const { data: sessionsData, error } = await supabase
        .from("sessions")
        .select(
          `
          id,
          name,
          created_at,
          creator_id,
          members!inner(id)
        `
        )
        .or(`creator_id.eq.${user.id},members.user_id.eq.${user.id}`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data and add stats
      const transformedSessions: Session[] =
        sessionsData?.map((session) => ({
          id: session.id,
          name: session.name,
          created_at: session.created_at,
          member_count: 0, // Will be populated by real stats
          order_count: 0,
          total_amount: 0,
          is_creator: session.creator_id === user.id,
        })) || [];

      setSessions(transformedSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      Alert.alert("Error", "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      Alert.alert("Error", "Please enter a session name");
      return;
    }

    try {
      setCreating(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("sessions")
        .insert({
          name: sessionName.trim(),
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as a member
      await supabase.from("members").insert({
        session_id: data.id,
        user_id: user.id,
        name: user.user_metadata?.full_name || user.email || "You",
        added_by_user_id: user.id,
      });

      setCreateModalVisible(false);
      setSessionName("");
      fetchSessions();

      // Navigate to the new session
      router.push({ pathname: "/session/[id]", params: { id: data.id } });
    } catch (error) {
      console.error("Error creating session:", error);
      Alert.alert("Error", "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = () => {
    router.push({ pathname: "/qr-scanner" });
  };

  const renderSessionItem = ({ item }: { item: Session }) => {
    const createdDate = new Date(item.created_at).toLocaleDateString();

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({ pathname: "/session/[id]", params: { id: item.id } })
        }
        className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 mb-3 shadow-sm border border-neutral-200 dark:border-neutral-700"
      >
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-lg font-semibold text-text-light dark:text-text-dark flex-1">
            {item.name}
          </Text>
          {item.is_creator && (
            <View className="bg-primary-100 dark:bg-primary-900 px-2 py-1 rounded-full">
              <Text className="text-primary-600 dark:text-primary-400 text-xs font-medium">
                Creator
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-neutral-600 dark:text-neutral-400 text-sm">
            Created {createdDate}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-row items-center">
            <Ionicons
              name="people-outline"
              size={16}
              color="#6f7c83"
              className="mr-1"
            />
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mr-4">
              {item.member_count || 0} members
            </Text>
          </View>

          <View className="flex-row items-center">
            <Ionicons
              name="receipt-outline"
              size={16}
              color="#6f7c83"
              className="mr-1"
            />
            <Text className="text-neutral-600 dark:text-neutral-400 text-sm mr-4">
              {item.order_count || 0} orders
            </Text>
          </View>

          {item.total_amount && item.total_amount > 0 && (
            <Text className="text-primary-600 dark:text-primary-400 font-semibold">
              ₱{item.total_amount.toFixed(2)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#519e8a" />
          <Text className="text-neutral-600 dark:text-neutral-400 mt-2">
            Loading sessions...
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
          Sessions
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400 mt-1">
          Manage your bill splitting sessions
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="px-6 py-4">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            className="flex-1 bg-primary-500 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              Create Session
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleJoinSession}
            className="flex-1 bg-surface-light dark:bg-surface-dark border border-primary-500 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="qr-code-outline" size={20} color="#519e8a" />
            <Text className="text-primary-500 font-semibold ml-2">
              Join Session
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sessions List */}
      <View className="flex-1 px-6">
        {sessions.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Ionicons name="list-outline" size={64} color="#9ea8ad" />
            <Text className="text-xl font-semibold text-neutral-600 dark:text-neutral-400 mt-4">
              No sessions yet
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-500 text-center mt-2">
              Create your first session or join one with a QR code
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            renderItem={renderSessionItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchSessions();
                }}
                colors={["#519e8a"]}
              />
            }
          />
        )}
      </View>

      {/* Create Session Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-semibold text-text-light dark:text-text-dark">
                Create New Session
              </Text>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#6f7c83" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter session name (e.g., Pizza Night)"
              value={sessionName}
              onChangeText={setSessionName}
              className="bg-neutral-100 dark:bg-neutral-800 text-text-light dark:text-text-dark rounded-xl px-4 py-3 mb-6"
              placeholderTextColor="#9ea8ad"
              autoFocus
            />

            <TouchableOpacity
              onPress={handleCreateSession}
              disabled={creating || !sessionName.trim()}
              className={`
                bg-primary-500 rounded-xl py-3 flex-row items-center justify-center
                ${creating || !sessionName.trim() ? "opacity-50" : ""}
              `}
            >
              {creating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="add" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Create Session
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
