# Proofhold brand kit

Everything visual is derived from these rules. Code assets live in `public/brand/`; the in-app versions are React components that take `currentColor`.

## Name

**Proofhold**: a hold on a payment that is released by proof. The name was supplied with the brief. Trademark availability has not been checked.

## Mark

A ring with a gap, and a tick whose tail leaves the ring through that gap. The ring is the hold; the tick leaving it is the release. One stroke weight, round caps, no fill.

| Asset                           | Use                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/brand/mark.svg`         | Mark in brand teal on any light surface                                                                                                                                         |
| `public/brand/mark-inverse.svg` | Mark in paper on a teal rounded square (app icon)                                                                                                                               |
| `public/brand/wordmark.svg`     | Wordmark only                                                                                                                                                                   |
| `public/brand/lockup.svg`       | Mark and wordmark, horizontal                                                                                                                                                   |
| `src/app/icon.svg`              | Favicon (same as mark-inverse)                                                                                                                                                  |
| `src/app/opengraph-image.tsx`   | Social preview, 1200×630, from Next's image response; its renderer has no web fonts or SVG text, so it uses the system serif with HTML over the ring. Same geometry as the app. |

Clear space around the mark: half its height. Minimum size: 16 px. Do not rotate, outline, add a gradient, or put the tick inside a filled circle.

## Colour

Paper and ink carry the interface. Teal is the brand and the colour of money moving. The other three colours are verdicts and nothing else.

| Token       | Light     | Dark      | Role                              |
| ----------- | --------- | --------- | --------------------------------- |
| `--paper`   | `#f6f4ef` | `#121110` | Page background                   |
| `--surface` | `#ffffff` | `#1a1816` | Sheets, panels                    |
| `--ink`     | `#17150f` | `#f1ede5` | Text                              |
| `--brand`   | `#0d5c4e` | `#3ea58f` | Actions, the mark, CAPTURED stamp |
| `--held`    | `#9a6a12` | `#d9a441` | Held, waiting, abstained          |
| `--pass`    | `#1d6f47` | `#4fb57f` | Passed lines, released            |
| `--fail`    | `#a8321f` | `#e0634c` | Failed lines, voided, disputed    |
| `--wax`     | = brand   | = brand   | Stamp ink                         |
| `--rule`    | `#cbc5ba` | `#403c36` | Ledger rules and the sheet margin |

Contrast: every text colour meets 4.5:1 on the surfaces it is used on, in both schemes (checked by `tests/browser/a11y.spec.ts` with axe, and by the pair table in the build log). Verdict colours are always paired with an icon or a word, never alone.

## Type

- **Display:** Fraunces, weight 500, optical size on, letter-spacing −0.015 to −0.022 em at display sizes. Titles, amounts, the sheet summary.
- **UI:** Inter, 400/500/600. Everything else.
- **Mono:** JetBrains Mono. Identifiers, hashes, check descriptions, file metadata, the ring text on the seal. Always with tabular numerals.

Scale (rem): 0.75, 0.8125, 0.9375, 1, 1.125, 1.375, 1.75, 2.25, 3. Line height 1.15 for display, 1.3 for dense UI, 1.55 for prose.

All three families are loaded through `next/font/google` under the SIL Open Font License 1.1.

## Space, radius, elevation

4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Radii 4, 8, 12 and pill. Three shadows, used only for things that float (toasts, dialogs, the landing hero frame). Panels sit on the paper with a 1 px rule, not a shadow.

## Icons

Lucide, 1.5 px stroke at 16 px, 1 px at 20 px and above. Icons never carry meaning alone; the verdict icons are paired with an `aria-label`.

## Motion

Durations 120 / 180 / 280 ms, one ease-out curve. Stamps land (scale 1.25 → 1 with a settle). Ring arcs draw in when a verdict arrives. Dots pulse only while something is actually running. Under `prefers-reduced-motion: reduce` every animation collapses to an instant change.

## Voice

Plain, declarative, specific. "PayPal captured $420.00", not "Payment successful!". Say which part is simulated where the user is deciding. Numbers as figures. No superlatives, no promises.

## Licence

Code and brand assets in this repository are MIT licensed (see `LICENSE`). Fonts are OFL 1.1. Lucide icons are ISC.
