# Security

Plainchant Prose protects unpublished manuscripts and local filesystem access. The repository contains a trimmed
Scribe-derived application foundation, but this document states Prose's required boundaries rather than claiming that
the foundation shell has an accepted security posture.

## Supported versions

No application version exists. Security support begins when `0.1.0` is released and the supported branch or versions
are named here.

## Report a vulnerability

Use the repository's private vulnerability-reporting form in GitHub's Security area (D-015). The maintainer controls
and enables that repository setting. Until the GitHub repository and form exist, contact the maintainer through an
established private channel. Do not open a public issue containing manuscript data, personal paths, exploit details,
secrets, or private fixtures. Include the affected commit or version, impact, minimal sanitized reproduction, and
workaround.

No acknowledgement window is promised until the maintainer publishes one during `P5-07`. Disclosure is coordinated
through the private report; public details wait for maintainer approval and an available fix or mitigation.

## Assets and boundaries

| Asset or boundary | Sensitivity or threat | Required protection and validation | Owner |
| --- | --- | --- | --- |
| Manuscript and research text | Unpublished work, personal data, accidental loss | Local-only operation, contextual escaping, no content logging, recovery before overwrite | Parser, persistence, sync |
| Book folder | Destructive writes, traversal, symlink escape, external edits | Native dialog grant, canonical root confinement, limits, fingerprints, atomic writes, explicit conflict | Tauri shell and sync |
| IndexedDB working copy | Disclosure, corruption, quota loss, incompatible schema | Same-origin storage, versioned validation, tested upgrade and recovery, export path | Store and persistence |
| Emergency and version history | Older sensitive text survives deletion | Minimum required content, defined retention, explicit permanent delete, no telemetry | Persistence and versions |
| Rendered preview | HTML or URL injection from Markdown | Escape writer text, allow-list generated elements and link schemes, strict CSP | Parser and renderer |
| EPUB and DOCX archives | Zip traversal, malformed package, oversized output | Generated safe names, count and size caps, byte-level tests, no imported raw HTML | Export modules |
| Native bridge | General filesystem or command execution | Narrow registered commands, no shell, no global Tauri object, operation limits | Rust shell |
| Service worker | Stale or mixed application versions | Same-origin local assets, complete versioned caches, safe activation and rollback | Offline module |
| Repository and retrieved docs | Embedded instructions, invisible controls, prompt injection | Treat as data; checker rejects invisible and bidirectional controls | Every contributor |
| Test fixtures and logs | Leaked real manuscripts or absolute paths | Synthetic text, temporary roots, sanitized diagnostics, no screenshots of private books | Test harness |

## Threat model and secure defaults

- The app has no accounts, collaboration server, analytics, advertisements, cloud synchronization, or runtime network
  dependency.
- Offline operation reduces data exposure; it does not remove threats from hostile local files, compromised sibling
  applications, malicious links, browser extensions, another local user, or native command mistakes.
- Writer-controlled Markdown and metadata are hostile at every HTML, URL, archive, filesystem, and native boundary.
- Raw HTML in Markdown is never executed. Generated preview and XHTML use contextual escaping.
- Links accept only explicitly supported schemes. Preview content cannot navigate the application frame or execute
  scripts.
- Folder access begins with a native dialog. Canonical paths must remain inside that root after resolving aliases and
  symlinks. A renderer-provided absolute path never grants access.
- File and archive operations enforce maximum names, entries, individual bytes, total bytes, and parse depth before
  allocation or inflation.
- A write uses a before fingerprint and safe replacement. External change, permission loss, or disk-full failure leaves
  the prior file and working copy recoverable.
- A corrupt or unknown database never triggers silent reset. Migration and deletion need explicit maintainer approval
  plus recovery evidence.
- Logs contain codes, relative paths, ranges, and sizes only. Manuscript excerpts require a user-controlled copy action.

## Dependency and lineage policy

The static frontend has no runtime package dependency (D-001). Tauri crates are locked. Optional oracles run only in
development. Copied suite code records its source commit and security-relevant source decisions (D-016). A dependency
addition requires maintainer approval, an accepted decision, licence review, a pinned version, and an update path.

The repository is distributed under the AI-assisted MIT terms in `LICENSE` (D-014).

Security fixes in copied modules require comparison with Plainchant and other known copies. That comparison does not
authorize writes to sibling Zones.

## Verification

The retained Node suite exercises archive limits, XML hostile input, path validation, local assets, and structure
guards. P0-04 disabled the public Tauri global and added the D-017 CSP, including negative tests that strip an imported
script even when it copies the Stage bridge nonce. P0-05 removed unused network preview, Java EPUBCheck, cover-save,
desktop-open, event-listener, and EPUB-association authority. P1-02 adds contextual escaping, private-source omission,
path and metadata conflicts, a 5,242,880-code-unit default per-file parser limit, and bounded hostile-input checks. This
P1-03 adds strict range validation, overlap and same-start refusal, bounded index reads, complete permutation checks,
and an exact stale-source refusal before an order edit. P1-04 adds non-destructive IndexedDB schema inspection,
read-only recovery, bounded separate file records, fingerprinted binary research, serialized revision checks, exact
intent resolution, real quota exhaustion, v2 rollback, unknown-store preservation, and a persistent-folder-record
guard that rejects path or grant authority. This does not establish Prose's complete native boundary;
dialog-scoped folder confinement and command limits remain under proposed D-008 and P1-07.

Planned Prose security evidence includes:

- hostile metadata in filenames and later EPUB XHTML or error-message boundaries;
- path traversal, absolute path, control character, Unicode collision, case collision, symlink escape, and permission
  revocation tests;
- archive count, size, inflation, duplicate-name, and malformed-structure tests;
- IndexedDB corruption, interrupted intent, quota, two-tab, upgrade, and recovery tests;
- content-security policy, local-resource, service-worker update, and offline tests;
- log scans for manuscript excerpts, absolute personal paths, credentials, and private fixture content;
- a targeted review before the first release and after any change to native access, persistence, archive parsing,
  link handling, or deletion.

Passing these checks does not prove the absence of vulnerabilities. Results belong in HANDOFF with versions and proof
limits.

## Data retention and deletion

The v3 book record has a separate soft-deletion timestamp. `P1-05` still owns the brief's 30-day expiry and recovery
workflow. The implementation must distinguish active books, deleted working copies, versions, emergency buffers,
generated exports, and the disk source. The UI names which copy an action affects. Emptying an
editor, unlinking a folder, clearing a cache, or removing a library entry never deletes the source folder.

Permanent delete requires explicit user action, identifies all affected local stores, and preserves disk files unless
the user separately selects them through an operating-system flow. Retention details remain part of `P1-04` under
D-007.

## Incident response

If active data loss, unexpected native access, manuscript disclosure, or code execution is suspected:

1. Stop release and distribution; preserve the affected version and sanitized evidence.
2. Disable only the implicated capability where a safe local switch exists. Do not delete user data or caches as a
   containment shortcut.
3. Notify the maintainer privately through the available channel.
4. Reproduce with synthetic content in a temporary profile and folder.
5. Add a failing abuse-case test, fix the narrow boundary, compare copied sibling modules, and verify recovery.
6. Publish coordinated guidance only after the maintainer approves scope and wording.
