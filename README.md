# Surplus Relay

A working prototype that connects food donors, volunteer riders and receiving organizations. It is a real Node server with realtime updates, not a static mockup. There are no npm dependencies.

## Run

Requires Node 18 or newer.

```
npm start
```

Open http://localhost:3000. Demo data is freshly seeded on every start, so demo donations are never already expired. Timers live on the server and survive browser refreshes. To keep saved data across restarts, start with `KEEP_DATA=1 npm start`. Admin can also reset the demo data from the Simulation Lab. The Log in page lists every demo account with a one-click Sign in button.

## Demo accounts (password: demo1234)

| Role | Email |
|---|---|
| Donor | donor@demo.test (Shree Kitchen), donor2@demo.test |
| Rider | rider@demo.test, rider2@demo.test, rider3@demo.test (Shree Kitchen), rider4@demo.test (Annapurna) |
| Receiver | receiver@demo.test (Asha Shelter), receiver2@demo.test, receiver3@demo.test |
| Admin | admin@demo.test |

## Try the main flow

1. Receiver: Emergency, inspect Shree Kitchen, request 40 meals.
2. Donor (second browser window): urgent alert appears, press Accept.
3. Riders: each assigned rider accepts. Receiver confirms rider assistance.
4. Riders start and deliver. Receiver confirms receipt.
5. Admin: open Simulation Lab to test failure, delay, expiry and reassignment.

## Architecture

- `engine.js`: all business rules, state machines, matching, timers, simulations. Pure and testable.
- `server.js`: HTTP API, role checks, Server Sent Events for realtime, JSON file persistence, 1 second timer tick.
- `public/`: single page app (vanilla JS) with hash routing, an inline SVG icon set and CSS.

Every API call is validated in the engine, so the UI cannot bypass rules. The browser only renders server state.

## Business rules

- A match is valid only if: category accepted, current demand exists, cooking items need water and fuel, refrigerated items need cold storage, route (pickup plus delivery) finishes before expiry minus the safety buffer, arrival falls inside receiving hours, and riders can carry the quantity.
- Riders must be verified, available, within their service radius and associated with the donor. One rider is used if capacity allows (fastest first), otherwise the quantity is split across riders.
- Ranking of receivers: demand fill, distance, expiry slack, occupancy pressure.
- Timers (configurable in Simulation Lab): donor approval, receiver confirmation, rider reservation, delay timeout, safety buffer, speed, traffic.
- Timeouts release the quantity and riders, notify users and suggest the next best option. An unconfirmed receiver triggers reassignment to the best other receiver only if delivery is still feasible.
- Rider failure, unresponsiveness or long delay triggers replacement riders for that quantity, or returns it to the donor.
- Invalid status changes are rejected. Each donation, request and assignment keeps a timeline, and the admin audit log records every transition.

## Tests

```
npm test
```

Unit tests cover compatibility, splitting, the full workflow, expiry, timeouts, reassignment, rider recovery, invalid transitions and role checks.

## Known limits

- Browser end to end tests are not included. The full workflow is covered at engine level.
- The map is a distance ring view and a table, with no tile map, so it works offline.
- Fonts load from Google Fonts and fall back to Georgia and system sans offline.
- Passwords use a fixed salt hash and there is no rate limiting. Do not use as is in production.
