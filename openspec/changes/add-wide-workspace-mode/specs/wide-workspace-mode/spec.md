## ADDED Requirements

### Requirement: User can open Vault Atlas HQ in a wide workspace mode
The system SHALL allow the user to open Vault Atlas HQ in a wider workspace leaf instead of only using the right sidebar leaf.

#### Scenario: Open in main workspace
- **WHEN** the user triggers the wide workspace open action
- **THEN** the system opens or reuses Vault Atlas HQ in a main workspace leaf with more horizontal space than the default right sidebar flow

### Requirement: Sidebar mode remains available
The system SHALL preserve the existing sidebar-oriented opening behavior for users who prefer the compact layout.

#### Scenario: Continue using sidebar mode
- **WHEN** the user triggers the existing standard open action
- **THEN** the system keeps using the existing sidebar-oriented opening behavior
