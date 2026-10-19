# Automation-Playwright

Tests for the Restful Booker demo site <https://automationintesting.online/>, written with
Playwright, TypeScript and Cucumber (Gherkin). There are two UI scenarios taken from my manual test
cases, and one API response-time scenario taken from my Postman collection.

## Scenarios

| Tag | Source | What it does |
|---|---|---|
| `@e2e` | Manual case TC-25 | Opens the Single room from the home page, picks a 1-night stay, checks the price summary (room rate + £25 cleaning fee + £15 service fee), books with valid guest details, and checks the API returns 201 and the confirmation screen shows the dates. |
| `@negative` | Manual case TC-19 | Tries to book with an invalid email. Checks the API returns 400, the only error shown is "must be a well-formed email address", no confirmation appears, and the form keeps the typed values. |
| `@performance` | Postman collection "API Automation Suite" and performance run #16 | Sends the 14 requests of the collection one at a time (5 rounds by default) and checks the response times against the limits from the collection and from the Postman run. |

The UI scenarios are in `features/room-reservation.feature`. The performance scenario is in
`performance/features/api-response-time.feature`.

## Setup and execution

### Setup

Requires Node.js 22 or newer.

```bash
npm ci
npm run install:browsers   # downloads Playwright's Chromium (only the UI scenarios need it)
```

### Running the tests

| Command | What it does |
|---|---|
| `npm test` | Runs all scenarios (UI and performance) and writes one combined report |
| `npm run test:ui` | Runs only the UI scenarios |
| `npm run test:e2e` | Runs only the `@e2e` scenario |
| `npm run test:negative` | Runs only the `@negative` scenario |
| `npm run test:performance` | Runs only the performance scenario, with its own report |
| `npm run test:headed` | Runs with a visible browser |
| `npm run test:dry-run` | Checks every Gherkin step has a definition, without opening a browser |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run verify` | Type check, lint and dry run together |
| `npm run report` | Opens the combined HTML report |
| `npm run report:performance` | Opens the performance HTML report |
| `npm run trace -- <file.zip>` | Opens a failure trace in the Playwright trace viewer |

Optional environment variables: `BASE_URL` (default is the live demo site), `PERF_ROUNDS` (how many
times the performance requests are sent, default 5), `HEADED`, `SLOW_MO`, `BROWSER_PATH` (use an
already-installed Chrome/Chromium), `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

### Reports

After a run, `reports/` contains:

- `cucumber-report.html` and `.json` – written by `npm test` and the other cucumber scripts. A full
  `npm test` puts all scenarios in this one report.
- `performance-report.html` and `.json` – written by `npm run test:performance`. It is a separate
  file so a performance-only run does not overwrite the combined report.
- `performance-timings.json` – every measured response time, plus the summary per request.
- `screenshots/` and `traces/` – a full-page screenshot and a Playwright trace for each failed UI
  scenario (the screenshot is also embedded in the HTML report).

In the HTML reports, the performance scenario has two text attachments: the timing table (average,
min, max and p95 per request) and a table of the slowest response against each limit. Passing UI
scenarios do not keep a trace or screenshot. The `reports/` folder is git-ignored.

## Framework structure and design decisions

### Project structure

```
features/      Gherkin for the UI scenarios
steps/         Step definitions for the UI scenarios
pages/         Page objects (home page, reservation page)
performance/
  features/    Gherkin for the response-time scenario
  steps/       Step definitions for it
  support/     api-flow.ts (the requests) and timing.ts (clock, statistics, tables)
support/       Cucumber world, hooks, shared expect, small API helper
config/        Environment settings and Cucumber config
test-data/     Guest data (JSON) and booking date generation
reports/       Generated output
.github/       GitHub Actions workflow
```

### Design decisions

- **Cucumber runs the tests, Playwright drives the browser and sends the API requests.** Each UI
  scenario gets its own browser context, so no state is shared between scenarios.
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
- **The browser starts only when a UI scenario needs it,** so the performance scenario runs without
  Chromium installed.

### Performance scenario

