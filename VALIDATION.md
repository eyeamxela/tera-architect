# TERA Architect validation

Verified locally on 13 September 2026, using Node 22.23.2.

## Passed

- `npm run check`: TypeScript completed without errors.
- `npm test`: **45 tests passed, 0 failed**. This includes the 37 inherited geometry, planning, GIS, API, permission and worker regression tests plus 8 architect-edition tests.
- Sites production build helper (`build-site.mjs`, invoking `npm run build`): passed. Frontend, API proxy and client share routes compiled. Vinext emits its existing informational route-classification notice.
- Local UI readiness: `http://localhost:3010/` returned HTTP 200. API started on loopback port 4312 with persistent local storage.
- Read-only integration review found no remaining critical issue in the examined pricing, persistence, authorization and publication paths after fixes.
- `git diff --check`: passed.

## Architect-edition coverage

- All 15 nonempty combinations of land, architecture, interiors and furniture.
- Excluding a module removes its estimates and tax while preserving its private draft.
- Nullable prices/quantities remain unpriced; an explicit zero is accepted.
- Mixed mapped land, manual common and discipline lines reconcile to one subtotal.
- Currency rounding, selected-line tax and one contingency calculation; budget gaps do not silently delete scope.
- Parallel timing, procurement lead times, dependency chains, unknown predecessor timing and circular-dependency rejection.
- Malformed variables, non-finite/negative values, duplicate selections and reserved-ID collisions rejected.
- Blank startup and creation without demo prices or property imagery.
- Save/reload through a real local database close/reopen preserves specifications and inactive drafts.
- Leads may edit assigned drafts; crew cannot; only the owner publishes.
- Inactive briefs, furniture notes and land metadata/imagery are absent from the entire client DTO.
- Later draft edits leave published specifications, estimates and hashes unchanged.
- New module data survives the shared UI/Hermes strict draft contract.

## Verification boundaries

No browser interaction, screenshot/visual inspection, physical-device testing or print-layout QA was performed. Responsive styles are implemented, but this document does not claim a mobile visual pass. The readiness request only verifies an HTTP response. Local startup remains blank; test projects are created in temporary test databases, then removed.

No Vercel/Cloudflare production release, DigitalOcean provisioning, Supabase production instance, live email, bot webhook or Hermes session was activated for this edition. Protocol tests do not prove live connectivity. The original TERA published site is a separate deployment and is not modified by this fork.

Rates, quantities, tax applicability, contractor timing, regulations and professional approvals are supplied by the project team. No market quote, survey certification, permit, executable blueprint, BIM model or guaranteed investment return is generated here.

The committed CI workflow repeats install, TypeScript checks, tests and build on GitHub. The local results above do not imply a hosted CI run has completed; consult the repository Actions status for that separate result.
