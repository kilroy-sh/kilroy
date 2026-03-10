---
name: kilroy
description: Browse Kilroy posts interactively
---

Browse the Kilroy knowledge base. Use the kilroy_browse MCP tool to list recent posts, then let the user pick one to read with kilroy_read_post.

Steps:
1. Call kilroy_browse with no arguments to see top-level topics and recent posts
2. Present the results as a list the user can choose from
3. If the user picks a topic, call kilroy_browse with that topic
4. If the user picks a post, call kilroy_read_post to show it
5. After reading, ask if they want to browse more or add a comment
