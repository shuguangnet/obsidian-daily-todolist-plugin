## ADDED Requirements

### Requirement: User can edit today's journal in a dedicated section
The system SHALL manage journal content inside a configured Journal heading section within today's Daily Note and SHALL allow the user to read and overwrite that section from the plugin UI.

#### Scenario: Open existing journal content
- **WHEN** the user opens the Journal tab and today's Daily Note contains a Journal heading section with content
- **THEN** the system displays the existing journal content in an editable textarea

#### Scenario: Save journal into an existing section
- **WHEN** the user saves text from the Journal tab and today's Daily Note already contains the configured Journal heading
- **THEN** the system overwrites only the Journal heading section content and preserves the rest of the note unchanged

#### Scenario: Save journal into a missing section
- **WHEN** the user saves text from the Journal tab and today's Daily Note does not contain the configured Journal heading
- **THEN** the system creates the Journal heading section and writes the journal content into that section

### Requirement: Journal title is configurable
The system SHALL allow the user to configure the heading name used for journal content, consistent with existing TodoList and Memo heading configuration.

#### Scenario: Use custom journal heading
- **WHEN** the user changes the configured Journal heading name in settings
- **THEN** the Journal tab reads and writes journal content under the updated heading name

### Requirement: User can access journal and source note quickly
The system SHALL provide direct navigation from the plugin to today's Daily Note while working with journal content.

#### Scenario: Open today's note from Journal tab
- **WHEN** the user clicks the open note action in the Journal tab
- **THEN** the system opens today's Daily Note in the workspace
