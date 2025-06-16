import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";

export default function IndexScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("IndexScreen: Setting up auth listener");

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log("IndexScreen: Initial session check:", {
        session: !!session,
        error,
      });
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("IndexScreen: Auth state changed:", {
        event,
        session: !!session,
        userId: session?.user?.id,
      });
      setSession(session);
      setIsLoading(false);
    });

    return () => {
      console.log("IndexScreen: Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  console.log("IndexScreen: Current state:", {
    isLoading,
    hasSession: !!session,
    userId: session?.user?.id,
  });

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  // Redirect based on authentication state
  if (session && session.user) {
    console.log(
      "IndexScreen: Redirecting authenticated user:",
      session.user.id
    );

    // Check if user needs to complete basic onboarding (name only)
    const userMetadata = session.user.user_metadata || {};
    const hasName = userMetadata.name && userMetadata.name.trim() !== "";
    const onboardingCompleted = userMetadata.onboarding_completed === true;

    console.log("IndexScreen: User profile check:", {
      hasName,
      onboardingCompleted,
      metadata: userMetadata,
    });

    // If user doesn't have a name or hasn't completed onboarding, redirect to onboarding
    if (!hasName || !onboardingCompleted) {
      console.log(
        "IndexScreen: Redirecting to onboarding for profile completion"
      );
      return <Redirect href="/auth/onboarding" />;
    }

    // User has completed their profile, redirect to main app
    // Note: Users can manage payment methods via the Profile tab
    return <Redirect href="/(tabs)" />;
  }

  console.log("IndexScreen: Redirecting to login");
  return <Redirect href="/auth/login" />;
}
