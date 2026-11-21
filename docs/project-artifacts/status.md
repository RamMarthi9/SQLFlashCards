# SQLFlashCards Project Status

Last updated: November 21, 2026.

The first working flashcard flow is implemented on the Stage 1 foundation: choose a topic, reveal an answer, open four learning sections, and navigate between cards. All 14 syllabus topics are listed; six starter cards cover SELECT, DISTINCT, WHERE, NULL, INNER JOIN, and LEFT JOIN across three topics. The other 11 topics show Content coming soon. SQLFlashCards remains a general SQL learning app, with database-specific syntax labelled when relevant. Progress storage, reviews, scheduling, and proficiency are not yet implemented. The foundation was introduced in commit `59d115f`; subsequent changes are recorded below.

## Completed

- React and strict TypeScript foundation, Vite development/build setup, ESLint, Vitest, and content/learning interaction tests.
- Validated, bundled JSON catalogue with 14 topics, six starter cards, source references, and explicit syllabus mappings.
- Topic selection, question/answer reveal, Definition/Concept/Examples/Syntax panels, and previous/next navigation with safe boundaries.
- Direct card links, browser Back/Forward, missing-content recovery, and transient state reset on navigation or reload.
- Responsive learning screens using the supplied mockup's lavender/purple visual direction, four coloured tiles, and join diagrams. The mockup's illustrative revision/proficiency values are not displayed as learner data.
- GitHub Actions configuration for type checking, linting, tests, and the production build.
- A documented 14-topic SQL syllabus and example flashcard.
- A separate indexed SQL syllabus with numbered subtopics, learning outcomes, prerequisites, keyword lookup, and researched primary-source references.
- App copy, page metadata, and project guidance aligned with the user's general SQL learning scope.
- The user's Android/web visual reference, plus HLD and LLD documents describing the planned system.
- A single project-artifacts folder, an index, and maintenance guidance for future project work.

## Next implementation step

Implement explicit topic completion and IndexedDB persistence, including save/reload and failure handling. Continue expanding the reviewed content collection beyond the six starter cards; none of the three populated modules is yet fully authored.

Review recording, revision rules, proficiency scoring, hosting, and Android packaging follow in later stages. See the [LLD delivery sequence](lld.md#delivery-sequence-and-boundaries).

## Open decisions

- How card-level reviews relate to the requested topic revision counter, and which actions qualify as revisions.
- Whether 1, 3, 5, 7, 20, and 30 days are offsets or intervals, including missed reviews and timezone behaviour.
- Proficiency feedback, evidence requirements, scoring thresholds, and policy upgrades.
- Whether the first release needs closed-app reminders, offline launch, or progress export.

The LLD identifies the implemented content/reveal interactions separately from future review and storage contracts. The mockup's revision count of 3 and Intermediate highlight are illustrative values, not learner data; their widgets remain hidden until the relevant features exist.

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

Real-browser visual, keyboard, and viewport checks remain unverified: the browser automation host was unavailable, and native Chrome recovery failed to activate the window and obtain input geometry. Automated interaction tests do not establish visual correctness. Deployment and Android device testing are outside this stage. The repository README separately records a dependency advisory dated November 18, 2026; that audit was not rerun here.

## GitHub publication

The artifact collection and maintenance instructions were merged into `main` through [pull request 2](https://github.com/RamMarthi9/SQLFlashCards/pull/2) on November 21, 2026, at merge commit `b65673e784b67cf0d4e988cbd8f7714a6d988f79`. Its [post-merge Checks run](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/44935488723) passed type checking, linting, tests, and the production build.

The first working flow and its accompanying artifacts are tracked in [pull request 3](https://github.com/RamMarthi9/SQLFlashCards/pull/3), from `feat/flashcard-flow` into `main`. It was retargeted after PR 2's merge was verified, following the user's request for two separate merges in order. The PR page records its final merge state, exact commit, and checks. Future changes should include affected artifacts and dated history through the same branch-and-PR workflow.

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

Update this record as project work progresses, replacing stale current-state statements and adding actual verification evidence. Keep design-document completion separate from implemented application functionality.
