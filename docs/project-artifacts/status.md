# SQLFlashCards Project Status

Last updated: November 19, 2026.

The application is at Stage 1: a static home screen and development/check tooling. The architecture, HLD, LLD, syllabus, and supplied mockup are documented; the learning experience remains to be implemented. The current code baseline is commit `59d115f`, the Stage 1 merge.

## Completed

- React and strict TypeScript foundation, Vite development/build setup, ESLint, Vitest, and a home-screen test.
- GitHub Actions configuration for type checking, linting, tests, and the production build.
- A documented 14-topic PostgreSQL syllabus and example flashcard.
- The user's Android/web visual reference, plus HLD and LLD documents describing the planned system.
- A single project-artifacts folder, an index, and maintenance guidance for future project work.

## Next implementation step

Build the first usable learning flow with a small validated content collection: choose a topic, read a question, reveal the answer, open Definition/Concept/Examples/Syntax sections, and navigate between cards. Follow the mockup's visual direction and the LLD's component boundaries.

Local progress, review recording, revision rules, proficiency scoring, hosting, and Android packaging follow in later stages. See the [LLD delivery sequence](lld.md#delivery-sequence-and-boundaries).

## Open decisions

- How card-level reviews relate to the requested topic revision counter, and which actions qualify as revisions.
- Whether 1, 3, 5, 7, 20, and 30 days are offsets or intervals, including missed reviews and timezone behaviour.
- Proficiency feedback, evidence requirements, scoring thresholds, and policy upgrades.
- Whether the first release needs closed-app reminders, offline launch, or progress export.

The LLD proposes specific screen interactions and contracts. These are design proposals until implemented or confirmed through the corresponding project work. The mockup's revision count of 3 and Intermediate highlight are illustrative values, not learner data.

## Verification record

| Date | Evidence | Result and scope |
| --- | --- | --- |
| November 19, 2026 | Local `npm.cmd run check` against the Stage 1 code in this session. | Type checking, ESLint, one Vitest test, and the production build passed. This validates the foundation, not future learning features. |
| November 19, 2026 | Artifact consolidation and documentation review. | The five existing artifacts were moved with matching SHA-256 hashes before updating location guidance. Cross-links and repository references were checked. No application code changed and no application tests were rerun for this documentation-only task. |
| November 19, 2026 | Pre-publication documentation checks. | All 27 local documentation links across 9 Markdown files resolved, including heading anchors; `git diff --check` passed. The publication changes contain only project documentation, the supplied mockup, and maintenance instructions. |
| November 19, 2026 | [GitHub Actions run 44578008968](https://github.com/RamMarthi9/SQLFlashCards/actions/runs/44578008968) for artifact commit `e1afa89`. | The Checks workflow completed successfully, including type checking, linting, tests, and the production build. This result belongs to that commit; use the publication PR for the latest head's checks. |

Browser visual testing, deployment, and Android device testing have not been verified in this documentation work. The repository README separately records a dependency advisory dated November 18, 2026; that audit was not rerun here.

## GitHub publication

The artifact collection and maintenance instructions were published through [pull request 2](https://github.com/RamMarthi9/SQLFlashCards/pull/2), from `docs/project-artifacts` into `main`. The PR records the current review/merge state and checks for its latest commit. Future project changes should include affected artifact updates and a dated history entry through the same branch-and-PR workflow.

## Change history

| Date | Change |
| --- | --- |
| November 19, 2026 | Captured the user's visual direction and created the HLD and LLD. |
| November 19, 2026 | Consolidated the designs, syllabus, architecture, and original mockup in this folder; added an index, status record, and maintenance instructions. |
| November 19, 2026 | Added the requested daily maintenance rule: append history on days the project changes, update affected designs in place, and publish artifact updates with the related GitHub changes. |
| November 19, 2026 | Published the collection in GitHub PR 2 and recorded the successful checks for its initial artifact commit. |

Update this record as project work progresses, replacing stale current-state statements and adding actual verification evidence. Keep design-document completion separate from implemented application functionality.
