@performance
Feature: API response time
  The requests of the Postman collection "API Automation Suite" are sent one at a time, and the
  response times are checked against the limits from that collection and from Postman
  performance run

  This is a response-time check with one user at a time. It is not a load test, so it says
  nothing about how the API behaves with 20 users at once.

  Scenario: Requests stay within the Postman response-time limits
    Given the application API is reachable
    When the requests from the Postman collection are sent one at a time
    Then all 14 requests were answered successfully in every round
    And these requests stay under their response-time limits from the Postman collection:
      | request        | limit in ms |
      | Login          | 3000        |
      | Validate Token | 3000        |
      | All Rooms      | 5000        |
      | Room By Id     | 3000        |
      | Update Room    | 5000        |
      | Delete Room    | 5000        |
      | Booking By Id  | 2000        |
    And the average response time of all requests is under 500 ms
