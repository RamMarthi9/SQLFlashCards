# SQLFlashCards High Level Design

SQLFlashCards will use one React and TypeScript web application for desktop browsers and Android. It will teach SQL through flashcards, track syllabus coverage, and help learners revise. Learning content will ship with the app; learner progress will be stored locally on the device.

This design follows the [architecture decisions](architecture.md), [14-topic syllabus](syllabus.md), and [user's visual mockup](app-design-reference.png). The current implementation contains only the home screen and development/check tooling. The learning components, storage, hosting, and Android package below are planned.

See the [Low level design](lld.md) for proposed components, TypeScript contracts, storage transactions, screen interactions, and implementation checks.

The separate [SQL syllabus index](sql-syllabus-index.md) expands the same 14 learning modules into numbered subtopics with outcomes and source references. It does not change the topic-coverage denominator or indicate that flashcard content is implemented.

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
| React screens | Show topics, learning cards, due revisions, and progress; accept learner actions. | Home screen exists; learning screens planned. |
| Learning coordinator | Load content and progress, pass actions to the rules, save results, and refresh the screen. | Planned. |
| Content reader | Load and validate reviewed topics and cards from versioned JSON. | Planned; syllabus exists as documentation. |
| Domain rules | Calculate coverage, revision counts, due dates, and proficiency. | Planned; counting, scheduling, and scoring details remain open. |
| Storage adapter | Read and write learner records and handle changes to the stored-data format. | Planned. |
| IndexedDB | Keep structured learner records in the browser. | Planned. |
| Vercel | Serve the built application and learning content over HTTPS. | Planned; no deployment. |
| Android package | Open the hosted web experience through a Trusted Web Activity, built using Bubblewrap. | Planned; no Android package. |

The UI will call the coordinator rather than accessing IndexedDB directly. Domain rules will be independent of React, browser storage, and network access; the coordinator will supply the current time explicitly so scheduling can be tested predictably.

IndexedDB is scoped to the website's origin. Local records are not a cloud backup, and clearing site data can remove progress. Storage failures must be visible to the learner rather than reported as successful saves. See [MDN's IndexedDB overview](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology).

## Screens and visual direction

The proposed navigation is a topic list, a topic/card learning screen, and a due-revision view. The learning screen will follow the supplied mockup: lavender background, a large purple topic card with a relevant visual, four coloured learning tiles, a revision-count row, and Beginner, Intermediate, and Expert proficiency indicators.

Definition will use coral, Concept yellow, Examples mint, and Syntax blue. The two-column tile layout will adapt to the available screen width. Controls must support touch and keyboard navigation, and selected proficiency must be understandable without relying only on colour.

The mockup's Left Join, revision count of 3, and Intermediate highlight are example content and values. New learners start with every topic uncovered; proficiency will depend on the scoring rules and available performance evidence. Whether tiles open panels, dialogs, or separate screens remains a UI decision.

## Data ownership

The following are proposed logical records, not a final storage schema:

| Record | Main information | Source of truth |
| --- | --- | --- |
| Topic | Stable ID, title, syllabus order, and related cards. | Versioned JSON in Git. |
| Flashcard | Stable ID, topic ID, question, answer, definition, concept, examples, syntax, and optional visual. | Versioned JSON in Git. |
| Topic progress | Topic ID, covered/uncovered state, and completion date if applicable. | IndexedDB. |
| Revision record | Unique record ID, topic/card reference, timestamp, and learner feedback. | IndexedDB. |
| Revision state | Schedule position and next due date calculated from revision history and the agreed rules. | IndexedDB, derived from learner activity. |

Revision counts and proficiency should come from learner activity and the agreed rules. Opening a page or refreshing the browser must not itself add a revision. Stable content IDs will keep progress attached to the right learning material when content changes; storage migrations will preserve existing records when the app's data format changes.

Topic completion is a separate learner action. A covered topic may still need revision. Syllabus progress is `covered topics / total topics * 100`; it is not the same as proficiency.

## Learning interaction

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

The existing `npm.cmd run check` command runs type checking, linting, the home-screen test, and the production build. As features are added, validation will cover answer reveal and navigation, save/reload behaviour, failed saves and duplicate submissions, revision dates, scoring, and content/storage upgrades. Browser checks will cover narrow and desktop layouts, keyboard access, and the supplied visual direction. Android delivery will need device testing and domain-verification checks.

Before implementing the corresponding features, settle these decisions:

- How the 14 syllabus topics map to individual concepts such as Left Join, and whether the displayed revision count is for a card, concept, or whole topic.
- Whether 1, 3, 5, 7, 20, and 30 days are offsets from first learning or gaps between revisions; also timezone and missed-revision behaviour.
- What action counts as a revision, what feedback is collected, how proficiency is calculated, and what to display before there is enough evidence.
- How learning tiles open and how content IDs and saved-data versions evolve.
- Whether reminders require closed-app delivery, and whether offline launch or progress export is needed for the first release.

The next implementation step is a working learning flow with a small validated content collection: choose a topic, read a question, reveal its answer, and move between cards using the mockup's visual direction. Local progress, revision rules, hosting, and Android packaging can then be added in separate stages.
