# SQL_Learner_Flashcard

SQL_Learner_Flashcard is a planned interactive learning app that helps learners practice SQL with flashcards and track which parts of the syllabus they have covered. It brings short explanations, query examples, and revision prompts into one place, making it easier to decide what to learn next.

This README introduces the app to be built. The features below are planned; this repository currently contains learning materials rather than a runnable app.

## Learning experience

1. Open the dashboard to see **Covered**, **Uncovered**, and **All Topics** views.
2. Choose a topic and read a flashcard question before revealing the answer.
3. Select **Show Answer** to see the explanation and an example SQL query.
4. Rate the card **Needs Review** or **Understood**, then use **Previous**, **Next**, or **Shuffle** to continue.
5. Mark the topic **Covered** when finished, or return it to **Uncovered** for another pass.
6. Return later to resume learning with saved progress and a list of cards needing review.

The app should support topic and difficulty filters, keyboard-accessible controls, and a layout that works on phones and desktops.

## Covered and uncovered syllabus

**Covered** means the learner explicitly marked a topic complete. **Uncovered** means the topic has not yet been marked complete. Topic completion and flashcard understanding are separate: a covered topic can still contain cards that need review.

All topics start uncovered for a new learner. Existing notes do not automatically count as completed learning. The dashboard should display both topic counts and a progress bar:

`Progress (%) = covered topics / total topics × 100`

### Covered

No topics are marked covered in this initial checklist.

### Uncovered

- [ ] **1. Database fundamentals:** databases, tables, rows, columns, relational concepts, and SQL command categories.
- [ ] **2. Basic queries:** `SELECT`, `FROM`, aliases, and `DISTINCT`.
- [ ] **3. Filtering:** `WHERE`, comparison and logical operators, `IN`, `BETWEEN`, `LIKE`, and `IS NULL`.
- [ ] **4. Sorting and limiting:** `ORDER BY`, ascending and descending order, and `LIMIT`.
- [ ] **5. Aggregate functions:** `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`.
- [ ] **6. Grouping:** `GROUP BY`, `HAVING`, and the difference between row and group filtering.
- [ ] **7. Joins:** inner, left, right, cross, and self joins.
- [ ] **8. Subqueries and set operations:** nested queries, correlated subqueries, `EXISTS`, `UNION`, and `UNION ALL`.
- [ ] **9. Common table expressions:** `WITH` and an introduction to recursive CTEs.
- [ ] **10. Window functions:** `OVER`, `PARTITION BY`, `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LEAD`, and `LAG`.
- [ ] **11. Expressions and functions:** `CASE`, `COALESCE`, and common string, numeric, and date functions.
- [ ] **12. Schema and data changes:** data types, `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, and constraints.
- [ ] **13. Relational design and transactions:** keys, relationships, normalization basics, ACID, `COMMIT`, and `ROLLBACK`.
- [ ] **14. Performance and interview practice:** indexes, query plans, duplicate detection, highest-salary questions, and query debugging.

**Initial progress: 0 of 14 topics covered (0%).**

This Markdown checklist is a planning aid and can be edited manually. Live filtering, saved completion status, and automatic progress calculations belong in the app.

## Try a sample flashcard

**Topic:** Filtering | **Difficulty:** Beginner

**Question:** How do you retrieve employees whose salary is greater than 50,000?

Assume an `employees` table with `employee_id`, `employee_name`, and `salary` columns. Try writing the query before opening the answer.

<details>
<summary>Show answer and explanation</summary>

```sql
SELECT employee_id, employee_name, salary
FROM employees
WHERE salary > 50000;
```

`SELECT` chooses the output columns, `FROM` identifies the table, and `WHERE` keeps only rows whose salary exceeds 50,000. A salary equal to 50,000 is excluded.

**Follow-up:** Change the condition to include employees earning exactly 50,000 as well.

</details>

The answer can be expanded in Markdown viewers that support HTML disclosure elements. In the app, each card should also provide the review ratings and navigation described above.

## Building the first version

A simple starting point is HTML, CSS, and JavaScript inside `SQLFlashCards/`, with flashcard content stored as JSON and learner progress stored in browser `localStorage`.

| Component | Initial responsibility |
| --- | --- |
| Syllabus dashboard | Show covered and uncovered topics, counts, and completion percentage. |
| Flashcard viewer | Display questions, reveal answers, and support navigation and shuffling. |
| Review controls | Save each card's understanding rating and filter cards needing review. |
| Progress storage | Remember topic completion and card ratings across browser sessions on the same browser and device. |
| Content collection | Store a stable card ID, topic ID, difficulty, question, answer, explanation, and optional SQL example. |

Use MySQL-oriented examples initially to match the existing practice script, and label examples that depend on a particular SQL dialect. The first version can teach through displayed queries; an executable SQL playground and spaced repetition can be later additions.

The first version is ready when a learner can select an uncovered topic, reveal and rate its cards, mark the topic covered, see the progress update, reload the app, and retain that progress. Moving a topic back to uncovered should update both the lists and the progress bar.

## Existing learning materials

- [SQL class notes](SQLClass1.txt): a starting source for explanations and practice questions.
- [SQL practice script](Create_SQL_Tutorial.sql): examples of schema creation and constraints.
- [SQL interview questions](SQL_Interview_Questions.txt): prompts for more challenging cards.

Review and adapt these materials into small, focused flashcards. Each card should teach or test one concept, with a clear answer and an explanation of why it works.
