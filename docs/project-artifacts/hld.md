# SQLFlashCards High Level Design

SQLFlashCards will use one React and TypeScript web application for desktop browsers and Android. It will teach SQL through flashcards, track syllabus coverage, and help learners revise. Learning content will ship with the app; learner progress will be stored locally on the device.

This design follows the [architecture decisions](architecture.md), [14-topic syllabus](syllabus.md), and [user's visual mockup](app-design-reference.png). The working learning flow includes all 14 topic headings, six starter cards across Basic queries, Filtering, and Joins, answer reveal, inline learning sections, and card navigation. The other 11 topics show Content coming soon. Explicit Completed/Incomplete choices now persist in IndexedDB, with filters and a syllabus progress summary. Review rules, hosting, and the Android package remain planned.

See the [Low level design](lld.md) for implemented component and storage contracts, proposed review flows, screen interactions, and verification requirements.

The separate [SQL syllabus index](sql-syllabus-index.md) expands the same 14 learning modules into numbered subtopics with outcomes and source references. Starter cards map explicitly to that index; their availability does not mean a learner has completed those topics or that the full curriculum has been authored.

## Product scope

The learning experience will provide topic selection, questions and answer reveal, Definition, Concept, Examples, and Syntax sections, performance feedback, covered/uncovered topics, revision counts, and proficiency levels. Revision scheduling must support the requested 1, 3, 5, 7, 20, and 30 day rule once its timing semantics are defined.

The first release will display SQL examples without executing queries. It will use local progress without accounts or cloud synchronization. The learning scope is general SQL; examples identify the relevant database when syntax or behaviour is engine-specific. The app does not require a database server.

## System structure

The diagram shows the target components inside each running client. The two entry points use the same web implementation; they do not imply a shared progress database across devices or browser profiles.

```mermaid
flowchart TD
    Web[Web browser] --> UI[React screens]
    Android[Android Trusted Web Activity] --> UI
    UI --> App[Learning coordinator]
    App --> Content[Content reader and validation]
    Content --> JSON[Versioned JSON topics and cards]
    App --> Rules[Coverage, revision and proficiency rules]
    App --> Storage[Storage adapter]
    Storage <--> DB[(IndexedDB on the device)]
```

| Component | Responsibility | Current state |
| --- | --- | --- |
| React screens | Show topics, learning cards, completion, and later due revisions. | Topic list, question/reveal, four inline sections, bounded card navigation, explicit completion controls, filters, and progress summary implemented. |
| Learning coordinator | Load content and progress, validate actions, save results, and refresh the screen. | Content/routes and topic-progress loading, saving, retry, and focus/visibility refresh implemented; review workflows remain planned. |
| Content reader | Load and validate reviewed topics and cards from versioned JSON. | Bundled JSON with runtime validation, 14 topic records, and six starter cards. |
| Domain rules | Calculate coverage, revision counts, due dates, and proficiency. | Explicit topic completion and active-syllabus coverage implemented; review counting, scheduling, and scoring remain open. |
| Storage adapter | Read and write learner records and handle changes to the stored-data format. | Native IndexedDB topic-progress adapter, transaction-completion acknowledgement, version conflict checks, and non-destructive error handling implemented. |
| IndexedDB | Keep structured learner records in the browser. | Database `sqlflashcards`, version 1, with the `topicProgress` store. Review stores remain future work. |
| Vercel | Serve the built application and learning content over HTTPS. | Planned; no deployment. |
| Android package | Open the hosted web experience through a Trusted Web Activity, built using Bubblewrap. | Planned; no Android package. |

The UI calls the progress coordinator rather than accessing IndexedDB directly. Domain rules and contracts are independent of React, browser storage, and network access; the coordinator supplies the current time explicitly. Future scheduling follows the same boundary so it can be tested predictably.

IndexedDB is scoped to the website's origin and browser profile. Refreshing or reopening the same origin reloads saved progress; a different hostname, scheme, port, or profile uses separate storage. Local records are not a cloud backup, and clearing site data can remove progress. Storage failures are visible to the learner rather than reported as successful saves; cards remain readable while retry is available. See [MDN's IndexedDB overview](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology).

## Screens and visual direction

Implemented hash navigation connects the topic list and topic/card learning screen, including direct links and browser Back/Forward. The learning screen follows the supplied mockup's lavender background, large purple concept card, join visuals, and four coloured learning tiles. The due-revision view, revision-count row, and proficiency indicators remain future work and are hidden until their policies and persistence exist.

Definition uses coral, Concept yellow, Examples mint, and Syntax blue. The tile layout adapts to available width and uses keyboard-accessible disclosure buttons. Each opens one inline section below the grid; selecting it again closes the section, and its Close button returns focus to the tile.

The mockup's Left Join is now a starter card. Its revision count of 3 and Intermediate highlight remain illustrative values, never initial learner data. Explicit topic completion appears on the topic list and learning screen, separate from the future proficiency assessment. All, Completed, and Incomplete filters show the relevant topics without changing their saved status.

## Data ownership

Topic, Flashcard, and Topic progress are implemented. Revision records and derived revision state remain proposed:

