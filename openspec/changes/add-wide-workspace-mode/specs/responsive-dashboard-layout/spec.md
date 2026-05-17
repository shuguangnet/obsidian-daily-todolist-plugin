## ADDED Requirements

### Requirement: Core dashboard pages adapt to wide layouts
The system SHALL provide layout adaptations for wide workspace usage so core pages make better use of available horizontal space.

#### Scenario: Render home in wide mode
- **WHEN** Vault Atlas HQ is rendered in a wide workspace context
- **THEN** the Home page presents cards and sections using a wider multi-column layout than the compact sidebar presentation

#### Scenario: Render gantt in wide mode
- **WHEN** Vault Atlas HQ is rendered in a wide workspace context and the user opens Gantt
- **THEN** the Gantt page uses the wider available area to improve timeline readability

#### Scenario: Render AI panel in wide mode
- **WHEN** Vault Atlas HQ is rendered in a wide workspace context and the user opens AI Command Panel
- **THEN** the AI page uses the wider available area to improve prompt input and output readability

### Requirement: Compact layout remains usable
The system SHALL preserve a compact layout path for narrow sidebar contexts.

#### Scenario: Render in narrow sidebar
- **WHEN** Vault Atlas HQ is rendered in a narrow sidebar context
- **THEN** the system keeps using a compact layout that remains usable without requiring wide workspace mode
