---
name: image-tagging
description: Guidelines for tagging images in the Kefel Lashon project to ensure accurate filtering and organization.
---

# Image Tagging Guidelines for Kefel Lashon

Proper tagging is crucial for the gallery's filtering system to work effectively. Follow these guidelines when adding or refining tags (topics).

## 1. Tag Structure

- Tags are stored in the `topic` field as a comma-separated string.
- Example: `"חיות, כלבים, פתגמים וביטויים"`

## 2. General vs. Specific Tags

Maintain a hierarchy by including both general categories and specific sub-tags.

- **General Categories**: Use categories defined in `tags_master.json` (e.g., "חיות", "חגים ומועדים", "יהדות ומסורת").
- **Specific Tags**: Add specific keywords derived from the image title or explanation (e.g., "פסח", "צה\"ל", "חתול").
- **Rule**: If an image is about "Pesach", it should have BOTH "חגים ומועדים" and "פסח".

## 3. Tag Selection Criteria

When selecting tags, look at:
1. **The Title**: Usually contains the core wordplay.
2. **The Explanation**: Often reveals the context or underlying themes.
3. **Visual Content**: What is actually shown in the image.

## 4. Consistency Guidelines

- **Hebrew Only**: All tags should be in Hebrew unless it's a specific English brand name or term (e.g., "Google").
- **Plurals**: Prefer plurals for categories (e.g., "חיות") but singular/plural as appropriate for specific items based on the image.
- **No Quotes**: Avoid using quotes within tags if possible.

## 5. Adding New Tags

- If you find a tag that is likely to be relevant to multiple images but isn't in `tags_master.json`, you can "invent" it.
- **Generic Check**: Ask yourself - "Will other images likely use this tag?" If yes, add it.

## 6. Common Categories and Keywords

- **חיות**: כלב, חתול, סוס, אריה, דג, ציפור, גדי, כבש.
- **חגים ומועדים**: פסח, סוכות, חנוכה, פורים, ראש השנה, שבועות.
- **יהדות ומסורת**: תפילה, רבנים, שבת, כשרות, צדיק.
- **פוליטיקה ואקטואליה**: ממשלה, ביבי, צה"ל, איראן, בחירות.
- **פתגמים וביטויים**: Use this for literal interpretations of common sayings.

## 7. Workflow for Tagging

1. Read the `title` and `explanation`.
2. Identify the main subject(s).
3. Check `tags_master.json` for the most relevant general category.
4. Extract specific keywords that act as meaningful sub-tags.
5. Combine them into a comma-separated string, ensuring the general category is present.
