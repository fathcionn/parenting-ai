import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RecordingComponent } from '../../src/components/RecordingComponent';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useAppStore } from '../../src/stores/app-store';

export default function RecordScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { selectedChildId } = useAppStore();
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      console.log('NAVIGATING to results for reportId:', reportId);
      router.replace({
        pathname: '/(drawer)/session-results' as any,
        params: { reportId },
      });
    }
  }, [reportId, router]);

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <RecordingComponent childId={selectedChildId} onReportSaved={setReportId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
