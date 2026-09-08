# Shared email draft contract

Do not invent a new layout. Parent renders every draft with one letter layout:

- Georgia / Times, 16px, #222 text, 24px padding
- No cards, tables, buttons, colored bars, or hidden preheaders
- Conference mail starts with `{{conferenceName}}` on its own line
- Auth mail has no conference name
- Facts are `Label: value` lines
- Links are plain text plus the raw URL
- Sign-off is `This message is from {{conferenceName}}.` or `Please do not reply to this message.`

Write one JSON file only. Schema:

```json
{
  "key": "template.key",
  "kind": "auth or conference",
  "subject": "short specific subject",
  "headline": "short title",
  "paragraphs": ["one or two short sentences"],
  "details": [{ "label": "Paper", "value": "{{paperTitle}}" }],
  "cta": null,
  "otp": null,
  "extraParagraphs": [],
  "secondaryNote": null,
  "variables": ["required", "merge", "keys"]
}
```

Rules:

- Audience: professors. Plain English. No product names (OpenConferences, Fresi, FresiCMT).
- Do not say dashboard, portal, or platform. Say "sign in" or "open this link".
- Do not include a Conference detail row. The letterhead already has the name.
- Keep required merge variables. Conference templates must include `conferenceName`.
- Do not invent variables. Do not edit other files.
