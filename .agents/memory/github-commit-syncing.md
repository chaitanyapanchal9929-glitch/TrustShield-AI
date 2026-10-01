---
name: GitHub commit syncing
description: Limits of syncing local Replit commits through the GitHub REST integration.
---

When native Git push is unavailable, GitHub REST Git Data endpoints can create equivalent trees and commits, but REST commit creation may not preserve Replit-specific commit headers such as `Replit-Commit-Author: Agent`. The resulting commit hashes can differ even when the tree, message, author, and dates match.

**Why:** Replit-generated local commits can contain headers that GitHub's REST create-commit API does not expose.

**How to apply:** If exact commit hashes matter, use an authenticated native Git push. Before updating a branch through REST, compare generated commit hashes and get the user's approval if the fallback would recreate history with different hashes.