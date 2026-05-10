import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RecordingComponent } from '../../src/components/RecordingComponent';
import { useAppStore } from '../../src/stores/app-store';

export default function RecordScreen() {
  const { selectedChildId } = useAppStore();

  return (
    <View style={styles.container}>
      <RecordingComponent childId={selectedChildId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FCF8FF',
    flex: 1,
  },
});
