import { supabase } from "@/lib/supabase";
import { AppTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import CountryPicker, {
  CallingCode,
  Country,
  CountryCode,
} from "react-native-country-picker-modal";
import {
  Avatar,
  Button,
  Chip,
  Divider,
  HelperText,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("PH");
  const [callingCode, setCallingCode] = useState<CallingCode>("63");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const theme = useTheme<AppTheme>();

  const formatPhoneNumberByCountry = (
    text: string,
    country: CountryCode
  ): string => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, "");

    if (country === "PH") {
      // Philippines formatting: 0917 123 4567 or 917 123 4567
      if (cleaned.length <= 3) {
        return cleaned;
      } else if (cleaned.length <= 6) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      } else if (cleaned.length <= 10) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
          6
        )}`;
      } else {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(
          7,
          11
        )}`;
      }
    } else if (country === "US") {
      // US formatting: (555) 123-4567
      if (cleaned.length <= 3) {
        return cleaned;
      } else if (cleaned.length <= 6) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      } else if (cleaned.length <= 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
          6
        )}`;
      }
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6,
        10
      )}`;
    } else {
      // Generic formatting for other countries
      if (cleaned.length <= 4) {
        return cleaned;
      } else if (cleaned.length <= 7) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      } else if (cleaned.length <= 11) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
          6
        )}`;
      }
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(
        7,
        11
      )}`;
    }
  };

  const cleanPhoneNumber = (
    formatted: string,
    country: CountryCode,
    calling: CallingCode
  ): string => {
    // Extract just digits
    const digits = formatted.replace(/\D/g, "");

    // Add country calling code
    if (digits.startsWith(calling)) {
      return `+${digits}`;
    }

    // Handle Philippines specific cases
    if (country === "PH") {
      if (digits.startsWith("0")) {
        // Remove leading 0 and add country code
        return `+${calling}${digits.slice(1)}`;
      }
      if (digits.length === 10 && digits.startsWith("9")) {
        // Mobile number without leading 0
        return `+${calling}${digits}`;
      }
    }

    return `+${calling}${digits}`;
  };

  const onCountrySelect = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
    setShowCountryPicker(false);
  };

  const handleSendOTP = async () => {
    try {
      setLoading(true);

      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (
        !supabaseUrl ||
        !supabaseKey ||
        supabaseUrl === "" ||
        supabaseKey === ""
      ) {
        Alert.alert(
          "Configuration Error",
          "Supabase is not configured. Please create a .env file with your Supabase credentials.\n\nSee the setup instructions for details."
        );
        return;
      }

      // Validate phone number
      const cleanedPhone = cleanPhoneNumber(
        phoneNumber,
        countryCode,
        callingCode
      );
      if (phoneNumber.replace(/\D/g, "").length < 7) {
        Alert.alert("Error", "Please enter a valid phone number");
        return;
      }

      console.log("Sending OTP to:", cleanedPhone);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: cleanedPhone,
        options: {
          data: name ? { name: name.trim() } : undefined,
        },
      });

      if (error) {
        console.error("OTP send error:", error);
        Alert.alert("Error", error.message);
      } else {
        console.log("OTP sent successfully:", data);
        setStep("otp");
        Alert.alert(
          "Code Sent! 📱",
          `We sent a 6-digit code to +${callingCode} ${phoneNumber}. It should arrive in a few seconds.`
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setLoading(true);

      if (otp.length !== 6) {
        Alert.alert("Error", "Please enter the 6-digit code");
        return;
      }

      console.log("Verifying OTP:", otp);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: cleanPhoneNumber(phoneNumber, countryCode, callingCode),
        token: otp,
        type: "sms",
      });

      if (error) {
        console.error("OTP verification error:", error);
        Alert.alert("Error", error.message);
      } else {
        console.log("OTP verified successfully:", data);

        // Check if we have a valid session
        if (data.session && data.user) {
          console.log("Session established:", {
            sessionId: data.session.access_token.substring(0, 20) + "...",
            userId: data.user.id,
            phone: data.user.phone,
          });

          // Show success message
          Alert.alert(
            "Welcome! 🎉",
            "You're now signed in. Taking you to the dashboard...",
            [{ text: "OK" }]
          );

          // Navigate immediately after successful verification
          try {
            router.replace("/(tabs)");
          } catch (navError) {
            console.error("Navigation error:", navError);
            // Fallback: Force a session refresh to trigger auth listener
            setTimeout(async () => {
              const { data: refreshedSession } =
                await supabase.auth.getSession();
              console.log("Fallback session refresh:", {
                hasSession: !!refreshedSession.session,
              });
            }, 500);
          }
        } else {
          console.warn("OTP verified but no session/user in response:", data);
          Alert.alert(
            "Authentication Error",
            "Verification successful but failed to establish session. Please try again."
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);

      console.log(
        "Resending OTP to:",
        cleanPhoneNumber(phoneNumber, countryCode, callingCode)
      );

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: cleanPhoneNumber(phoneNumber, countryCode, callingCode),
      });

      if (error) {
        console.error("OTP resend error:", error);
        Alert.alert("Error", error.message);
      } else {
        console.log("OTP resent successfully:", data);
        Alert.alert(
          "Code Resent! 📱",
          "A new code has been sent to your phone."
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert("Error", "Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep("phone");
    setOtp("");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingVertical: 20,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 48,
    },
    logo: {
      marginBottom: 16,
    },
    appTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.colors.onBackground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 18,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: 8,
    },
    formContainer: {
      marginBottom: 32,
    },
    formTitle: {
      fontSize: 24,
      fontWeight: "600",
      textAlign: "center",
      color: theme.colors.onBackground,
      marginBottom: 8,
    },
    formSubtitle: {
      fontSize: 16,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      marginBottom: 32,
      lineHeight: 24,
    },
    input: {
      marginBottom: 16,
    },
    phoneInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    countrySelector: {
      marginRight: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      minWidth: 80,
    },
    countrySelectorContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    countryText: {
      marginLeft: 8,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    phoneInput: {
      flex: 1,
    },
    otpInput: {
      textAlign: "center",
      fontSize: 24,
      letterSpacing: 8,
      marginBottom: 16,
    },
    authButton: {
      marginTop: 16,
      marginBottom: 16,
    },
    secondaryButton: {
      marginBottom: 16,
    },
    backButton: {
      marginBottom: 24,
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    dividerText: {
      marginHorizontal: 16,
      color: theme.colors.onSurfaceVariant,
    },
    setupButton: {
      marginBottom: 16,
    },
    disclaimerContainer: {
      marginTop: 24,
    },
    disclaimerText: {
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 20,
    },
    featuresContainer: {
      paddingHorizontal: 32,
      paddingBottom: 32,
    },
    featureRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    featureItem: {
      flex: 1,
      alignItems: "center",
    },
    featureChip: {
      marginBottom: 8,
    },
    featureText: {
      fontSize: 12,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
    },
  });

  const showSetupInstructions = () => {
    Alert.alert(
      "Phone Authentication Setup 📱",
      "Phone + OTP authentication requires:\n\n✅ Supabase phone auth enabled\n✅ SMS provider configured (Twilio/MessageBird)\n💰 Small SMS cost (~$0.01 per message)\n\nNow with international support! Default set to Philippines 🇵🇭",
      [{ text: "OK" }]
    );
  };

  const renderPhoneStep = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>Welcome to Ambagan</Text>
      <Text style={styles.formSubtitle}>
        Enter your phone number to get started. We&apos;ll send you a
        verification code.
      </Text>

      <TextInput
        label="Your Name/Nickname"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
        autoCapitalize="words"
        textContentType="name"
        placeholder="What should we call you?"
      />

      <View style={styles.phoneInputContainer}>
        <TouchableOpacity onPress={() => setShowCountryPicker(true)}>
          <Surface
            style={[
              styles.countrySelector,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.countrySelectorContent}>
              <CountryPicker
                countryCode={countryCode}
                withFilter
                withFlag
                withCallingCode
                withCountryNameButton={false}
                onSelect={onCountrySelect}
                visible={showCountryPicker}
                onClose={() => setShowCountryPicker(false)}
              />
              <Text style={styles.countryText}>+{callingCode}</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TextInput
          label="Phone Number"
          value={phoneNumber}
          onChangeText={(text) =>
            setPhoneNumber(formatPhoneNumberByCountry(text, countryCode))
          }
          mode="outlined"
          style={styles.phoneInput}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder={
            countryCode === "PH"
              ? "917 123 4567"
              : countryCode === "US"
              ? "(555) 123-4567"
              : "123 456 7890"
          }
          left={<TextInput.Icon icon="phone" />}
        />
      </View>

      <HelperText type="info">
        We&apos;ll send a 6-digit verification code via SMS
      </HelperText>

      <Button
        mode="contained"
        onPress={handleSendOTP}
        loading={loading}
        disabled={loading || !phoneNumber.trim()}
        style={styles.authButton}
        contentStyle={{ paddingVertical: 8 }}
        icon="message-text"
      >
        {loading ? "Sending Code..." : "Send Verification Code"}
      </Button>
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>Enter Verification Code</Text>
      <Text style={styles.formSubtitle}>
        We sent a 6-digit code to{"\n"}+{callingCode} {phoneNumber}
      </Text>

      <TextInput
        label="6-Digit Code"
        value={otp}
        onChangeText={setOtp}
        mode="outlined"
        style={[styles.input, styles.otpInput]}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        placeholder="123456"
        maxLength={6}
      />

      <Button
        mode="contained"
        onPress={handleVerifyOTP}
        loading={loading}
        disabled={loading || otp.length !== 6}
        style={styles.authButton}
        contentStyle={{ paddingVertical: 8 }}
        icon="check-circle"
      >
        {loading ? "Verifying..." : "Verify & Sign In"}
      </Button>

      <Button
        mode="text"
        onPress={handleResendOTP}
        disabled={loading}
        style={styles.secondaryButton}
        icon="refresh"
      >
        Resend Code
      </Button>

      <Button
        mode="outlined"
        onPress={goBack}
        disabled={loading}
        style={styles.backButton}
        icon="arrow-left"
      >
        Change Phone Number
      </Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* App Logo/Icon */}
          <View style={styles.logoContainer}>
            <Avatar.Text
              size={96}
              label="A"
              style={[styles.logo, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary, fontSize: 40 }}
            />
            <Text style={styles.appTitle}>Ambagan</Text>
            <Text style={styles.subtitle}>Split bills with friends easily</Text>
          </View>

          {/* Auth Form */}
          {step === "phone" ? renderPhoneStep() : renderOTPStep()}

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <Divider
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outline },
              ]}
            />
            <Text style={styles.dividerText}>or</Text>
            <Divider
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outline },
              ]}
            />
          </View>

          {/* Setup Instructions Button */}
          <Button
            mode="text"
            onPress={showSetupInstructions}
            style={styles.setupButton}
            contentStyle={{ paddingVertical: 4 }}
            icon="information-outline"
          >
            Setup Instructions
          </Button>

          {/* Additional Info */}
          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerText}>
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </Text>
          </View>
        </View>

        {/* Bottom Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <Chip
                style={styles.featureChip}
                textStyle={{ fontSize: 18 }}
                mode="outlined"
              >
                🍕
              </Chip>
              <Text style={styles.featureText}>Track Orders</Text>
            </View>

            <View style={styles.featureItem}>
              <Chip
                style={styles.featureChip}
                textStyle={{ fontSize: 18 }}
                mode="outlined"
              >
                👥
              </Chip>
              <Text style={styles.featureText}>Split Bills</Text>
            </View>

            <View style={styles.featureItem}>
              <Chip
                style={styles.featureChip}
                textStyle={{ fontSize: 18 }}
                mode="outlined"
              >
                💰
              </Chip>
              <Text style={styles.featureText}>Easy Payments</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
