# Upcoming demo apps plan

Planning only — no app scaffolds until implementation starts.

**Owner:** Ankush (these four). **Mizan:** existing Ditto catalogue (Stock Sync, Order Up, Cowrite, Tic Tac Together) + Atlas CMMS.

**Home:** [offline-app-examples](https://github.com/Offline-Protocol/offline-app-examples), MIT-0 like the other apps. Target **eight** working demos on docs/website when these ship.

**SDK:** Mesh SDK **0.27.0** only. Demo copy and narration say **Bluetooth mesh** — not Wi‑Fi Direct or “any radio” (phone Wi‑Fi carries no data in 0.27).

**CLI alignment:** Build from the enterprise starter templates the CLI generates where possible — proves templates produce real apps.

| App | CLI / template lane |
| --- | --- |
| YardGate | Nearby service discovery + invoke |
| VenueStaff | Encrypted group messaging |
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
| VenueStaff | **3** | Staff sender → **attendee/stranger relay** (cannot read) → staff receiver |

---

## Build order

1. **OutageNet** — handoff, accept, outbox, idempotent mock HQ (template for sync honesty)
2. **YardGate** — MeshServices + gate role + relay phone
3. **VenueStaff** — MLS group + OfflineID staff enrollment + relay
4. **AgriMesh** — multi-hop batch carry (depends on comfort with group/relay from VenueStaff)

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

## 2. VenueStaff (organiser + ticketing platform)

**Site vertical:** [Live events](https://www.offlineprotocol.com/solutions/events) — staff ops **and** platform gate sync (e.g. [TicketingHub](https://www.ticketinghub.com/en-US) commercial interest: scanners sharing check-ins offline).

**Two demo paths (same SDK, different UI story):**

| Path | Buyer | Proves |
| --- | --- | --- |
| **A — Staff ops** | Event organiser | MLS staff group + OfflineID; medic/security dispatch over crowd relay |
| **B — Gate sync** | Ticketing platform / POS | Shared **admission ledger** across 2–3 gate scanners over Bluetooth mesh; idempotent ingest to mock TH API |

Path B is the Carl/TicketingHub workflow; see `docs/TICKETINGHUB_SCOPE.md`. Path A stays the public “VenueStaff” narrative on the website.

**Purpose (Path A):** Cell saturated; **staff-only** coordination over **Bluetooth mesh**, including when traffic **relays through a non-staff phone**.

**Roles:**

| Role | Device | Behavior |
| --- | --- | --- |
| Staff sender | Phone A | OfflineID **staff** session; sends e.g. “Medic needed, Section B” in **MLS encrypted group** |
| Relay | Phone B | Forwards mesh traffic; **must not decrypt** staff payload |
| Staff receiver | Phone C | OfflineID staff; receives and acks alert |

**User experience:** “I'm security. I send an alert. Another staff phone gets it even when the tower is useless. If the packet hops through a random attendee phone, that phone **still can't read** the message — that's the point vs public mesh chat.”

**Proves:** Encrypted group messaging + **OfflineID sign-in** for staff roster; relay + confidentiality.

**Implementation note:** Use encrypted group (`group: true` / MLS group), not a open room. Document seeded staff accounts for the demo reset.

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
- Later: video, TestFlight/APK (Ditto-style catalogue).

---

## Messaging to Satvik (summary)

Four apps map to logistics, events, public sector, and agriculture. Three map 1:1 to CLI enterprise templates; AgriMesh adds **multi-hop store-and-forward**, which the other three do not show. All demos are honest about **Bluetooth range** (relay phones where yards/venues/fields require it). Staff confidentiality and gate approval are **shown in UI**, not asserted. Sync demos **prove** idempotency in the mock backend.

---

## References

- [Local handoff](https://www.offlineprotocol.com/docs/guides/local-handoff)
- [Backend delivery](https://www.offlineprotocol.com/docs/guides/backend-delivery)
- [Nearby service](https://www.offlineprotocol.com/docs/guides/nearby-service)
- [Shared state / groups](https://www.offlineprotocol.com/docs/guides/shared-state) (VenueStaff)
- [Platforms & transports](https://www.offlineprotocol.com/docs/getting-started/platforms) (BLE limits)
- Repo patterns: `packages/mesh`, `apps/orderup`, `apps/cowrite`
