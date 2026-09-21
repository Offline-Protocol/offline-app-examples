/** Mesh configuration — same appId must be used on every device. */
export const APP_ID = 'tictactogether';
export const SERVICE_NAME = 'tictactogether-service';
export const DISCOVERY_MODE = 'mesh-services';
export const TRANSPORT_PROFILE = 'nearby-only';
/** Fallback lobby id when service metadata is missing (host still accepts this). */
export const DIRECT_LOBBY = 'nearby-tictactogether-service-v1';
/** Wait after BLE neighbor before join (GATT settle); skipped once MLS session exists. */
export const NEIGHBOR_SETTLE_MS = 2000;
/** Min interval between MeshServices discovery queries (avoids BLE retry storms). */
export const SERVICE_DISCOVER_MIN_INTERVAL_MS = 6000;
/** Console log prefix — filter on this tag in Xcode / adb logcat. */
export const LOG_TAG = '[tictactogether]';
