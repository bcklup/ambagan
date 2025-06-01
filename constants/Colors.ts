/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const primaryColor = "#519e8a";
const secondaryColor = "#22333B";
const tertiaryColor = "#5E503F";
const darkTint = "#0A0908";
const lightTint = "#F2F4F3";

export const Colors = {
  light: {
    text: darkTint,
    background: lightTint,
    tint: primaryColor,
    icon: primaryColor,
    tabIconDefault: primaryColor,
    tabIconSelected: secondaryColor,
  },
  dark: {
    text: lightTint,
    background: "#000",
    tint: primaryColor,
    icon: primaryColor,
    tabIconDefault: primaryColor,
    tabIconSelected: secondaryColor,
  },
};
