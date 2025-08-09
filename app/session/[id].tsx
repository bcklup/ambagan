import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  IconButton,
  List,
  Menu,
  Portal,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import QRCode from "react-native-qrcode-svg";

interface Session {
  id: string;
  name: string;
  creator_id: string;
  qr_code_token: string;
  is_active: boolean;
  created_at: string;
}

interface Member {
  id: string;
  session_id: string;
  user_id: string | null;
  name: string;
  payment_method_type: string;
  payment_qr_image_url: string | null;
  payment_notes: string | null;
  added_by_user_id: string;
  created_at: string;
}

interface Order {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  total_amount: number;
  created_by_user_id: string;
  created_at: string;
}

interface OrderPayer {
  id: string;
  order_id: string;
  member_id: string;
  amount_paid: number;
  member_name: string;
}

interface OrderConsumer {
  id: string;
  order_id: string;
  member_id: string;
  split_ratio: number;
  member_name: string;
}

interface Balance {
  owed_to_member_id: string;
  owed_to_member_name: string;
  amount_owed: number;
  order_details: {
    order_name: string;
    amount: number;
  }[];
}

interface MemberBalance {
  member_id: string;
  member_name: string;
  balances: Balance[];
  total_owed: number;
  total_owed_to_them: number;
}

type ActiveTab = "members" | "orders" | "balances";

