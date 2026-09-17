import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { MapPin, Navigation } from 'lucide-react-native';

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onSelectLocation?: (lat: number, lng: number) => void;
  height?: number;
}

const lon2tile = (lon: number, zoom: number) => {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
};

const lat2tile = (lat: number, zoom: number) => {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
};

export const DeliveryLocationMapPicker: React.FC<MapPickerProps> = ({
  initialLat = 12.9716,
  initialLng = 77.5946,
  onSelectLocation,
  height = 175,
}) => {
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const zoomLevel = 14;

  const centerX = lon2tile(coords.lng, zoomLevel);
  const centerY = lat2tile(coords.lat, zoomLevel);
  const tileOffsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],  [0, 0],  [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ];

  return (
    <View style={[styles.container, { height }]}>
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          title: 'Delivery Location Map',
          width: '100%',
          height: '100%',
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          loading: 'lazy',
          src: `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`,
        })
      ) : (
        <View style={styles.tileCanvasWrapper}>
          <View style={styles.tileGridContainer}>
            {tileOffsets.map(([dx, dy]) => {
              const tx = centerX + dx;
              const ty = centerY + dy;
              const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoomLevel}/${ty}/${tx}`;
              return (
                <Image
                  key={`${zoomLevel}-${tx}-${ty}`}
                  source={{ uri: url }}
                  style={styles.tileImage}
                  resizeMode="cover"
                />
              );
            })}
          </View>

          <View style={styles.centerPinWrapper}>
            <View style={styles.customMarker}>
              <MapPin size={18} color="#0066FF" />
            </View>
          </View>
        </View>
      )}

      <View style={styles.overlayHint}>
        <Navigation size={11} color="#0066FF" style={{ marginRight: 4 }} />
        <Text style={styles.hintText}>Pin • {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  tileCanvasWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGridContainer: {
    width: 768,
    height: 768,
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -384 }, { translateY: -384 }],
  },
  tileImage: {
    width: 256,
    height: 256,
  },
  centerPinWrapper: {
    position: 'absolute',
    zIndex: 20,
  },
  customMarker: {
    backgroundColor: '#EFF6FF',
    padding: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0066FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  overlayHint: {
    position: 'absolute',
    bottom: 6,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  hintText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
  },
});
