import React, { useEffect, useRef } from 'react';
import MapView, { Marker, Circle } from 'react-native-maps';

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
  markers?: {
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    description?: string;
  }[];
  safeZones?: {
    id: string;
    latitude: number;
    longitude: number;
    radius: number;
  }[];
  customMapStyle?: any[];
};

export function ChildMap({ region, marker, markers, safeZones, customMapStyle }: ChildMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const visibleMarkers = markers || (marker ? [{ id: marker.title, ...marker }] : []);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 450);
  }, [region]);

  return (
    <MapView
      ref={mapRef}
      style={{ height: '100%', width: '100%' }}
      region={region}
      mapType="standard"
      customMapStyle={customMapStyle}
    >
      {visibleMarkers.map((item) => (
        <Marker
          key={item.id}
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          title={item.title}
          description={item.description}
        />
      ))}
      {(safeZones || []).map((zone) => (
        <Circle
          key={zone.id}
          center={{ latitude: zone.latitude, longitude: zone.longitude }}
          radius={zone.radius}
          strokeColor="rgba(92,122,107,0.45)"
          fillColor="rgba(92,122,107,0.14)"
        />
      ))}
    </MapView>
  );
}
