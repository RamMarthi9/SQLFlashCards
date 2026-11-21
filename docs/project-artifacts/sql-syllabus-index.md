# SQL Syllabus Index

Last researched: November 21, 2026.

This is the detailed learning index for SQLFlashCards: 14 modules covering SQL fundamentals, query writing, relational design, and advanced practice. It expands the [planned syllabus](syllabus.md) with numbered subtopics, learning outcomes, prerequisites, and links to primary references. The app teaches general SQL; database-specific examples must identify their engine and relevant version.

## Scope and sources

The module grouping comes from the existing project plan. The source links below were researched for this revision; they do not establish where the earlier uncited draft originally came from. The topic numbering, learning stages, prerequisites, outcomes, and suggested exercises are project-authored. This is a source-informed app curriculum, not a reproduction of a provider's course or a claim of complete SQL-standard coverage.

The broad learning coverage was checked against [Harvard CS50 SQL](https://cs50.harvard.edu/sql/) and [Microsoft Learn's querying and data-modification path](https://learn.microsoft.com/en-us/training/paths/get-started-querying-with-transact-sql/). Each module links more specific references. CS50 examples often use SQLite, Microsoft examples use Transact-SQL, and the MySQL and Oracle references identify their editions. These references do not make any one engine the app's default.

The documents are learning plans, not completed flashcard content or learner progress. The app's first release will display queries and explanations; exercises here describe material to author, not an implemented SQL execution environment. Source links establish topic coverage; each eventual card's syntax, explanation, and expected result still need review for its labelled database.

## Module index

The levels describe lesson difficulty, not the learner's calculated proficiency. Prerequisite numbers refer to modules in this table. Learners can revisit earlier modules as needed.

| ID | Module | Learning stage | Suggested preparation |
| --- | --- | --- | --- |
| SQL-01 | [Database fundamentals](#sql-01-database-fundamentals) | Beginner | None; familiarity with tables helps. |
| SQL-02 | [Basic queries](#sql-02-basic-queries) | Beginner | 01 |
| SQL-03 | [Filtering and missing values](#sql-03-filtering-and-missing-values) | Beginner | 02 |
| SQL-04 | [Sorting and limiting](#sql-04-sorting-and-limiting) | Beginner | 02, 03 |
| SQL-05 | [Aggregate functions](#sql-05-aggregate-functions) | Beginner | 02, 03 |
| SQL-06 | [Grouping](#sql-06-grouping) | Beginner to intermediate | 05 |
| SQL-07 | [Joins](#sql-07-joins) | Intermediate | 01, 02, 03 |
| SQL-08 | [Subqueries and set operations](#sql-08-subqueries-and-set-operations) | Intermediate | 03, 06, 07 |
| SQL-09 | [Common table expressions](#sql-09-common-table-expressions) | Intermediate to advanced | 08 |
| SQL-10 | [Window functions](#sql-10-window-functions) | Intermediate to advanced | 04, 05, 06 |
| SQL-11 | [Expressions and functions](#sql-11-expressions-and-functions) | Beginner to intermediate | 02, 03; useful alongside 05 and 06. |
| SQL-12 | [Schema and data changes](#sql-12-schema-and-data-changes) | Beginner to intermediate | 01, 03; 07 and 08 for views. |
| SQL-13 | [Relational design and transactions](#sql-13-relational-design-and-transactions) | Intermediate | 07, 12 |
| SQL-14 | [Performance and interview practice](#sql-14-performance-and-interview-practice) | Advanced practice | 01 through 13 as relevant to each exercise. |

## SQL 01 Database fundamentals

- **SQL-01.01** Relational databases, tables, rows, and columns.
- **SQL-01.02** Entities, relationships, and why keys identify and connect records.
- **SQL-01.03** SQL, database engines, and dialects; query, schema, data-change, and transaction statements.
- **SQL-01.04** Schemas, basic data types, and the meaning of a missing value.

**Outcome:** Read a small database diagram and identify what each table and key represents.

**Practice:** Describe the relationships among customers, orders, and order items before writing queries.

**References:** [Microsoft SQL introduction](https://learn.microsoft.com/en-us/training/modules/introduction-to-transact-sql/) covers the language, schemas, statement types, types, and NULLs; [CS50 Relating](https://cs50.harvard.edu/sql/notes/1/) supports the relationship/key concepts. Use their engine-specific examples with labels.

## SQL 02 Basic queries

- **SQL-02.01** `SELECT` and `FROM`; selecting named columns and understanding `*`.
- **SQL-02.02** Column aliases and readable result headings.
- **SQL-02.03** Expressions in the select list.
- **SQL-02.04** `DISTINCT` and duplicate result rows.
- **SQL-02.05** Reading the shape of a result: columns, rows, and values.

**Outcome:** Write a query that returns the required columns and explain whether duplicates should remain.

**Practice:** List employee names and salaries, then produce a distinct department list.

**References:** [CS50 Querying](https://cs50.harvard.edu/sql/notes/0/) provides the introductory query material, and the [SQLite SELECT reference](https://www.sqlite.org/lang_select.html) explains duplicate removal with `DISTINCT`. These examples use SQLite; identifier quoting and other dialect details need context.

## SQL 03 Filtering and missing values

- **SQL-03.01** `WHERE` and comparison operators.
- **SQL-03.02** `AND`, `OR`, `NOT`, parentheses, and combining conditions.
- **SQL-03.03** `IN`, `NOT IN`, and `BETWEEN`.
- **SQL-03.04** `LIKE` patterns and wildcard matching.
- **SQL-03.05** `IS NULL`, `IS NOT NULL`, unknown truth values, and missing-value pitfalls.

**Outcome:** Explain which rows satisfy a condition, including rows containing NULLs.

**Practice:** Filter a salary range and separately identify employees without an assigned department.

**Reference:** [SQLite expressions](https://www.sqlite.org/lang_expr.html) documents these predicates. Treat pattern-case rules, type conversion, and extensions as engine-specific; do not generalize every SQLite operator to all databases.

## SQL 04 Sorting and limiting

- **SQL-04.01** `ORDER BY`, ascending/descending order, and multiple sort keys.
- **SQL-04.02** Ties and an explicit tie-breaker for predictable top-N results.
- **SQL-04.03** Row limits using syntax appropriate to the labelled database.
- **SQL-04.04** Pagination and the effect of changing data on repeated pages.

**Outcome:** Specify both the required rows and their presentation order.

**Practice:** Return the five highest-paid employees with a defined rule for equal salaries.

**References:** [SQL Server ORDER BY](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql?view=sql-server-ver17) covers ordering and `OFFSET`/`FETCH`; [CS50 Querying](https://cs50.harvard.edu/sql/notes/0/) illustrates SQLite's `LIMIT`. These are labelled examples, not interchangeable syntax promises.

## SQL 05 Aggregate functions

- **SQL-05.01** `COUNT(*)`, `COUNT(column)`, and distinct counting.
- **SQL-05.02** `SUM` and `AVG`.
- **SQL-05.03** `MIN` and `MAX`.
- **SQL-05.04** NULL inputs and empty-input cases.
- **SQL-05.05** Combining a row filter with an aggregate.

**Outcome:** Select the correct aggregate and explain what rows or values it counts.

**Practice:** Compare total employee count, recorded-salary count, and average recorded salary.

**Reference:** [SQLite aggregate functions](https://www.sqlite.org/lang_aggfunc.html). Keep numeric result types and conversion rules labelled; SQLite's `total()` is not part of the general core in this index.

## SQL 06 Grouping

- **SQL-06.01** `GROUP BY` on one or several columns.
- **SQL-06.02** Aggregates within each group.
- **SQL-06.03** `WHERE` for input rows and `HAVING` for grouped results.
- **SQL-06.04** Grouped and aggregated select-list expressions.
- **SQL-06.05** Ordering a grouped report.

**Outcome:** Produce one summary row per group and distinguish row filtering from group filtering.

**Practice:** Report departments whose recorded salary total exceeds a chosen threshold.

**References:** [Microsoft grouping and functions module](https://learn.microsoft.com/en-us/training/modules/use-built-functions-transact-sql/) and [CS50 Relating](https://cs50.harvard.edu/sql/notes/1/). Alias visibility and permissive grouping behaviour must not be assumed identical across engines.

## SQL 07 Joins

- **SQL-07.01** Join conditions, table aliases, and qualified column names.
- **SQL-07.02** Inner joins and matching rows.
- **SQL-07.03** Left, right, and full outer joins; reasoning about unmatched rows.
- **SQL-07.04** Cross joins and self joins.
- **SQL-07.05** One-to-many relationships and unexpectedly multiplied result rows.
- **SQL-07.06** Predicate placement in an outer join's `ON` clause versus a later filter.

**Outcome:** Predict the rows returned by a join, including unmatched rows and duplicates.

**Practice:** List all customers and any matching orders, including customers with no orders. This module contains the mockup's Left Join concept.

**Reference:** [Microsoft FROM and JOIN reference](https://learn.microsoft.com/en-us/sql/t-sql/queries/from-transact-sql?view=sql-server-ver16). This is a T-SQL reference; join availability, extensions, and exact syntax require engine/version checks when cards are authored.

## SQL 08 Subqueries and set operations

- **SQL-08.01** Scalar and multi-row subquery results; choosing a compatible context.
- **SQL-08.02** Self-contained and correlated subqueries.
- **SQL-08.03** `EXISTS`, `NOT EXISTS`, and membership tests.
- **SQL-08.04** `UNION` versus `UNION ALL` and compatible result columns.
- **SQL-08.05** Intersection and difference: `INTERSECT` and dialect-labelled `EXCEPT` or `MINUS` forms.

**Outcome:** Choose between a join, a nested query, and a set operation for a stated result.

**Practice:** Find customers with no orders and combine two customer lists with a deliberate duplicate policy.

**References:** [MySQL 8.4 subqueries](https://dev.mysql.com/doc/refman/8.4/en/subqueries.html), [MySQL 8.4 set operations](https://dev.mysql.com/doc/refman/8.4/en/set-operations.html), and [Oracle 19c set operators](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html). Oracle 19c's documented `MINUS` and operator precedence must not be presented as universal syntax or precedence.

## SQL 09 Common table expressions

- **SQL-09.01** `WITH`, named intermediate results, and query scope.
- **SQL-09.02** Multiple CTEs and breaking a report into understandable steps.
- **SQL-09.03** CTEs versus a nested subquery as a query-organization choice.
- **SQL-09.04** Recursive anchor and recursive member.
- **SQL-09.05** Termination and recursion limits when traversing a hierarchy.

**Outcome:** Refactor a nested report into readable stages and explain how a recursive example ends.

**Practice:** Build a two-stage sales summary; later trace a small employee hierarchy.

**Reference:** [MySQL 8.4 common table expressions](https://dev.mysql.com/doc/refman/8.4/en/with.html). Its `WITH RECURSIVE` syntax, restrictions, and recursion settings are MySQL-specific reference details; a CTE is not automatically a performance improvement.

## SQL 10 Window functions

- **SQL-10.01** `OVER`, `PARTITION BY`, and retaining detail rows.
- **SQL-10.02** Window ordering versus final result ordering.
- **SQL-10.03** `ROW_NUMBER`, `RANK`, and `DENSE_RANK`, including ties.
- **SQL-10.04** `LAG` and `LEAD` for neighbouring values.
- **SQL-10.05** Window aggregates, running totals, and moving calculations.
- **SQL-10.06** Frame boundaries and the difference between row-based and value-based frames.

**Outcome:** Add a ranking or running calculation without collapsing the original rows into groups.

**Practice:** Rank salaries within departments and compare each month's sales with the preceding month.

**Reference:** [SQLite window functions](https://www.sqlite.org/windowfunctions.html). Verify each engine's frame rules and supported function forms; a window's ordering does not itself guarantee final output order.

## SQL 11 Expressions and functions

- **SQL-11.01** Simple and searched `CASE` expressions.
- **SQL-11.02** `COALESCE` and deliberate treatment of missing values.
- **SQL-11.03** Text transformations, concatenation, and substring operations.
- **SQL-11.04** Numeric expressions, rounding, and result types.
- **SQL-11.05** Date/time extraction, comparison, and arithmetic.
- **SQL-11.06** Conversion functions and matching the result type to the question.

**Outcome:** Build a calculated result and explain any engine-dependent function choices.

**Practice:** Categorize salary bands and format an order report without silently replacing meaningful NULLs.

**References:** [Microsoft CASE reference](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/case-transact-sql?view=sql-server-ver17) and [MySQL 8.4 function reference](https://dev.mysql.com/doc/refman/8.4/en/built-in-function-reference.html). Function names, argument order, conversions, and date behaviour need database labels when relevant.

## SQL 12 Schema and data changes

- **SQL-12.01** Choosing data types and defining a table.
- **SQL-12.02** Primary/foreign keys, `NOT NULL`, `UNIQUE`, defaults, and check constraints.
- **SQL-12.03** `CREATE`, `ALTER`, and `DROP` in a schema's lifecycle.
- **SQL-12.04** `INSERT`, generated values, and inserting query results.
- **SQL-12.05** `UPDATE` and `DELETE` with explicit row-selection conditions.
- **SQL-12.06** Basic views as named queries and when to use them.

**Outcome:** Explain a small schema and reason about how a data-change statement affects its rows and constraints.

**Practice:** Design a small orders table and predict a targeted update's result before applying it in an external practice environment.

**References:** [CS50 Designing](https://cs50.harvard.edu/sql/notes/2/), [Microsoft data modification](https://learn.microsoft.com/en-us/training/modules/modify-data-with-transact-sql/), and [CS50 Viewing](https://cs50.harvard.edu/sql/notes/4/). SQLite type affinity, generated-value syntax, supported table alterations, and view updateability need engine context.

## SQL 13 Relational design and transactions

- **SQL-13.01** One-to-one, one-to-many, and many-to-many relationships.
- **SQL-13.02** Candidate, primary, foreign, and composite keys.
- **SQL-13.03** Repeated data, modification anomalies, and functional dependencies.
- **SQL-13.04** First, second, and third normal forms at an introductory level.
- **SQL-13.05** Atomicity, consistency, isolation, and durability.
- **SQL-13.06** Transaction boundaries, autocommit, `COMMIT`, and `ROLLBACK`.

**Outcome:** Improve a small relational design and explain which related changes belong in one transaction.

**Practice:** Normalize a customer/order example and describe an all-or-nothing balance transfer.

**References:** [CS50 Designing](https://cs50.harvard.edu/sql/notes/2/), [Microsoft normalization](https://learn.microsoft.com/en-us/training/modules/explore-performance-based-design/2-describe-normalization), and [MySQL 8.4 InnoDB ACID model](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html). Transaction behaviour and guarantees depend on the engine and configuration; [MySQL's implicit-commit reference](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) illustrates why not every DDL statement can be rolled back.

## SQL 14 Performance and interview practice

- **SQL-14.01** Why indexes help some access patterns and carry storage/write costs.
- **SQL-14.02** Reading a labelled engine's query-plan output.
- **SQL-14.03** Scans, indexed searches, and avoidable work in a report.
- **SQL-14.04** Duplicate detection and highest-value questions with explicit tie handling.
- **SQL-14.05** Debugging incorrect joins, filters, grouping, and NULL assumptions.
- **SQL-14.06** Comparing alternative solutions for correctness before investigating speed.

**Outcome:** Explain a query's result and use plan evidence to discuss a possible improvement.

**Practice:** Diagnose an inflated department total and solve a second-highest-salary question with a defined tie policy. These are project-authored practice ideas, not copied interview questions or official examination items.

**References:** [CS50 Optimizing](https://cs50.harvard.edu/sql/notes/5/) and [SQLite EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html). Query-plan formats and index options are engine-specific; adding an index does not guarantee a faster query.

## Keyword lookup

| Find | Go to |
| --- | --- |
| ACID, autocommit, COMMIT, ROLLBACK | [SQL-13](#sql-13-relational-design-and-transactions) |
| Aliases, DISTINCT, SELECT | [SQL-02](#sql-02-basic-queries) |
| AVG, COUNT, MIN, MAX, SUM | [SQL-05](#sql-05-aggregate-functions) |
| CASE, COALESCE, dates, strings | [SQL-11](#sql-11-expressions-and-functions) |
| Constraints, CREATE, ALTER, DROP | [SQL-12](#sql-12-schema-and-data-changes) |
| CTE, WITH, recursion | [SQL-09](#sql-09-common-table-expressions) |
| EXISTS, UNION, INTERSECT, EXCEPT, MINUS | [SQL-08](#sql-08-subqueries-and-set-operations) |
| GROUP BY, HAVING | [SQL-06](#sql-06-grouping) |
| Indexes, query plans, interview practice | [SQL-14](#sql-14-performance-and-interview-practice) |
| INSERT, UPDATE, DELETE, views | [SQL-12](#sql-12-schema-and-data-changes) |
| Inner, left, right, full, cross, self joins | [SQL-07](#sql-07-joins) |
| Keys, relationships, normalization | [SQL-13](#sql-13-relational-design-and-transactions) |
| LAG, LEAD, RANK, ROW_NUMBER, frames | [SQL-10](#sql-10-window-functions) |
| LIMIT, OFFSET, FETCH, ORDER BY | [SQL-04](#sql-04-sorting-and-limiting) |
| NULL, BETWEEN, LIKE, IN, WHERE | [SQL-03](#sql-03-filtering-and-missing-values) |

## Use in the app and future updates

Each indexed subtopic is a candidate for one or more focused flashcards using the mockup's Definition, Concept, Examples, and Syntax sections. The IDs identify curriculum entries; they do not automatically replace the future JSON/route IDs such as `joins-left-basic`. Keep that mapping explicit when the content collection is implemented.

Keep the 14 parent modules as the coverage denominator described in [the syllabus coverage model](syllabus.md#coverage-model). Adding subtopics or source links does not mark a learner's topic covered or assign proficiency. Topic completion remains an explicit learner action.

When a module changes, preserve its established index IDs, update its references and the concise syllabus summary where needed, and append a dated entry in [project status](status.md). Recheck source pages when writing database-specific cards. Stored procedures, triggers, administration, replication, and sharding can be considered later; they are not additional core modules in this index.
