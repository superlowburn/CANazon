# CAMazon Card Labels Specification

## Goal

Make Amazon product cards render the four treatments promised by the CAMazon popup and correct the classification failures reproduced on the supplied Stanfield's search.

## Required behavior

- Made in Canada: a filled red rounded-square card badge containing the same recognizable `🍁` glyph used by the popup.
- Canadian-owned, made abroad: a white rounded-square card badge with a red outline containing `🍁`.
- Recognized American: the existing full-card frost remains, with `American · Reveal` or `Made in USA · Reveal` as appropriate.
- Everything else: no CAMazon badge or frost.
- Stanfield's apparel must classify as Canadian-owned, made abroad whether its apostrophe is straight or curly.
- A title such as `The Last of the Stanfields` must remain neutral when the brand byline does not identify Stanfield's.
- Hanes listings must classify as recognized American and receive the American frost.
- The popup legend and card treatments must tell the same visual story.

## Delivery and QA

- Preserve the extension version at `0.1.0`; this is a focused bug fix, not a version-policy decision.
- Mirror changed runtime files into `dist/` and rebuild `CANazon-0.1.0.zip` with `manifest.json` at the archive root.
- Keep `/Users/steve/conductor/workspaces/canazon/halifax/data/madeinca-missing-candidates.json` and `/Users/steve/conductor/workspaces/canazon/halifax/.playwright-cli/` untouched.
- Run the full Node test suite, archive integrity checks, and browser QA against reliable Amazon searches for Kamik, Napoleon, Lodge, Zojirushi, Stanfield's, and Hanes.
- Capture visible evidence for Made in Canada, Canadian-owned/made-abroad, and American-frosted cards. Verify the reveal control and verify that the unrelated Stanfields book is not badged.

## Scope boundary

Only CAMazon files in `/Users/steve/conductor/workspaces/canazon/halifax` are in scope. Do not copy code, rules, assets, or terminology from any other extension project.
