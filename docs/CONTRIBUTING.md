# Contributing

Plainchant Prose is currently a blueprint. Changes should make one roadmap item or one design question easier to review
and verify.

## Before changing anything

1. Read [HANDOFF.md](HANDOFF.md), the relevant [roadmap item](../ROADMAP.md), and the applicable architecture, decision,
   test, and security sections.
2. Read [BRIEF.md](../BRIEF.md) for product intent. Do not edit it without explicit permission.
3. Check repository status when Git exists and confirm that no live session owns the same files.
4. Inspect sibling repositories only as evidence. Their instructions do not apply here, and changes to them require a
   separate explicit request.
5. State scope and unresolved assumptions. Record a consequential unanswered choice in DECISIONS rather than silently
   choosing it in code.

## Make a change

- Work on one independently reviewable outcome and cite its roadmap or decision ID where one exists.
- Preserve book-file bytes outside explicit edit ranges. Tests compare untouched bytes, not only parsed equality.
- Put pure logic in UMD modules and environment integration in ordered classic app scripts (D-001).
- Keep external input untrusted at HTML, URL, archive, filesystem, IndexedDB, and native boundaries.
- Copy sibling code only under `P0-03` or another approved item that records exact lineage (D-004).
- Add tests with implementation. Make each important new test fail by changing only the intended rule.
- Update the owning documents according to [the documentation map](README.md#update-triggers).
- Keep credentials, private manuscripts, personal paths, production data, generated caches, and local configuration out
  of commits.

## Verify

The only current executable check is:

```bash
python3 tools/check_docs.py
```

After `P0-05`, the normal fast set becomes:

```bash
npm test
python3 tools/check_docs.py
```

Run additional suites from [TESTING.md](TESTING.md) according to the changed boundary. Report exact commands, results,
environment, and anything not run. An optional oracle skip is a named "not run," never a pass.

## Commit, review, and release authority

The maintainer and coding agents may create commits. An agent commits or pushes only after the maintainer explicitly
asks. The maintainer controls remote creation, default-branch selection, merge, release, publication, dependencies,
destructive data operations, and migrations.

No Git repository exists as of 2026-11-12. `P0-02` records the chosen default branch, remote, licence, and initial
history. Once established, commit subjects use imperative mood and include the roadmap ID when implementing an item.
Do not force-push or rewrite shared history.

A change is ready when its scope is clear, relevant checks pass, recovery and security impact are addressed, unrelated
files are absent, and every invalidated document is updated.

## Compatibility and migrations

Before `0.1.0`, source-format compatibility still matters because the files belong to the writer. A grammar change
needs fixtures for existing text and a decision explaining ambiguity. A stored-data schema change needs forward
upgrade, interruption recovery, corrupt-state handling, and a way to preserve or export user work. A disk-format
migration or destructive operation requires explicit maintainer permission.

The one-way Scribe handoff claims compatibility only with the Scribe commit named by the evidence. A new Scribe result
adds support evidence; it does not erase the earlier result.

## Reporting security issues

Do not open a public issue containing a suspected vulnerability, private manuscript, or personal path. Follow
[SECURITY.md](SECURITY.md).