export default function SessionScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  // Core data
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPayers, setOrderPayers] = useState<OrderPayer[]>([]);
  const [orderConsumers, setOrderConsumers] = useState<OrderConsumer[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [memberBalances, setMemberBalances] = useState<MemberBalance[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("members");
  const [menuVisible, setMenuVisible] = useState(false);
  const [calculatingBalances, setCalculatingBalances] = useState(false);

  // Dialog states
  const [memberDialogVisible, setMemberDialogVisible] = useState(false);
  const [orderDialogVisible, setOrderDialogVisible] = useState(false);
  const [qrDialogVisible, setQrDialogVisible] = useState(false);

  // Form states
  const [memberName, setMemberName] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [orderName, setOrderName] = useState("");
  const [orderDescription, setOrderDescription] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const calculateBalances = async () => {
    console.log("💰 calculateBalances called at:", new Date().toISOString());
    if (!session || !members.length) return;

    try {
      setCalculatingBalances(true);

      // Step 1: Calculate what each member paid and what they owe
      const memberSummaries = members.map((member) => {
        let totalPaid = 0;
        let totalOwed = 0;

        // Calculate total paid by this member
        const memberPayments = orderPayers.filter(
          (p) => p.member_id === member.id
        );
        totalPaid = memberPayments.reduce(
          (sum, payment) => sum + payment.amount_paid,
          0
        );

        // Calculate total this member should pay (their share of all orders)
        for (const order of orders) {
          const orderConsumersForOrder = orderConsumers.filter(
            (c) => c.order_id === order.id
          );
          const memberConsumer = orderConsumersForOrder.find(
            (c) => c.member_id === member.id
          );

          if (memberConsumer) {
            const totalSplitRatio = orderConsumersForOrder.reduce(
              (sum, c) => sum + c.split_ratio,
              0
            );
            const memberShare =
              (order.total_amount * memberConsumer.split_ratio) /
              totalSplitRatio;
            totalOwed += memberShare;
          }
        }

        return {
          member_id: member.id,
          member_name: member.name,
          total_paid: totalPaid,
          total_owed: totalOwed,
          net_balance: totalPaid - totalOwed, // positive = should receive, negative = should pay
        };
      });

      // Step 2: Calculate who owes whom (settle net balances)
      const balances: MemberBalance[] = memberSummaries.map((member) => {
        const debts: Balance[] = [];

        // Only calculate debts for members who owe money (negative net balance)
        if (member.net_balance < -0.01) {
          // They owe money
          const amountToPay = Math.abs(member.net_balance);

          // Find members who are owed money (positive net balance) and settle debts
          const creditors = memberSummaries
            .filter((m) => m.net_balance > 0.01) // They should receive money
            .sort((a, b) => b.net_balance - a.net_balance); // Highest credit first

          let remainingDebt = amountToPay;

          for (const creditor of creditors) {
            if (remainingDebt <= 0.01) break;

            const paymentAmount = Math.min(remainingDebt, creditor.net_balance);

            if (paymentAmount > 0.01) {
              debts.push({
                owed_to_member_id: creditor.member_id,
                owed_to_member_name: creditor.member_name,
                amount_owed: paymentAmount,
                order_details: [], // Net settlement doesn't need order breakdown
              });

              remainingDebt -= paymentAmount;
              creditor.net_balance -= paymentAmount; // Reduce creditor's remaining credit
            }
          }
        }

        return {
          member_id: member.member_id,
          member_name: member.member_name,
          balances: debts,
          total_owed: debts.reduce((sum, debt) => sum + debt.amount_owed, 0),
          total_owed_to_them: Math.max(0, member.net_balance), // How much they should receive
        };
      });

      setMemberBalances(balances);
    } catch (error) {
      console.error("Error calculating balances:", error);
      Alert.alert("Error", "Failed to calculate balances");
    } finally {
      setCalculatingBalances(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      // Refresh data when screen comes into focus
      // This will trigger when returning from assign-split screen
      if (id && !loading) {
        console.log("🔄 Screen focused, refreshing data...");
        fetchSessionData();
      }
    }, [id, loading])
  );

  useEffect(() => {
    // Only calculate balances when switching to balances tab and we have actual data
    // Add a small delay to prevent rapid recalculations during data loading
    if (
      activeTab === "balances" &&
      members.length > 0 &&
      orders.length > 0 &&
      !loading
    ) {
      console.log("🧮 Calculating balances...");
      const timeoutId = setTimeout(() => {
        calculateBalances();
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [
    activeTab,
    members.length,
    orders.length,
    orderPayers.length,
    orderConsumers.length,
    loading,
  ]);

  const fetchSessionData = async () => {
    console.log("🔄 fetchSessionData called at:", new Date().toISOString());
    console.log(
      "📊 Current state - loading:",
      loading,
      "refreshing:",
      refreshing,
      "id:",
      id
    );
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (!user || !id) return;

      // Fetch session details
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", id)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      console.log("[Log] membersData", { membersData });

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch order payers with member names
      const { data: payersData, error: payersError } = await supabase
        .from("order_payers")
        .select(
          `
          *,
          members!inner(name)
        `
        )
        .in(
          "order_id",
          (ordersData || []).map((o) => o.id)
        );

      if (payersError) throw payersError;
      const transformedPayers = (payersData || []).map((p) => ({
        ...p,
        member_name: p.members.name,
      }));
      setOrderPayers(transformedPayers);

      // Fetch order consumers with member names
      const { data: consumersData, error: consumersError } = await supabase
        .from("order_consumers")
        .select(
          `
          *,
          members!inner(name)
        `
        )
        .in(
          "order_id",
          (ordersData || []).map((o) => o.id)
        );

      if (consumersError) throw consumersError;
      const transformedConsumers = (consumersData || []).map((c) => ({
        ...c,
        member_name: c.members.name,
      }));
      setOrderConsumers(transformedConsumers);
    } catch (error) {
      console.error("Error fetching session data:", error);
      Alert.alert("Error", "Failed to load session data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    console.log("🔄 onRefresh called");
    if (!refreshing) {
      setRefreshing(true);
      fetchSessionData();
    }
  }, [refreshing]);

  const handleAddMember = async () => {
    if (!memberName.trim()) return;

    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !session) return;

      if (editingMemberId) {
        // Update existing member
        const { error } = await supabase
          .from("members")
          .update({ name: memberName.trim() })
          .eq("id", editingMemberId);

        if (error) throw error;
      } else {
        // Add new member
        const { error } = await supabase.from("members").insert({
          session_id: session.id,
          name: memberName.trim(),
          user_id: null, // Manual entry
          payment_method_type: "other",
          payment_notes: "Cash or other payment method",
          added_by_user_id: user.id,
        });

        if (error) throw error;
      }

      setMemberDialogVisible(false);
      setMemberName("");
      setEditingMemberId(null);
      fetchSessionData(); // Refresh data
    } catch (error) {
      console.error("Error saving member:", error);
      Alert.alert("Error", "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const handleEditMemberStart = (member: Member) => {
    setMemberName(member.name);
    setEditingMemberId(member.id);
    setMemberDialogVisible(true);
  };

  const handleAssignSplit = (orderId: string) => {
    if (!session?.id) return;

    router.push({
      pathname: "/session/[id]/assign-split",
      params: { id: session.id, orderId },
    });
  };

  const handleDeleteMember = async (memberId: string) => {
    Alert.alert(
      "Delete Member",
      "Are you sure you want to remove this member?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("members")
                .delete()
                .eq("id", memberId);

              if (error) throw error;
              fetchSessionData();
            } catch (error) {
              console.error("Error deleting member:", error);
              Alert.alert("Error", "Failed to delete member");
            }
          },
        },
      ]
    );
  };

  const handleDeleteOrder = async (orderId: string) => {
    Alert.alert("Delete Order", "Are you sure you want to delete this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .delete()
              .eq("id", orderId);

            if (error) throw error;
            fetchSessionData();
          } catch (error) {
            console.error("Error deleting order:", error);
            Alert.alert("Error", "Failed to delete order");
          }
        },
      },
    ]);
  };

  const handleAddOrder = async () => {
    if (!orderName.trim() || !orderAmount.trim()) return;

    const amount = parseFloat(orderAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !session) return;

      if (editingOrderId) {
        // Update existing order
        const { error } = await supabase
          .from("orders")
          .update({
            name: orderName.trim(),
            description: orderDescription.trim() || null,
            total_amount: amount,
          })
          .eq("id", editingOrderId);

        if (error) throw error;
      } else {
        // Add new order
        const { error } = await supabase.from("orders").insert({
          session_id: session.id,
          name: orderName.trim(),
          description: orderDescription.trim() || null,
          total_amount: amount,
          created_by_user_id: user.id,
        });

        if (error) throw error;
      }

      setOrderDialogVisible(false);
      setOrderName("");
      setOrderDescription("");
      setOrderAmount("");
      setEditingOrderId(null);
      fetchSessionData(); // Refresh data
    } catch (error) {
      console.error("Error saving order:", error);
      Alert.alert("Error", "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const handleEditOrderStart = (order: Order) => {
    setOrderName(order.name);
    setOrderDescription(order.description || "");
    setOrderAmount(order.total_amount.toString());
    setEditingOrderId(order.id);
    setOrderDialogVisible(true);
  };

  const isCreator =
    currentUser && session && session.creator_id === currentUser.id;

  const handleDeleteSession = async () => {
    if (!session || !isCreator) return;

    Alert.alert(
      "Delete Session",
      `Are you sure you want to delete "${session.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Delete the session (this will cascade delete all related data)
              const { error } = await supabase
                .from("sessions")
                .delete()
                .eq("id", session.id);

              if (error) {
                console.error("Error deleting session:", error);
                Alert.alert(
                  "Error",
                  "Failed to delete session. Please try again."
                );
                setLoading(false);
                return;
              }

              Alert.alert("Success", "Session deleted successfully", [
                {
                  text: "OK",
                  onPress: () => router.replace("/(tabs)"),
                },
              ]);
            } catch (error) {
              console.error("Unexpected error:", error);
              Alert.alert(
                "Error",
                "Failed to delete session. Please try again."
              );
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderMemberItem = ({ item }: { item: Member }) => (
    <Card style={styles.listItem}>
      <List.Item
        title={item.name}
        description={item.user_id ? "App User" : "Manual Entry"}
        left={() => (
          <Avatar.Text
            size={40}
            label={item.name.charAt(0).toUpperCase()}
            style={{ backgroundColor: theme.colors.primaryContainer }}
          />
        )}
        right={() => {
          const canModify = isCreator && item.user_id !== currentUser?.id;
          const isManualEntry = !item.user_id;

          if (!canModify) return null;

          return (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isManualEntry && (
                <IconButton
                  icon="pencil"
                  onPress={() => handleEditMemberStart(item)}
                />
              )}
              <IconButton
                icon="delete"
                onPress={() => handleDeleteMember(item.id)}
              />
            </View>
          );
        }}
        style={{
          paddingRight: 0,
          paddingLeft: 16,
        }}
      />
    </Card>
  );

  const renderOrderItem = ({ item }: { item: Order }) => {
    const payers = orderPayers.filter((p) => p.order_id === item.id);
    const consumers = orderConsumers.filter((c) => c.order_id === item.id);
    const hasSplit = payers.length > 0 && consumers.length > 0;
    const isPartialSplit = payers.length > 0 || consumers.length > 0;

    return (
      <Card style={styles.listItem}>
        <Card.Content>
          <View style={styles.orderHeader}>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Text variant="titleMedium">{item.name}</Text>
                {hasSplit && (
                  <Chip
                    mode="flat"
                    compact
                    style={{
                      marginLeft: 8,
                      backgroundColor: theme.colors.primaryContainer,
                    }}
                    textStyle={{ fontSize: 12 }}
                  >
                    Split Assigned
                  </Chip>
                )}
                {isPartialSplit && !hasSplit && (
                  <Chip
                    mode="flat"
                    compact
                    style={{
                      marginLeft: 8,
                      backgroundColor: theme.colors.errorContainer,
                    }}
                  >
                    Incomplete
                  </Chip>
                )}
              </View>
              {item.description && (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {item.description}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                variant="titleLarge"
                style={{
                  color: theme.colors.primary,
                  fontWeight: "bold",
                  fontSize: 18,
                }}
              >
                ₱{item.total_amount.toFixed(2)}
              </Text>
              {isCreator && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => handleEditOrderStart(item)}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => handleDeleteOrder(item.id)}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.orderSection}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.primary }}
              >
                Paid by ({payers.length})
              </Text>
              {payers.length > 0 ? (
                payers.map((payer) => (
                  <Text key={payer.id} variant="bodySmall">
                    {payer.member_name}: ₱{payer.amount_paid.toFixed(2)}
                  </Text>
                ))
              ) : (
                <Text
                  variant="bodySmall"
                  style={{
                    fontStyle: "italic",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  No payers assigned
                </Text>
              )}
            </View>

            <View style={styles.orderSection}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.secondary }}
              >
                Split among ({consumers.length})
              </Text>
              {consumers.length > 0 ? (
                consumers.splice(0, 3).map((consumer) => (
                  <Text key={consumer.id} variant="bodySmall">
                    {consumer.member_name} ({consumer.split_ratio}x)
                  </Text>
                ))
              ) : (
                <Text
                  variant="bodySmall"
                  style={{
                    fontStyle: "italic",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  No consumers assigned
                </Text>
              )}
              {consumers.length >= 3 && <Text variant="bodySmall">...</Text>}
            </View>
          </View>

          <Button
            mode="outlined"
            compact
            style={{ marginTop: 8 }}
            onPress={() => handleAssignSplit(item.id)}
          >
            {hasSplit
              ? "Edit Split"
              : isPartialSplit
              ? "Complete Split"
              : "Assign Split"}
          </Button>
        </Card.Content>
      </Card>
    );
  };

  const getFABIcon = () => {
    switch (activeTab) {
      case "members":
        return "account-plus";
      case "orders":
        return "plus";
      default:
        return "plus";
    }
  };

  const getFABAction = () => {
    switch (activeTab) {
      case "members":
        return () => setMemberDialogVisible(true);
      case "orders":
        return () => setOrderDialogVisible(true);
      default:
        return undefined;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "members":
        return (
          <FlatList
            data={members}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text
                  variant="bodyLarge"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  No members yet. Add members to start splitting bills!
                </Text>
              </View>
            }
          />
        );

      case "orders":
        return (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text
                  variant="bodyLarge"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  No orders yet. Add orders to track what needs to be split!
                </Text>
              </View>
            }
          />
        );

      case "balances":
        return (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            {calculatingBalances ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  variant="bodyLarge"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 16,
                  }}
                >
                  Calculating balances...
                </Text>
              </View>
            ) : memberBalances.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text
                  variant="bodyLarge"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  No balances to calculate yet. Add orders and assign splits to
                  see who owes what!
                </Text>
              </View>
            ) : (
              <View>
                {memberBalances.map((memberBalance) => {
                  const netBalance =
                    memberBalance.total_owed_to_them - memberBalance.total_owed;

                  return (
                    <Card
                      key={memberBalance.member_id}
                      style={styles.listItem}
                      onPress={() => {
                        if (!session) return;
                        // TODO: Temporary disable balance detail screen
                        // router.push(
                        //   `/session/${session.id}/balance-detail?memberId=${memberBalance.member_id}`
                        // );
                      }}
                    >
                      <Card.Content>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <Text variant="titleMedium">
                            {memberBalance.member_name}
                          </Text>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.onSurfaceVariant }}
                            >
                              {netBalance > 0
                                ? "Receives"
                                : netBalance < 0
                                ? "Owes"
                                : "Even"}
                            </Text>
                            <Text
                              variant="titleLarge"
                              style={{
                                fontWeight: "bold",
                                color:
                                  netBalance > 0
                                    ? theme.colors.primary
                                    : netBalance < 0
                                    ? theme.colors.error
                                    : theme.colors.onSurface,
                              }}
                            >
                              {netBalance > 0 ? "+" : ""}₱
                              {Math.abs(netBalance).toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        {/* Show specific payments this member needs to make */}
                        {memberBalance.balances.length > 0 && (
                          <View>
                            <Text
                              variant="titleSmall"
                              style={{
                                color: theme.colors.error,
                                marginBottom: 12,
                                fontWeight: "bold",
                              }}
                            >
                              💸 Needs to pay:
                            </Text>
                            {memberBalance.balances.map((balance, index) => (
                              <Surface
                                key={index}
                                style={{
                                  marginBottom: 8,
                                  borderRadius: 8,
                                  backgroundColor: theme.colors.errorContainer,
                                  borderLeftWidth: 4,
                                  borderLeftColor: theme.colors.error,
                                }}
                                elevation={1}
                              >
                                <View
                                  style={{
                                    padding: 12,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      variant="bodyMedium"
                                      style={{
                                        fontWeight: "600",
                                        color: theme.colors.onErrorContainer,
                                        marginBottom: 2,
                                      }}
                                    >
                                      Pay {balance.owed_to_member_name}
                                    </Text>
                                    {balance.order_details.length > 0 && (
                                      <Text
                                        variant="bodySmall"
                                        style={{
                                          color: theme.colors.onErrorContainer,
                                          opacity: 0.8,
                                        }}
                                      >
                                        From:{" "}
                                        {balance.order_details
                                          .map((d) => d.order_name)
                                          .join(", ")}
                                      </Text>
                                    )}
                                  </View>
                                  <Text
                                    variant="titleMedium"
                                    style={{
                                      fontWeight: "bold",
                                      color: theme.colors.error,
                                    }}
                                  >
                                    ₱{balance.amount_owed.toFixed(2)}
                                  </Text>
                                </View>
                              </Surface>
                            ))}
                          </View>
                        )}

                        {/* Show if this member should receive money */}
                        {memberBalance.total_owed_to_them > 0 &&
                          memberBalance.balances.length === 0 && (
                            <View>
                              <Text
                                variant="titleSmall"
                                style={{
                                  color: theme.colors.primary,
                                  marginBottom: 12,
                                  fontWeight: "bold",
                                }}
                              >
                                💰 Will receive:
                              </Text>
                              <Surface
                                style={{
                                  borderRadius: 8,
                                  backgroundColor:
                                    theme.colors.primaryContainer,
                                  borderLeftWidth: 4,
                                  borderLeftColor: theme.colors.primary,
                                }}
                                elevation={1}
                              >
                                <View
                                  style={{
                                    padding: 12,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text
                                    variant="bodyMedium"
                                    style={{
                                      fontWeight: "600",
                                      color: theme.colors.onPrimaryContainer,
                                    }}
                                  >
                                    From other members
                                  </Text>
                                  <Text
                                    variant="titleMedium"
                                    style={{
                                      fontWeight: "bold",
                                      color: theme.colors.primary,
                                    }}
                                  >
                                    +₱
                                    {memberBalance.total_owed_to_them.toFixed(
                                      2
                                    )}
                                  </Text>
                                </View>
                              </Surface>
                            </View>
                          )}

                        {/* Show if member is even */}
                        {Math.abs(netBalance) <= 0.01 && (
                          <View style={{ marginTop: 16 }}>
                            <Surface
                              style={{
                                borderRadius: 8,
                                backgroundColor: theme.colors.surfaceVariant,
                                borderLeftWidth: 4,
                                borderLeftColor: theme.colors.outline,
                              }}
                              elevation={1}
                            >
                              <View
                                style={{
                                  padding: 16,
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  variant="titleSmall"
                                  style={{
                                    color: theme.colors.onSurfaceVariant,
                                    fontWeight: "600",
                                    textAlign: "center",
                                  }}
                                >
                                  ✅ All settled up!
                                </Text>
                                <Text
                                  variant="bodySmall"
                                  style={{
                                    color: theme.colors.onSurfaceVariant,
                                    textAlign: "center",
                                    marginTop: 4,
                                    opacity: 0.8,
                                  }}
                                >
                                  No payments needed
                                </Text>
                              </View>
                            </Surface>
                          </View>
                        )}
                      </Card.Content>
                    </Card>
                  );
                })}

                {/* Summary Card */}
                <Card
                  style={[
                    styles.listItem,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="titleMedium" style={{ marginBottom: 12 }}>
                      Session Summary
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text>Total Orders:</Text>
                      <Text style={{ fontWeight: "bold" }}>
                        {orders.length}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text>Total Amount:</Text>
                      <Text style={{ fontWeight: "bold" }}>
                        ₱
                        {orders
                          .reduce((sum, order) => sum + order.total_amount, 0)
                          .toFixed(2)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text>Active Members:</Text>
                      <Text style={{ fontWeight: "bold" }}>
                        {members.length}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              </View>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabContainer: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 20,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    listItem: {
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    orderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    orderDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    orderSection: {
      flex: 1,
      marginRight: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 64,
      paddingHorizontal: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Loading..." />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Session Not Found" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Session not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header mode="small" style={{ elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={session.name} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setQrDialogVisible(true);
            }}
            title="Show QR Code"
            leadingIcon="qrcode"
          />
          {isCreator && (
            <>
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  // TODO: Edit session
                }}
                title="Edit Session"
                leadingIcon="pencil"
              />
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  handleDeleteSession();
                }}
                title="Delete Session"
                leadingIcon="delete"
                titleStyle={{ color: theme.colors.error }}
              />
            </>
          )}
        </Menu>
      </Appbar.Header>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ActiveTab)}
          buttons={[
            { value: "members", label: `Members (${members.length})` },
            { value: "orders", label: `Orders (${orders.length})` },
            { value: "balances", label: "Balances" },
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* FAB */}
      {getFABAction() && (
        <FAB
          icon={getFABIcon()}
          style={{
            position: "absolute",
            margin: 16,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.primary,
          }}
          onPress={getFABAction()}
        />
      )}

      {/* Add Member Dialog */}
      <Portal>
        <Dialog
          visible={memberDialogVisible}
          onDismiss={() => {
            setMemberDialogVisible(false);
            setMemberName("");
            setEditingMemberId(null);
          }}
        >
          <Dialog.Title>
            {editingMemberId ? "Edit Member" : "Add Member"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Member Name"
              placeholder="Enter name"
              value={memberName}
              onChangeText={setMemberName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setMemberDialogVisible(false);
                setMemberName("");
                setEditingMemberId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              style={{ paddingHorizontal: 5 }}
              onPress={handleAddMember}
              loading={saving}
              disabled={saving || !memberName.trim()}
            >
              {editingMemberId ? "Update" : "Add"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Order Dialog */}
      <Portal>
        <Dialog
          visible={orderDialogVisible}
          onDismiss={() => {
            setOrderDialogVisible(false);
            setOrderName("");
            setOrderDescription("");
            setOrderAmount("");
            setEditingOrderId(null);
          }}
        >
          <Dialog.Title>
            {editingOrderId ? "Edit Order" : "Add Order"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Order Name"
              placeholder="e.g., Pizza, Drinks"
              value={orderName}
              onChangeText={setOrderName}
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Description (Optional)"
              placeholder="Additional details"
              value={orderDescription}
              onChangeText={setOrderDescription}
              mode="outlined"
              multiline
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Total Amount"
              placeholder="0.00"
              value={orderAmount}
              onChangeText={setOrderAmount}
              mode="outlined"
              keyboardType="numeric"
              left={<TextInput.Affix text="₱" />}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setOrderDialogVisible(false);
                setOrderName("");
                setOrderDescription("");
                setOrderAmount("");
                setEditingOrderId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              style={{ paddingHorizontal: 5 }}
              onPress={handleAddOrder}
              loading={saving}
              disabled={saving || !orderName.trim() || !orderAmount.trim()}
            >
              {editingOrderId ? "Update" : "Add"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* QR Code Dialog */}
      <Portal>
        <Dialog
          visible={qrDialogVisible}
          onDismiss={() => setQrDialogVisible(false)}
        >
          <Dialog.Title>Session QR Code</Dialog.Title>
          <Dialog.Content>
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              {session?.qr_code_token ? (
                <View style={{ alignItems: "center" }}>
                  <Surface
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <QRCode
                      value={session.qr_code_token}
                      size={200}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </Surface>
                  <Text
                    variant="bodyMedium"
                    style={{ textAlign: "center", marginTop: 16 }}
                  >
                    Share this QR code with others to invite them to the session
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{
                      textAlign: "center",
                      marginTop: 8,
                      fontFamily: "monospace",
                      color: theme.colors.onSurfaceVariant,
                    }}
                  >
                    Token: {session.qr_code_token}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: "center" }}>
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ textAlign: "center", marginTop: 16 }}
                  >
                    Loading QR code...
                  </Text>
                </View>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQrDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
