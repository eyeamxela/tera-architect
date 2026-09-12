# TERA local validation — 11 September 2026

Product naming update: both the local product and public preview now use TERA. The historical mobile release below was version 6; the branding release is recorded at the end of this document.

## Automated checks

- **37 passing tests** via `npm test`: existing geometry, planning, and GIS tests plus real PGlite/Postgres-backed API/service/worker tests.
- Covered role/project authorization, strict draft validation, simultaneous saves, idempotent replay/payload conflict, stale publication, immutable snapshots, internal-note exclusion, exact client revision approval, published-file membership, foreign-file reference attacks, expired/revoked links, HTTP session/origin checks, and disabled production fixture login.
- Covered Telegram duplicate delivery, exact saved requests, lease expiry/reclaim, stale media cleanup, revoked membership, job-bound draft versions, retry exhaustion, interrupted outbox claims, and single application of a simulated Hermes result.
- Filesystem Postgres closes/reopens with its saved data intact. Migration reruns preserve state.
- `npm run check`: TypeScript passes.
- New backend, auth, workspace persistence, team setup, manual packages, files, client-link modules, proxy, and dev runner pass the repository's strict lint rules. This was a scoped lint run, not a clean-lint claim for every inherited UI/component file.
- Required Sites production build succeeds. Vinext reports its existing static route-classification limitation for `/`; the generated API and dynamic client routes are present.
- Dependency installation/audit after compatible security patches reports **zero vulnerabilities**. This is a package advisory check, not a penetration test.
- `git diff --check` passes. Local database/files/secrets and generated bundles are ignored.

## Browser verification

Used the local in-app browser, with the real HTTP proxy and persisted API:

1. Owner login loads the saved workspace.
2. General work-package title edit autosaves and creates a draft distinct from the published revision.
3. Review/publish creates revision 2 and the standalone client URL displays the updated package.
4. An invited local client adds a note to the landscape revision, approves it, and reloads. The saved comment and approved state remain.
5. Owner project totals include both mapped and manual scopes. The general project has no mandatory map/calibration prerequisite.
6. Changing the general project budget from $35,000 to $7,000 and delivery window to 12 months funds one $3,850 package including contingency and defers the $8,316 finish package. The published copy remains unchanged.
7. Team and branding configuration renders with labelled fields and explicit disconnected Telegram status.
8. Inspected the client portal at the browser's narrow width and the workspace at a 1440px desktop viewport. Desktop document width equals viewport width; the temporary viewport override was reset after testing.
9. API health returns 200. Both relative and Vite `/@fs/` requests for `.build-local/share-secret` return 403, without reading the secret into test output.

The local example database intentionally retains the test edits, proposal revision, comment, and approval so the workflow is inspectable. No real client records or messages were used.

## Not yet live-verified

- Supabase Postgres migration against a hosted project, email OTP delivery/session lifecycle, private Storage, and backup/restore.
- Real Telegram webhook registration, real voice transcription, model-generated actions from an installed Hermes runtime, process restart under systemd, and interrupted delivery on the real provider.
- Actual restricted Hermes profile tool exposure. The worker rejects runtimes without advertised durable Runs idempotency; a real adversarial tool-attempt test is still required.
- Production domain, external-client access, HTTPS cookies, and frontend/API proxy secrets. The existing private hosted Site remains the previous prototype.
- PDF print pagination across browsers and a complete accessibility audit.

The worker test substitutes only the remote Hermes/Telegram HTTP responses; database, application commands, authentication guards, leases, and outbox handling run as implemented. It proves the protocol path, not model quality or live provider delivery.

## Deliberately deferred

Telegram project creation; reusable rate-book catalog management; live subscriptions; distributed rate limiting; refresh-token rotation; self-service multi-company onboarding; operational inbox retry/re-route controls; invoice/payment/e-signature integrations; automated photo interpretation or permit/buildability decisions.

No deployment, GitHub push, real bot messages, or cloud resource provisioning occurred during this implementation.

## Mobile pass — 2026-09-11

- Added compact phone section selection, project cards, accessible field-inbox access, wrapping save status, larger editing controls, viewport-aware dialogs, and full-image mobile map framing with tools below the aerial.
- Browser checked local CRM at 320×568, 390×844, 430×932, plus 1440×900 desktop. All seven sections fit the 320px viewport after correcting planning totals and the team-role selector. Manual scope controls, share-dialog scrolling, and map drawing controls were inspected without publishing a new local proposal.
- Production build and TypeScript check passed; all 37 existing tests passed. The broader legacy UI lint run still reports existing unused imports and accessibility issues in page.tsx/views.tsx/land-map.tsx; it is not a clean lint baseline.
- The existing public prototype is being released from the isolated sibling checkout `../land-scope-mobile-preview`, branch `mobile-public-preview`, based on the previous published source. It contains the same mobile presentation improvements and Build branding, retains session-only demo behavior, and has no local CRM data or API access. All six preview sections fit 320px.

Public mobile preview published successfully as Sites version 6, source `27bfb9f90cee6e04e248b97e384ef17af00a6112`, on 2026-09-11. Live URL: https://groundwork-land-clients.eyeamxela.chatgpt.site/. Verified the live page title, preview disclosure, mobile section selector, and 390px page width with no horizontal overflow. The local database-backed CRM was not deployed; its mobile changes remain in this checkout.

## TERA public branding release — 2026-09-11 Pacific

Published the existing public preview as Sites version 7, source `47c967b90afcc9f1112b36c789c0294b5920977e`. Deployment `appgdep_6aa4d5ca66108191877622381585b0c2` succeeded on 2026-09-12 at 04:32 UTC. The existing public URL is https://groundwork-land-clients.eyeamxela.chatgpt.site/. The header, browser title, client portal, demo label, and package metadata use TERA; sample business mastheads use Example Studio. The source build and archive validation passed, and the local preview returned HTTP 200 with the TERA title and wordmark. The existing browser tab was navigated back to the successful deployment URL and visibly showed the TERA page title, header, preview label, and client-portal wordmark. This publication changes the demo branding; the production CRM/backend and GitHub deployment remain separate and pending.

## GitHub source release — 2026-09-12

Repository: https://github.com/eyeamxela/tera (private). The full CRM is on `main`; `mobile-public-preview` preserves the published TERA demo source. TypeScript checks, all 37 existing tests, and the production build passed again before the source release. A bounded review of candidate files and both branch histories found no credential-pattern matches or local CRM data. The tracked TypeScript build cache was removed from the current main tree; local data, private environment files, dependencies, and generated output remain ignored. This is source publication only; no Vercel deployment, production backend setup, or live integration activation is part of this release. Earlier no-push statements in this document describe the historical implementation phases.
