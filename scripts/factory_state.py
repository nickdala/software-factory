#!/usr/bin/env python3
"""Read-only queries over factory/jobs/*/job.json, shared by every orchestrator session.

  factory_state.py active <repo>        number of jobs in an active stage
  factory_state.py queue-head <repo>    id of the job first in the merge queue (empty if none)
  factory_state.py next-id <repo>       next free 3-digit job number, e.g. 004
"""
import glob
import json
import os
import sys

ACTIVE = {"intent", "spec", "plan", "build", "review", "approval", "merging"}


def jobs(repo):
    for path in sorted(glob.glob(os.path.join(repo, "factory", "jobs", "*", "job.json"))):
        try:
            with open(path) as f:
                yield json.load(f)
        except (OSError, ValueError):
            continue  # mid-write; the caller polls again


def main(cmd, repo):
    if cmd == "active":
        print(sum(1 for j in jobs(repo) if j.get("stage") in ACTIVE))
    elif cmd == "queue-head":
        merging = [j for j in jobs(repo) if j.get("stage") == "merging"]
        merging.sort(key=lambda j: (j.get("approvedAt") or "", j.get("id", "")))
        print(merging[0]["id"] if merging else "")
    elif cmd == "next-id":
        nums = [int(d[:3]) for d in os.listdir(os.path.join(repo, "factory", "jobs")) if d[:3].isdigit()] \
            if os.path.isdir(os.path.join(repo, "factory", "jobs")) else []
        print(f"{max(nums, default=0) + 1:03d}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
