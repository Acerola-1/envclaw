## ADDED Requirements

### Requirement: Shared preflight checking

All Mapairs screenshot skills SHALL use the shared preflight checking function to verify the runtime environment before starting browser operations. Preflight SHALL check:

1. Python version >= 3.10
2. Playwright module can be imported
3. Chromium executable exists and can be launched
4. `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` environment variables are set
5. Network can resolve `mapairs.com` domain

#### Scenario: All checks pass
- **WHEN** all preflight checks pass
- **THEN** preflight prints `PREFLIGHT: OK` and continues execution

#### Scenario: Multiple checks fail
- **WHEN** multiple preflight checks fail
- **THEN** preflight collects all failure messages
- **AND** fails immediately with a list of all problems
- **AND** does NOT start the browser

### Requirement: Shared Mapairs login

All Mapairs screenshot skills SHALL use the shared login function that:
1. Navigates to the login page
2. Fills username and password from environment variables
3. Clicks login button
4. Handles the "login device limit reached" dialog by clicking "logout other devices" until the dialog clears
5. Waits for navigation to the post-login page

The login function SHALL NOT hardcode credentials; it always uses the environment variables.

#### Scenario: Successful login
- **WHEN** credentials are correct and no device limit is hit
- **THEN** login completes successfully
- **AND** function returns after navigation to the overall situation page

#### Scenario: Device limit reached and cleared
- **WHEN** login hits "login device quantity reached" dialog
- **THEN** the function automatically clicks "logout other devices" to clear the limit
- **AND** continues login after dialog is dismissed

### Requirement: Base URL configuration

The base URL for Mapairs SHALL be configurable via a common setting. The default SHALL be the internal network URL `http://192.168.4.25:8095` for development, and can be changed to the public internet URL in production.

#### Scenario: Default base URL used
- **WHEN** no custom base URL is configured
- **THEN** `http://192.168.4.25:8095` is used

### Requirement: Screenshot output naming

Screenshot files SHALL be named with a consistent pattern:
```
{function-name}_{region}_{timestamp}.png
```
Example: `one-map_1309a14a1_20260722_143000.png`

All screenshots SHALL be written into the task's output directory provided by the caller.

#### Scenario: Screenshot named correctly
- **WHEN** one-map screenshot is generated for region `1309a14a1` at 2:30 PM July 22 2026
- **THEN** filename is `one-map_1309a14a1_20260722_143000.png`

### Requirement: Output artifact reporting

After successful screenshot capture, the skill SHALL print:
```
ARTIFACT:<absolute-path>
MEDIA:<absolute-path>
```
This format is recognized by Hermes and enables automatic delivery to the configured channel.

#### Scenario: Successful output
- **WHEN** screenshot is saved to `/path/to/image.png`
- **THEN** the skill prints exactly `ARTIFACT:/path/to/image.png` on stdout
- **AND** prints exactly `MEDIA:/path/to/image.png` on stdout
