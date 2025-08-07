import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Card,
  Dialog,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

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

interface Transaction {
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
  balances: Transaction[];
  total_owed: number;
  total_owed_to_them: number;
}

export default function BalanceDetailScreen() {
  const { id: sessionId, memberId } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [memberBalance, setMemberBalance] = useState<MemberBalance | null>(
    null
  );
  const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState<Member | null>(null);
  const [viewQrModal, setViewQrModal] = useState(false);

  useEffect(() => {
    fetchBalanceDetails();
  }, [sessionId, memberId]);

  const fetchBalanceDetails = async () => {
    try {
      if (!sessionId || !memberId) return;

      // Fetch member details
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("id", memberId)
        .single();

      if (memberError) throw memberError;
      setMember(memberData);

      // Fetch all session data needed for balance calculation
      // First get orders to get their IDs
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("session_id", sessionId);

      if (ordersError) throw ordersError;
      const orders = ordersData || [];
      const orderIds = orders.map((o) => o.id);

      // Now fetch everything else in parallel
      const [membersRes, payersRes, consumersRes] = await Promise.all([
        supabase.from("members").select("*").eq("session_id", sessionId),
        supabase
          .from("order_payers")
          .select(
            `
          *,
          members!inner(name)
        `
          )
          .in("order_id", orderIds),
        supabase
          .from("order_consumers")
          .select(
            `
          *,
          members!inner(name)
        `
          )
          .in("order_id", orderIds),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (payersRes.error) throw payersRes.error;
      if (consumersRes.error) throw consumersRes.error;

      const members = membersRes.data || [];
      const orderPayers = (payersRes.data || []).map((p: any) => ({
        ...p,
        member_name: p.members.name,
      }));
      const orderConsumers = (consumersRes.data || []).map((c: any) => ({
        ...c,
        member_name: c.members.name,
      }));

      // Calculate balances using the same logic as the main session screen
      const memberSummaries = members.map((member: any) => {
        let totalPaid = 0;
        let totalOwed = 0;

        // Calculate total paid by this member
        const memberPayments = orderPayers.filter(
          (p: any) => p.member_id === member.id
        );
        totalPaid = memberPayments.reduce(
          (sum: number, payment: any) => sum + payment.amount_paid,
          0
        );

        // Calculate total this member should pay
        for (const order of orders) {
          const orderConsumersForOrder = orderConsumers.filter(
            (c: any) => c.order_id === order.id
          );
          const memberConsumer = orderConsumersForOrder.find(
            (c: any) => c.member_id === member.id
          );

          if (memberConsumer) {
            const totalSplitRatio = orderConsumersForOrder.reduce(
              (sum: number, c: any) => sum + c.split_ratio,
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
          net_balance: totalPaid - totalOwed,
        };
      });

      // Find this specific member's balance
      const thisMemberSummary = memberSummaries.find(
        (m: any) => m.member_id === memberId
      );

      if (thisMemberSummary) {
        const debts: Transaction[] = [];

        // Calculate who this member owes money to
        if (thisMemberSummary.net_balance < -0.01) {
          const amountToPay = Math.abs(thisMemberSummary.net_balance);
          const creditors = memberSummaries
            .filter((m: any) => m.net_balance > 0.01)
            .sort((a: any, b: any) => b.net_balance - a.net_balance);

          let remainingDebt = amountToPay;

          for (const creditor of creditors) {
            if (remainingDebt <= 0.01) break;

            const paymentAmount = Math.min(remainingDebt, creditor.net_balance);

            if (paymentAmount > 0.01) {
              debts.push({
                owed_to_member_id: creditor.member_id,
                owed_to_member_name: creditor.member_name,
                amount_owed: paymentAmount,
                order_details: [], // Simplified - could be enhanced with order breakdown
              });

              remainingDebt -= paymentAmount;
              creditor.net_balance -= paymentAmount;
            }
          }
        }

        setMemberBalance({
          member_id: thisMemberSummary.member_id,
          member_name: thisMemberSummary.member_name,
          balances: debts,
          total_owed: thisMemberSummary.total_owed,
          total_owed_to_them: Math.max(0, thisMemberSummary.net_balance),
        });
      }
    } catch (error) {
      console.error("Error fetching balance details:", error);
      Alert.alert("Error", "Failed to load balance details");
    } finally {
      setLoading(false);
    }
  };

  const handleShowPaymentDetails = async (creditorId: string) => {
    try {
      const { data: creditorData, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", creditorId)
        .single();

      if (error) throw error;

      console.log("Creditor data:", creditorData);
      console.log("Payment method type:", creditorData.payment_method_type);
      console.log("QR image URL:", creditorData.payment_qr_image_url);
      console.log("Payment notes:", creditorData.payment_notes);

      setSelectedCreditor(creditorData);
      setPaymentDialogVisible(true);
    } catch (error) {
      console.error("Error fetching creditor details:", error);
      Alert.alert("Error", "Failed to load payment details");
    }
  };

  const getNetBalance = () => {
    if (!memberBalance) return 0;
    return memberBalance.total_owed_to_them - memberBalance.total_owed;
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
      padding: 16,
    },
    memberCard: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    balanceAmount: {
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginVertical: 8,
    },
    transactionCard: {
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    orderDetail: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingLeft: 16,
    },
    paymentMethodCard: {
      margin: 16,
      backgroundColor: theme.colors.primaryContainer,
    },
    qrContainer: {
      alignItems: "center",
      paddingVertical: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 64,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Balance Details" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!member || !memberBalance) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Balance Not Found" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Balance details not found</Text>
        </View>
      </View>
    );
  }

  const netBalance = getNetBalance();

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={`${member.name}'s Balance`} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Member Summary Card */}
        <Card style={styles.memberCard}>
          <Card.Content>
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Avatar.Text
                size={64}
                label={member.name.charAt(0).toUpperCase()}
                style={{ backgroundColor: theme.colors.primaryContainer }}
              />
              <Text variant="headlineSmall" style={{ marginTop: 12 }}>
                {member.name}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {member.user_id ? "App User" : "Manual Entry"}
              </Text>

              <Text
                style={[
                  styles.balanceAmount,
                  {
                    color:
                      netBalance > 0
                        ? theme.colors.primary
                        : netBalance < 0
                        ? theme.colors.error
                        : theme.colors.onSurface,
                  },
                ]}
              >
                {netBalance > 0
                  ? "Should receive: +"
                  : netBalance < 0
                  ? "Should pay: "
                  : "Even: "}
                ₱{Math.abs(netBalance).toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Transactions */}
        {memberBalance.balances.length > 0 ? (
          <View>
            <Text
              variant="titleMedium"
              style={{ marginBottom: 12, color: theme.colors.primary }}
            >
              Required Payments
            </Text>

            {memberBalance.balances.map((transaction, index) => (
              <Card key={index} style={styles.transactionCard}>
                <List.Item
                  title={`Pay ${transaction.owed_to_member_name}`}
                  description={`₱${transaction.amount_owed.toFixed(2)}`}
                  style={{
                    paddingLeft: 16,
                  }}
                  left={() => (
                    <Avatar.Text
                      size={40}
                      label={transaction.owed_to_member_name
                        .charAt(0)
                        .toUpperCase()}
                      style={{ backgroundColor: theme.colors.errorContainer }}
                    />
                  )}
                  right={() => (
                    <Button
                      mode="outlined"
                      compact
                      style={{
                        paddingHorizontal: 5,
                      }}
                      onPress={() =>
                        handleShowPaymentDetails(transaction.owed_to_member_id)
                      }
                    >
                      Pay
                    </Button>
                  )}
                />

                {/* Order breakdown */}
                {transaction.order_details.length > 0 && (
                  <Card.Content style={{ paddingTop: 0 }}>
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginBottom: 4,
                      }}
                    >
                      Order breakdown:
                    </Text>
                    {transaction.order_details.map((order, orderIndex) => (
                      <View key={orderIndex} style={styles.orderDetail}>
                        <Text variant="bodySmall">{order.order_name}</Text>
                        <Text variant="bodySmall">
                          ₱{order.amount.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </Card.Content>
                )}
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text
              variant="bodyLarge"
              style={{
                textAlign: "center",
                color: theme.colors.onSurfaceVariant,
              }}
            >
              🎉 All settled up! No payments required.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Payment Details Dialog */}
      <Portal>
        <Dialog
          visible={paymentDialogVisible}
          onDismiss={() => setPaymentDialogVisible(false)}
        >
          <Dialog.Title>
            Payment Details - {selectedCreditor?.name}
          </Dialog.Title>
          <Dialog.Content>
            {selectedCreditor && (
              <View>
                {/* Payment Method Type */}
                <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                  Payment Method:{" "}
                  {selectedCreditor.payment_method_type === "qr_code"
                    ? "QR Code"
                    : selectedCreditor.payment_method_type === "gcash"
                    ? "GCash"
                    : selectedCreditor.payment_method_type === "paymaya"
                    ? "PayMaya"
                    : selectedCreditor.payment_method_type === "bank_transfer"
                    ? "Bank Transfer"
                    : selectedCreditor.payment_method_type === "cash"
                    ? "Cash"
                    : selectedCreditor.payment_method_type || "Not specified"}
                </Text>

                {/* QR Code Display for QR Code payment methods */}
                {selectedCreditor.payment_method_type === "qr_code" &&
                  selectedCreditor.payment_qr_image_url && (
                    <View style={{ alignItems: "center", marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setViewQrModal(true)}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          backgroundColor: "#FFFFFF",
                          borderWidth: 1,
                          borderColor: theme.colors.outline,
                        }}
                      >
                        <Image
                          source={{
                            uri: selectedCreditor.payment_qr_image_url,
                          }}
                          style={{ width: 200, height: 200 }}
                          resizeMode="contain"
                          onError={(error) => {
                            console.log("QR Image load error:", error);
                            console.log(
                              "Image URL:",
                              selectedCreditor.payment_qr_image_url
                            );
                          }}
                          onLoad={() => {
                            console.log("QR Image loaded successfully");
                          }}
                        />
                      </TouchableOpacity>
                      <Text
                        variant="bodySmall"
                        style={{
                          textAlign: "center",
                          marginTop: 8,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        Tap to view full size
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{
                          textAlign: "center",
                          marginTop: 4,
                          color: theme.colors.onSurfaceVariant,
                          fontSize: 10,
                        }}
                      >
                        Debug:{" "}
                        {selectedCreditor.payment_qr_image_url?.substring(
                          0,
                          50
                        )}
                        ...
                      </Text>
                    </View>
                  )}

                {/* Show debug info when QR code payment method but no image */}
                {selectedCreditor.payment_method_type === "qr_code" &&
                  !selectedCreditor.payment_qr_image_url && (
                    <View style={{ alignItems: "center", marginBottom: 16 }}>
                      <Text
                        variant="bodyMedium"
                        style={{
                          textAlign: "center",
                          color: theme.colors.error,
                          fontStyle: "italic",
                        }}
                      >
                        QR Code payment method selected but no QR image
                        available
                      </Text>
                    </View>
                  )}

                {/* Payment Notes */}
                {selectedCreditor.payment_notes && (
                  <View style={{ marginBottom: 16 }}>
                    <Text variant="labelMedium" style={{ marginBottom: 4 }}>
                      Payment Instructions:
                    </Text>
                    <Text variant="bodyMedium">
                      {selectedCreditor.payment_notes}
                    </Text>
                  </View>
                )}

                {/* No payment details available */}
                {!selectedCreditor.payment_qr_image_url &&
                  !selectedCreditor.payment_notes &&
                  (!selectedCreditor.payment_method_type ||
                    selectedCreditor.payment_method_type === "cash") && (
                    <Text
                      variant="bodyMedium"
                      style={{
                        textAlign: "center",
                        color: theme.colors.onSurfaceVariant,
                        fontStyle: "italic",
                        padding: 16,
                      }}
                    >
                      {selectedCreditor.payment_method_type === "cash"
                        ? "Pay in cash when you see them"
                        : "No payment details available. Contact them directly."}
                    </Text>
                  )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaymentDialogVisible(false)}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* QR Code Full Screen Viewer */}
      <Portal>
        <Dialog
          visible={viewQrModal}
          onDismiss={() => setViewQrModal(false)}
          style={{ backgroundColor: "transparent" }}
        >
          <Dialog.Content>
            {selectedCreditor?.payment_qr_image_url && (
              <Image
                source={{ uri: selectedCreditor.payment_qr_image_url }}
                style={{ width: "100%", height: 300 }}
                resizeMode="contain"
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setViewQrModal(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
