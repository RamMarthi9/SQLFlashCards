# SQLFlashCards Low Level Design

This design translates the [HLD](hld.md) and [visual mockup](app-design-reference.png) into proposed React components, TypeScript contracts, local storage records, and interaction flows. It is an implementation blueprint; the repository currently contains only the Stage 1 home screen and development/check tooling. The modules described below have not been implemented.

The application remains a single React and TypeScript web application, with versioned JSON learning content, IndexedDB progress, planned Vercel hosting, and a planned Android Trusted Web Activity package. Content teaches general SQL and identifies database-specific syntax or behaviour in relevant examples. SQL examples are displayed, not executed. Accounts, a backend API, cloud synchronization, offline launch, and background notifications are outside this design's first implementation stages.

## Design choices and unresolved policies

The following are proposed implementation choices for this LLD:

| Area | Proposed choice |
| --- | --- |
| Content hierarchy | A topic is one of the 14 syllabus groups. A flashcard tests one question/concept within a topic. `joins` contains card `joins-left-basic`, displayed as Left Join. |
| Tile interaction | Definition, Concept, Examples, and Syntax buttons toggle one inline section panel below the tile grid. |
| Navigation | Hash routes with validated topic/card IDs and browser Back/Forward support. No router package is currently installed. |
| Screen state | React state/reducers and an application coordinator; no global state library is needed initially. |
| Feedback | After revealing an answer, the learner chooses Need practice, With help, or Confident. These are self-reports, not automatic SQL grading. |
| Activity records | Persist individual completed card-review events with stable IDs. The displayed card's counter is derived from those events under the eventual revision-counting policy. |
| Storage | Native IndexedDB behind a repository interface. Persist pending submissions so retries can recover after a reload. |

These choices make the design concrete without settling the HLD's open learning policies. In particular, a sum of card reviews is not automatically a completed whole-topic revision. The product decisions near the end of this document must be resolved before enabling their dependent features.

## Screens and mockup mapping

| Route | Screen | Behaviour |
| --- | --- | --- |
| `#/topics` | Topic list | Show syllabus coverage, covered/uncovered filters, and links to available cards. An explicit action marks a topic covered or uncovered. |
| `#/topics/:topicId/cards/:cardId` | Learning screen | Show the mockup's topic/concept card, learning tiles, revision count, and proficiency, plus question/reveal, feedback, and previous/next controls. |
| `#/revisions` | Due revisions | Once scheduling is enabled, list active cards with saved due dates at or before the supplied current time. |
| Unknown route or ID | Missing content view | Explain that the item is unavailable and provide a return to Topics. Never substitute an unrelated card silently. |

An empty URL opens Topics. Validate that a card belongs to the route's topic. Route changes reset answer visibility, the open section, and an unsubmitted feedback draft. A submission already staged for saving stays recoverable. Back/Forward changes the route and uses the same loading/reset logic; it never creates a review event.

```text
App
  AppHeader
  RouteView
    TopicListScreen
      CoverageSummary
      TopicFilters
      TopicList
    LearningScreen
      TopicHero
      StudyPrompt
      LearningTiles
      LearningSectionPanel
      ReviewFeedback
      RevisionSummary
      ProficiencyIndicator
      CardNavigation
    DueRevisionsScreen
  StatusMessage
```

| Component | Inputs | User action or responsibility |
| --- | --- | --- |
| `TopicHero` | Card title and optional diagram | Display the purple hero and meaningful diagram alternative text. |
| `StudyPrompt` | Question, answer, `answerRevealed` | Emit `onReveal`; render the answer only after reveal. |
| `LearningTiles` | Active section ID | Emit `onToggle(section)`; opening the same section again closes it. |
| `LearningSectionPanel` | Section title and structured content blocks | Render text, SQL, and example tables without injecting HTML; show a SQL block's dialect label when supplied. |
| `ReviewFeedback` | Answer visibility, submission status | Emit one feedback value; disable repeated submission while saving or after success. |
| `RevisionSummary` | Derived count and its scope | Show the current card's count with a clear accessible label. No hard-coded 3. |
| `ProficiencyIndicator` | Assessed level and explanation, or insufficient evidence | Display a read-only result when assessment is enabled. No selectable difficulty tabs and no default Intermediate. |
| `CardNavigation` | Position, card count, adjacent IDs | Show Card N of M; disable Previous/Next at boundaries rather than wrap silently. |
| `CoverageSummary` | Active topics and explicit coverage records | Display coverage independently of proficiency and revision counts. |
| `StatusMessage` | Loading/save/recovery state | Explain actionable failures and announce save outcomes without stealing focus. |