- **What is measured.** The time from sending a request until the whole response has arrived, one
  request at a time. One extra request before the first round is not counted, so the first measured
  request does not pay for opening the connection.
- **Where the limits come from.** Eight requests in the Postman collection have a response-time
  assertion in their Tests tab: 3000 ms for Login, Validate Token, Logout and Room By Id; 5000 ms for
  All Rooms, Update Room and Delete Room; 2000 ms for Booking By Id. Seven of them are in the
  table in the feature file; Logout is not run (see below). The average limit of 500 ms is the pass
  criterion of Postman performance run #16. The other seven requests have no response-time
  assertion in the collection, so no limit was invented for them; they are covered only by the
  average.
- **A response that is not 2xx stops the round.** A fast error response would otherwise lower the
  average and make the API look quicker than it is.
- **Only its own data is deleted.** In Postman, Delete Room deletes the last room in the list and
  Delete Message deletes the last message in the inbox. On a shared demo site those can belong to
  someone else. Here each round creates a room, a booking and the inbox message that the booking
  produces, and deletes only those. If a round stops early, it deletes what it had created so far.
- **Paths have no trailing slash** (`/room` instead of Postman's `/room/`). In my local run the site
  redirected the slash version, and Playwright dropped the manually set `Cookie` header when it
  followed the redirect, so authenticated requests returned 401. The slash-free paths are the ones
  the site's own pages use.
- **Logout is not sent,** because performance run #16 did not execute it either.

## Execution status

- Type check, lint and the Gherkin dry run pass.
- All three scenarios were run against a local build of the application's published front-end
  source with a stubbed backend, **not against the live site**. Each scenario passed 3 out of 3
  times when run alone, and the full `npm test` passed 3 out of 3 times.
- On that local setup the average response time is roughly 10 to 15 ms. This only shows that the code runs.
  It says nothing about how fast the real API is.
- I also made the local backend slow or faulty to check that the performance assertions fail when
  they should: every response delayed (average over 500 ms fails), only Login delayed (the Login
  limit fails), a request answered with HTTP 403 (the round stops), and the API unreachable (the
  first step fails and nothing is measured). Data left behind after a failed round was removed.
- **The scenarios have not been run against https://automationintesting.online/.** The live site may
  differ from the source I built from. If the step "the application API is reachable" fails,
  nothing was measured, so treat that as blocked and not as a performance result.
- The GitHub Actions workflow has not been run on GitHub. It runs the UI scenarios on every push
  and pull request. The performance scenario runs only when started by hand from the Actions tab.

## Limitations

- **This is not a load test.** There is one user at a time. Postman run #16 used 20 virtual users,
  and this scenario does not reproduce that.
- With 5 rounds there are only 5 samples per request, so the average is a rough indicator and the p95
  is simply the slowest sample. `PERF_ROUNDS` raises the number.
- Response times depend on where the tests run. They are not comparable with the Postman numbers
  unless both are run from the same place.
- The status check is "any 2xx". It is looser than the per-request status assertions in Postman.
- Each round briefly creates and deletes a room, a booking and a message on the public demo site,
  where other people can see them.
- Chromium only, and only two UI scenarios; most of the manual cases are not automated.
- The booking is checked through the UI and the booking API response. It is not checked on the
  admin side (messages or the admin booking list).
- The E2E scenario does not delete the inbox message that its booking creates.
- The date check depends on the room report endpoint the page itself uses.

## What I would improve with more time

- Add a real load test (for example k6) for concurrent users, since Playwright is not the right
  tool for that.
- Raise the number of rounds and agree percentile limits (such as p95) once there is a baseline.
- Compare each run with a stored baseline instead of fixed limits only.
- Add Logout to the flow.
- Delete the E2E scenario's inbox message too, the way the performance scenario already does.
- Add the other form-validation cases (blank fields, short phone number) as a Scenario Outline.
- Cover the duplicate-booking case (TC-28) and check how the UI handles the 409.
- Check the booking in the admin area.
- Run on Firefox and WebKit, and add retries with trace-on-retry in CI.
