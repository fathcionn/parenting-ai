import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ChildMapProps = {
  region: {
    latitude: number;
    longitude: number;
  };
  marker?: {
    latitude: number;
    longitude: number;
    title: string;
  } | null;
};

export function ChildMap({ marker, region }: ChildMapProps) {
  const point = marker || { latitude: region.latitude, longitude: region.longitude, title: '' };

  return (
    <View style={styles.webMapFallback}>
      <FontAwesome name="map-marker" size={42} color="#000" />
      <Text style={styles.webMapText}>
        {marker ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'No location shared yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapFallback: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  webMapText: { color: '#000', fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' },
});