The header, hero, four coloured tiles, revision row, and proficiency indicator preserve the mockup's hierarchy. Question/reveal and feedback controls are proposed additions needed for the HLD's practice flow. Reference tiles may contain clues; opening them does not itself count as a review. Record whether reference material was opened during the attempt so a later scoring policy can account for assisted practice.

## Layout and accessibility

Use lavender for the page, a deep purple gradient for the hero and selected proficiency, coral for Definition, yellow for Concept, mint for Examples, and blue for Syntax. Match final colours against the saved mockup and verify readable contrast during implementation; exact colour values and typography are not inferred measurements from the image.

Proposed CSS behaviour:

- Centre the learning surface at a maximum width of approximately 960 px, with fluid spacing. Use two tile columns from 480 px upward and one below that breakpoint when labels would otherwise be crowded.
- Keep the hero title and diagram side by side when they fit and stack them on narrow screens. Test at 320, 390, 768, and 1280 px, and with enlarged text; adjust breakpoints based on actual content fit.
- Use native buttons with a minimum 44 px target, visible focus, and text labels. Tile buttons use `aria-expanded` and `aria-controls`; they are disclosure controls, not tabs.
- Keep the inline panel after the tile grid in reading order. A keyboard-accessible Close button restores focus to its tile. Route navigation focuses the new screen heading; routine save updates do not move focus.
- Display proficiency as labelled text with a highlighted segment. Before sufficient evidence, show Not assessed yet with no selected segment.
- Render SQL as selectable `<pre><code>` text. Confine horizontal scrolling to code and table panels. Diagrams need an explanation of what shading means; decorative icons are hidden from assistive technology.
- Announce saved/error states through an appropriate live region. Keep retry controls available and respect reduced-motion preferences.

## Proposed module layout

```text
src/
  main.tsx                         # Existing entry; compose dependencies here
  app/
    App.tsx                        # Existing shell evolves into screen host
    routes.ts                     # Hash parsing, validation, navigation
    screens/                      # Topics, Learning, DueRevisions
    components/                   # Presentational pieces listed above
    hooks/useLearningController.ts
    App.css
  application/
    learningService.ts            # Load, reveal/feedback workflow, persistence
    ports.ts                      # Content, progress, clock, ID contracts
    viewModels.ts                 # Data prepared for screens
  domain/
    models.ts
    coverage.ts
    reviewRules.ts
    schedule.ts
    proficiency.ts
  content/
    catalog.json
    loadCatalog.ts
    validateCatalog.ts
    diagrams/                     # Bundled SVG assets with known paths
  storage/
    indexedDbProgressRepository.ts
    migrations.ts
    storageErrors.ts
  styles.css                      # Shared typography and design tokens
  test/                           # Existing setup plus shared test fixtures
```

Tests live beside the modules they exercise. Create each future directory when its feature is implemented. UI modules depend on application services and view models; application services depend on domain functions and repository interfaces. Storage implements those interfaces. Domain code imports no React, IndexedDB, network, or ambient clock APIs. The composition root supplies concrete adapters.

## Content contracts

The TypeScript shapes below describe proposed data contracts; they do not replace runtime validation of JSON.

