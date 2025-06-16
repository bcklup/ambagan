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
      "IndexScreen: Redirecting to main app for user:",
      session.user.id
    );
    return <Redirect href="/(tabs)" />;
  }

  console.log("IndexScreen: Redirecting to login");
  return <Redirect href="/auth/login" />;
}
