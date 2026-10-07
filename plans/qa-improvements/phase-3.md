# Phase 3: Season administration and setup

Status: implemented; final verification is recorded in [OVERVIEW.md](OVERVIEW.md).

## Implementation

Dedicated season editors with draft/published/featured navigation, editable descriptions, unique public identifiers frozen on publication, UUID redirects, separate goals and milestones, and explicit historical publication reconciliation. New participation uses server-owned Africa/Nairobi. Join/Continue/Retry lead to the appropriate setup or detail route, with editable template drafts and required-goal validation.

## Acceptance and evidence

Migration tests preserve existing frozen timezones and unknown publication timestamps; domain tests reject client timezone overrides and duplicate or frozen identifiers. Browser coverage creates and publishes a season, edits the template, validates Start requirements, starts participation and exercises retry setup. Existing seasons without reliable publication evidence require an explicit administrator timestamp before backdating.

See the [item-by-item mapping](checklist.md). Live provider configuration, production email delivery and deployment are external release checks; local provider doubles and Mailpit verify application behavior.
