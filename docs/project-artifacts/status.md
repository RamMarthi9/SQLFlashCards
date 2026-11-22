# SQLFlashCards Project Status

Last updated: November 22, 2026.

The working flashcard flow now includes saved topic completion: explicitly mark a topic completed or incomplete, filter the topic list, and reload the saved state when returning to the same browser and origin. All 14 syllabus topics count toward the completion summary; six starter cards cover SELECT, DISTINCT, WHERE, NULL, INNER JOIN, and LEFT JOIN across three topics. The other 11 topics show Content coming soon and cannot be newly completed. SQLFlashCards remains a general SQL learning app, with database-specific syntax labelled when relevant. Review history, scheduling, and proficiency are not yet implemented. The foundation was introduced in commit `59d115f`; subsequent changes are recorded below.

## Completed

- React and strict TypeScript foundation, Vite development/build setup, ESLint, Vitest, and content/learning interaction tests.
- Validated, bundled JSON catalogue with 14 topics, six starter cards, source references, and explicit syllabus mappings.
- Topic selection, question/answer reveal, Definition/Concept/Examples/Syntax panels, and previous/next navigation with safe boundaries.
- Direct card links, browser Back/Forward, missing-content recovery, and transient state reset on navigation or reload.
- Explicit Completed/Incomplete controls on topic and learning screens, All/Completed/Incomplete filters, and a summary over all active syllabus topics. Opening or revealing a card does not change completion.
- Native IndexedDB topic-progress storage, transaction-completion acknowledgements, stale-version conflict handling, focus/visibility refresh, and visible loading/save errors with retry. Reading cards remains available when storage fails; no automatic database reset is used.
- Responsive learning screens using the supplied mockup's lavender/purple visual direction, four coloured tiles, and join diagrams. The mockup's illustrative revision/proficiency values are not displayed as learner data.
- GitHub Actions configuration for type checking, linting, tests, and the production build.
- A documented 14-topic SQL syllabus and example flashcard.
- A separate indexed SQL syllabus with numbered subtopics, learning outcomes, prerequisites, keyword lookup, and researched primary-source references.
- App copy, page metadata, and project guidance aligned with the user's general SQL learning scope.
- The user's Android/web visual reference, plus HLD and LLD documents describing the planned system.
- A single project-artifacts folder, an index, and maintenance guidance for future project work.

## Next implementation step

Expand the reviewed content collection beyond the six starter cards; none of the three populated modules is yet fully authored. Settle what counts as a revision and what feedback to collect before implementing durable review history and counts. Complete any outstanding real-browser persistence and visual checks recorded below before release.

