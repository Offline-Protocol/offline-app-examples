import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Bluetooth permissions must be granted before the protocol starts.
 * iOS asks on first Bluetooth use (Info.plist strings), so there is nothing to do there.
 */
export async function requestNearbyPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const p = PermissionsAndroid.PERMISSIONS;
  const needed =
    Number(Platform.Version) >= 31
      ? [p.BLUETOOTH_SCAN, p.BLUETOOTH_ADVERTISE, p.BLUETOOTH_CONNECT]
      : [p.ACCESS_FINE_LOCATION];
  const grants = await PermissionsAndroid.requestMultiple(needed);
  if (needed.some(permission => grants[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error(
      'Bluetooth permission is needed. Allow Nearby devices (or Location on Android 11 and older) in Settings, then try again.',
    );
  }
}
