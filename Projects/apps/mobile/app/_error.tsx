import React from 'react';
import { View, Text } from 'react-native';

export default function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Something went wrong</Text>
      <Text>{String(error)}</Text>
    </View>
  );
}
