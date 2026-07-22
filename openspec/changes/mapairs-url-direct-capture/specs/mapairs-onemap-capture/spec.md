## ADDED Requirements

### Requirement: Accept structured one-map configuration and generate screenshot

The system SHALL accept a structured one-map (一张图) configuration from the task, build the full URL with query parameters, navigate directly to that URL using Playwright, and generate a screenshot according to the configuration.

#### Scenario: Generate one-map screenshot with given configuration
- **WHEN** task execution provides a valid one-map configuration
- **AND** the configuration includes theme, mode, zoom, factor, windWaves, region, timeType, leftPanel settings
- **THEN** the skill builds the full URL with all query parameters correctly mapped
- **AND** Playwright navigates directly to the constructed URL
- **AND** waits for the map to fully render
- **AND** captures a screenshot according to the configured screenshot scope
- **AND** outputs the absolute path to the screenshot image file

### Requirement: Parameter mapping matches URL convention

The configuration parameters SHALL be mapped to URL query parameters exactly as defined by the target webpage:

| Config field | URL parameter | Notes |
|--------------|---------------|-------|
| `theme` | `theme` | `Light` → `Light`, `dark` → `Dark` |
| `mode` | `mode` | `monitoring`/`interpolation` as-is |
| `zoom` | `zoom` | numeric value as-is |
| `factor` | `factor` | pollution factor as-is |
| `windWaves` | `windWaves` | boolean → `true`/`false` |
| `region` | `region` | region code as-is |
| `timeType` | `timeType` | `hourly`/`dt`/`daily` as-is |
| `leftPanel` | `leftPanel` | boolean → `true`/`false` |

#### Scenario: Parameter mapping is correct
- **WHEN** configuration is: `{theme: "light", mode: "monitoring", factor: "PM2.5", windWaves: true, region: "1309a14a1", timeType: "daily", leftPanel: false}`
- **THEN** constructed URL is: `/oneMap?theme=Light&factor=PM2.5&leftPanel=false&region=1309a14a1&windWaves=true&mode=monitoring&timeType=daily`
- **AND** Playwright navigates to this URL on the correct base domain

### Requirement: Use injected credentials

The skill SHALL use the `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` environment variables injected by Envclaw for login. The credentials SHALL NOT be read from anywhere else.

#### Scenario: Login with injected credentials
- **WHEN** the skill starts
- **THEN** it reads username and password from environment variables
- **AND** logs into Mapairs before navigating to the target URL

### Requirement: Preflight verification

Before opening the browser, the skill SHALL run preflight verification to check:
- Python version >= 3.10
- Playwright for Python is installed
- Chromium browser is installed
- `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` are set
- Network can resolve Mapairs domain

Any preflight failure SHALL fail immediately with a clear error message listing all problems.

#### Scenario: Preflight detects missing credentials
- **WHEN** `MAPAIRS_USERNAME` or `MAPAIRS_PASSWORD` is not set
- **THEN** skill fails before starting browser with error message: "Missing Mapairs credentials: Envclaw has not injected MAPAIRS_USERNAME and MAPAIRS_PASSWORD"

### Requirement: Only screenshot when requested

If the configuration does not include `includeScreenshot: true`, the skill SHALL NOT generate a screenshot artifact.

#### Scenario: Screenshot disabled
- **WHEN** configuration has `includeScreenshot: false`
- **THEN** skill skips screenshot generation
- **AND** no image artifact is produced

### Requirement: Respect screenshot scope

The skill SHALL crop the screenshot according to the configured `screenshotScope`:
- `mapOnly`: only the map area
- `mapLegend`: map + legend
- `fullPage`: entire page

#### Scenario: Crop to map only
- **WHEN** `screenshotScope: "mapOnly"`
- **THEN** calculate bounding box of just the map element
- **AND** crop screenshot to that region
