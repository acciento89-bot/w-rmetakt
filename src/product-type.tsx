import React, { createContext, forwardRef, useContext } from 'react';
import { ActivityIndicator, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import type { PropsWithChildren, ElementRef } from 'react';
import type { StyleProp, TextProps, TextInputProps, TextStyle } from 'react-native';
const Ready = createContext(false);
const fontAssets = {
  cambayRegular: require('../assets/fonts/cambay/Cambay-Regular.ttf'),
  cambayBold: require('../assets/fonts/cambay/Cambay-Bold.ttf'),
};
function face(style: StyleProp<TextStyle>) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  return weight === 'bold' || Number(weight) >= 600 ? 'cambayBold' : 'cambayRegular';
}
// Select actual bundled faces; never ask Android to synthesize a weight.
export const Text = forwardRef<ElementRef<typeof NativeText>, TextProps>(({ style, ...props }, ref) => {
  const ready = useContext(Ready);
  return <NativeText {...props} ref={ref} style={[style, ready && { fontFamily: face(style), fontWeight: 'normal', fontStyle: 'normal' }]} />;
});
export const TextInput = forwardRef<ElementRef<typeof NativeTextInput>, TextInputProps>(({ style, ...props }, ref) => {
  const ready = useContext(Ready);
  return <NativeTextInput {...props} ref={ref} style={[style, ready && { fontFamily: face(style), fontWeight: 'normal', fontStyle: 'normal' }]} />;
});
export function ProductFontGate({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(fontAssets);
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator accessibilityLabel="Loading / Laden" /></View>;
  return <Ready.Provider value={loaded}><View style={{ flex: 1 }}>{error && <NativeText accessibilityRole="alert" style={{ padding: 12, backgroundColor: '#fff2db', color: '#633500' }}>Schrift nicht verfügbar · Font unavailable</NativeText>}{children}</View></Ready.Provider>;
}
