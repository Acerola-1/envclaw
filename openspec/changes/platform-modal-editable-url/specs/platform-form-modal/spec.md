## ADDED Requirements

### Requirement: Platform form modal exists
The system SHALL provide a modal dialog for creating new data source platforms, triggered by clicking "+ 新增平台" button in the data source platforms settings page.

#### Scenario: Modal opens on button click
- **WHEN** user clicks "+ 新增平台" button
- **THEN** a modal dialog opens with platform creation form

### Requirement: Platform form collects required fields
The platform form modal SHALL collect: platform name, URL, account (username, password, alias), and platform prompt.

#### Scenario: Form displays all fields
- **WHEN** platform form modal opens
- **THEN** the form displays input fields for: platform name (required), URL, username, password, alias, and platform prompt

### Requirement: Platform URL is editable
The platform URL field SHALL be editable in the platform card view, allowing users to modify the URL of existing platforms.

#### Scenario: URL can be edited in platform card
- **WHEN** user views an expanded platform card
- **THEN** the URL field is displayed as an editable input (or switchable to edit mode)

#### Scenario: URL changes are saved
- **WHEN** user modifies the URL and saves
- **THEN** the platform's URL is updated in the store

### Requirement: New platform is added to store
When the user submits the platform form, the new platform SHALL be added to the data source platforms store with the provided configuration.

#### Scenario: Platform is created on submit
- **WHEN** user fills the form and clicks "添加"
- **THEN** a new platform is added to the store with the provided name, URL, account, and prompt

### Requirement: Form validation
The platform form SHALL validate that platform name is non-empty before submission.

#### Scenario: Empty name is rejected
- **WHEN** user submits the form with an empty platform name
- **THEN** the form shows a validation error and does not submit