```ts
type SectionId = 'definition' | 'concept' | 'examples' | 'syntax';
type Feedback = 'needPractice' | 'withHelp' | 'confident';
type ProficiencyLevel = 'beginner' | 'intermediate' | 'expert';
type Instant = string; // Canonical UTC timestamp, e.g. Date.toISOString()

type ContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'sql'; code: string; dialect?: string }
  | { kind: 'table'; columns: string[]; rows: string[][] };

interface Topic {
  id: string;
  title: string;
  order: number;
}

interface Flashcard {
  id: string;
  topicId: string;
  title: string;
  order: number;
  question: string;
  answer: string;
  sections: Record<SectionId, ContentBlock[]>;
  diagram?: { asset: string; alt: string };
}

interface Catalog {
  schemaVersion: 1;
  contentVersion: string;
  topics: Topic[];
  cards: Flashcard[];
}
```

Use stable IDs such as `joins` and `joins-left-basic`; wording changes do not create new identities. Validate unique IDs, existing topic references, nonempty questions/answers, all four sections, table row lengths, known diagram assets, nonempty dialect labels when supplied, and supported schema version. Sort by order, with ID as a deterministic tie-breaker. A new empty topic starts uncovered and shows Content coming soon; it cannot newly be marked covered before it has learning material. If a previously covered topic loses its cards, preserve its explicit completion and history; while its topic ID remains active, its saved flag still participates in coverage. An empty catalogue produces an empty state and 0% coverage without dividing by zero.

For an engine-specific SQL block, authors supply `dialect` as a display label naming the database and version when relevant. Engine-specific questions or answers name that context in their text. Content review checks these labels and explains relevant differences; an omitted label does not guarantee compatibility with every database. This metadata supports explanation and display, not a dialect selector or query execution.

Bundle content with the build and validate it in CI as well as at the loading boundary. Reject an invalid catalogue with a recoverable content error rather than silently dropping cards and changing coverage. Removed cards are omitted from active navigation and due lists, while their historical learner records are preserved. If multiple questions later need a shared concept page, add a separate Concept entity and a deliberate content migration.

## Learner records and rule contracts

```ts
interface TopicProgress {
  topicId: string;
  covered: boolean;
  coveredAt: Instant | null;
  updatedAt: Instant;
  version: number;
}

interface ReviewCommand {
  commandId: string;
  cardId: string;
  topicId: string;
  contentVersion: string;
  ruleSetVersion: string;
  feedback: Feedback;
  referenceUsed: boolean;
  occurredAt: Instant;
  timeZone: string; // Validated IANA zone supplied by the application
}

interface ReviewEvent extends ReviewCommand {
  sequence: number; // Increasing commit order within one card
}

type ScheduleResult =
  | { status: 'disabled' }
  | { status: 'not-started' }
  | { status: 'scheduled'; dueAt: Instant; step: number }
  | { status: 'complete' };

type ProficiencyResult =
  | { status: 'disabled' }
  | { status: 'insufficient-evidence'; reason: string }
  | { status: 'assessed'; level: ProficiencyLevel; explanation: string };

interface CardState {
  cardId: string;
  version: number;
  lastSequence: number;
  revisionCount: number;
  schedule: ScheduleResult;
  proficiency: ProficiencyResult;
  ruleSetVersion: string;
}

interface CardSnapshot {
  state: CardState;
  events: readonly ReviewEvent[]; // Sorted by sequence
}

interface TimeContext {
  now: Instant;
  timeZone: string;
}

interface LearningPolicy {
  version: string;
  revision: number; // Monotonically increasing activation revision
  countRevisions(events: readonly ReviewEvent[]): number;
  schedule: ((events: readonly ReviewEvent[], time: TimeContext) => ScheduleResult) | null;
  assess: ((events: readonly ReviewEvent[]) => ProficiencyResult) | null;
}

interface Clock { now(): Instant; timeZone(): string }
interface IdGenerator { next(): string }
```

`LearningPolicy` is an injected pure strategy. Its concrete implementation must document the decisions in the policy table below; a version string alone is not a definition of its behaviour. Keep the requested day sequence `[1, 3, 5, 7, 20, 30]` in that versioned policy. Do not provide arbitrary scoring thresholds or choose offsets versus intervals silently. During the review-counting stage, schedule/assessment strategies may be null: derivation returns their explicit disabled states and the UI hides the corresponding features. Disabled is distinct from enabled scheduling that has not started or enabled assessment with insufficient evidence.

