# Groundwork — Land & Clients

Interactive UI prototype inspired by the Ground Truth field dashboard. The original Ground Truth project remains unchanged.

## Included

- Project directory with search, stage filtering, and project creation.
- Property workspace with illustrative aerial, selectable features, layers, zoom, polygon drawing, image replacement, and two-point calibration.
- Deterministic plan geometry and planting spacing calculations.
- Scope editor with inclusions, descriptions, quantities, sample rates, totals, and print/PDF styling.
- Versioned client-preview snapshot, comments, approval/change requests, and project updates.
- Imperative browser agent tools: `get_land_workspace` and `set_demo_tree_spacing`.

## Prototype boundary

All data is sample data or kept only in the current browser session. Reloading resets changes. Client preview is a simulated role, not an authorization boundary. Telegram and Hermes are not connected. Nothing is emailed or sent externally. No production CRM, client authentication, durable database, surveying service, or client messaging integration is implemented.

The aerial image is AI-generated for a fictional farm. The initial calibration is illustrative, not a real-world measurement of land. User-added images must be top-down and calibrated from a known distance. Shape dimensions are axis-aligned extents, not surveyed dimensions. Pond volumes, soil conditions, engineering, and permitting are outside scope.

Draft edits increment the revision once after a share. A shared proposal stores its own image, geometry, scale, spacing, descriptions, prices, and totals; later edits do not change the client's copy.

## Development

`npm run dev` starts the UI. `npm run build` builds the Sites-compatible Cloudflare Worker. `node --experimental-strip-types --test tests/geometry.test.mjs` exercises measurement, spacing, unscaled input, and snapshot behavior. `npx tsc --noEmit` checks TypeScript.

The two WebMCP contracts were exercised through the supported browser context: read state, valid spacing change and readback, and invalid spacing rejection. General browser screenshot/interaction QA was not performed because it was not requested.
