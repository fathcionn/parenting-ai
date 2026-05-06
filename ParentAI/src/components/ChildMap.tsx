import React from 'react';
import MapView, { Marker } from 'react-native-maps';

type ChildMapProps = {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  marker?: {
    latitude: number;
    longitude: number;
    title: string;
  } | null;
};

export function ChildMap({ region, marker }: ChildMapProps) {
  return (
    <MapView style={{ height: '100%', width: '100%' }} region={region}>
      {marker ? (
        <Marker
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          title={marker.title}
        />
      ) : null}
    </MapView>
  );
}
