# Phase 1: Shared UI and authentication

Status: implemented; final verification is recorded in [OVERVIEW.md](OVERVIEW.md).

## Implementation

Shared shell, focused authentication/account/Home components, keyboard-accessible password controls and contextual help, focus-aware sticky navigation, persisted light/dark/system themes, reduced motion, and overlay toasts. Login, signup, verification, recovery and reset now have dedicated routes; verified email returns to login and successful login opens Home.

## Acceptance and evidence

Browser coverage exercises dedicated routes, login/signup switching, password reveal, verification and reset through Mailpit, mobile layout, persisted themes, reduced motion and notification geometry. Routine toasts do not move content; actionable failures remain dismissible.

See the [item-by-item mapping](checklist.md). Live provider configuration, production email delivery and deployment are external release checks; local provider doubles and Mailpit verify application behavior.
