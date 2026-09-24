import React from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';
import { useAppTheme } from './theme';
export function Text({ style, ...props }: TextProps) {
  const { theme } = useAppTheme();
  const flattened = StyleSheet.flatten(style);
  const weight = Number(flattened?.fontWeight || 400);
  const fontFamily = flattened?.fontFamily || (weight >= 700 ? 'MyMapBold' : weight >= 500 ? 'MyMapSemiBold' : 'MyMapRegular');
  return <NativeText {...props} style={[{ fontFamily, color: theme.colors.text }, style]} />;
}
