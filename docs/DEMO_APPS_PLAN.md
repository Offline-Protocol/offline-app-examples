# Upcoming demo apps plan

Planning only — no app scaffolds until implementation starts.

**Owner:** Ankush (these four). **Mizan:** existing Ditto catalogue (Stock Sync, Order Up, Cowrite, Tic Tac Together) + Atlas CMMS.

**Home:** [offline-app-examples](https://github.com/Offline-Protocol/offline-app-examples), MIT-0 like the other apps. Target **eight** working demos on docs/website when these ship.

**SDK:** Mesh SDK **0.27.0** only. Demo copy and narration say **Bluetooth mesh** — not Wi‑Fi Direct or “any radio” (phone Wi‑Fi carries no data in 0.27).

**CLI alignment:** Build from the enterprise starter templates the CLI generates where possible — proves templates produce real apps.

| App | CLI / template lane |
| --- | --- |
| YardGate | Nearby service discovery + invoke |
| Event Floor | Events app: **Flow A** staff dispatch + **Flow B** gate sync (one app, two GIFs) |
| OutageNet | Local handoff + retained delivery + sync |
| AgriMesh | Multi-hop relay / store-and-forward (custom on mesh primitives) |

**Out of scope for v1:** Proof of Location (YardGate check-ins stay app-level; POL fails often server-side today).

---

## Devices per demo

| App | Phones | Why |
| --- | --- | --- |
| OutageNet | **2** | Direct handoff + sync story |
| AgriMesh | **3+** | Field spread > BLE range; readings hop via middle device |
| YardGate | **3** | Driver → relay in yard → **gate officer** approves/denies |
| Event Floor | **2–3** | Flow A: staff + relay (3). Flow B: gate scanners (+ optional relay) |

---

## Build order

1. **OutageNet** — handoff, accept, outbox, idempotent mock HQ (template for sync honesty)
2. **YardGate** — MeshServices + gate role + relay phone *(shipped: `apps/yardgate`)*
3. **Event Floor** — single events demo app: Flow A (staff) + Flow B (gate); see `docs/EVENT_FLOOR_DEMO_PLAN.md`; **demo GIF per flow**
4. **AgriMesh** — multi-hop batch carry (depends on comfort with group/relay from Event Floor Flow A)

---

## 1. YardGate

**Site vertical:** [Logistics](https://www.offlineprotocol.com/solutions/logistics)

**Purpose:** Yard with no cellular: driver discovers a **gate check-in service** over **Bluetooth mesh**, completes check-in; **gate officer** approves or denies on the gate device.

**Roles (demo cast):**

| Role | Device | Behavior |
| --- | --- | --- |
| Driver | Phone A | Discovers service (possibly via relay), submits trailer/load ID (seeded) |
| Relay | Phone B | Optional middle hop when driver is not in direct BLE range of gate |
| Gate officer | Phone C | Runs gate service; **human approves or denies**; response returns to driver |

**User experience:** “I'm a driver in the yard with no signal. I check in from my phone. The **gate officer** sees the request on the gate tablet/phone and taps Approve or Deny. I see the result on mine — no walk to the office, no tower.”

**Proves:** MeshServices discover + invoke; **visible approver**; multi-hop when yard layout requires a middle phone.

**Constraints:** No Proof of Location. RPC payload is signed plaintext — no secrets in the invoke body.

---

## 2. Event Floor (single events demo app)

**Site vertical:** [Live events](https://www.offlineprotocol.com/solutions/events) — **organisers** and **ticketing platforms** (generic; no vendor name in the app).

**One app (`apps/eventfloor`), two flows** — full scope in [`docs/EVENT_FLOOR_DEMO_PLAN.md`](./EVENT_FLOOR_DEMO_PLAN.md).

| Flow | Buyer | Proves |
| --- | --- | --- |
| **A — Staff ops** | Event organiser | MLS staff group + OfflineID; dispatch over crowd relay (relay cannot read) |
| **B — Gate sync** | Ticketing / gate POS | Shared **admission ledger** across scanners; idempotent mock platform ingest |

**Catalogue bar (Satvik / Mizan parity):** End-to-end RN app, seeded reset, README scripts, **`demo-staff.gif`** + **`demo-gate.gif`**, root README embeds, CI matrix row.

**Flow A (short):** Security sends “Medic, Section B”; staff receiver gets it on **Bluetooth mesh** when cell is saturated; optional third phone relays.

**Flow B (short):** Scanner A admits ticket; B shows **already used** offline; sync shows **dupes dropped** on repeat ingest.

**Implementation:** Shared lobby with flow/role selection; Flow A uses `group: true` + staff OfflineID; Flow B uses host-authoritative admission + outbox (Order Up / OutageNet patterns). Bluetooth-only wording.

---

## 3. OutageNet

**Site vertical:** [Public sector](https://www.offlineprotocol.com/solutions/public-sector)

**Purpose:** Blackout / infrastructure down: teams post status, **hand off responsibility** to a teammate offline, then **sync once** when any phone gets connectivity.

**Roles:** Field worker A, field worker B (accepts handoff). Optional fourth phone later as “first online” syncer — can be A or B.

**User experience:** “Power and towers are out. I log ‘Sector 3 cleared’ or pass ‘you're lead for this block’ to a coworker — they **accept**. Both keep history. When one phone gets signal, **HQ (mock dashboard)** shows updates **once**.”

**Proves:** Local handoff + accept + durable local history + backend delivery.

**Must build (not marketing):**

- Stable **`operationId`** / idempotency key on every record and sync payload.
- Mock dashboard **visibly rejects duplicates** (counter or log: “dropped duplicate `operationId`”).
- Test: sync from two phones after same events → dashboard still single row per operation.
- Payload size: direct messages **≤ 256 KiB**; seeded batches stay **well under** (small JSON status lines, not huge blobs). Split if needed.

**Devices:** **2** phones for core demo; presenter can show dashboard on laptop/browser.

---

## 4. AgriMesh (revised — not a clone of OutageNet)

**Site vertical:** [Agriculture](https://www.offlineprotocol.com/solutions)

**Purpose:** **Store-and-forward over multiple hops** — field readings collected on one edge of a plot, **carried across Bluetooth mesh** (worker phones as relays) until they reach a phone at the **farm office edge** that can upload when online.

**Distinct from OutageNet:** OutageNet = **handoff + accept + responsibility** + HQ sync. AgriMesh = **range extension via relay chain** + **batch carriage** + **one clean upload** — no “accept ownership” narrative required (optional ack at office only).

**Roles:**

| Role | Device | Behavior |
| --- | --- | --- |
| Field collector | Phone A | Records seeded readings (moisture, equipment checks); small batches |
| Relay worker | Phone B | Carries traffic when A and C are not in direct range |
| Office edge | Phone C | Holds batch; uploads to mock farm system when connectivity returns |

**User experience:** “I'm in a field with no service. I log readings. They're **not** going straight to the cloud — they **hop** across coworkers' phones spread out until the office-side phone has them. When **any** path gets connectivity, the office system gets **one** record set.”

**Proves:** Multi-hop relay, store-and-forward, deterministic sync — **different SDK story** from OutageNet.

**Must build:**

- Same **idempotency keys** and mock backend **duplicate drop** as OutageNet.
- Seeded batches **well under 256 KiB** per message; split across messages if the route grows.

**Devices:** **3** minimum.

---

## Done bar (all four)

- Physical devices as in table above; README with **5-minute script** and **Bluetooth-only** wording.
- Seeded scenario + documented **reset**.
- Domain tests (pure TS): message validation, idempotency, handoff rules where applicable.
- **Presenter / debug strip:** pending, delivered, accepted (where relevant), synced, **duplicates dropped** count.
- Mock HQ / farm / gate log: simple HTTP or in-app “dashboard” view for demos.
- Release build note for offline-from-Metro demos.
- **Event Floor:** two **`demo.gif`** assets (one per flow) before calling the events demo catalogue-complete.
- Later: TestFlight/APK (Ditto-style catalogue).

---

## Messaging to Satvik (summary)

Four apps map to logistics, events, public sector, and agriculture. Three map 1:1 to CLI enterprise templates; AgriMesh adds **multi-hop store-and-forward**, which the other three do not show. All demos are honest about **Bluetooth range** (relay phones where yards/venues/fields require it). Staff confidentiality and gate approval are **shown in UI**, not asserted. Sync demos **prove** idempotency in the mock backend.

---

## References

- [Local handoff](https://www.offlineprotocol.com/docs/guides/local-handoff)
- [Backend delivery](https://www.offlineprotocol.com/docs/guides/backend-delivery)
- [Nearby service](https://www.offlineprotocol.com/docs/guides/nearby-service)
- [Shared state / groups](https://www.offlineprotocol.com/docs/guides/shared-state) (Event Floor Flow A)
- [Platforms & transports](https://www.offlineprotocol.com/docs/getting-started/platforms) (BLE limits)
- Repo patterns: `packages/mesh`, `apps/orderup`, `apps/cowrite`
