# Project Artifact Maintenance

The user requested that project artifacts stay together and be updated as the project progresses. Their canonical location is `docs/project-artifacts/`; begin with its [index](docs/project-artifacts/README.md) and [status](docs/project-artifacts/status.md).

- During project work, read the relevant HLD, LLD, architecture, syllabus, and visual reference before changing their corresponding implementation.
- Update affected artifacts in the same change when behaviour, requirements, decisions, scope, delivery, or verification status changes. Keep the HLD, LLD, architecture, and syllabus consistent with one another and with the code.
- Update status.md for meaningful progress, recording completed work, the next step, unresolved decisions, and actual checks performed. Distinguish implemented features from proposed designs; do not report a configured check as a passing run.
- On each day that project work changes implementation, requirements, decisions, or verification results, append a dated change-history entry in status.md and update its current-state sections. Preserve prior history; update the HLD, LLD, architecture, and syllabus in place only where affected. Do not add empty daily entries when nothing changed.
- Include relevant artifact updates in the same GitHub branch and pull request as the authorized project work. The user requested ongoing GitHub publication of these updates; use the repository's normal review/check workflow and report the published commit or pull request.
- Store new project design, status, decision, and reference artifacts in this folder and add them to its index. Preserve one canonical copy; update links when files move.
- Preserve the user's original mockup. A new visual reference should be clearly identified rather than silently replacing it.
- Keep the root README as the entry point for setup/run instructions and links to the artifact collection. Check documentation links after changes.

Maintenance is part of the repository work being performed; do not create a scheduled job or background automation unless the user requests one.
