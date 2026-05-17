## ADDED Requirements

### Requirement: User can save AI output back into the vault
The system SHALL provide explicit actions for saving AI output into supported Obsidian destinations.

#### Scenario: Save output to memo
- **WHEN** the user chooses to save AI output to Memo
- **THEN** the system appends the output as a new memo entry in today's Daily Note

#### Scenario: Save output to journal
- **WHEN** the user chooses to save AI output to Journal
- **THEN** the system appends or inserts the output into today's Journal section

#### Scenario: Save output as new note
- **WHEN** the user chooses to save AI output as a new note
- **THEN** the system creates a new markdown note with the output content in the configured location

### Requirement: Output saving is user-driven
The system SHALL not automatically persist AI output to the vault unless the user explicitly chooses a save action.

#### Scenario: Output remains ephemeral until saved
- **WHEN** a provider command finishes and the user does not trigger any save action
- **THEN** the system keeps the result in the panel without writing it into the vault
