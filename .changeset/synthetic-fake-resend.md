---
"@domandigital/synthetic": minor
---

`fakeResend()`: a stand-in for Resend for a client's own pull request and deploy test runs, so they send no real email and use none of anyone's allowance. It answers `POST /emails` and `GET /emails/<id>` as Resend does and `GET /messages?runId=` as DD Checks' canary read does, refuses any address that is not a canary's, and can answer `daily_quota_exceeded` to test an allowance alert. Web Fetch only, so it runs in a Worker as well as in Node.
