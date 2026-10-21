# Experiment quality implementation plan

Inline execution using superpowers:executing-plans; human routine design/plan approval already explicit. Root owns serial test/build/device queue. Spec: ../specs/2026-10-21-experiment-quality-design.md

## Review focus
Preserve all raw/old comparison/Pro data; no automatic outlier removal; reasons bound to phase/date; invalid visible form never keeps stale preview; zero/duplicate/invalid rows do not imply energy saving; malformed/future review must not overwrite itself; failed SQL mutation must retain old rows; current safe areas, keyboard and window dimensions drive layout.

###1 — Tests first, root observed RED
New tests/experimentQuality.test.mjs imports real future src/experimentQuality.ts. Golden datesOct1..4/Oct5..8 and20→10/10/10/90 establish all−50%, reviewed+50%, sensitivity+100pp after explicitOct8 reason. Assert raw values/IDs remain, flags require no exclusion, missing/duplicates/invalid rows/zero denominators are explicit, UTC offset normalization and strict config failures.
New tests/qualityRepository.test.mjs imports real future src/qualityRepository.ts with temporary node:sqlite database. Actual parameterized SQL read/upsert, roundtrip/default, corrupt/future/trailing existing-row preservation, external replacement after load, SQL-trigger failure and unchanged original measurement/experiment/Pro rows. Node test-only SQLite adapter mirrors getFirstAsync/runAsync/withExclusiveTransactionAsync contract.
Root command cwd checkout: node --experimental-strip-types --test tests/*.test.mjs. Expected RED missing new feature modules; root runtime must support built-in TS stripping and node:sqlite (Node24+). No worker execution/install.

###2 — Pure review model/repository after RED
src/experimentQuality.ts exports types QualityReview/QualityAssessment; defaultQualityReview(experiment), validateQualityReview(value,expectedExperimentId), decodeQualityReview(raw,id), encodeQualityReview(review), assessQualityReview(measurements,review). Interfaces/results pin all-selected/reviewed counts/analysis, missing/duplicate dates, invalid/outlier IDs, outside-selection count, numeric sensitivity ornull and status. All helpers pure and no raw writes.
Keep src/domain.ts body unchanged, only import Measurement as type for pure runtime execution; new TS imports use explicit .ts extension supported by Node/Metro and enable allowImportingTsExtensions in no-emit tsconfig.
src/qualityRepository.ts exposes loadQualityReview(client,id), saveQualityReview(client,review), reviewStateKey(id); rejects unknown existing row inside transaction before upsert. Root repeats full Node GREEN.

###3 — Same Expo/React Native integration for both platforms
src/database.ts adds only load/save quality methods calling pure repository with existing SQLite connection; no old schemas/rows or useProPurchase changes. src/QualityReviewScreen.tsx handles load/retry/error, text-backed draft/current assessment, per-day raw records/exclusion reason editors, all-decision reinstatement and durable save-before-publish. Add qualityStrings DE/EN to i18n.ts.
App.tsx adds quality route selected experiment identity and entry button per existing ExperimentCard from Tests. Preserve existing global analysis, create/free-limit/purchase paths, profile and screenshot-mode gating. SafeAreaProvider wrapper above content; reactive insets bottom nav and current window width content/wrapping; accessible actual controls and keyboard-aware scroll. Root typecheck, full test and Expo native builds; no worker npm/node/prebuild/device runs.

###4 — Review, actual native acceptance and handoff
Root independent read-only review, test-first fixes if findings. Root actual ordinary iPhone/Android/Duo flow with neutral readings (no purchases/restore), window edits/exclusions/reason/save/cold reload/invalid fields, original history+global analysis unchanged. Metadata drafts accurately describe quality worksheet only; CSV/PDF/guaranteed savings not claimed new. Commit locally after root verified code readiness, preserve versions/IAP/workflows; no push/store by worker. Per-app source audit/evidence/hash ledger/native QA/metadata/handoff under Artifacts/StoreOptimization-20261020/WaermeTaktUpdate.
