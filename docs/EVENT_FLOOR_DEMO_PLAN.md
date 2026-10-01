# Event Floor demo plan

**Product:** One end-to-end example app in [offline-app-examples](https://github.com/Offline-Protocol/offline-app-examples) for **live events and ticketing customers**, MIT-0 like Stock Sync and Order Up.

**App name (repo):** `eventfloor` · **Display name:** **Event Floor**

**Why this name:** In venues, the **event floor** is where show-day reality happens—**gates and admissions**, **security and medical dispatch**, **crowd-saturated networks**—not the back-office dashboard. One app covers both **floor staff coordination** and **gate scanners staying in sync** when connectivity fails.

**Positioning:** Generic **event organiser + ticketing platform** story. Do **not** brand the demo or public docs after a specific vendor. Partner evaluations use this app as the reference implementation; integration scope below is for **any** platform with bookings APIs and gate scanners.

**Site alignment:** [Events solution](https://www.offlineprotocol.com/solutions/events) — staff ops, gate scanning, ticket verification, fraud/duplicates, sync back to system of record.

**SDK:** Mesh SDK **0.27.0**, **Bluetooth mesh** only in copy and narration (phone Wi‑Fi Direct carries no data in 0.27).

---

## One app, two flows (sections)

Both flows live in **the same React Native app** (mode switch or role picker at lobby — same pattern as Order Up host vs waiter).


| Flow                   | Section in app | Primary buyer narrative                                                    | Phones                              |
| ---------------------- | -------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| **A — Staff dispatch** | Staff channel  | Organiser / venue ops when cell is saturated                               | **3** (sender, relay, receiver)     |
| **B — Gate sync**      | Admissions     | Ticketing platform / gate POS when scanners cannot share check-ins offline | **2–3** (scanners + optional relay) |


Each flow gets its own **README subsection**, **5-minute demo script**, and `**demo.gif`** in the app folder (same bar as Mizan’s catalogue: Order Up, Stock Sync, etc.). Root README embeds both GIFs under a single **Event Floor** entry.

---

## Flow A — Staff dispatch

**Purpose:** Staff-only coordination over **Bluetooth mesh** when the tower is saturated; traffic may **relay through attendee devices** that **cannot decrypt** staff payloads.

**Roles:**


| Role           | Device | Behavior                                                                                                   |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Staff sender   | A      | Staff identity (OfflineID sign-in in demo); sends alert e.g. “Medic, Section B” in **MLS encrypted group** |
| Relay          | B      | Mesh forward only; UI shows relay activity, not message body                                               |
| Staff receiver | C      | Staff identity; receives and acks                                                                          |


**Proves:** Encrypted group messaging + staff roster; confidentiality vs public mesh chat.

**CLI template lane:** Encrypted group messaging (enterprise starter).

**Demo GIF:** Record mixed devices (e.g. iOS + Android) running Flow A; show alert arriving after “cell saturated” and relay line in presenter strip.

---

## Flow B — Gate sync (ticketing / admission)

**Problem (industry-generic):** Gate scanners often **do not share check-ins with each other without connectivity**. Each device works alone until a link returns → duplicate scan risk, wrong capacity, friction at peak load.

**Goal:** While offline, **nearby gate scanners share admission state over Bluetooth mesh**. One gate admits ticket `T-1001`; others in mesh range see **already used**. When **any** scanner gets connectivity, records sync **once** to a **mock platform API** with stable `**scanId`** (visible **duplicates dropped** in UI).

**Reference script:**

1. Two or three scanners, same seeded event; no path to cloud.
2. Scanner A admits `T-1001`; B (and C) update over mesh.
3. B scans `T-1001` → **already admitted** (reject or supervisor override — seeded policy).
4. One device online → batch ingest; mock dashboard shows **one row per scanId**; repeat sync increments **dupes dropped**.

**Roles:**


| Role             | Device    | Behavior                                                         |
| ---------------- | --------- | ---------------------------------------------------------------- |
| Gate scanner     | A, B, (C) | Scan seeded QR/ticket id; local outbox + shared admission ledger |
| Relay (optional) | C         | Middle hop when gates are not in direct BLE range                |


**Proves:** Edge sync / host-authoritative admission map; [local handoff](https://www.offlineprotocol.com/docs/guides/local-handoff) + [backend delivery](https://www.offlineprotocol.com/docs/guides/backend-delivery) patterns (`scanId` idempotency).

**Demo GIF:** Two phones scanning; second shows reject; sync strip shows dedupe.

**Out of scope v1:** Proof of Location; full holder-bound ticket crypto (Phase 2 on events page).

---

## Architecture (logical)

One physical venue, two logical paths in the **same Event Floor app**. Transport is **Bluetooth LE mesh** (multi-hop where noted). Phone Wi‑Fi Direct is **not** used for payload in SDK 0.27.

### System context

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Partner or mock cloud (system of record)                                    │
│  · Event / inventory API (bootstrap while online)                            │
│  · Scan ingest API (Flow B) — idempotent on scanId                           │
│  · Reporting / attendance (Flow B) — no duplicate rows after retry           │
└───────────────────────────────▲──────────────────────────────────────────────┘
                                │
                    HTTPS when any floor device has a path out (Flow B)
                    (demo: in-app “Sync to platform” + mock dashboard)
                                │
┌───────────────────────────────┴──────────────────────────────────────────────┐
│                         VENUE — event floor (offline-capable)                │
│                                                                              │
│  ┌── Flow A: Staff dispatch ──────────────────────────────────────────────┐  │
│  │  No cloud required for dispatch; MLS-encrypted staff group on mesh     │  │
│  │                                                                        │  │
│  │   Staff phone A          Relay (optional)           Staff phone C      │  │
│  │   (security)             attendee or staff           (medical)         │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │  │
│  │  │ Event Floor     │    │ Event Floor     │    │ Event Floor     │     │  │
│  │  │ · OfflineID     │    │ · forward only  │    │ · OfflineID     │     │  │
│  │  │ · staff roster  │    │ · cannot decrypt│    │ · ack alert     │     │  │
│  │  │ · MLS group msg │───►│   staff payload │───►│                 │     │  │
│  │  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │  │
│  │           └──────────────────────┴──────────────────────┘              │  │
│  │                         Bluetooth mesh (≤ 8 hops)                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌── Flow B: Gate / admission sync ────────────────────────────────────────┐ │
│  │  No cloud required for shared admission; ingest when link returns       │ │
│  │                                                                         │ │
│  │  Gate scanner A         Gate scanner B         Gate / relay C (opt.)    │ │
│  │  (North entrance)       (South entrance)       (middle hop or 3rd gate) │ │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │ │
│  │  │ Event Floor     │   │ Event Floor     │   │ Event Floor     │        │ │
│  │  │ · scan UI       │   │ · scan UI       │   │ · scan UI or    │        │ │
│  │  │ · local outbox  │   │ · local outbox  │   │   relay only    │        │ │
│  │  │ · admission     │◄─►│ · admission     │◄─►│                 │        │ │
│  │  │   ledger (host  │   │   ledger(replica│   │                 │        │ │
│  │  │   or peer sync) │   │  from host snap)│   │                 │        │ │
│  │  │ · pending upload│   │ · “already used”│   │                 │        │ │
│  │  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘        │ │
│  │           └─────────────────────┴─────────────────────┘                 │ │
│  │                         Bluetooth mesh (multi-hop if gates > ~30 m)     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  @offline-protocol/mesh-sdk (v0.27) on each participating phone         │ │
│  │  · OfflineProtocol + room or MLS group (Flow A) / host snapshots (B)    │ │
│  │  · Device identity (off1…); Flow A adds OfflineID staff sign-in (demo)  │ │
│  │  · Encrypted messaging (MLS); service RPC not used in v1 demo           │ │
│  │  · AsyncStorage: outbox + ledger survive app restart (demo requirement) │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow B — data path (admit one ticket offline)

```text
  Operator scans QR / enters ticket id on Scanner A
           │
           ▼
  ┌─────────────────────┐
  │ Validate vs seed    │  (demo: local list; partner: cached bootstrap)
  │ Create scanId       │
  │ Append to outbox    │
  │ Update admission    │
  │ ledger on A         │
  └──────────┬──────────┘
             │ mesh: propose + snapshot (host-authoritative, dedupe ticket id)
             ▼
  ┌─────────────────────┐
  │ Scanner B ledger    │  ticket T-1001 → ADMITTED @ gate A, time, scanId
  │ shows “already used”│  on second scan at B
  └──────────┬──────────┘
             │ when online (any scanner)
             ▼
  ┌─────────────────────┐
  │ POST ingest batch   │  scanId idempotency key
  │ Mock / partner API  │  → accept new ids, drop duplicates (visible in UI)
  └─────────────────────┘
```

### Flow A — data path (staff alert)

```text
  Staff A sends alert in MLS group (encrypted)
           │
           ▼
  ┌─────────────────────┐
  │ Mesh routes over    │  optional hop via Device B (relay)
  │ Bluetooth           │  B sees envelope only, not plaintext
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │ Staff C decrypts,   │  application-level ack to A (demo UI)
  │ displays + acks     │  no cloud required
  └─────────────────────┘
```

### Demo vs partner production


| Layer   | Public demo (`apps/eventfloor`) | Partner integration (Phase 1+) |
| ------- | ------------------------------- | ------------------------------ |
| Cloud   | Mock ingest + in-app dashboard  | Partner REST / webhook ingest  |
| Tickets | Seeded JSON list                | Bootstrap API + QR spec        |
| Staff   | Seeded OfflineID demo accounts  | Partner roster / SSO policy    |
| Mesh    | Same SDK patterns               | Embed module in partner POS    |


---

## What Offline Protocol builds (demo app + partner path)

### In `offline-app-examples` (end-to-end catalogue item)

- [ ] Single app `**apps/eventfloor**`: lobby, Flow A UI, Flow B UI, shared mesh layer (`packages/mesh` + group mode where needed).
- [ ] Seeded event + staff roster + ticket list; documented **reset**.
- [ ] Presenter/debug strips (pending, synced, **dupes dropped**, hop/relay hints where useful).
- [ ] Domain tests: staff message validation; admission dedupe; ingest idempotency.
- [ ] `**demo-staff.gif**` and `**demo-gate.gif**` (prefer **two** GIFs, one per flow).
- [ ] App README + root README entry with GIFs (mirror Order Up / Stock Sync).
- [ ] CI: iOS + Android matrix row for `eventfloor`.

### For platform partners (optional integration, not in the open-source demo)

- Integration guide: embed points, lifecycle, 256 KiB message budget, BLE range + relay honesty.
- Draft **scan ingest** OpenAPI (generic fields: `scanId`, `ticketId`, `eventId`, `gateId`, `scannedAt`, `deviceId`).
- Phased pilot: **Phase 0** = this public demo; **Phase 1** = partner sandbox + ≤2 working sessions (contract + validation).

---

## What a ticketing / POS partner provides (integration only)

**Target: ~two working sessions** + async sandbox.


| Session                     | Partner inputs                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **1 — Contract & fixtures** | Sandbox API; sample event + tickets; QR/barcode spec; duplicate policy; gate/device IDs; POS stack (RN vs native) |
| **2 — Validation**          | Staging POS or reference build; outage script; ingest visible in their dashboard                                  |


Partner does **not** build mesh, MLS, or relay — that remains SDK + reference app.

---

## Integration points (Flow B — partner systems)


| #   | Boundary                 | Content                                                                     |
| --- | ------------------------ | --------------------------------------------------------------------------- |
| I1  | Ticket presentation      | QR/barcode/NFC payload scanners already read                                |
| I2  | Online validation        | Baseline API when online                                                    |
| I3  | Offline admission ledger | Scanner ↔ scanner over mesh                                                 |
| I4  | Scan ingest (catch-up)   | Idempotent batch: `scanId`, `ticketId`, `eventId`, `gateId`, `scannedAt`, … |
| I5  | Event bootstrap          | Event config + ticket cache while online                                    |
| I6  | Auth                     | Credentials on device; no secrets in mesh RPC plaintext                     |
| I7  | Identity (Phase 2)       | OfflineID staff; optional holder-bound tickets                              |


---

## Phasing


| Phase               | Deliverable                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| **0 — Public demo** | Event Floor app in repo, both flows, GIFs, docs                                     |
| **1 — Partner MVP** | Sandbox ingest wired to partner API; embed guide                                    |
| **2+**              | Signed tickets, holder challenge, revenue/reconcile rules (partner-owned reporting) |


---

## Open questions (effort for Phase 1)

1. Partner POS stack (RN embed vs sidecar)?
2. Offline cache today (full bookings vs scan queue)?
3. Canonical ticket id for ledger + ingest?
4. Existing validate API schema?
5. New ingest endpoint vs extend existing; idempotency field?
6. Gates per venue → need third phone as relay?
7. Hardware: phones vs rugged scanners (BLE)?
8. Duplicate policy under partition?
9. One mesh session per event?
10. Commercial Mesh SDK license for proprietary POS?

---

## Success criteria (Phase 0 — catalogue)

- [ ] Flow A: staff alert reaches receiver with relay; non-staff relay cannot read payload.
- [ ] Flow B: B sees A’s admission offline; duplicate scan handled clearly; mock ingest dedupes visibly.
- [ ] Both flows documented with GIFs in README; `pnpm test` / CI green.
- [ ] Wording matches website events page; **no partner trademark** in user-facing strings.

---

## Relationship to other planned demos

- **Event Floor** combines staff + gate stories in one events catalogue app (no separate gate-only demo).
- **OutageNet**, **YardGate**, **AgriMesh** remain separate verticals (see `DEMO_APPS_PLAN.md`).

---

## Internal note

Early drafts referenced a specific ticketing platform from commercial conversations. External and repo-facing materials use **generic events/ticketing** language only; partner name stays in CRM.