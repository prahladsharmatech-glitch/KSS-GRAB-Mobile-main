import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let UrlTile: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    UrlTile = Maps.UrlTile;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch {}
}
import {
  MapPin,
  Navigation,
  Check,
  Clock,
  LocateFixed,
  Plus,
  Minus,
} from 'lucide-react-native';
import { COLORS, SHADOWS } from '../../constants/theme';

interface LocationData {
  lat: number;
  lng: number;
  radius: number;
  address: string;
  title: string;
}

interface SupermarketLocationMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialTitle?: string;
  initialRadius?: number;
  onSaveLocation?: (data: LocationData) => void;
  height?: number;
}

const RADIUS_OPTIONS = [
  { label: '50m', value: 50 },
  { label: '100m', value: 100 },
  { label: '250m', value: 250 },
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '7 km', value: 7000 },
  { label: '10 km', value: 10000 },
];

export const SupermarketLocationMapPicker: React.FC<SupermarketLocationMapPickerProps> = ({
  initialLat = 13.014333,
  initialLng = 77.646000,
  initialTitle = 'GrabIt Supermarket — 5km Express Delivery Coverage Zone',
  initialRadius = 5000,
  onSaveLocation,
  height = 360,
}) => {
  const mapRef = useRef<any>(null);
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [geofenceRadius, setGeofenceRadius] = useState(initialRadius);
  const [storeTitle, setStoreTitle] = useState(initialTitle);
  const [resolvedAddress, setResolvedAddress] = useState(
    'Near 9th Main Road, HRBR Layout 1st Block, Banaswadi, Bengaluru 560043'
  );
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [zoomLevel, setZoomLevel] = useState(initialRadius > 1000 ? 0.07 : 0.015);

  // Live clock string
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Reverse Geocoding via OpenStreetMap Nominatim API
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsResolving(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'GrabIt-Admin-Mobile/1.0 (admin@grabit.local)',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.suburb || 'Main Market Road';
        const area = addr.suburb || addr.neighbourhood || addr.city_district || 'Banaswadi';
        const city = addr.city || addr.town || 'Bengaluru';
        const postcode = addr.postcode || '560043';

        const hubPrefix = initialTitle.includes('Express') || initialTitle.includes('5km')
          ? 'GrabIt Supermarket — 5km Express Delivery Coverage Zone'
          : initialTitle.includes('Dispatch')
          ? 'GrabIt Supermarket — Live Rider Dispatch'
          : 'GrabIt Supermarket';
        setStoreTitle(`${hubPrefix} (${area})`);
        setResolvedAddress(`${road}, ${area}, ${city} ${postcode}`);
      }
    } catch {
      setResolvedAddress('Near 9th Main Road, HRBR Layout 1st Block, Banaswadi, Bengaluru 560043');
    } finally {
      setIsResolving(false);
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    const newLat = parseFloat(region.latitude.toFixed(6));
    const newLng = parseFloat(region.longitude.toFixed(6));
    setCoords({ lat: newLat, lng: newLng });
    setZoomLevel(region.latitudeDelta);
    reverseGeocode(newLat, newLng);
  };

  const handleZoomIn = () => {
    const newDelta = Math.max(zoomLevel / 2, 0.002);
    setZoomLevel(newDelta);
    mapRef.current?.animateToRegion(
      {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: newDelta,
        longitudeDelta: newDelta,
      },
      300
    );
  };

  const handleZoomOut = () => {
    const newDelta = Math.min(zoomLevel * 2, 0.5);
    setZoomLevel(newDelta);
    mapRef.current?.animateToRegion(
      {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: newDelta,
        longitudeDelta: newDelta,
      },
      300
    );
  };

  const handleLocateMe = () => {
    setIsLocating(true);
    // Center to Bangalore hub coordinates or navigator coords
    const hubLat = 13.014333;
    const hubLng = 77.646000;
    setCoords({ lat: hubLat, lng: hubLng });
    mapRef.current?.animateToRegion(
      {
        latitude: hubLat,
        longitude: hubLng,
        latitudeDelta: zoomLevel,
        longitudeDelta: zoomLevel,
      },
      400
    );
    reverseGeocode(hubLat, hubLng);
    setTimeout(() => setIsLocating(false), 600);
  };

  const handleSave = () => {
    const data: LocationData = {
      lat: coords.lat,
      lng: coords.lng,
      radius: geofenceRadius,
      address: resolvedAddress,
      title: storeTitle,
    };
    if (onSaveLocation) {
      onSaveLocation(data);
    }
    setSavedNotice(`✅ Supermarket Location Saved: ${coords.lat}, ${coords.lng} (${geofenceRadius}m radius)`);
    setTimeout(() => setSavedNotice(''), 4000);
  };

  return (
    <View style={styles.cardContainer}>
      {/* ── HEADER ROW (EXACT TO REACT WEB) ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.navIconBox}>
            <Navigation size={15} color="#0071E3" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.visualizerTitle}>INTERACTIVE MAP & GEOFENCE VISUALIZER</Text>
            <Text style={styles.visualizerSub}>
              Drag the marker pin or click anywhere on the map to set exact supermarket hub coordinates.
            </Text>
          </View>
        </View>

        {/* Lat/Lng Badge */}
        <View style={styles.coordsBadgeTop}>
          <MapPin size={13} color="#0071E3" />
          <Text style={styles.coordsBadgeText}>
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </Text>
        </View>
      </View>

      {/* ── MAP CONTAINER (WITH OPENSTREETMAP TILES & OVERLAYS) ── */}
      <View style={[styles.mapWrapper, { height }]}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          style={styles.map}
          initialRegion={{
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: zoomLevel,
            longitudeDelta: zoomLevel,
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {/* OpenStreetMap Tile Layer API */}
          <UrlTile
            urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
            zIndex={-1}
          />

          {/* Blue Geofence Circle with Dashed Border */}
          <Circle
            center={{ latitude: coords.lat, longitude: coords.lng }}
            radius={geofenceRadius}
            fillColor="rgba(0, 113, 227, 0.16)"
            strokeColor="#0071E3"
            strokeWidth={2.5}
          />

          {/* Draggable Supermarket Pulse Marker */}
          <Marker
            coordinate={{ latitude: coords.lat, longitude: coords.lng }}
            title={storeTitle}
            description={resolvedAddress}
            draggable
            onDragEnd={(e: any) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              const newLat = parseFloat(latitude.toFixed(6));
              const newLng = parseFloat(longitude.toFixed(6));
              setCoords({ lat: newLat, lng: newLng });
              reverseGeocode(newLat, newLng);
            }}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerPulse} />
              <View style={styles.markerBadge}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        </MapView>

        {/* Top-Left Zoom Controls */}
        <View style={styles.zoomControlBox}>
          <Pressable style={styles.zoomBtn} onPress={handleZoomIn}>
            <Plus size={16} color="#0F172A" />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable style={styles.zoomBtn} onPress={handleZoomOut}>
            <Minus size={16} color="#0F172A" />
          </Pressable>
        </View>

        {/* Top-Right My Location Button Overlay */}
        <Pressable
          style={styles.myLocationBtn}
          onPress={handleLocateMe}
          disabled={isLocating}
        >
          <LocateFixed size={14} color="#0071E3" />
          <Text style={styles.myLocationText}>
            {isLocating ? 'Locating...' : 'My Location'}
          </Text>
        </Pressable>

        {/* ── BOTTOM LIGHT GLASSMORPHISM OVERLAY BANNER (MATCHING SCREENSHOT) ── */}
        <View style={styles.bottomFloatingCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.floatingCardTitleRow}>
              <View style={styles.blueDot} />
              <Text style={styles.floatingCardTitle} numberOfLines={1}>
                {storeTitle}
              </Text>
            </View>

            <Text style={styles.floatingCardSub}>
              Radius: <Text style={styles.boldBlueText}>{geofenceRadius} meters</Text> | Lat: {coords.lat.toFixed(6)} | Lon: {coords.lng.toFixed(3)}
            </Text>

            <View style={styles.cloudLiveRow}>
              <View style={styles.greenLiveDot} />
              <Text style={styles.cloudLiveText}>
                Cloud Live • {liveTime || 'Online'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── SETUP CONTROLS BELOW MAP ── */}
      <View style={styles.footerControls}>
        {/* Resolved Hub Address Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>RESOLVED HUB ADDRESS</Text>
          <View style={styles.addressInputBox}>
            <TextInput
              editable={false}
              value={isResolving ? 'Resolving map location via OpenStreetMap...' : resolvedAddress}
              style={styles.addressInputText}
              numberOfLines={2}
              multiline
            />
            {isResolving && <ActivityIndicator size="small" color="#0071E3" />}
          </View>
        </View>

        {/* Delivery Geofence Radius Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DELIVERY GEOFENCE RADIUS</Text>
          <View style={styles.radiusPillsRow}>
            {RADIUS_OPTIONS.map((opt) => {
              const isSelected = geofenceRadius === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.radiusPill, isSelected && styles.radiusPillActive]}
                  onPress={() => setGeofenceRadius(opt.value)}
                >
                  <Text style={[styles.radiusPillText, isSelected && styles.radiusPillTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Success Notice */}
        {savedNotice !== '' && (
          <View style={styles.noticeBanner}>
            <Check size={14} color="#047857" style={{ marginRight: 6 }} />
            <Text style={styles.noticeText}>{savedNotice}</Text>
          </View>
        )}

        {/* Save Button */}
        <Pressable
          style={styles.saveBtn}
          onPress={handleSave}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.saveBtnText}>Save Geofence Coordinates</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
    ...SHADOWS.md,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  navIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  visualizerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0071E3',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  visualizerSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  coordsBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  coordsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0071E3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapWrapper: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  markerPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 113, 227, 0.25)',
  },
  markerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0071E3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...SHADOWS.md,
  },
  zoomControlBox: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    zIndex: 500,
    ...SHADOWS.sm,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  myLocationBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 500,
    ...SHADOWS.md,
  },
  myLocationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomFloatingCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 500,
    ...SHADOWS.md,
  },
  floatingCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0071E3',
  },
  floatingCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
  },
  floatingCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  boldBlueText: {
    color: '#0071E3',
    fontWeight: '900',
  },
  cloudLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  greenLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  cloudLiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
  },
  footerControls: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  addressInputBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressInputText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 17,
  },
  radiusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  radiusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radiusPillActive: {
    backgroundColor: '#0071E3',
    borderColor: '#0071E3',
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  radiusPillTextActive: {
    color: '#FFFFFF',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...SHADOWS.md,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});

export default SupermarketLocationMapPicker;