Coverage is a separate pure function over active topic IDs and TopicProgress. Missing records mean uncovered; returning a topic to uncovered clears `coveredAt` without deleting review events. For zero active topics return 0%; otherwise calculate covered active topics divided by all active topics, multiplied by 100. Display rounding must not change the stored completion flags.

`deriveCardState(snapshot: CardSnapshot, newEvent: ReviewEvent, policy: LearningPolicy, time: TimeContext): CardState` produces the next cache from the complete ordered history and increments its version. Use sequence for ordering, since device timestamps may be equal or change. Derivation uses recorded activity times/timezones; retries and rebuilds must not shift due dates simply because they run later. Any policy use of current time must be explicit and captured in its replay inputs. The scheduling policy must state how it treats delayed submissions, timezone changes, and a clock moving backward.

An administrative policy activation uses a monotonically increasing revision in storage metadata; an older app bundle cannot downgrade it. A projection rebuild compares its previous state version, increments that version, and retains the last event sequence. While a card's projection is incompatible with the active policy, learner writes wait for a controlled rebuild. Pending commands from an older policy cannot resume under new rules without an explicit compatibility/migration decision; their original event policy version and the active projection policy version have different meanings. Preserve unsupported pending commands for recovery rather than silently rewriting them.

Revision counts, proficiency, and due dates are derived values; components never increment them locally. Review features that require an unresolved policy stay disabled at the feature level. The earlier content/reveal stage can ship without displaying technical configuration messages or invented progress values.

## IndexedDB schema and ownership

Proposed database name: `sqlflashcards`; initial database schema version: `1`. Database schema version, content version, and learning-policy version are separate values.

| Object store | Key and indexes | Purpose |
| --- | --- | --- |
| `topicProgress` | Key `topicId` | Authoritative explicit topic coverage and optimistic-concurrency version. |
| `reviewEvents` | Key `commandId`; index `cardId`; unique compound index `[cardId, sequence]`; index `topicId` | Immutable review activity, including the feedback and policy/content version used. |
| `cardState` | Key `cardId`; index `schedule.dueAt` | Rebuildable count, proficiency, due-date state, and concurrency version. Unscheduled states have no due-date index entry. |
| `pendingReviews` | Key `commandId`; indexes `cardId` and `occurredAt` | Frozen submission payload staged before recording its completed activity. |
| `metadata` | Key `key`; `activeRuleSet` record contains version and activation revision | Authoritative active policy, preventing older tabs from reverting new projections. |

IndexedDB records are local to the site's origin and browser storage context. There is no implied synchronization across devices or profiles. Hosting-origin changes need a migration/export plan; clearing site data can remove records. See [MDN's IndexedDB overview](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology).

Projection records can be rebuilt from immutable events with a selected policy version. Do not delete events when content is retired or when a projection must be rebuilt. A missing projection with existing events triggers a controlled rebuild, not an empty-state reset. Start with loading the selected card's history through its index; add pagination or incremental aggregates only when measured record volume requires them. Store all indexed timestamps in the same canonical UTC format so string comparisons preserve chronological order.

Run schema changes through numbered upgrade migrations. Close old connections on `versionchange`; a blocked upgrade should explain that other tabs need to close or reload. A failed migration preserves source records and reports recovery options; it must not automatically delete the database. Never write or migrate learner data during React rendering.

## Application and repository interfaces

These are in-process TypeScript interfaces, not HTTP endpoints. No backend API is required for the first release.

```ts
type CommitResult =
  | { kind: 'saved' | 'already-saved'; snapshot: CardSnapshot }
  | { kind: 'stale'; current: CardSnapshot }
  | { kind: 'command-conflict' | 'policy-changed' | 'projection-outdated' };

type CoverageResult =
  | { kind: 'saved'; progress: TopicProgress }
  | { kind: 'stale'; current: TopicProgress | null };

interface ContentRepository {
  load(): Promise<Catalog>;
}

interface ProgressRepository {
  loadTopics(): Promise<TopicProgress[]>;
  loadCard(cardId: string): Promise<CardSnapshot | null>;
  listDue(at: Instant): Promise<CardState[]>;
  listPending(): Promise<ReviewCommand[]>;
  stageReview(command: ReviewCommand): Promise<void>;
  commitReview(input: {
    event: ReviewEvent;
    expectedVersion: number;
    next: CardState;
  }): Promise<CommitResult>;
  discardPending(commandId: string): Promise<void>;
  setTopicCovered(input: {
    topicId: string;
    covered: boolean;
    changedAt: Instant;
    expectedVersion: number;
  }): Promise<CoverageResult>;
}
```

