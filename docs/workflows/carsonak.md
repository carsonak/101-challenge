# carsonak's optional workflow

Read the repository's own AGENTS.md before acting. When reading this file as workspace-root `AGENTS.md`, locate the main worktree, the name of the directory ends with `-main`, then locate the active checkout using `git worktree list` from a registered checkout and read `<active-checkout>/AGENTS.md`; in the named example layout, the permanent checkout's guide is `101-challenge-main/AGENTS.md`. When reading this file at its tracked location, the guide is `../../AGENTS.md`.

This tracked document describes a personal workflow, not required contributor setup. Its workspace-root hard link enables agent discovery without adding personal preferences to the repository guide. Apply this workflow when requested or established by the session context. The active checkout's `CONTRIBUTING.md` governs shared developer practices; its `AGENTS.md` governs agent authorization and safety. Relative Markdown links below resolve from this document's tracked location, `docs/workflows/carsonak.md`, rather than from its workspace-root hard link.

## Discover or adopt a workspace

From any clone, discover the repository root with `git rev-parse --show-toplevel` and inspect `git worktree list`. The clone may have any name and may already be a linked worktree. Use registered worktree paths to identify the permanent original checkout; never infer it from a directory suffix or assume the parent directory is a configured workspace.

For an existing workspace, retain its configured paths. For a new ordinary clone, leave its name and location intact. Choose a writable sibling location for task worktrees and explicitly establish a writable artifact directory outside every repository/worktree. Use the clone's parent only when it is appropriate and authorized for that purpose; otherwise choose separate locations. Do not move or rename the clone to match an example.

Typical configured layout:

```text
<workspace>/
├── AGENTS.md                         # Local hard link to the personal workflow
├── <original-clone>/
├── 101-challenge-feat-<topic>/
├── 101-challenge-fix-<topic>/
├── 101-challenge-exp-artwork-<variant>/
└── artifacts/<task-or-experiment>/
```

The original checkout retains Git metadata. Preserve it; never delete, rename, or detach it as task cleanup. Run repository commands from the owning checkout. Do not commit machine-specific workspace settings or artifact paths.

## Workspace agent discovery setup

After choosing the workspace and identifying the permanent original checkout, create a hard link from its tracked `docs/workflows/carsonak.md` to `<workspace>/AGENTS.md`. The workspace file remains outside Git; the repository's own AGENTS.md remains a separate file. Do not overwrite an existing workspace guide without inspecting it and resolving any conflict.

For the example layout with a clone named `101-challenge-main`, run from the workspace root:

```bash
ln 101-challenge-main/docs/workflows/carsonak.md AGENTS.md
stat -c '%d:%i %h %n' AGENTS.md 101-challenge-main/docs/workflows/carsonak.md
```

Adapt the source path for an ordinary clone with a different name. Matching device/inode values confirm the hard link; both paths refer to the same contents. Hard links require the source and destination to be on the same filesystem. If linking fails, leave existing files intact and resolve the layout before proceeding.

Git does not preserve hard-link relationships across clones. Set up the link locally for each workspace. Checkout changes and editors that replace files by renaming can break the relationship; verify it after updating or editing the tracked workflow. If the workspace path is a stale link, inspect both versions, preserve any needed edits, and recreate only that local link within authorized scope. Never unlink or replace the repository's agent guide as part of this setup.

Read the active checkout's own AGENTS.md for branch-specific repository instructions. The workspace workflow is a discovery entrypoint and personal context, not a substitute for those instructions.

## Task worktrees

Inspect branch, HEAD, upstream, status, registered worktrees, and baseline freshness before acting. A branch can be checked out in only one worktree. Shared objects, refs, and repository configuration can affect other tasks.

Use `feat/<topic>`, `fix/<topic>`, and `exp/artwork-<variant>` branches and the corresponding sibling directory names above. Verify the intended integration baseline exists; do not assume a local or remote branch is present. Ordinary feature worktree creation needs a baseline commit. Establish missing history or integration branches only within an authorized bootstrap task.

Example from an original checkout with a verified `develop` branch and a chosen available sibling path:

```bash
git status --short --branch
git worktree list
git rev-parse --verify develop
git worktree add ../101-challenge-feat-reporting -b feat/reporting develop
```

Give concurrent tasks exclusive checkouts, branches, and file scopes. Coordinate contracts and migrations. Follow contributor resource-isolation rules; especially ensure that experiment workers cannot consume another task's jobs. Worktree creation for authorized implementation does not authorize commits, pushes, merges, delegation, or destructive cleanup.

## Plans and artifacts

Follow [plan-directory conventions](../../plans/README.md). Keep related plans grouped, update verified progress incrementally, and reconcile branch-local plan changes during integration. Multiphase groups use `OVERVIEW.md` for the bird's-eye view and current progress; README provides discovery and reading guidance.

Keep scratch scripts, raw logs, profiling output, session notes, verification manifests, and temporary renders in the configured external `artifacts/<task-or-experiment>/` directory. Separate tasks and variants. Keep secrets and private participant data out of artifacts. Do not copy or stage artifacts into a repository; an external directory needs no tracked ignore rule. Preserve durable findings in tracked documentation without workstation paths or private session details.

## Artwork experiments

Use dedicated experiment worktrees, synthetic versioned inputs, and isolated outputs. Group experiment plans by initiative and variant. Record generator/configuration/input versions, provenance, reproducibility checks, and visual comparisons. Track a selected asset only when explicitly approved as a deliverable.

Discover the active artwork contract and release boundary through the relevant plan-directory README and domain documentation. Experiments must not alter core completion semantics, seed stability, or entitlement identity. Successful experiments alone do not authorize integration; require an explicit scope decision and appropriate privacy and contract verification before merging into the intended release.

## Cleanup

Plans and working artifacts are temporary and may be cleaned up regularly within authorized scope. Before removing a plan, preserve lasting requirements in domain documentation, architecture decisions in ADRs, and useful developer guidance in CONTRIBUTING. Check links, dependent work, and whether evidence still needs to be retained.

Before authorized worktree removal, verify clean status, no active process or task depends on it, and needed commits are reachable from the intended merged or pushed branch. Prefer normal `git worktree remove` and `git branch -d`; do not force away unmerged or dirty work. Branch deletion and artifact removal require authorization for their targets. Preserve the original repository and shared metadata. Never treat routine cleanup as permission to delete unrelated repositories or personal files.
