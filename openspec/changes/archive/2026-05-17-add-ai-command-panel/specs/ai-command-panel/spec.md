## ADDED Requirements

### Requirement: User can run a controlled AI command from the plugin
The system SHALL provide an AI Command Panel that lets the user choose a configured provider, enter a prompt, execute a controlled command, and view command output inside the plugin.

#### Scenario: Run a provider command successfully
- **WHEN** the user selects a configured provider, enters a prompt, and starts execution
- **THEN** the system runs the corresponding provider command and displays its output in the panel

#### Scenario: Stop a running provider command
- **WHEN** the user stops an in-progress provider execution
- **THEN** the system terminates the running command and updates the panel status accordingly

### Requirement: User can configure desktop AI providers
The system SHALL allow the user to configure local AI CLI providers with executable path and runtime options required for execution.

#### Scenario: Configure provider path
- **WHEN** the user saves a provider executable path in settings
- **THEN** the AI Command Panel uses that configured provider for future executions
