# SQLFlashCards Project Artifacts

This folder is the canonical home for the project's design documents, learning scope, visual references, and progress record. Maintain these artifacts alongside future project changes so they describe both the working app and the agreed next steps accurately.

| Artifact | What it contains | Update when |
| --- | --- | --- |
| [Project status](status.md) | Completed work, next step, open decisions, verification evidence, and change history. | A stage progresses, a decision is resolved, or verification results change. |
| [High level design](hld.md) | System components, responsibilities, data flow, and planned web/Android delivery. | System scope, component boundaries, or delivery choices change. |
| [Low level design](lld.md) | Screens, component contracts, data structures, storage transactions, failure handling, and tests. | Implementation details or interactions are decided or changed. |
| [Architecture](architecture.md) | Agreed technical direction, implementation boundaries, and mockup interpretation. | Architecture decisions or implemented-stage boundaries change. |
| [Planned syllabus](syllabus.md) | The 14-topic PostgreSQL learning scope and example card. | Topic scope, coverage semantics, or educational requirements change. |
| [App mockup](app-design-reference.png) | The user's visual reference for Android and web. | The user supplies or approves a revised visual reference. |

The HLD and LLD describe planned features as well as the current foundation; they are not claims that the full application exists. Start with [Project status](status.md) to see what is implemented. Local run commands and setup instructions remain in the [repository README](../../readme.md).

## Maintenance workflow

1. Read the current status and relevant design artifacts before changing the app.
2. Update affected artifacts in the same change as code, requirements, or decisions. Reconcile HLD, LLD, architecture, and syllabus where a decision spans more than one document.
3. Keep implemented behaviour, proposed choices, and unresolved decisions distinct. Update earlier descriptions when a planned feature is implemented.
4. Record meaningful progress and actual verification results in status.md, including the date and any checks not performed. Add a short change-history entry without inventing test evidence or a completion percentage.
5. Keep one canonical copy of each artifact here. Preserve the original mockup; add a clearly named replacement when a new reference is supplied and identify which reference is current.
6. Update this index and all inbound links when artifacts are added, renamed, or moved. Check relative links before finishing.
7. On each day the project changes, append a dated entry to status.md's change history and refresh its current-state sections. Edit affected designs in place, preserve earlier history, and include the updates in that day's project branch/pull request. Days without project changes need no empty entry.

These updates are part of ongoing project work. The repository's [agent guidance](../../AGENTS.md) and [pull request template](../../.github/pull_request_template.md) carry the same maintenance expectation into later changes.
