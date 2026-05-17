## ADDED Requirements

### Requirement: User can attach Obsidian context to AI execution
The system SHALL let the user choose which supported Obsidian context sources to attach to an AI execution request.

#### Scenario: Attach current note
- **WHEN** the user enables the current note context source before execution
- **THEN** the system includes the current note content in the execution context payload

#### Scenario: Attach daily workflow context
- **WHEN** the user enables supported daily workflow context such as today's Journal or today's tasks before execution
- **THEN** the system includes those selected sources in the execution context payload

### Requirement: Context attachment is explicit
The system SHALL not automatically attach all available vault context to an AI execution.

#### Scenario: Run without optional context
- **WHEN** the user runs a provider command without selecting any optional context source
- **THEN** the system executes the command using only the entered prompt and required provider metadata