Review recording, revision rules, proficiency scoring, hosting, and Android packaging follow in later stages. See the [LLD delivery sequence](lld.md#delivery-sequence-and-boundaries).

## Open decisions

- How card-level reviews relate to the requested topic revision counter, and which actions qualify as revisions.
- Whether 1, 3, 5, 7, 20, and 30 days are offsets or intervals, including missed reviews and timezone behaviour.
- Proficiency feedback, evidence requirements, scoring thresholds, and policy upgrades.
- Whether the first release needs closed-app reminders, offline launch, or progress export.

The LLD identifies implemented content/reveal interactions and the topic-progress store separately from future review stores and policies. The mockup's revision count of 3 and Intermediate highlight are illustrative values, not learner data; their widgets remain hidden until the relevant features exist. Completion is a learner's explicit choice, not a proficiency score or a claim that the whole curriculum has been authored.

## Verification record

| Date | Evidence | Result and scope |
| --- | --- | --- |
| November 19, 2026 | Local `npm.cmd run check` against the Stage 1 code in this session. | Type checking, ESLint, one Vitest test, and the production build passed. This validates the foundation, not future learning features. |
| November 19, 2026 | Artifact consolidation and documentation review. | The five existing artifacts were moved with matching SHA-256 hashes before updating location guidance. Cross-links and repository references were checked. No application code changed and no application tests were rerun for this documentation-only task. |
| November 19, 2026 | Pre-publication documentation checks. | All 27 local documentation links across 9 Markdown files resolved, including heading anchors; `git diff --check` passed. The publication changes contain only project documentation, the supplied mockup, and maintenance instructions. |
| November 19, 2026 | [GitHub Actions run 44578008968](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/44578008968) for artifact commit `e1afa89`. | The Checks workflow completed successfully, including type checking, linting, tests, and the production build. This result belongs to that commit; use the publication PR for the latest head's checks. |
| November 21, 2026 | Local validation after correcting the SQL learning scope. | `npm.cmd run check` passed type checking, linting, one Vitest test, and the production build. All 27 local documentation links passed; diff whitespace checks passed. Source/document review found no remaining engine-default product wording, and the original mockup's SHA-256 hash is unchanged. |
| November 21, 2026 | Indexed syllabus and reference review. | Confirmed 14 modules and 74 unique subtopic IDs, reviewed primary references and database-specific qualifications, and verified all 64 local documentation links across 10 Markdown files, including heading anchors. `git diff --check` passed. This change contains only documentation; application checks were not rerun locally. |
| November 21, 2026 | First working flashcard flow: local automated and serving checks. | `npm.cmd run check` passed strict type checking, ESLint, 43 tests across two files, and the production build. Tests cover reveal/hide, all four panels, close-focus restoration, navigation bounds, history/reload resets, invalid routes, load retry, empty content, and catalogue validation. Six displayed SQL examples produced their expected results in test-only in-memory SQLite; this is one-engine verification, not a universal compatibility claim. Development HTML and the latest production HTML/JS/CSS returned HTTP 200. All 72 local documentation links passed; whitespace checks passed; the original mockup's Git object hash is unchanged. |
| November 22, 2026 | Saved topic completion: local automated checks and documentation validation. | `npm.cmd run check` passed strict type checking, ESLint, 75 tests across four files, and the production build. This includes 14 progress UI tests and 18 IndexedDB adapter tests covering persisted completion/incompletion across fresh connections, explicit actions, filters, empty/retired topics, retry, concurrent-tab conflicts, transaction aborts, malformed data, blocked opens, version changes, and keyboard focus after filtered-card removal. These use test-only `fake-indexeddb`, not a native browser. All 73 local documentation links across 10 Markdown files resolved; `git diff --check` passed. The original mockup is unchanged. |

The user manually tested the first flashcard flow and reported that it worked before this persistence change. That feedback does not verify the new saved-progress feature. Real-browser refresh/close-and-reopen, visual, keyboard, and viewport checks remain unverified for this stage: the browser inventory was empty and reported that the browser access host was unavailable. Simulated IndexedDB and automated interaction tests do not establish real-browser persistence or visual correctness. Deployment and Android device testing are outside this stage. The November 22 npm install audit reported 0 vulnerabilities across 252 packages; the README retains that dated result instead of treating the earlier November 18 advisory as a current audit.

## GitHub publication

The artifact collection and maintenance instructions were merged into `main` through [pull request 2](https://github.com/RamMarthi9/SQLFlashCards/pull/2) on November 21, 2026, at merge commit `b65673e784b67cf0d4e988cbd8f7714a6d988f79`. Its [post-merge Checks run](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/44935488723) passed type checking, linting, tests, and the production build.

The first working flow and its accompanying artifacts were merged into `main` through [pull request 3](https://github.com/RamMarthi9/SQLFlashCards/pull/3), after PR 2's successful merge was checked, at commit `396aca6bb56793a763f93ea6dc2bf93acd0bc54e`. Its [post-merge Checks run](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/44935808876) passed. The local project was updated to that main branch while preserving the user's uncommitted README edit.

Saved topic completion and its affected artifacts are published in [pull request 4](https://github.com/RamMarthi9/SQLFlashCards/pull/4), from `feat/topic-progress` into `main`. The first [Checks run](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/45049490069) found a keyboard-focus timing failure despite passing local checks: the filtered topic disappeared before the passive focus effect ran. Focus restoration now runs during the layout commit, before paint. The corrected implementation at `efca0492a4fbe6a12e056fb6d4ed5b708b9a8b25` passed [Checks run 45049819464](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/45049819464), including all 75 tests, on November 22, 2026. The PR page records checks for subsequent documentation-only commits and its final review state; this feature has not been merged or deployed. The user's original README formatting edit remains local and uncommitted.

## Change history

| Date | Change |
| --- | --- |
| November 19, 2026 | Captured the user's visual direction and created the HLD and LLD. |
| November 19, 2026 | Consolidated the designs, syllabus, architecture, and original mockup in this folder; added an index, status record, and maintenance instructions. |
| November 19, 2026 | Added the requested daily maintenance rule: append history on days the project changes, update affected designs in place, and publish artifact updates with the related GitHub changes. |
| November 19, 2026 | Published the collection in GitHub PR 2 and recorded the successful checks for its initial artifact commit. |
| November 21, 2026 | Corrected the app, page/package descriptions, syllabus, HLD, LLD, architecture, and maintenance guidance to teach SQL broadly, with database-specific examples labelled where relevant. Preserved the original mockup and existing learning-feature scope. |
| November 21, 2026 | Added a separately indexed SQL curriculum with source references, preserving the 14-module structure. Expanded the detailed scope to include set intersection/difference and basic views, and linked the index from the syllabus, HLD, LLD, artifact index, and repository README. |
| November 21, 2026 | Implemented the first content/reveal flow with six starter cards, a 14-topic list, runtime content validation, hash navigation, inline learning sections, and mockup-based styling. Updated the designs, syllabus inventory, and README test instructions; progress, review, scheduling, and proficiency remain later stages. |
| November 21, 2026 | Verified PR 2's successful merge into main and passing post-merge checks, then retargeted PR 3 to main for the separately requested second merge. Updated this publication record in PR 3; the PR pages retain the exact merge outcomes and checks. |
| November 22, 2026 | Added explicit completed/incomplete topic tracking, filters, active-syllabus coverage, local IndexedDB persistence, stale-write protection, and retry handling. Updated the HLD, LLD, architecture, syllabus, artifact index, and README with the implemented boundaries and persistence test steps; the original mockup and SQL curriculum content are preserved. Published PR 4 and corrected the keyboard-focus timing failure found by its initial CI run. Verification and publication evidence are recorded above. |

Update this record as project work progresses, replacing stale current-state statements and adding actual verification evidence. Keep design-document completion separate from implemented application functionality.
