# Restful Booker – Playwright + Gherkin tests

UI tests for the room booking flow on <https://automationintesting.online/>, written with
Playwright, TypeScript and Cucumber (Gherkin). They cover two scenarios taken from my manual
test cases.

## Scenarios

| Tag | Manual case | What it does |
|---|---|---|
| `@e2e` | TC-25 | Opens the Single room from the home page, picks a 1-night stay, checks the price summary (room rate + £25 cleaning fee + £15 service fee), books with valid guest details, and checks the API returns 201 and the confirmation screen shows the dates. |
| `@negative` | TC-19 | Tries to book with an invalid email. Checks the API returns 400, the only error shown is "must be a well-formed email address", no confirmation appears, and the form keeps the typed values. |

The scenarios are in `features/room-reservation.feature`.

## Setup

Requires Node.js 22 or newer.

```bash
npm ci
npm run install:browsers   # downloads Playwright's Chromium
```

## Running the tests

| Command | What it does |
|---|---|
| `npm test` | Runs both scenarios |
| `npm run test:e2e` | Runs only the `@e2e` scenario |
| `npm run test:negative` | Runs only the `@negative` scenario |
| `npm run test:headed` | Runs with a visible browser |
| `npm run test:dry-run` | Checks every Gherkin step has a definition, without opening a browser |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run verify` | Type check, lint and dry run together |
| `npm run report` | Opens the HTML report |
| `npm run trace -- <file.zip>` | Opens a failure trace in the Playwright trace viewer |

Optional environment variables: `BASE_URL` (default is the live demo site), `HEADED`, `SLOW_MO`,
`BROWSER_PATH` (use an already-installed Chrome/Chromium), `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

## Reports

After a run, `reports/` contains:

- `cucumber-report.html` – the main report (and `cucumber-report.json`)
- `screenshots/` – a full-page screenshot for each failed scenario (also embedded in the HTML report)
- `traces/` – a Playwright trace zip for each failed scenario

Passing scenarios do not keep a trace or screenshot. The `reports/` folder is git-ignored.

## Project structure

```
features/    Gherkin feature file
steps/       Step definitions
pages/       Page objects (home page, reservation page)
support/     Cucumber world, hooks, shared expect, small API helper
config/      Environment settings and Cucumber config
test-data/   Guest data (JSON) and booking date generation
reports/     Generated output
.github/     GitHub Actions workflow
```

## Design decisions

- **Cucumber runs the tests, Playwright drives the browser.** Each scenario gets its own browser
  context, so no state is shared between scenarios.
- **Page objects hold locators and actions; the steps hold the assertions.** Locators use roles and
  accessible names where possible. The room cards and booking card have no role or test id, so
  those use the site's own CSS classes.
- **Dates are set through the URL.** The reservation page reads `?checkin=...&checkout=...`, which
  is also how the home page's "Book now" links work. I used this instead of dragging across the
  calendar, which is fragile to automate.
- **Dates are generated, not fixed.** The demo site is shared and keeps bookings, so the fixed dates
  from the manual case would clash on a second run. The test reads the room's existing bookings and
  picks a free stay.
- **Clean-up.** After the E2E scenario, the booking is deleted through the admin API using the
  public demo login (`admin` / `password`). If clean-up fails, a warning is printed and the
  scenario result is not changed.
- **The nightly rate is read from the page,** so the price check still works if the demo's price
  changes. It checks the arithmetic and the two fixed fees.

## Execution status

- Type check, lint and the Gherkin dry run pass.
- The scenarios were run against a local build of the application's published front-end source
  with a stubbed backend, not the live site. Both passed, each on its own and together, three
  times each.
- **They have not been run against https://automationintesting.online/.** The live site may
  differ from the source I built from.
- The GitHub Actions workflow is included but has not been run on GitHub.

## Limitations

- Chromium only.
- Only two scenarios; most of the manual cases are not automated.
- The booking is checked through the UI and the booking API response. It is not checked on the
  admin side (messages or the admin booking list).
- The admin message that the site creates for each booking is not cleaned up.
- The date check depends on the room report endpoint the page itself uses.

## With more time

- Add the other form-validation cases (blank fields, short phone number) as a Scenario Outline.
- Cover the duplicate-booking case (TC-28) and check how the UI handles the 409.
- Check the booking in the admin area, and clean up the admin message.
- Run on Firefox and WebKit, and add retries with trace-on-retry in CI.
- Add a Playwright API-level test for the booking endpoint.
