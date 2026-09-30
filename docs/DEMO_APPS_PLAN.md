# Upcoming Demo apps plan

Planning only — no app scaffolds until implementation starts. Mizan owns Ditto catalogue polish + Atlas CMMS; these four are separate verticals from [Offline Protocol solutions](https://www.offlineprotocol.com/solutions).

## Build order

1. **OutageNet** — template for handoff + mock HQ sync
2. **AgriMesh** — same pattern, agriculture narrative
3. **YardGate** — MeshServices discover / invoke
4. **VenueStaff** — staff dispatch over mesh

## Apps


| App            | `appId`      | User story (short)                                                                    | SDK focus                       |
| -------------- | ------------ | ------------------------------------------------------------------------------------- | ------------------------------- |
| **OutageNet**  | `outagenet`  | Blackout field updates; hand off to teammate; sync once to mock command view          | Local handoff, backend delivery |
| **AgriMesh**   | `agrimesh`   | Off-grid field readings; partner accepts batch; one upload when online                | Same as OutageNet               |
| **YardGate**   | `yardgate`   | Yard with no cell: discover gate check-in service on nearby device, complete check-in | MeshServices                    |
| **VenueStaff** | `venuestaff` | Event staff alert (e.g. medic needed) over mesh when cell saturated                   | Encrypted staff mesh / room     |




## Done bar (each app)

- Two physical phones, README + live script, seeded scenario + reset, domain tests, minimal debug/presenter strip  
- Catalogue polish later: video, installable builds (Ditto-style)



## References

- [Local handoff](https://www.offlineprotocol.com/docs/guides/local-handoff)  
- [Backend delivery](https://www.offlineprotocol.com/docs/guides/backend-delivery)  
- [Nearby service](https://www.offlineprotocol.com/docs/guides/nearby-service)  
- Existing patterns: `packages/mesh`, `apps/stocksync`, `apps/orderup`

