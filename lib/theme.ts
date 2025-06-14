import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

// Custom colors based on the original design
const customColors = {
  primary: "#519e8a",
  primaryContainer: "#dcf0eb",
  secondary: "#22333B",
  secondaryContainer: "#e1e4e5",
  tertiary: "#5E503F",
  tertiaryContainer: "#edeae5",
  surface: "#ffffff",
  surfaceVariant: "#f5f5f5",
  background: "#F2F4F3",
  error: "#ef4444",
  errorContainer: "#fee2e2",
  success: "#22c55e",
  warning: "#f59e0b",
  outline: "#e5e5e5",
  outlineVariant: "#d4d4d4",
};

const customDarkColors = {
  primary: "#519e8a",
  primaryContainer: "#24453d",
  secondary: "#9ea8ad",
  secondaryContainer: "#161e23",
  tertiary: "#c0b7aa",
  tertiaryContainer: "#352c25",
  surface: "#1a1a1a",
  surfaceVariant: "#262626",
  background: "#000000",
  error: "#f87171",
  errorContainer: "#7f1d1d",
  success: "#4ade80",
  warning: "#fbbf24",
  outline: "#333333",
  outlineVariant: "#404040",
};

// Font configuration
const fontConfig = {
  web: {
    regular: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "normal",
    },
    medium: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "500",
    },
    light: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "300",
    },
    thin: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "200",
    },
  },
  default: {
    regular: {
      fontFamily: "System",
      fontWeight: "normal",
    },
    medium: {
      fontFamily: "System",
      fontWeight: "500",
    },
    light: {
      fontFamily: "System",
      fontWeight: "300",
    },
    thin: {
      fontFamily: "System",
      fontWeight: "200",
    },
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...customColors,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...customDarkColors,
  },
};

// Type for theme
export type AppTheme = typeof lightTheme;

// Helper to get current theme colors
export const getThemeColors = (isDark: boolean) => {
  return isDark ? darkTheme.colors : lightTheme.colors;
};
