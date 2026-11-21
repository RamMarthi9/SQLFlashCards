# Planned SQL syllabus

This is the educational scope for SQLFlashCards content. The app lists all 14 topics and now loads six starter cards across Basic queries, Filtering, and Joins; the other 11 topics show Content coming soon. Learner completion is not yet recorded. SQLFlashCards teaches general SQL concepts, with database-specific syntax and behaviour labelled in relevant examples. Feature availability and exact syntax can vary between databases.

Use the separate [SQL syllabus index](sql-syllabus-index.md) for numbered subtopics, prerequisites, learning outcomes, keyword lookup, and researched source links. This document retains the concise 14-topic checklist and coverage model.

## Coverage model

A topic will be **covered** when the learner explicitly marks it complete and **uncovered** otherwise. A learner can return a topic to uncovered. Completion is separate from understanding: a covered topic can still contain cards that need revision.

New learners start with every topic uncovered. Existing notes or source material do not count as learner completion. The future progress calculation is:

```text
Progress (%) = covered topics / total topics * 100
```

The checklist below describes the learning plan, not measured user progress. The [implemented starter-card inventory](sql-syllabus-index.md#implemented-starter-cards) separately records which content exists in the app; six starter cards do not complete those three modules' full scope.

## Covered

No topics are marked covered in this initial plan.

## Uncovered

- [ ] **1. Database fundamentals:** databases, tables, rows, columns, relational concepts, and SQL command categories.
- [ ] **2. Basic queries:** `SELECT`, `FROM`, aliases, and `DISTINCT`.
- [ ] **3. Filtering:** `WHERE`, comparison and logical operators, `IN`, `BETWEEN`, `LIKE`, and `IS NULL`.
- [ ] **4. Sorting and limiting:** `ORDER BY`, ascending and descending order, and row-limiting syntax appropriate to the database, such as `LIMIT`.
- [ ] **5. Aggregate functions:** `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`.
- [ ] **6. Grouping:** `GROUP BY`, `HAVING`, and the difference between row and group filtering.
- [ ] **7. Joins:** inner, left, right, full outer, cross, and self joins.
- [ ] **8. Subqueries and set operations:** nested queries, correlated subqueries, `EXISTS`, `UNION`, `UNION ALL`, intersection, and dialect-specific set difference.
- [ ] **9. Common table expressions:** `WITH` and an introduction to recursive CTEs.
- [ ] **10. Window functions:** `OVER`, `PARTITION BY`, `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LEAD`, and `LAG`.
- [ ] **11. Expressions and functions:** `CASE`, `COALESCE`, and common string, numeric, and date functions.
- [ ] **12. Schema and data changes:** data types, `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, constraints, and basic views.
- [ ] **13. Relational design and transactions:** keys, relationships, normalization basics, ACID, `COMMIT`, and `ROLLBACK`.
- [ ] **14. Performance and interview practice:** indexes, query plans, duplicate detection, highest-salary questions, and query debugging.

**Initial learning plan: 0 of 14 topics covered (0%).** This checklist can be edited as documentation; interactive completion belongs in a later app stage.

## Example card

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

**Follow-up:** Change `>` to `>=` to include employees earning exactly 50,000.

</details>

This is a documentation example. The app displays SQL and explanations without executing user-supplied queries. The implemented JSON catalogue and runtime validator are described in the [LLD content contracts](lld.md#content-contracts). Each card tests one concept with a question, answer, four learning sections, explicit curriculum IDs, and source references.
