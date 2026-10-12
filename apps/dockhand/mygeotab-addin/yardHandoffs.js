/* eslint-env browser */
/* global globalThis, module */
/* MyGeotab Add-In page: lists DockHand handoffs stored as AddInData and checks
 * both signatures in the browser, independently of the phones that made them.
 * Everything shown is parsed from the signed texts, so what you read is what was signed. */
(function (root) {
  'use strict';

  // Must match ADD_IN_ID in src/services/mygeotab.ts.
  var ADD_IN_ID = 'aQ1J3cGt1UkW1vXoJmZ6h3w';

  function fromHex(hex) {
    if (
      typeof hex !== 'string' ||
      hex.length % 2 !== 0 ||
      !/^[0-9a-f]*$/i.test(hex)
    )
      return null;
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++)
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  async function verifySignature(subtle, signed, text) {
    var key = fromHex(signed && signed.publicKey);
    var sig = fromHex(signed && signed.signature);
    if (!key || key.length !== 32 || !sig || sig.length !== 64) return false;
    var cryptoKey = await subtle.importKey(
      'raw',
      key,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return subtle.verify(
      { name: 'Ed25519' },
      cryptoKey,
      sig,
      new TextEncoder().encode(text),
    );
  }

  /**
   * Returns { status: 'valid' | 'invalid' | 'unsupported', reason, view }.
   * `view` comes from the signed texts, never from the plain fields beside them.
   */
  async function verifyRecord(details, subtle) {
    var s = details && details.signed;
    var checkIn, assignment;
    try {
      checkIn = JSON.parse(s.checkIn);
      assignment = JSON.parse(s.assignment);
    } catch (e) {
      return {
        status: 'invalid',
        reason: 'Signed texts are missing or malformed',
        view: null,
      };
    }
    if (
      checkIn[0] !== 'dockhand/checkin/v1' ||
      assignment[0] !== 'dockhand/assign/v1'
    ) {
      return {
        status: 'invalid',
        reason: 'Unknown record version',
        view: null,
      };
    }
    var view = {
      handoffId: checkIn[1],
      vehicleName: checkIn[3],
      driverName: checkIn[5],
      bol: checkIn[6],
      trailer: checkIn[7],
      seal: checkIn[8],
      pallets: checkIn[9],
      checkedInAt: new Date(checkIn[10]),
      dock: assignment[3],
      yardName: assignment[5],
      assignedAt: new Date(assignment[6]),
      goFix: details.goFix || null,
    };
    // The yard's signature must cover this exact check-in and the driver's signature on it.
    if (
      assignment[1] !== s.checkIn ||
      assignment[2] !== (s.driver && s.driver.signature)
    ) {
      return {
        status: 'invalid',
        reason: 'Yard signed a different check-in',
        view: view,
      };
    }
    if (!subtle)
      return {
        status: 'unsupported',
        reason: 'This browser cannot check Ed25519',
        view: view,
      };
    try {
      var driverOk = await verifySignature(subtle, s.driver, s.checkIn);
      var yardOk = await verifySignature(subtle, s.yard, s.assignment);
      if (!driverOk)
        return {
          status: 'invalid',
          reason: 'Driver signature does not match',
          view: view,
        };
      if (!yardOk)
        return {
          status: 'invalid',
          reason: 'Yard signature does not match',
          view: view,
        };
      return {
        status: 'valid',
        reason: 'Driver and yard signatures valid',
        view: view,
      };
    } catch (e) {
      return {
        status: 'unsupported',
        reason: 'This browser cannot check Ed25519',
        view: view,
      };
    }
  }

  /** Two phones can sync the same handoff at the same moment; show it once. */
  function dedupe(records) {
    var seen = {};
    return records.filter(function (r) {
      var id = r.details && r.details.handoffId;
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  // ------------------------------------------------------------- rendering

  function el(tag, text, className) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text; // never innerHTML: these strings came from phones
    if (className) node.className = className;
    return node;
  }

  function fmt(date) {
    return isNaN(date) ? '?' : date.toLocaleString();
  }

  async function render(container, records) {
    var subtle = root.crypto && root.crypto.subtle;
    var rows = await Promise.all(
      dedupe(records).map(function (r) {
        return verifyRecord(r.details, subtle);
      }),
    );
    rows.sort(function (a, b) {
      return (
        ((b.view && b.view.assignedAt) || 0) -
        ((a.view && a.view.assignedAt) || 0)
      );
    });
    container.textContent = '';
    if (rows.length === 0) {
      container.appendChild(
        el(
          'p',
          'No handoffs yet. Complete one in DockHand and sync it.',
          'empty',
        ),
      );
      return;
    }
    var table = el('table');
    var head = el('tr');
    [
      'Assigned',
      'Vehicle',
      'Driver',
      'Load',
      'Dock',
      'Yard',
      'GO fix at check-in',
      'Signatures',
    ].forEach(function (h) {
      head.appendChild(el('th', h));
    });
    table.appendChild(head);
    rows.forEach(function (row) {
      var v = row.view || {};
      var tr = el('tr');
      tr.appendChild(el('td', v.assignedAt ? fmt(v.assignedAt) : '?'));
      tr.appendChild(el('td', v.vehicleName || '?'));
      tr.appendChild(el('td', v.driverName || '?'));
      tr.appendChild(
        el(
          'td',
          'BOL ' +
            v.bol +
            ' · Trailer ' +
            v.trailer +
            ' · Seal ' +
            (v.seal || 'none') +
            ' · ' +
            v.pallets +
            ' pallets',
        ),
      );
      tr.appendChild(el('td', v.dock || '?'));
      tr.appendChild(el('td', v.yardName || '?'));
      var fix = el('td');
      if (v.goFix) {
        var link = el(
          'a',
          v.goFix.latitude.toFixed(5) + ', ' + v.goFix.longitude.toFixed(5),
        );
        link.href =
          'https://www.openstreetmap.org/?mlat=' +
          v.goFix.latitude +
          '&mlon=' +
          v.goFix.longitude +
          '#map=17/' +
          v.goFix.latitude +
          '/' +
          v.goFix.longitude;
        link.target = '_blank';
        link.rel = 'noopener';
        fix.appendChild(link);
        fix.appendChild(el('div', fmt(new Date(v.goFix.dateTime)), 'muted'));
      } else fix.textContent = 'none (demo vehicle)';
      tr.appendChild(fix);
      tr.appendChild(el('td', row.reason, 'sig ' + row.status));
      table.appendChild(tr);
    });
    container.appendChild(table);
  }

  function load(api) {
    var container = document.getElementById('yardHandoffs-list');
    container.textContent = 'Loading…';
    api.call(
      'Get',
      {
        typeName: 'AddInData',
        search: { addInId: ADD_IN_ID },
        resultsLimit: 500,
      },
      function (records) {
        render(container, records || []);
      },
      function (error) {
        container.textContent =
          'Could not load handoffs: ' +
          (error && error.message ? error.message : error);
      },
    );
  }

  if (root.geotab && root.geotab.addin) {
    root.geotab.addin.yardHandoffs = function () {
      return {
        initialize: function (api, state, callback) {
          callback();
        },
        focus: function (api) {
          load(api);
        },
        blur: function () {},
      };
    };
  }

  if (typeof module !== 'undefined')
    module.exports = {
      verifyRecord: verifyRecord,
      dedupe: dedupe,
      ADD_IN_ID: ADD_IN_ID,
    };
})(typeof window !== 'undefined' ? window : globalThis);