The application service exposes `loadTopicList`, `loadLearningScreen`, `submitReview`, `retryReview`, `setTopicCovered`, and `loadDueRevisions`. It validates active content references, obtains time/IDs, applies domain rules, and maps storage results to screen state. The repository interface above covers learner operations; policy activation and projection rebuild are separate administrative operations with version checks. Repository methods reject with classified storage errors for unavailable storage, quota failure, transaction abort, or migration failure; they do not return success when only some writes succeeded. `stageReview` additionally rejects with a distinct command-conflict error for an ID reused with a different payload.

For a card with neither state nor events, `loadCard` returns null and the service constructs an empty snapshot: version and sequence 0, count 0, and either disabled results or not-started/insufficient-evidence results under enabled policies. A missing TopicProgress record means uncovered with expected version 0; a stale coverage result may return null to represent that absence. A consistent snapshot reads state and history in one readonly transaction. Returned commit snapshots reflect that transaction's state; a synthetic empty current snapshot is allowed only when no events or state exist. Due-list queries additionally filter against the active catalogue; completed syllabus topics may still contain due cards. Activation metadata and projection policy must agree before cached assessments or due dates are used.

## UI state and event handling

Keep route identity separate from transient study state:

```ts
type LoadStatus = 'loading' | 'ready' | 'error';
type SubmitStatus = 'idle' | 'saving' | 'saved' | 'retryable-error' | 'stale' | 'blocked';

interface StudyState {
  cardId: string;
  activeSection: SectionId | null;
  answerRevealed: boolean;
  referenceUsed: boolean;
  submitStatus: SubmitStatus;
  pendingCommandId: string | null;
}
```

| Event | State change | Persistent effect |
| --- | --- | --- |
| Load or change card | Reset active section, answer visibility, reference-used flag, submit status, and transient pending ID; load the selected snapshot and pending commands. Ignore obsolete load responses after navigation. | Read only. |
| Toggle reference tile | Toggle one section; set `referenceUsed` to true for the current attempt. | None. |
| Reveal answer | Set `answerRevealed`; enable feedback if no submission is in progress. | None. |
| Submit feedback | Freeze one command ID, feedback, reference flag, timestamps, and versions; enter saving. | Stage command, then atomically save event and derived state. |
| Save succeeds | Show the committed snapshot; enter saved. | No extra writes from rendering or effects. |
| Save fails | Retain the pending command and show Retry. | No review count increase unless an event was actually committed. |
| Retry | Resubmit the same frozen command; reload/recalculate if stale. | At most one event for that command ID. |
| Practice again | Reset answer visibility, active section, reference-used flag, submission status, and transient pending ID. | Allocate a new command only on its later submission. |
| Mark topic covered/uncovered | Update explicit completion after repository success. | Coverage only; never erase review history. |

After a successful submission, Next moves to another card; it is not automatic. Durable pending commands live outside transient StudyState. Loading a card with a pending command offers Resume save or Discard unsaved attempt before enabling a fresh submission. A pending save can finish after navigation, but its result must update only its own card's cache, not the newly displayed card. A command conflict enters blocked state, preserves the original event, and explains that this attempt cannot be retried with changed data; offer to reload saved progress or discard only the unsaved attempt. Policy changes require refresh/recovery, and outdated projections require rebuilding before retry. Do not create a submission in a mount effect: React rendering or development StrictMode must not create activity.

The controller allocates and retains one command ID synchronously on the first accepted submission, before any asynchronous call. Repeated handlers for that same attempt reuse the command and in-flight promise; disabling the button is a usability measure, not the duplicate-prevention mechanism. Persistence still enforces uniqueness independently.

