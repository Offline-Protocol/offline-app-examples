import { describe, expect, it } from '@jest/globals';
import { webcrypto } from 'crypto';
import { toHex } from '@offline-app-examples/mesh/src/signing';
import {
  assignmentText,
  checkInText,
  type Handoff,
} from '../src/domain/handoff';
import { toDetails } from '../src/domain/sync';
import { ADD_IN_ID } from '../src/services/mygeotab';

// The MyGeotab page is plain browser JavaScript; it exports for this test only.
const addin = require('../mygeotab-addin/yardHandoffs.js');
const subtle = webcrypto.subtle;

async function signer() {
  const keys = (await subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as unknown as webcrypto.CryptoKeyPair;
  const publicKey = toHex([
    ...new Uint8Array(await subtle.exportKey('raw', keys.publicKey)),
  ]);
  return async (text: string) => ({
    publicKey,
    signature: toHex([
      ...new Uint8Array(
        await subtle.sign(
          { name: 'Ed25519' },
          keys.privateKey,
          new TextEncoder().encode(text),
        ),
      ),
    ]),
  });
}

/** A handoff signed the way the phones sign it, with real Ed25519 keys. */
async function signedHandoff(): Promise<Handoff> {
  const [driver, yard] = [await signer(), await signer()];
  const base = {
    handoffId: 'ho-1',
    vehicle: { id: 'b1', name: 'Truck 12' },
    driverId: 'off1driver',
    driverName: 'Ada',
    load: { bol: 'BOL-1', trailer: 'TR-1', seal: 'SL-1', pallets: 22 },
    checkedInAt: 1_700_000_000_000,
  };
  const h: Handoff = { ...base, driverSig: await driver(checkInText(base)) };
  const a = {
    dock: 'Dock 3' as const,
    yardId: 'off1yard',
    yardName: 'North Yard',
    assignedAt: 1_700_000_060_000,
  };
  return {
    ...h,
    assignment: { ...a, yardSig: await yard(assignmentText(h, a)) },
  };
}

describe('MyGeotab page', () => {
  it('uses the same add-in id as the phones', () => {
    expect(addin.ADD_IN_ID).toBe(ADD_IN_ID);
  });

  it('verifies a record the phones signed, and shows what was signed', async () => {
    const details = toDetails(await signedHandoff(), null);
    const result = await addin.verifyRecord(details, subtle);
    expect(result.status).toBe('valid');
    expect(result.view).toMatchObject({
      handoffId: 'ho-1',
      bol: 'BOL-1',
      dock: 'Dock 3',
      pallets: 22,
      yardName: 'North Yard',
    });
  });

  it('rejects edits to the load, the dock or a signature', async () => {
    const details = toDetails(await signedHandoff(), null);
    const editedLoad = {
      ...details,
      signed: {
        ...details.signed,
        checkIn: details.signed.checkIn.replace('22', '21'),
      },
    };
    expect((await addin.verifyRecord(editedLoad, subtle)).status).toBe(
      'invalid',
    );
    const editedDock = {
      ...details,
      signed: {
        ...details.signed,
        assignment: details.signed.assignment.replace('Dock 3', 'Dock 4'),
      },
    };
    expect((await addin.verifyRecord(editedDock, subtle)).reason).toMatch(
      /Yard signature/,
    );
    const swapped = {
      ...details,
      signed: { ...details.signed, yard: details.signed.driver },
    };
    expect((await addin.verifyRecord(swapped, subtle)).status).toBe('invalid');
    expect((await addin.verifyRecord({ signed: {} }, subtle)).status).toBe(
      'invalid',
    );
    expect((await addin.verifyRecord(details, undefined)).status).toBe(
      'unsupported',
    );
  });

  it('shows a handoff synced from two phones once', () => {
    const r = (id: string) => ({ details: { handoffId: id } });
    expect(addin.dedupe([r('a'), r('b'), r('a')])).toEqual([r('a'), r('b')]);
  });
});
