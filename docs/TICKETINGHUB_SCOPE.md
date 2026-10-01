# Technical scope (draft): Offline gate sync for TicketingHub

---

## 1. Problem and goal

**Today (per Carl):** TicketingHub gate/POS devices **do not share check-ins with each other when connectivity is unavailable**. Each scanner operates in isolation until a link returns, which creates duplicate-entry risk, inconsistent capacity counts, and operational friction at peak load.

**Goal:** During an outage or saturated network, **nearby gate scanners share admission state over a Bluetooth mesh** so that when one gate scans a ticket, **other gates in mesh range treat that ticket as used** without a live round trip to TicketingHub. When **any** device regains connectivity, **scan records sync back once** to TicketingHub’s backend (system of record), with **stable scan IDs** so retries do not double-count revenue or attendance.

**Reference workflow (evaluation demo):**

1. Two or three gate scanners at one venue run TicketingHub POS (or a reference scanner build).
2. Cellular/Wi‑Fi to TicketingHub is **unavailable** (airplane mode or simulated outage).
3. Scanner A admits ticket `T-1001`; admission replicates to Scanner B (and C if present) over **Bluetooth mesh** within seconds.
4. Scanner B scans `T-1001` → **already used** (policy: reject or supervisor override — configurable).
5. Connectivity returns on one scanner → batched scan records POST to TicketingHub with **idempotency keys**; dashboard shows **one** admission per ticket.

