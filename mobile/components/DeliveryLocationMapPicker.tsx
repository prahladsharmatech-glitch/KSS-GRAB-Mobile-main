import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { COLORS, SPACING } from '../constants/theme';
import { MapPin, Navigation } from 'lucide-react-native';

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onSelectLocation?: (lat: number, lng: number) => void;
  height?: number;
}

export const DeliveryLocationMapPicker: React.FC<MapPickerProps> = ({
  initialLat = 12.9716,
  initialLng = 77.5946,
  onSelectLocation,
  height = 200,
}) => {
  const [region, setRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const handleRegionChangeComplete = (newRegion: any) => {
    setRegion(newRegion);
    if (onSelectLocation) {
      onSelectLocation(newRegion.latitude, newRegion.longitude);
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title="Delivery Pin">
          <View style={styles.customMarker}>
            <MapPin size={24} color={COLORS.primaryDark} />
          </View>
        </Marker>
      </MapView>

      <View style={styles.overlayHint}>
        <Navigation size={14} color={COLORS.primaryDark} style={{ marginRight: 4 }} />
        <Text style={styles.hintText}>Drag map to adjust delivery pin location</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  customMarker: {
    backgroundColor: COLORS.primaryLight,
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  overlayHint: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
});
