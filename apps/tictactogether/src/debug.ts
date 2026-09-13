/** Filter device logs with LOG_TAG from constants (Xcode / adb logcat / Metro). */

import { LOG_TAG } from './constants';

export function meshLog(message: string, data?: Record<string, unknown>): void {
  if (data) {
    console.log(LOG_TAG, message, data);
  } else {
    console.log(LOG_TAG, message);
  }
}

export function meshWarn(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (data) {
    console.warn(LOG_TAG, message, data);
  } else {
    console.warn(LOG_TAG, message);
  }
}

export function meshError(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (data) {
    console.error(LOG_TAG, message, data);
  } else {
    console.error(LOG_TAG, message);
  }
}

export function shortPeer(peer: string): string {
  return peer.length > 12 ? `${peer.slice(0, 8)}…${peer.slice(-4)}` : peer;
}
