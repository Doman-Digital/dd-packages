---
"@domandigital/buyer-panel": patch
---

Keep panel runs in the cloud capsule by default: `archive` is `storage:capsule`, its working copy comes from `dd-storage`, and each finished run is published with `dd-storage publish`. If the cloud cannot be reached, the run stays local with a loud notice and is recorded as local only. A folder path still works for an offline run.
