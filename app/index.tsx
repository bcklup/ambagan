import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function HomeScreen() {
  const color = useThemeColor({ light: "#", dark: Colors.dark.tint }, "text");
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" darkColor={color} lightColor={color}>
        Ambagan
      </ThemedText>
      <ThemedView>
        <View style={styles.card}>
          <ThemedText type="defaultSemiBold">Bowling</ThemedText>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
});
