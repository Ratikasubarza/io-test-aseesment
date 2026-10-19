# Performance test approach: booking API

This document answers the performance part of the assessment. It describes the test approach and the example script, and explains the workload model, metrics, thresholds and limitations.

**Status, stated plainly**

| Item | Status |
|---|---|
| Gradual increase | One Postman run exists (performance run #16: 20 virtual users, 10 minutes, ramp-up 150 s). |
| Normal traffic (5 rps) | Not run yet. Planned below. |
| Peak traffic (20 rps) | Not run yet. Planned below. |

Run #16 reached 0.68 requests per second (410 requests in 10 minutes). It did not reach 5 or 20 requests per second, so it cannot stand in for the normal or peak phase. Its average response time was 346 ms and its 95th percentile was 551 ms. 82 of 2,180 assertions failed (96.24% passed). The run still counted as PASS, because the only pass criterion was the average response time. Section 7 lists the causes.

## 1. Tool choice

I use the Postman performance runner instead of k6. The brief allows "k6 or a comparable tool". Both run a scripted request flow with virtual users and report response time and error rate. The collection and the earlier run already exist in Postman, so I keep the same tool for all phases.

The Playwright scenario in `performance/` is a different thing. It sends the requests one at a time from one user and checks response times against the Postman limits. It is not a load test and does not answer the traffic questions in this brief.

## 2. Scope of the flow

Booking requests only, in this order:

1. Login (get a token)
2. Create Booking
3. Booking By Id
4. Delete Booking (the booking this iteration created)

Every iteration deletes only the data it created. This matters because the target is a shared public demo site.

## 3. Workload model

**Closed model.** Postman starts a fixed number of virtual users. Each user repeats the flow and sends the next request after the previous one finishes. Postman has no setting for "5 requests per second". Throughput is a result, not an input.

Because of that, I estimate the user count with Little's law and then check it against the measured throughput:

    virtual users ≈ target requests per second × time one user needs per request

Time per request includes the response time and any delay between requests. The estimate is only a starting point. The first run of each phase is a calibration: read the achieved requests per second from the report, adjust the user count, and run again. Run #16 shows why this is needed: 20 users produced only 0.68 requests per second.

The limit of a closed model: when the server slows down, the users send fewer requests, so the load drops exactly when the system struggles. An open model (fixed arrival rate, as k6 `constant-arrival-rate` offers) does not do that. I list this under risks.

## 4. Phases

| Phase | Postman profile | Intended load | Duration | Purpose |
|---|---|---|---|---|
| Normal | Fixed | Tuned so measured throughput is about 5 requests/s | 5 minutes | Baseline for expected traffic |
| Gradual increase | Ramp up | From the normal level up to the level that gives about 20 requests/s | 5 to 10 minutes | Find where response time or errors start to rise |
| Peak | Fixed (or Spike) | Tuned so measured throughput is about 20 requests/s | 3 to 5 minutes | Check the stated peak is handled within the thresholds |

The durations are my choice to keep the load on a public demo site short. They are not derived from a requirement.

Pass or fail is judged on the **measured** throughput. If a phase only reaches 3 rps, the report says so and the result is not described as a pass for 5 rps.

## 5. Metrics to monitor

- **Response time** per request: average, and the 95th and 99th percentile where Postman reports them. The average hides slow outliers, so percentiles are needed.
- **Throughput**: requests per second actually achieved.
- **Error rate**: failed assertions and non-2xx responses, counted separately.
- **Response time against load**: whether response time rises as users increase (visible in the ramp-up phase).
- **Virtual users over time**, to line the above up with the load.

Server-side metrics (CPU, memory, database) are not available on the public site. That is a limitation, not something I monitor.

## 6. Checks and thresholds

**Checks** (per request):

| Request | Check |
|---|---|
| Login | status 200, token present |
| Create Booking | status 201, booking id present |
| Booking By Id | status 200 |
| Delete Booking | status 202 or 200 as returned by the API |

**Thresholds:**

| Threshold | Value | Where it comes from |
|---|---|---|
| Login response time | under 3000 ms | Existing assertion in my Postman collection |
| Booking By Id response time | under 2000 ms | Existing assertion in my Postman collection |
| Average response time, whole run | under 500 ms | Pass criterion used in run #16 |
| Create Booking and Delete Booking response time | No limit in the collection. Set after the normal-phase baseline. | |
| Error rate | Proposed: under 1% | My proposal, see below |

How I chose them. The first three come from limits I had already written in the collection, so they are existing decisions, not figures derived from a baseline. They are loose. A 3-second limit on a request that averages a few hundred milliseconds would let a large slowdown pass. After the normal-phase run I would tighten each limit to a margin above the observed 95th percentile.

The 1% error limit is a proposal. The brief says the API is expected to handle 20 rps at peak, so failures inside that range indicate a problem. Run #16 had no limit on failures, so it passed with 3.76% of assertions failing (82 of 2,180). Those failures would breach this threshold. The new runs would count only failures that come from the API, not from shared test data (see section 7).

The average also hides the tail. Run #16 averaged 346 ms (under the 500 ms limit), but its 95th percentile was 551 ms, so more than 5% of requests were slower than the limit. For the new runs I would add a 95th percentile limit next to the average.

## 7. Limitations and risks

- **Closed model.** See section 3. Load falls when the server slows.
- **Throughput is not controlled.** Reaching 5 and 20 rps needs calibration runs, and exact values may not be reachable.
- **Shared public site.** Other people use it, results vary with their traffic, and the data may be reset. Load at 20 rps is small, but I keep runs short and delete my own data.
- **Booking conflicts.** Two users booking the same room and dates can collide and fail. Create Booking passed all 30 requests in run #16, so this was not seen at that load. The flow should still use different dates per user and iteration, so a collision is not counted as an API failure.
- **Shared test data caused most of run #16's failures.** The 82 failed assertions come from four requests: All Message By Id (28, the API returns HTTP 500 every time, a backend defect), Delete Room (24, concurrent users deleting the same record), Delete Booking By Id (20, deleting records that no longer exist) and Delete Message (10, data not ready yet). Only the first is an API problem. The other three are test design: virtual users share data. The new flow deletes only the booking each iteration created, which removes this cause.
- **Run #16 is a small sample.** Each request ran only 30 times (28 or 26 for the last four), which is about 0.05 requests per second per request. With 30 samples the 99th percentile is almost the same as the maximum, so P95 and P99 are weak figures. I did not find the reason in the report why 20 virtual users produced only 30 runs of the flow in 10 minutes. Postman's settings (delay between requests, iteration behaviour) would have to be checked before the next run.
- **Logout was selected but did not run.** The report lists 15 selected requests and 14 executed.
- **Pass criterion ignored failures.** Run #16 reported PASS with these failures because only the average was checked.
- **Load generator location.** Network latency from the Postman cloud agents to the site is part of every response time.
- **No server-side visibility.** I can show that something is slow but not why.
- **One run per phase** gives no measure of run-to-run variation.

## 8. Results

Run #16 (gradual increase, whole collection):

| Measure | Value |
|---|---|
| Virtual users | 20 |
| Duration | 10 minutes, ramp-up 150 s |
| Requests | 410 |
| Throughput | 0.68 requests/s |
| Average response time | 346 ms |
| Response time min / P90 / P95 / P99 / max | 227 / 472 / 551 / 736 / 1,493 ms |
| Assertions | 2,098 passed, 82 failed (96.24%) |
| Network or transport errors | 0% |

Planned runs (fill in from the Postman report only after running):

| Phase | Virtual users | Measured rps | Average ms | p95 ms | Error rate | Result |
|---|---|---|---|---|---|---|
| Normal | | | | | | not run |
| Gradual increase | | | | | | not run |
| Peak | | | | | | not run |

## 9. What I would improve with more time

- Run the normal and peak phases and report the measured throughput, so the 5 and 20 requests per second in the brief are tested and not assumed.
- Give every virtual user its own data (own booking, own dates) so failures mean the API failed, not that two users deleted the same record.
- Add pass criteria beyond the average: a 95th percentile limit and an error-rate limit, and fail the run when they are broken.
- Remove the status-code assertion that accepts HTTP 500 on Booking By Id. A server error should fail the check.
- Use a tool with an open model (fixed arrival rate, for example k6) in addition to Postman, to hold the request rate steady when the server slows down.
- Repeat each phase several times and compare, to see run-to-run variation.
- Run the load from a location close to the site, or record the location, so network latency can be separated from server time.
- Report the defect found in the run (GET /api/message/{id} returns 500) with reproduction steps in the defect report.
