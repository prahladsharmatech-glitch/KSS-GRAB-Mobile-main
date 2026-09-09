import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  addressName?: string;
}

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Location permission request error:', err);
    return false;
  }
}

export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords: LocationCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };

    // Geocode to readable street name if possible
    try {
      const reversed = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (reversed && reversed.length > 0) {
        const item = reversed[0];
        coords.addressName = [item.name, item.street, item.city].filter(Boolean).join(', ');
      }
    } catch {}

    return coords;
  } catch (err) {
    console.warn('Get current location error:', err);
    return null;
  }
}
