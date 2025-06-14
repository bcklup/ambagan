import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QRScannerScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg text-text-light dark:text-text-dark">
          QR Scanner
        </Text>
        <Text className="text-neutral-600 dark:text-neutral-400 mt-2">
          QR code scanning coming soon...
        </Text>
      </View>
    </SafeAreaView>
  );
}
