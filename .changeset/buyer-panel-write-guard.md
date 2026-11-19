---
"@domandigital/buyer-panel": patch
---

Read-only browser: a write guard stops every request that is not a GET or HEAD, every form submission, beacon, WebSocket and payment-host request (Stripe, PayPal, Klarna and others) before it leaves the machine, so a simulated buyer on a live site can no longer join a waitlist, send an enquiry or start a checkout. Each blocked attempt is kept in `session.json` (`blocked`, `blockedTotal`), the buyer is told after an action that the panel did not send, the evaluator is told a send that did not happen is not a defect, and the report has a "Write guard" section. Buyers do not see post-submit states, so a panel for a live site should list "forms do not send in this run" in its known states.
