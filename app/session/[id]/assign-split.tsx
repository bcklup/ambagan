import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Checkbox,
  Chip,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface Order {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  total_amount: number;
  created_by_user_id: string;
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

interface PayerAssignment {
  member_id: string;
  amount_paid: string;
}

interface ConsumerAssignment {
  member_id: string;
  split_amount: string;
  checked: boolean;
}

export default function AssignSplitScreen() {
  const { id: sessionId, orderId } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Assignment states
  const [payers, setPayers] = useState<PayerAssignment[]>([]);
  const [consumers, setConsumers] = useState<ConsumerAssignment[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");

  useEffect(() => {
    fetchData();
  }, [sessionId, orderId]);

  const fetchData = async () => {
    try {
      if (!sessionId || !orderId) return;

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Fetch session members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("session_id", sessionId)
        .order("name", { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Check for existing assignments
      const { data: payersData, error: payersError } = await supabase
        .from("order_payers")
        .select("*")
        .eq("order_id", orderId);

      const { data: consumersData, error: consumersError } = await supabase
        .from("order_consumers")
        .select("*")
        .eq("order_id", orderId);

      if (payersError) console.error("Error fetching payers:", payersError);
      if (consumersError)
        console.error("Error fetching consumers:", consumersError);

      // Initialize payers state
      if (payersData && payersData.length > 0) {
        setIsEditing(true);
        setPayers(
          payersData.map((p) => ({
            member_id: p.member_id,
            amount_paid: p.amount_paid.toString(),
          }))
        );
      } else {
        // Default: first member pays the full amount
        if (membersData && membersData.length > 0) {
          setPayers([
            {
              member_id: membersData[0].id,
              amount_paid: orderData.total_amount.toString(),
            },
          ]);
        }
      }

      // Initialize consumers state
      if (consumersData && consumersData.length > 0) {
        setIsEditing(true);

        // Check if this is a custom split (not all ratios are 1.0)
        const hasCustomRatios = consumersData.some(
          (c) => c.split_ratio !== 1.0
        );
        setSplitMode(hasCustomRatios ? "custom" : "equal");

        setConsumers(
          (membersData || []).map((member) => {
            const existing = consumersData.find(
              (c) => c.member_id === member.id
            );

            if (existing) {
              // Convert existing ratio to amount
              const totalRatio = consumersData.reduce(
                (sum, c) => sum + c.split_ratio,
                0
              );
              const memberAmount =
                (existing.split_ratio / totalRatio) * orderData.total_amount;
              return {
                member_id: member.id,
                split_amount: memberAmount.toFixed(2),
                checked: true,
              };
            } else {
              return {
                member_id: member.id,
                split_amount: "",
                checked: false,
              };
            }
          })
        );
      } else {
        // Default: all members split equally
        const memberCount = (membersData || []).length;
        const amountPerPerson =
          memberCount > 0
            ? (orderData.total_amount / memberCount).toFixed(2)
            : "0.00";

        setConsumers(
          (membersData || []).map((member) => ({
            member_id: member.id,
            split_amount: amountPerPerson,
            checked: true,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load assignment data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!order || !members.length) return;

    // Validate payers
    const totalPaid = payers.reduce((sum, payer) => {
      const amount = parseFloat(payer.amount_paid);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    if (Math.abs(totalPaid - order.total_amount) > 0.01) {
      Alert.alert(
        "Error",
        `Total paid (₱${totalPaid.toFixed(
          2
        )}) must equal order total (₱${order.total_amount.toFixed(2)})`
      );
      return;
    }

    // Validate consumers
    const selectedConsumers = consumers.filter((c) => c.checked);
    if (selectedConsumers.length === 0) {
      Alert.alert(
        "Error",
        "Please select at least one person to split the cost"
      );
      return;
    }

    // Validate that checked members have split amounts
    const membersWithoutAmounts = selectedConsumers.filter((c) => {
      const amount = parseFloat(c.split_amount);
      return isNaN(amount) || amount <= 0;
    });

    if (membersWithoutAmounts.length > 0) {
      const memberNames = membersWithoutAmounts
        .map((c) => getMemberName(c.member_id))
        .join(", ");

      Alert.alert(
        "Error",
        `Please enter split amounts for all selected members: ${memberNames}`
      );
      return;
    }

    // Validate total split amounts
    const totalSplitAmount = getTotalAmount();
    if (Math.abs(totalSplitAmount - order.total_amount) > 0.01) {
      Alert.alert(
        "Error",
        `Total split amount (₱${totalSplitAmount.toFixed(
          2
        )}) must equal order total (₱${order.total_amount.toFixed(2)})`
      );
      return;
    }

    try {
      setSaving(true);

      // Delete existing assignments
      await supabase.from("order_payers").delete().eq("order_id", order.id);
      await supabase.from("order_consumers").delete().eq("order_id", order.id);

      // Insert payers
      const payerInserts = payers
        .filter((p) => {
          const amount = parseFloat(p.amount_paid);
          return !isNaN(amount) && amount > 0;
        })
        .map((payer) => ({
          order_id: order.id,
          member_id: payer.member_id,
          amount_paid: parseFloat(payer.amount_paid),
        }));

      if (payerInserts.length > 0) {
        const { error: payersError } = await supabase
          .from("order_payers")
          .insert(payerInserts);

        if (payersError) throw payersError;
      }

      // Insert consumers
      const consumerInserts = selectedConsumers.map((consumer) => {
        const amount = parseFloat(consumer.split_amount);
        const validAmount = isNaN(amount) ? 0 : amount;
        // Convert amount to ratio: if total order is 100 and person owes 25, ratio is 0.25
        const ratio =
          order.total_amount > 0 ? validAmount / order.total_amount : 0;

        return {
          order_id: order.id,
          member_id: consumer.member_id,
          split_ratio: ratio,
        };
      });

      const { error: consumersError } = await supabase
        .from("order_consumers")
        .insert(consumerInserts);

      if (consumersError) throw consumersError;

      Alert.alert("Success", "Split assignment saved successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error saving assignment:", error);
      Alert.alert("Error", "Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  const updatePayerAmount = (memberId: string, amount: string) => {
    setPayers((prev) => {
      const existing = prev.find((p) => p.member_id === memberId);
      if (existing) {
        return prev.map((p) =>
          p.member_id === memberId ? { ...p, amount_paid: amount } : p
        );
      } else if (amount && amount !== "0") {
        // Only add new payer if amount is not empty or zero
        return [...prev, { member_id: memberId, amount_paid: amount }];
      }
      return prev;
    });
  };

  const updateConsumerChecked = (memberId: string, checked: boolean) => {
    setConsumers((prev) =>
      prev.map((c) => (c.member_id === memberId ? { ...c, checked } : c))
    );
  };

  const updateConsumerAmount = (memberId: string, amount: string) => {
    setConsumers((prev) =>
      prev.map((c) =>
        c.member_id === memberId ? { ...c, split_amount: amount } : c
      )
    );
  };

  const distributeEqualSplit = () => {
    const selectedCount = consumers.filter((c) => c.checked).length;
    if (selectedCount === 0 || !order) return;

    const amountPerPerson = (order.total_amount / selectedCount).toFixed(2);

    setConsumers((prev) =>
      prev.map((c) => ({
        ...c,
        split_amount: c.checked ? amountPerPerson : c.split_amount,
      }))
    );
  };

  const getMemberName = (memberId: string) => {
    return members.find((m) => m.id === memberId)?.name || "Unknown";
  };

  const getTotalPaid = () => {
    return payers.reduce((sum, payer) => {
      const amount = parseFloat(payer.amount_paid);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  const getTotalAmount = () => {
    return consumers
      .filter((c) => c.checked)
      .reduce((sum, consumer) => {
        const amount = parseFloat(consumer.split_amount);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
  };

  const hasSelectedMembersWithoutAmounts = () => {
    const selectedConsumers = consumers.filter((c) => c.checked);
    return selectedConsumers.some((c) => {
      const amount = parseFloat(c.split_amount);
      return isNaN(amount) || amount <= 0;
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onBackground,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    orderCard: {
      margin: 16,
      backgroundColor: theme.colors.surface,
    },
    memberCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    amountInput: {
      width: 120,
    },
    ratioInput: {
      width: 160,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    summaryCard: {
      margin: 16,
      backgroundColor: theme.colors.primaryContainer,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    saveButton: {
      margin: 16,
    },
    splitModeChips: {
      flexDirection: "row",
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    chip: {
      marginRight: 8,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Assign Split" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Order Not Found" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Order not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={isEditing ? "Edit Split" : "Assign Split"} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Order Details */}
        <Card style={styles.orderCard}>
          <Card.Content>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <Text variant="titleLarge">{order.name}</Text>
              {isEditing && (
                <Chip
                  mode="flat"
                  compact
                  style={{ backgroundColor: theme.colors.secondaryContainer }}
                >
                  Editing
                </Chip>
              )}
            </View>
            {order.description && (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
              >
                {order.description}
              </Text>
            )}
            <Text
              variant="headlineSmall"
              style={{
                color: theme.colors.primary,
                marginTop: 8,
                fontWeight: "bold",
              }}
            >
              ₱{order.total_amount.toFixed(2)}
            </Text>
          </Card.Content>
        </Card>

        {/* Who Paid Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who Paid?</Text>

          {members.map((member) => {
            const payer = payers.find((p) => p.member_id === member.id);
            return (
              <Card key={member.id} style={styles.memberCard}>
                <Card.Content>
                  <View style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text variant="titleMedium">{member.name}</Text>
                    </View>
                    <TextInput
                      style={styles.amountInput}
                      mode="outlined"
                      label="Amount"
                      value={payer?.amount_paid || ""}
                      onChangeText={(text) =>
                        updatePayerAmount(member.id, text)
                      }
                      keyboardType="numeric"
                      left={<TextInput.Affix text="₱" />}
                      dense
                      placeholder="0.00"
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </View>

        {/* Split Mode Selection */}
        <View style={styles.splitModeChips}>
          <Chip
            style={styles.chip}
            mode={splitMode === "equal" ? "flat" : "outlined"}
            selected={splitMode === "equal"}
            onPress={() => {
              setSplitMode("equal");
              distributeEqualSplit();
            }}
          >
            Equal Split
          </Chip>
          <Chip
            style={styles.chip}
            mode={splitMode === "custom" ? "flat" : "outlined"}
            selected={splitMode === "custom"}
            onPress={() => setSplitMode("custom")}
          >
            Custom Split
          </Chip>
        </View>

        {/* Who Splits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who Splits the Cost?</Text>

          {members.map((member) => {
            const consumer = consumers.find((c) => c.member_id === member.id);
            if (!consumer) return null;

            return (
              <Card key={member.id} style={styles.memberCard}>
                <Card.Content>
                  <View style={styles.memberRow}>
                    <Checkbox
                      status={consumer.checked ? "checked" : "unchecked"}
                      onPress={() =>
                        updateConsumerChecked(member.id, !consumer.checked)
                      }
                    />
                    <View style={styles.memberInfo}>
                      <Text variant="titleMedium">{member.name}</Text>
                    </View>
                    {splitMode === "custom" && consumer.checked && (
                      <TextInput
                        style={styles.ratioInput}
                        mode="outlined"
                        label="Amount"
                        value={consumer.split_amount}
                        onChangeText={(text) =>
                          updateConsumerAmount(member.id, text)
                        }
                        keyboardType="numeric"
                        dense
                        placeholder="0.00"
                        left={<TextInput.Affix text="₱" />}
                      />
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </View>

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 12 }}>
              Summary
            </Text>

            <View style={styles.summaryRow}>
              <Text>Order Total:</Text>
              <Text style={{ fontWeight: "bold" }}>
                ₱{order.total_amount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text>Total Paid:</Text>
              <Text
                style={{
                  fontWeight: "bold",
                  color:
                    getTotalPaid() === order.total_amount
                      ? theme.colors.primary
                      : theme.colors.error,
                }}
              >
                ₱{getTotalPaid().toFixed(2)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text>People Splitting:</Text>
              <Text style={{ fontWeight: "bold" }}>
                {consumers.filter((c) => c.checked).length}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text>Total Split Amount:</Text>
              <Text
                style={{
                  fontWeight: "bold",
                  color:
                    hasSelectedMembersWithoutAmounts() ||
                    Math.abs(getTotalAmount() - order.total_amount) >= 0.01
                      ? theme.colors.error
                      : theme.colors.primary,
                }}
              >
                ₱{getTotalAmount().toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Save Button */}
      <Button
        mode="contained"
        style={styles.saveButton}
        onPress={handleSave}
        loading={saving}
        disabled={
          saving ||
          Math.abs(getTotalPaid() - order.total_amount) > 0.01 ||
          Math.abs(getTotalAmount() - order.total_amount) > 0.01 ||
          hasSelectedMembersWithoutAmounts()
        }
      >
        {isEditing ? "Update Assignment" : "Save Assignment"}
      </Button>
    </View>
  );
}
