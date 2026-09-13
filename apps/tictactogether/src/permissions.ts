import { PermissionsAndroid, Platform } from 'react-native';

export async function requestBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const p = PermissionsAndroid.PERMISSIONS;
  const permissions =
    Number(Platform.Version) >= 31
      ? [p.BLUETOOTH_SCAN, p.BLUETOOTH_ADVERTISE, p.BLUETOOTH_CONNECT]
      : [p.ACCESS_FINE_LOCATION];
  const grants = await PermissionsAndroid.requestMultiple(permissions);
  if (
    permissions.some(
      (permission) => grants[permission] !== PermissionsAndroid.RESULTS.GRANTED,
    )
  ) {
    throw new Error(
      'Bluetooth permission is required. Enable Nearby devices (or Location on Android 11) in Settings, then try again.',
    );
  }
}
