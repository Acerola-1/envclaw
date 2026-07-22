## ADDED Requirements

### Requirement: Store Mapairs credentials after successful login

The system SHALL store the user's Mapairs username and plaintext password in encrypted form after successful external platform login. The credentials SHALL be encrypted using the system-wide AES-256-GCM key before storage.

Because the SM2 keypair used for login belongs to the Mapairs platform (Envclaw only holds the public key), the backend CANNOT decrypt the SM2 ciphertext. Therefore the frontend SHALL send the plaintext password alongside the SM2 ciphertext, and the backend SHALL AES-encrypt that plaintext for storage.

#### Scenario: Successful platform login stores credentials
- **WHEN** user successfully logs in to Mapairs platform via Envclaw external login
- **AND** the frontend included the plaintext password in the login request
- **THEN** Envclaw encrypts the plaintext username and password using AES-256-GCM
- **AND** Envclaw stores the encrypted credentials in the `envclaw_platform_accounts` table with `platform_id = 'mapairs'`
- **AND** the original username and password SHALL NOT be logged or written to disk in plaintext

#### Scenario: Retrieve credentials for skill execution
- **WHEN** a Mapairs screenshot skill executes
- **THEN** the system retrieves the encrypted credentials from the database
- **AND** decrypts to get plaintext username and password
- **AND** injects them as environment variables `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` into the Hermes gateway process that runs the Python script
- **AND** the gateway is restarted after a login stores new credentials so the running process picks up the change

#### Scenario: Fail execution when no credentials stored
- **WHEN** a Mapairs screenshot skill executes but no credentials are stored
- **THEN** the skill fails immediately with a clear error message indicating that Mapairs login is required

### Requirement: One credential per user

Each Envclaw user SHALL have exactly one set of Mapairs credentials stored. When the user logs in again with different credentials, the existing credentials SHALL be replaced with the new ones.

#### Scenario: Repeated login updates credentials
- **WHEN** user logs in to Mapairs again with different credentials
- **THEN** the old credentials are replaced by the new credentials
- **AND** all subsequent screenshot tasks use the new credentials
