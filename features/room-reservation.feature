Feature: Room reservation
  As a guest of Shady Meadows B&B
  I want to reserve a room online
  So that my stay is confirmed, and I am told clearly when my details are wrong

  # Based on manual test case TC-25.
  # The dates are generated at run time instead of using 2026-10-19 / 2026-10-20 from the
  # manual case, because the demo site is shared and a fixed date would clash on the second run.
  @e2e @TC-25
  Scenario: Guest reserves a single room for one night with valid details
    Given the guest is on the home page
    When the guest chooses to book the "Single" room
    And the guest selects a 1-night stay on dates that are not booked yet
    Then the price summary adds a £25 cleaning fee and a £15 service fee to the room rate
    When the guest starts the reservation
    And the guest enters the "valid" guest details
    And the guest confirms the reservation
    Then the booking is accepted with status 201
    And the booking confirmation shows the selected dates

  # Based on manual test case TC-19.
  # Only the email is wrong, so the test checks that one rule in isolation.
  @negative @TC-19
  Scenario: Guest cannot reserve a room with an invalid email address
    Given the guest is on the home page
    When the guest chooses to book the "Single" room
    And the guest selects a 1-night stay on dates that are not booked yet
    And the guest starts the reservation
    And the guest enters the "invalid email" guest details
    And the guest confirms the reservation
    Then the booking is rejected with status 400
    And the guest sees the error "must be a well-formed email address"
    And no booking confirmation is shown
