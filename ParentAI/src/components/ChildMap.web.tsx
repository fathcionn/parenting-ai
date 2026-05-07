import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';

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
  markers?: {
    id: string;
    latitude: number;
    longitude: number;
    title: string;
  }[];
  safeZones?: {
    id: string;
    latitude: number;
    longitude: number;
  }[];
};

function initial(name: string) {
  return name.trim()[0]?.toUpperCase() || 'C';
}

export function ChildMap({ marker, markers, region }: ChildMapProps) {
  const points = markers || (marker ? [{ id: marker.title, ...marker }] : []);

  return (
    <View style={styles.webMapFallback}>
      <View style={styles.webMapGrid} />
      {points.length === 0 ? (
        <Text style={styles.webMapText}>
          {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
        </Text>
      ) : (
        points.map((point, index) => (
          <View
            key={point.id}
            style={[
              styles.webMarker,
              {
                left: `${24 + (index % 3) * 24}%`,
                top: `${28 + (index % 2) * 24}%`,
              },
            ]}
          >
            <Text style={styles.webMarkerText}>{initial(point.title)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webMapFallback: {
    backgroundColor: '#f5f0eb',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  webMapGrid: {
    borderColor: '#e8e0d8',
    borderRadius: 180,
    borderWidth: 42,
    height: 360,
    left: -50,
    opacity: 0.8,
    position: 'absolute',
    top: -60,
    width: 520,
  },
  webMapText: {
    alignSelf: 'center',
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 120,
    textAlign: 'center',
  },
  webMarker: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderColor: COLORS.onPrimary,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    width: 36,
  },
  webMarkerText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
