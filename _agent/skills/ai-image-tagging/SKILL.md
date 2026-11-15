---
name: ai-image-tagging
description: Guidelines for the AI agent to automatically tag images and review existing tags in the Kefel Lashon project.
---

# AI Image Tagging Guidelines for Kefel Lashon

These guidelines define how the AI system should tag new images or review existing tags to ensure accurate filtering and organization.

## 1. Tag Limit
- Each image must have **up to 5 tags** maximum.

## 2. The Tagging Process
When assigning tags to an image, follow these steps in order:
1. **Read the Image Name (Title):** Analyze the title of the image. This typically contains the core pun or wordplay.
2. **Read the Explanation:** Review the explanation to fully understand the context, the meaning behind the humor, and the underlying themes.
3. **Select Tags from the Pool:** Consult the predefined categories and mappings in `tags_master.json`. Choose the most appropriate general categories and specific tags from this existing pool.
4. **Create New Tags If Needed:** If you find a more suitable and accurate tag that is not currently in the pool, you may invent a **new tag**. Only add a new tag if it captures the essence perfectly and is likely to be relevant to other images as well.

## 3. Reviewing Existing Tags
When examining an image that already has tags, you must act as a quality reviewer:
- **Verify:** Look at the existing tags and ensure there are no tags that are inappropriate or do not fit the image's name and explanation.
- **Remove:** Discard any irrelevant, incorrect, or redundant tags.
- **Enforce Limit:** If there are more than 5 tags, keep only the top 5 most descriptive and accurate tags.

## 4. Consistency Guidelines
- **Hebrew Only:** All tags must be written in Hebrew (unless referencing a specific English brand or universally accepted English term).
- **Format:** In the `topic` field, tags must be stored as a single comma-separated string (e.g., `"חיות, כלבים, פוליטיקה"`).
- **Hierarchy:** Strive to include at least one broad category (e.g., "חיות") and some more specific tags (e.g., "חתול").
