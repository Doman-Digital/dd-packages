---
"@domandigital/buyer-panel": patch
---

Fix runs landing in a folder literally named `~`: `dd-storage get local.capsule_dir` prints `~/dd-client-capsule`, which was used as written, so a run on the cloud capsule was written under the current directory and `dd-storage publish` then reported success for a capsule that did not hold it. The folder is now expanded.