This aligns with the ticketing section on our [events solutions page](https://www.offlineprotocol.com/solutions/events) (gate scanning, shared scan state, fraud/duplicate handling, ticketing system integration).

---



## 2. Audience: organiser vs ticketing platform


| Layer                       | Who         | Role                                                               |
| --------------------------- | ----------- | ------------------------------------------------------------------ |
| **Platform (TicketingHub)** | Carl’s team | Issuer of truth for inventory, bookings, APIs, POS product roadmap |
| **Operator / organiser**    | TH customer | Runs the event; may not build software                             |
| **Gate staff**              | End users   | Scan tickets on POS/handheld                                       |


This scope targets **TicketingHub as platform**: a **reusable offline gate module** embedded in (or paired with) TH POS, not a one-off for a single festival organiser. Organisers benefit automatically when TH ships the capability.

---



## 3. Architecture (logical)

```text
┌─────────────────────────────────────────────────────────────┐
│  TicketingHub cloud (system of record)                      │
│  Bookings, inventory, reporting, reseller/OTA sync          │
└──────────────────────────▲──────────────────────────────────┘
                           │ HTTPS when available
                           │ (idempotent scan ingest API)
┌──────────────────────────┴──────────────────────────────────┐
│  Gate scanner A          Gate scanner B          (Gate C)   │
│  ┌──────────────────┐   ┌──────────────────┐                │
│  │ TH POS / scan UI │   │ TH POS / scan UI │                │
│  │ + local outbox   │   │ + local outbox   │                │
│  │ + admission store│◄─►│ + admission store│  Bluetooth mesh│
│  └────────┬─────────┘   └────────┬─────────┘  (multi-hop)   │
│           └────────── Offline Protocol Mesh SDK ────────────┘
└─────────────────────────────────────────────────────────────┘
```

**Transport (v0.27):** **Bluetooth LE mesh** between scanners (multi-hop where gates are not in direct range). Demo and production copy should **not** rely on phone Wi‑Fi Direct for data (no payload on that transport in SDK 0.27).

**Data on mesh (evaluation phase):** Replicated **admission ledger** per event (ticket or booking ID + scan metadata + scanner ID + timestamp + stable `scanId`). Matches SDK **edge sync** / shared document patterns described on the events page.

**Optional later:** Offline cryptographic ticket verification (issuer-signed ticket, holder device challenge) — see §7 Phase 2.

---



## 4. Integration points


| #   | Boundary                           | Direction                  | Content                                                                                                            |
| --- | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| I1  | **Ticket presentation**            | Guest → Scanner            | QR/barcode/NFC payload TH POS already reads                                                                        |
| I2  | **Online validation (baseline)**   | Scanner → TH API           | Current behavior when online (reference for parity)                                                                |
| I3  | **Offline admission ledger**       | Scanner ↔ Scanner          | Mesh-synced “admitted ticket IDs” + metadata for event `E`                                                         |
| I4  | **Scan ingest (offline catch-up)** | Scanner → TH API           | Batch or single records: `scanId`, `ticketId`, `eventId`, `gateId`, `scannedAt`, `deviceId`, optional `operatorId` |
| I5  | **Event bootstrap**                | TH → Scanner               | Before doors: event config, ticket list or validation keys, gate roster (download while online)                    |
| I6  | **Auth**                           | TH → Scanner               | API credentials / device enrollment for ingest endpoint (secrets stay in TH app; not in mesh RPC plaintext)        |
| I7  | **Identity (optional Phase 2)**    | Offline Protocol OfflineID | Staff vs attendee roles; holder-bound tickets                                                                      |


---



## 5. What Offline Protocol would build (evaluation → pilot)

**A. Reference integration**

- **Gate sync module** (documented pattern for embedding `@offline-protocol/mesh-sdk` in a React Native POS):
  - Local **durable outbox** for scans pending upload
  - **Mesh-synced admission map** for the active event session
  - **Idempotent ingest client** (retries, duplicate suppression UI for operators)
- **Reference UI slice** (can ship in `offline-app-examples` as **GateScan** or extend **VenueStaff** ticketing path): 2–3 phones, seeded tickets, mock TH ingest endpoint for demo/video
- **Scope document + API contract** for I4/I5 (this doc + OpenAPI sketch for scan ingest)
- **Telemetry hook** (opt-in): hop count, sync latency — for post-event review per events FAQ

**B. Not in initial evaluation (unless explicitly scoped)**

- Full OfflineID holder binding and anti-screenshot challenge flow (Phase 2)
- Proof of Location for gate check-in (excluded — server-side POL immature)
- TicketingHub dashboard UI changes (TH-owned)
- OTA/reseller channel logic (TH-owned; we only deliver accurate scan facts)

**C. Deliverables Carl can see without committing to POS merge**

- Working **multi-scanner offline demo** (video + repo)
- **Integration guide** for TH engineering: embed points, lifecycle, battery/relay notes
- **Sample ingest API** TH can mirror in sandbox

---



## 6. What TicketingHub would provide


| Session                             |     | TH inputs needed                                                                                                                                                                                  |
| ----------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session 1 — Contract & fixtures** |     | Sandbox API access; sample event + 50–200 test tickets; current QR payload spec; desired duplicate policy (hard reject vs override); gate/device ID scheme; point of contact for POS architecture |
| **Session 2 — Validation**          |     | Dev or staging POS build (or TH engineer on reference app); run scripted outage test; confirm ingest records appear correctly in TH dashboard/reporting                                           |


**Async:**

- Written answers to §8 open questions (can be bullet form)
- Confirmation of **legal/licensing** path (AGPL vs commercial Mesh SDK license for proprietary POS)

**TH does not need to build** the mesh layer, MLS, or relay logic — that stays in the SDK and reference module.

---



## 7. Phased capability (manage TH engineering risk)


| Phase                         | Capability                                                       | TH effort                                 | OP effort                    |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------- | ---------------------------- |
| **0 — Demo**                  | Shared check-in between 2–3 reference scanners; mock ingest      | Review only                               | Reference app + doc          |
| **1 — MVP (Carl’s priority)** | POS embed: offline scan + mesh share + idempotent sync to TH API | 2 sessions + sandbox ingest endpoint      | Integration module + support |
| **2 — Authentication**        | Issuer-signed tickets; optional holder device challenge          | Ticket signing pipeline + POS verify hook | SDK identity patterns + doc  |
| **3 — Revenue / resale**      | Reconcile admissions vs sales channels using synced scan ledger  | Reporting + business rules                | Stable scan schema only      |


**Recommendation:** Commit evaluation scope to **Phase 0 → 1** only. Phase 2+ as follow-on once POS roadmap stabilizes (Carl’s concern about new POS).

---



## 8. Open questions (drive effort and timeline)

1. **POS stack:** Is new POS React Native, native iOS/Android, or hybrid? (Determines embed vs sidecar “mesh companion” app.)
2. **Offline behavior today:** What is stored locally when offline (full booking cache vs scan queue only)?
3. **Ticket identifier:** Single canonical ID for mesh ledger (`bookingId`, `ticketUuid`, barcode string)?
4. **Online validate API:** Existing endpoint and response schema to mirror offline?
5. **Scan ingest:** New webhook/REST batch endpoint, or extension of an existing API? Required idempotency header/field?
6. **Gate topology:** Typical gates per venue; need for **3+ device relay** (distance > ~30 m BLE)?
7. **Hardware:** Consumer phones only, or dedicated scanners (Zebra, etc.) — BLE support?
8. **Policy:** Duplicate scan at two gates during partition — auto-deny, flag for review, or last-writer-wins?
9. **Multi-event:** One mesh per event or concurrent events on same device?
10. **Commercial license:** Will TH POS ship as proprietary App Store app (commercial SDK license)?

---



## 9. Effort summary (indicative, pending §8)


| Item                                  |
| ------------------------------------- |
| OP reference demo + ingest contract   |
| OP embed module + TH sandbox wired    |
| TH ingest endpoint + sandbox fixtures |
| TH POS integration                    |


**Carl’s constraint (“see how POS develops”):** Phase 0 demo and ingest contract can proceed **without** production POS merge; TH integrates when new POS reaches extension point (Session 2 on reference or alpha POS).

---



## 10. Success criteria (evaluation complete)

- [ ] Scanner B shows ticket admitted on A within **≤ N seconds** (target TBD at venue rehearsal) with no cloud connectivity.
- [ ] Duplicate scan attempt on B surfaces clear operator message.
- [ ] After reconnect, TH receives **exactly one** ingest record per `scanId` in acceptance tests (including dual-scanner retry scenario).
- [ ] TH engineering confirms **≤ two sessions** sufficient for integration kickoff given chosen embed path.

---



## 11. Next step

Share answers to §8 (even partial). Offline Protocol schedules **Session 1** and delivers Phase 0 demo link + ingest OpenAPI draft for TH review.