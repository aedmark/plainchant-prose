# Prose source format

This document is the normative v0.1 source grammar for Plainchant Prose. It defines the writer-owned `book.txt`
index, chapter files, diagnostics, recovery, and source ranges. The fixture books under
`test/fixtures/prose-source/` provide executable examples. `P1-02` implements this contract; this document does not
claim that the current application parses Prose source yet.

## Shared rules

- Every source file is UTF-8. A UTF-8 byte-order mark is tolerated and produces a warning; it is outside the first
  logical line's content.
- LF and CRLF line endings are accepted. A parser records the observed style, and a range splice preserves every
  untouched code unit.
- Source ranges are zero-based, half-open UTF-16 code-unit offsets, written `[start, end)`. JavaScript
  `source.slice(start, end)` returns the exact covered source. Astral characters therefore occupy two offsets.
- The parser derives a model and diagnostics without modifying source. An explicit user action performs every
  deletion, rewrite, or conflict resolution as an undoable source edit.
- Horizontal whitespace means space or tab. Control characters are refused in paths and metadata names; ordinary
  source text containing an unsupported construct remains literal.
- A warning preserves source and permits editing. A conflict remains visible and unresolved. Export is blocked only
  by the conditions named under [Export gate](#diagnostics-and-export-gate).

## `book.txt`

### Metadata block

The opening metadata block ends at the first blank line. Every nonblank line in the block has the form
`Key: value`; the first colon separates the key from the value. Leading and trailing horizontal whitespace around
the semantic key and value is ignored, while the original source remains unchanged.

The required keys are `Title`, `Author`, and `Language`. The optional standard keys are `Publish Date`, `Publisher`,
and `Series`.

`Language` is a BCP 47 language tag. `Publish Date` accepts `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. The parser recognizes
ASCII case variants of a standard key, preserves the spelling, and warns that the canonical spelling is preferred.
An empty required value is a conflict.

Each standard key has at most one selected occurrence. Multiple occurrences remain unresolved warnings while the
book is edited; no occurrence silently wins. Before export, the user selects the occurrence to keep. The resolution
removes the other occurrences in one undoable source edit.

An unknown key remains an unresolved conflict until the user rejects the line or converts it to generalized custom
metadata:

```text
Custom: Imprint = North Star Press
Custom: Edition = Revised
```

The first equals sign separates a custom name from its value. A custom name is nonempty and contains only ASCII
letters, numbers, spaces, hyphens, or underscores. Leading and trailing horizontal whitespace is ignored semantically
and preserved in source. Repeated custom names use the same user-selected resolution as duplicate standard keys.
Custom metadata is preserved in the book model. It has no EPUB mapping until a later accepted rule defines one.

`book.txt` has no comment syntax in v0.1. An unrecognized nonblank line in either block remains source and is an
unresolved conflict.

### Ordered section

After the blank line, the ordered section contains optional part labels and chapter entries:

```text
Part: Part One
chapters/01-harbour.md
chapters/02-the-letter.md
Part: Part Two
chapters/03-crossing.md
```

A `Part: value` line applies to following chapter entries until the next part line. Parts are optional. An empty part
value produces a warning.

A chapter entry is a relative path ending in lowercase `.md`; subdirectories are allowed. A valid path uses `/`
separators, is not absolute, has no empty, `.` or `..` component, has no backslash or control character, and does not
name `research/` or anything below it.

Duplicate paths and paths that collide after Unicode normalization or case-folding are conflicts. Every listed
chapter must exist, be readable, and be a regular file. Every manuscript `.md` file outside `research/` must be
listed. Missing, unreadable, duplicate, colliding, and unlisted files produce diagnostics; the application never
guesses reading order.

## Chapter files

### Title and blocks

The first physical line, after an optional byte-order mark, is a nonempty chapter title with exactly one hash and one
or more following spaces:

```text
# The Harbour
```

Another level-one heading is unsupported literal source and a diagnostic. A missing, empty, or duplicate chapter
title is a conflict. Section headings use `##` through `######`, followed by one or more spaces and nonempty text.
They may contain supported bold and italic spans, but no footnote reference. A heading without the required space or
text remains literal and produces a diagnostic.

Blank lines delimit paragraphs. Consecutive ordinary lines belong to one paragraph and render with a soft space
between them. Hard line breaks, lists, fenced or indented code, images, links, tables, thematic rules other than the
exact Prose scene break, and raw HTML are unsupported. They remain literal source; rendered angle brackets and all
other writer text are escaped.

### Scenes and synopses

Text after the chapter title begins an implicit first scene. A line containing only `* * *`, with optional outer
horizontal whitespace, starts the next scene. The scene-break range belongs to the following scene so a scene move
can carry its delimiter. A final scene break creates an empty scene and a warning. `***`, `---`, and `_ _ _` are
literal unsupported syntax, not scene breaks.

A synopsis is one nonempty line beginning `= ` immediately after the chapter title for the first scene or immediately
after a scene break for a later scene. No blank line may intervene. A scene has at most one synopsis. Synopsis text is
plain, nonprinting metadata; inline marks in it remain literal. A lone `=` is an empty synopsis marker. A misplaced,
empty, or duplicate synopsis remains literal source and produces a warning.

### Author notes

An author note begins with unescaped `[[` and ends at the first unescaped `]]`. It may be inline or multiline, does
not nest, and is entirely nonprinting. Removing a note inserts no automatic whitespace. Note and boneyard delimiters
inside an active note are literal.

An unclosed `[[` remains literal and produces an export-blocking warning so private text cannot enter an export by
accident. A stray `]]` remains literal and produces a warning.

### Boneyards

A boneyard begins with unescaped `/*` and ends at the first unescaped `*/`. It may be inline or multiline, does not
nest, and is entirely nonprinting. Note and boneyard delimiters inside an active boneyard are literal.

An unclosed `/*` remains literal and produces an export-blocking warning. A stray `*/` remains literal and produces
a warning.

### Emphasis

`*italic*` and `**bold**` are the supported emphasis forms. Bold delimiters are recognized before italic delimiters.
An opener cannot be followed by whitespace; a closer cannot be preceded by whitespace. Emphasis cannot cross a
paragraph boundary. Empty or unclosed delimiters remain literal. Combined `***bold italic***`, underscore emphasis,
strikethrough, and every other emphasis form remain literal unsupported syntax.

### Quotes

One or more consecutive lines beginning `> ` form one quote block. A blank line ends it. Quotes do not nest. Bold,
italic, and footnote references are recognized inside a quote. An empty `>` line or a line beginning `>>` remains
literal and produces a diagnostic.

### Footnotes

A footnote reference is `[^label]`. A definition begins `[^label]: definition`. Labels are case-sensitive and contain
no whitespace, closing bracket, or control character. A definition may appear anywhere after the chapter title and is
nonprinting at its source location. Lines indented by four spaces or one tab immediately after a definition continue
that definition. Bold and italic are supported inside definition content; notes, boneyards, and nested footnote
references are unsupported there and remain literal with diagnostics.

Each referenced label has exactly one reference and one definition in v0.1. Duplicate references, duplicate
definitions, and a reference without a definition are conflicts. A definition without a reference produces a
warning. Valid footnotes are exported as endnotes.

## Escaping and precedence

A backslash escapes the following ASCII punctuation character. The punctuation remains printable and the escape
backslash does not. A backslash before any other character remains literal.

At a given source position, constructs are recognized in this order:

1. escapes;
2. closed author notes and boneyards;
3. line-level blocks, including titles, headings, scenes, synopses, quotes, and footnote definitions;
4. footnote references;
5. bold;
6. italic; and
7. literal text.

An active nonprinting construct consumes its nested delimiters as literal content. A malformed or unsupported mark is
never silently discarded.

## Diagnostics and export gate

Diagnostics contain a stable code, severity, file-relative path, exact source range where possible, and a concise
message. The editor shows warnings and conflicts without preventing source edits. Preview uses only unambiguous data
and excludes every recognized nonprinting construct.

Export is blocked by:

- a missing or empty required metadata value;
- unresolved duplicate, unknown, or invalid metadata;
- an unsafe, duplicate, colliding, missing, unreadable, or unlisted chapter path;
- a missing, empty, or duplicate chapter title;
- an unclosed author note or boneyard; or
- a reference without a definition, a duplicate reference, or a duplicate definition.

Unsupported Markdown that can safely remain literal does not block export. Every export attempt reruns the complete
duplicate and conflict check across `book.txt` and all ordered chapters, regardless of earlier editor diagnostics.

## Fixture contract

Each directory under `test/fixtures/prose-source/` contains source files and an `expected.json`. A manifest records
the grammar features exercised, source ranges with the exact expected slice, derived values that `P1-02` must return,
diagnostics with their export effect, and the fixture-level `exportBlocking` result.

The fixture consistency test checks schema, paths, UTF-16 offsets, exact slices, diagnostics, and required feature
coverage without implementing the parser. Embedded source is permitted only for byte-order-mark, CRLF, or isolated
Unicode range cases where a separate physical file would hide the relevant encoding in review.
