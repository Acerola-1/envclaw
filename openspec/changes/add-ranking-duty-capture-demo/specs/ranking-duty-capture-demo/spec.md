## ADDED Requirements

### Requirement: Configure a concentration-ranking output
The system SHALL present an interactive concentration-ranking fixture where a user can set the ranking scope, period, and target city before saving a duty output.

#### Scenario: Save a daily city ranking
- **WHEN** the user selects daily city ranking for a province and target city and saves the current output
- **THEN** the system records those values in the local duty definition and shows the resulting output in the duty summary

### Requirement: Separate time intent from observed page time
The system SHALL display the fixture's observed timestamp separately from the time intent saved for unattended execution.

#### Scenario: Use latest published data
- **WHEN** the user saves a ranking view with the default latest-published-data option
- **THEN** the saved definition uses latest-published-data and does not treat the displayed timestamp as a fixed future execution time

#### Scenario: Fix the observed time for a historical review
- **WHEN** the user chooses fixed observed time while saving
- **THEN** the saved definition records the observed timestamp as its fixed-time intent

### Requirement: Simulate the unattended execution contract
The system SHALL allow the user to run a local rehearsal after saving an output and SHALL show the ordered operations that a future Hermes runner would perform.

#### Scenario: Rehearse a saved ranking output
- **WHEN** the user starts rehearsal for a saved ranking definition
- **THEN** the system shows the selected ranking configuration, time intent, and a successful simulated output state without creating a real job or accessing an external platform

### Requirement: Keep the demo separate from production scheduling
The system SHALL expose the demo as an additive Envclaw route and SHALL not create a cron job, persist credentials, or invoke a browser automation runtime.

#### Scenario: Leave the demo
- **WHEN** the user navigates away from the concentration-ranking demo
- **THEN** no production job or external side effect has been created
