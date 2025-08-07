import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
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
  const theme = useTheme<AppTheme>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
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

      console.log("Dashboard: Fetching sessions for user:", user?.id);

      if (!user) {
        console.log("Dashboard: No user found");
        return;
      }

      // Get sessions where user is creator
      const { data: creatorSessions, error: creatorError } = await supabase
        .from("sessions")
        .select(
          `
          id,
          name,
          created_at,
          creator_id
        `
        )
        .eq("creator_id", user.id)
        .eq("is_active", true);

      if (creatorError) throw creatorError;

      // Get session IDs where user is a member
      const { data: memberSessionIds, error: memberIdsError } = await supabase
        .from("members")
        .select("session_id")
        .eq("user_id", user.id);

      if (memberIdsError) throw memberIdsError;

      // Get sessions where user is a member (if any)
      let memberSessions: any[] = [];
      if (memberSessionIds && memberSessionIds.length > 0) {
        const sessionIds = memberSessionIds.map((item) => item.session_id);
        const { data: memberSessionsData, error: memberError } = await supabase
          .from("sessions")
          .select(
            `
            id,
            name,
            created_at,
            creator_id
          `
          )
          .in("id", sessionIds)
          .eq("is_active", true);

        if (memberError) throw memberError;
        memberSessions = memberSessionsData || [];
      }

      // Combine and deduplicate sessions
      const allSessions = [...(creatorSessions || []), ...memberSessions];
      const uniqueSessions = allSessions.filter(
        (session, index, self) =>
          index === self.findIndex((s) => s.id === session.id)
      );

      console.log("Dashboard: Fetched sessions:", uniqueSessions.length);

      // Transform data and add stats
      const transformedSessions: Session[] = [];

      for (const session of uniqueSessions) {
        // Get member count for this session
        const { data: memberData, error: memberError } = await supabase
          .from("members")
          .select("id")
          .eq("session_id", session.id);

        if (memberError) {
          console.error("Error fetching member count:", memberError);
        }

        // Get order count and total amount for this session
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, total_amount")
          .eq("session_id", session.id);

        if (orderError) {
          console.error("Error fetching order data:", orderError);
        }

        const member_count = memberData?.length || 0;
        const order_count = orderData?.length || 0;
        const total_amount =
          orderData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

        transformedSessions.push({
          id: session.id,
          name: session.name,
          created_at: session.created_at,
          member_count,
          order_count,
          total_amount,
          is_creator: session.creator_id === user.id,
        });
      }

      // Sort by creation date
      transformedSessions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setSessions(transformedSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      return;
    }

    try {
      setCreating(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      console.log("Creating session:", sessionName);

      const { data, error } = await supabase
        .from("sessions")
        .insert({
          name: sessionName.trim(),
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as a member with proper name
      const userName = user.user_metadata?.name;
      const userPhone = user.phone;

      let memberName = "You";
      if (userName) {
        memberName = userName;
      } else if (userPhone) {
        memberName = userPhone;
      }

      await supabase.from("members").insert({
        session_id: data.id,
        user_id: user.id,
        name: memberName,
        added_by_user_id: user.id,
      });

      setCreateDialogVisible(false);
      setSessionName("");
      fetchSessions();

      // Navigate to the new session
      router.push({ pathname: "/session/[id]", params: { id: data.id } });
    } catch (error) {
      console.error("Error creating session:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = () => {
    router.push({ pathname: "/qr-scanner" });
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
    actionContainer: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      flexDirection: "row",
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 6,
      paddingHorizontal: 5,
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 24,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      marginTop: 16,
      textAlign: "center",
    },
    emptyDescription: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 24,
    },
    sessionCard: {
      marginBottom: 12,
      backgroundColor: theme.colors.surface,
    },
    cardContent: {
      paddingVertical: 16,
    },
    sessionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    sessionName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
      flex: 1,
      marginRight: 12,
    },
    sessionDate: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 12,
    },
    sessionStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    statText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginLeft: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
    },
  });

  const renderSessionItem = ({ item }: { item: Session }) => {
    const createdDate = new Date(item.created_at).toLocaleDateString();

    return (
      <Card
        style={styles.sessionCard}
        onPress={() =>
          router.push({ pathname: "/session/[id]", params: { id: item.id } })
        }
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionName}>{item.name}</Text>
            {item.is_creator && (
              <Chip mode="outlined" compact>
                Creator
              </Chip>
            )}
          </View>

          <Text style={styles.sessionDate}>Created {createdDate}</Text>

          <View style={styles.sessionStats}>
            <View style={styles.statItem}>
              <Text style={styles.statText}>
                {item.member_count || 0} members
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statText}>
                {item.order_count || 0} orders
              </Text>
            </View>

            {item.total_amount && item.total_amount > 0 ? (
              <Text
                style={[
                  styles.statText,
                  { color: theme.colors.primary, fontWeight: "bold" },
                ]}
              >
                ₱{item.total_amount.toFixed(2)}
              </Text>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <Text style={styles.subtitle}>Manage your bill splitting sessions</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          mode="contained"
          style={styles.actionButton}
          onPress={() => setCreateDialogVisible(true)}
          icon="plus"
        >
          Create
        </Button>
        <Button
          mode="outlined"
          style={styles.actionButton}
          onPress={handleJoinSession}
          icon="qrcode"
        >
          Join
        </Button>
      </View>

      {/* Sessions List */}
      <View style={styles.listContainer}>
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Surface style={{ borderRadius: 32, padding: 16 }}>
              <Text style={{ fontSize: 48, textAlign: "center" }}>📋</Text>
            </Surface>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyDescription}>
              Create your first session or join one with a QR code to get
              started with bill splitting.
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
                colors={[theme.colors.primary]}
              />
            }
          />
        )}
      </View>

      {/* Create Session Dialog */}
      <Portal>
        <Dialog
          visible={createDialogVisible}
          onDismiss={() => setCreateDialogVisible(false)}
        >
          <Dialog.Title>Create New Session</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Session Name"
              placeholder="e.g., Pizza Night, Team Lunch"
              value={sessionName}
              onChangeText={setSessionName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateSession}
              loading={creating}
              disabled={creating || !sessionName.trim()}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}