| Record | Main information | Source of truth |
| --- | --- | --- |
| Topic | Stable ID, title, syllabus order, and related cards. | Versioned JSON in Git. |
| Flashcard | Stable ID, topic ID, question, answer, definition, concept, examples, syntax, and optional visual. | Versioned JSON in Git. |
| Topic progress | Topic ID, covered/uncovered state, completion date if applicable, last-change time, and concurrency version. | IndexedDB `topicProgress`. |
| Revision record | Unique record ID, topic/card reference, timestamp, and learner feedback. | IndexedDB. |
| Revision state | Schedule position and next due date calculated from revision history and the agreed rules. | IndexedDB, derived from learner activity. |

Revision counts and proficiency should come from learner activity and the agreed rules. Opening a page or refreshing the browser must not itself add a revision. Stable content IDs will keep progress attached to the right learning material when content changes; storage migrations will preserve existing records when the app's data format changes.

Topic completion is a separate learner action. A covered topic may still need revision. Syllabus progress is `covered active topics / total active topics * 100`, with 0% for an empty catalogue; it is not the same as proficiency. All 14 active topics count, including those awaiting cards. Missing saved records mean incomplete, and an empty topic cannot be newly completed. Existing completion survives removal of its cards and can be reopened; retired-topic records are preserved but excluded from the percentage.

## Learning interaction

The implemented flow loads and validates bundled content, opens a topic's first available card, reveals an answer on request, toggles reference sections, and moves between cards. Unknown routes or mismatched topic/card IDs show an unavailable-content view. Card changes, browser history navigation, and reloads reset answer visibility and the open section. These actions create no learner records.

The implemented completion flow loads saved topic records, validates an explicit completion action against active content, and writes it with the version last read. The UI changes to the saved value only after the transaction commits. Another tab's newer change produces a visible conflict and an explicit retry, while focus/visibility refresh picks up saved changes. Loading, reading, and navigating do not write completion records.

The following review extension remains planned:

1. The app loads the content collection and reads local learner records.
2. The learner selects a topic and reads a question or learning section.
3. The learner reveals the answer and submits performance feedback.
4. The coordinator passes that action, previous records, and the current time to the domain rules.
5. The rules calculate the resulting revision state and proficiency under the agreed policy.
6. The storage adapter saves the completed activity and its resulting state together, then the UI shows the updated values. A failed save offers a retry without double-counting the activity.
7. When the learner returns, the app reloads saved progress and identifies revisions that are due.

The precise action that qualifies as a completed revision must be settled before implementing steps 4 through 6. Marking a topic covered or uncovered updates completion independently.

## Build and delivery

```mermaid
flowchart LR
    Source[Code and content in GitHub] --> Checks[TypeScript, ESLint and Vitest checks]
    Checks --> Build[Vite production build]
    Build --> Release[Release step - planned]
    Release --> Host[Vercel static hosting - planned]
    Host --> Browser[Web browser]
    Host --> Android[Android TWA - planned]
```

Node.js and npm run the development tools. Vite serves the app locally during development and produces the release files. GitHub Actions is configured to install locked dependencies and run checks on pull requests and pushes to main; it does not currently deploy the app.

For Android, Bubblewrap will create the package that opens the hosted app through a Trusted Web Activity. Website ownership must be verified using Digital Asset Links. This is a wrapper around the web experience, so the learning UI and rules remain in the shared web code. See the [Chrome Trusted Web Activity guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).

## Reminders and future capabilities

The proposed first reminder capability is an in-app due list calculated from saved revision dates when the app opens. Notification delivery is a separate component to design after deciding whether reminders must work while the app is closed and how precise their timing must be.

Browsers control service-worker execution and background scheduling. Consequently, this client-only design does not promise exact closed-app alarms; that is a design constraint inferred from [MDN's background-operation guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

Offline launching requires a separate asset-caching design; local progress storage alone does not provide it. Accounts, cloud backup, and synchronization across devices are later capabilities and would require additional services and data-conflict rules.

## Validation and remaining decisions

The existing `npm.cmd run check` command runs type checking, linting, tests, and the production build. Content, learning interaction, progress coordination, and storage contract tests belong to the current stage; actual executed results belong in [Project status](status.md). Real-browser checks must verify saved progress after refresh/reopen, storage failures and upgrades, narrow and desktop layouts, keyboard access, and the supplied visual direction. Simulated IndexedDB tests do not replace browser verification. Later review checks must cover duplicate submissions, revision dates, and scoring. Android delivery will need device testing and domain-verification checks.

Before implementing the corresponding features, settle these decisions:

- How the displayed revision count relates to individual cards, concepts, or whole topics; the initial topic/card mapping is now explicit in the content catalogue.
- Whether 1, 3, 5, 7, 20, and 30 days are offsets from first learning or gaps between revisions; also timezone and missed-revision behaviour.
- What action counts as a revision, what feedback is collected, how proficiency is calculated, and what to display before there is enough evidence.
- How content IDs and saved-data versions evolve as the authored catalogue and learner records grow.
- Whether reminders require closed-app delivery, and whether offline launch or progress export is needed for the first release.

The next implementation step is to expand the reviewed card collection and settle what counts as a revision before adding durable review history and counts. Complete outstanding real-browser persistence and visual checks before release. Scheduling/proficiency rules, hosting, and Android packaging remain separate delivery steps.
