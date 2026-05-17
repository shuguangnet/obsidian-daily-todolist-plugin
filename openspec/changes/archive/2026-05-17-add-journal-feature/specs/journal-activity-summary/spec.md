## ADDED Requirements

### Requirement: System summarizes monthly journal activity
The system SHALL surface basic journal activity for the currently viewed month so users can understand whether they are recording journals consistently.

#### Scenario: Count days with journal content
- **WHEN** the system renders a summary view for the current month
- **THEN** it shows the number of dates whose Daily Note contains non-empty Journal section content

### Requirement: System indicates whether today has journal content
The system SHALL surface whether today's Daily Note already contains journal content.

#### Scenario: Show today's journal presence
- **WHEN** the home or stats view is rendered for the current month
- **THEN** the system shows whether today's Daily Note contains non-empty Journal section content