## Atomic review submission and recovery

```mermaid
sequenceDiagram
    actor Learner
    participant UI as Learning screen
    participant App as Learning service
    participant Rules as Domain rules
    participant DB as Progress repository
    Learner->>UI: Reveal answer and choose feedback
    UI->>App: submitReview
    App->>DB: Stage immutable command
    App->>DB: Read consistent card snapshot
    App->>Rules: Derive candidate event and next state
    Rules-->>App: Candidate state
    App->>DB: Commit with expected version
    alt Matching command already recorded
        DB-->>App: already-saved plus current snapshot
    else Snapshot is stale
        DB-->>App: stale plus current snapshot
    else New valid command
        DB->>DB: Add event, update state, remove pending
        DB-->>App: saved after transaction completion
    end
    App-->>UI: Saved values or recovery action
```

The repository's `commitReview` algorithm is:

1. Open one readwrite transaction covering `reviewEvents`, `cardState`, `pendingReviews`, and `metadata`.
2. Look up `commandId` before checking state version. If an event already exists with the same original command payload, remove any matching restaged pending command and return already-saved with a consistent current snapshot after transaction completion. Compare command fields, excluding derived sequence, expected version, and candidate state. The same ID with different feedback or other payload is a command conflict. If its projection needs repair, preserve the known saved event and return projection-outdated for recovery; never insert it again.
3. For a new event, verify that command and candidate policy versions match the active metadata and current projection. Return policy-changed or projection-outdated when they do not. Then compare current state version with `expectedVersion`; return stale without adding an event if they differ. A missing state has version 0 only if no prior events exist. The service must reload, recompute, and retry with the same command ID after the learner chooses Reload and retry.
4. Validate that the staged command matches, the candidate sequence is current `lastSequence + 1`, and the candidate state version is current version + 1. Add the event using its unique key, write the next state, and remove its pending command in that transaction.
5. Return saved only when the transaction completes. A failure aborts all three changes. Do not perform network calls, timers, or unrelated asynchronous work inside the transaction. These constraints follow [IndexedDB transaction behaviour](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) and [transaction completion semantics](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

The service computes domain results before the transaction; the state-version and active-policy checks make that proposed state safe to commit. Concurrent tabs cannot overwrite a newer projection with an older one. All saved/already-saved/stale snapshots are read or built consistently within their transaction and returned only after completion. Administrative policy activation also uses metadata compare-and-swap and refuses a lower activation revision; projection rebuilds retain lastSequence and increment state.version even when no new event is added. Refresh data on window focus/visibility changes; correctness still comes from transaction checks, not refresh timing.

`stageReview` is itself idempotent: the same ID/payload is accepted, while an altered payload is rejected. Do not attempt the final commit if staging fails. On restart, list pending commands and offer Resume save or Discard unsaved attempt. Discard removes only that pending record, never a committed review. A crash after a successful atomic commit leaves the saved event/state and no pending command; reopening loads those saved values and does not resubmit automatically.

If a pending command refers to unavailable content or an unsupported policy version, retain it and explain that it cannot currently be resumed; do not silently reinterpret its feedback. A stale submission preserves its original activity time. Duplicate clicks and acknowledgement failures reuse the same ID, so they cannot add a second review. This is an at-most-once recording guarantee per command ID, not a promise against device-data deletion or permanent storage failure.

Topic coverage updates use their own readwrite transaction and version check. Stale coverage changes return the newer value and allow an explicit retry; they never overwrite review events or reset proficiency.

## Scheduling and proficiency decisions

The following decisions remain open in the HLD. The concrete policy and its tests must settle them before scheduling/scoring is enabled:

| Decision | Required definition |
| --- | --- |
| Revision qualification | Whether first learning counts, what feedback/action completes a revision, and how assisted practice contributes. |
| Counter scope | Confirm the proposed current-card count and define the required whole-topic revision metric. Until then, topic aggregates must be labelled Card reviews rather than Whole-topic revisions. |
| Day sequence | Whether 1, 3, 5, 7, 20, and 30 are offsets from first learning or intervals between revisions. |
| Calendar semantics | Calendar days versus elapsed 24-hour periods, timezone persistence, daylight-saving transitions, and changes to the device clock. |
| Schedule progression | Early/late reviews, missed steps, repeated same-day attempts, feedback effects, delayed pending submissions, and behaviour after the final step. |
| Proficiency | Feedback weights, evidence window, minimum evidence, thresholds, and any topic-level aggregation. |
| Policy upgrades | Preserve previously derived state or rebuild it under the new version, and how that change is explained. |

The initial due view reads saved scheduled dates on startup and when the app returns to the foreground. Passing the supplied current time into `listDue` and the domain layer makes the result testable. A policy needs a valid scheduled instant before an item appears in that list; opening the list does not advance the schedule.

Notifications while closed require a separate delivery design and permission flow. Browser background scheduling cannot be treated as a precise alarm service; this limitation is described in [MDN's background-operation guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation). No service worker, push subscription, server scheduler, or native alarm integration is implied by this LLD.

## Failure handling and verification

| Case | Expected behaviour and test |
| --- | --- |
| Invalid catalogue or missing route ID | Clear error/empty state with navigation or retry; no wrong-card fallback or fabricated progress. |
| Reveal, tile toggle, refresh, navigation | No review event and no completion change. |
| Duplicate click or retry after lost acknowledgement | Same command ID creates one event; later state changes do not invalidate duplicate recognition. |
| Same command ID with altered data | Reject as conflict; preserve the original record. |
| Two tabs submit reviews for one card | Version check catches stale state; explicit retry incorporates saved history and assigns the next sequence. |
| Rebuild races with a save or old-policy retry | Rebuild increments state version; active-policy checks reject rollback, and incompatible pending commands remain recoverable. |
| Missing projection with existing history | Rebuild from events under an explicitly selected policy; never reset count/history to empty. |
| Transaction abort between event/state writes | Neither review nor derived state partially persists; pending command remains recoverable. |
| Reload before or after commit | Recover pending command before commit; reload committed state afterward without replay. |
| Quota denied or storage unavailable | Explain that progress was not saved; retain the in-memory attempt if possible and offer retry. Reading content can continue without claiming persistence. |
| Migration blocked or failed | Explain how to retry/close other tabs; never automatically erase learner records. |
| Retired content and new topics | Preserve history, exclude retired cards from due lists, and start new active topics uncovered. |
| Empty topics and no evidence | Safe coverage calculation, unavailable learning state, and Not assessed yet. |
| Date and policy boundaries | Fixed-clock tests for each agreed policy decision, including final step and timezone edges. |
| Visual and assistive use | Verify mockup hierarchy, narrow layouts, enlarged text, keyboard order, contrast, labels, and diagram meaning in a real browser. |

Use Vitest for pure rules and service workflows, React Testing Library for user interactions, and repository contract tests for persistence. Test IndexedDB transactions and upgrades in a real browser; the current jsdom screen test alone cannot establish their correctness. No additional test or browser-automation package has been installed by this document.

Keep the existing typecheck, lint, test, and build pipeline. Later add content validation and feature tests to it. Release checks must include saved progress surviving reload, API-free learning behaviour, production asset loading, and the Android wrapper's navigation and domain association when that packaging stage is built.

## Delivery sequence and boundaries

1. Implement validated content, topic/card navigation, the mockup's visual components, question/reveal, and four inline learning sections.
2. Implement explicit topic coverage and the IndexedDB adapter with failure handling and migrations.
3. Finalize review qualification and feedback, then add durable review commands, event history, and count projections.
4. Finalize schedule/proficiency policies, add due views and assessed levels, and verify their edge cases.
5. Add Vercel hosting and the Bubblewrap/TWA Android package, following the HLD. Native UI/storage and cross-device synchronization are not introduced implicitly by packaging.

The Android wrapper will use the same routes, React components, content, and storage adapter as the web application. Deployment must verify website ownership and navigation on a device, as described in the [Chrome Trusted Web Activity guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start). A future offline cache, notification mechanism, or cloud sync service requires its own design extension.
