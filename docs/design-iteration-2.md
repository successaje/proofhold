# Design iteration 2: what Braintrust does well, and what Proofhold takes from it

Studied on 2026-11-08: [braintrust.dev](https://www.braintrust.dev), its [Observe product page](https://www.braintrust.dev/product/observe), [docs](https://docs.braintrust.dev) and [pricing](https://www.braintrust.dev/pricing). Principles only; Proofhold keeps its own palette, type and voice.

## What Braintrust does that works

| Pattern | What it does for the reader | Proofhold's version |
| --- | --- | --- |
| **The product is the hero.** A full, realistic UI frame (sidebar, filter bar, numbered table, inspector panel) sits under a one-line coloured band that names what you are looking at; the frame is cropped at the bottom so it reads as a window, not a poster. | You understand the product before reading a paragraph. | The hero frame is the real seller page for a held proofhold, rendered by the real components, under a teal band: "The seller's page, the moment the buyer approves." |
| **A sticky section index** in mono caps at the left (WORKFLOW, PLATFORM, SCALE…), with a dash that moves as you scroll. | You always know where you are in a long page and can jump. | BRIEF · HOLD · CHECKS · RELEASE · WHEN IT GOES WRONG · WHAT IS REAL · COMPARE, scroll-spied, hidden on phones. |
| **Colour blocks per section**, alternating paper with bold tints, each carrying one dense UI plate on a muted tinted backing. | Rhythm; each section is one idea with one piece of evidence. | Paper, brand-soft, held-soft and an ink band for the failure paths; plates carry the Sheet, the buyer page, the verdicts, the seals, the rail. |
| **Feature triads**: icon, bold title, one-line description, then pill links "Explore … ↗". | Scannable; the link is a promise, not a button. | Three per section, lucide icons, arrow pills that go to the docs or the app. |
| **Dense, honest data UI**: filter chips (All logs ▾ · Traces ▾ · All time ▾ · Add filter), numbered rows, small mono ids, relative times, a right-hand inspector with tabs. | Operators trust what looks like the real tool. | The ledger gets a chip bar (group, kind, sort, search), numbered rows with mono ids and relative times, and an inspector panel that opens beside the list on desktop without leaving the page. |
| **Left sidebar app shell** with a workspace switcher, icon list and counts. | Navigation that scales past three items and shows state at rest. | A sidebar on desktop (Proofholds with a needs-attention count, New, Outbox, Settings, and a modes block); the bottom bar stays on phones. |
| **Headline rhythm**: a plain large headline at a light weight, with the second clause in the brand colour. | One idea, one accent. | Fraunces headline, the second clause in teal. |
| **Micro-motion**: hover icons shift 5–7 px over 350–400 ms on one curve; nothing loops. | Feedback that explains, never decorates. | Feature icons nudge on hover; sections rise 12 px as they enter; the seal arcs draw in on view; the index dash slides. All collapse under reduced motion. |

What we do not take: the blue, the tick-tape art, the testimonial wall (we have no customers and will not invent any), the pricing page (there is no price), and copy that speaks to AI teams.

## Changes in this iteration

1. **Landing rebuilt** around the frame-and-index structure above. Same start form, same comparison table, same honesty section, new arrangement and motion.
2. **App shell**: a left sidebar on desktop with counts and a modes block; the phone layout is unchanged.
3. **Ledger**: chip filter bar, numbered rows with mono ids and relative time, and an inspector panel (`?peek=<id>`) that shows the seal, the next step, the buyer, the amounts and the links beside the list.
4. **Motion system** written down: durations 120/180/280/400 ms, one ease-out for entrances and one ease-in-out for position changes, reveal-on-view for landing sections, hover nudges, no loops except the live "checking" pulse.

Verification: the existing flows, the axe scan, screenshots at three widths, a third independent critique.

## Shipped (2026-11-09)

All four changes are on `feat/iteration-2-landing-shell`. Two departures from the plan above, both deliberate: the hero frame shows the buyer window rather than "the moment the buyer approves", because the window is the state where every piece (verdicts, countdown, seal, agreement) is on screen at once; and the triads carry mono pills rather than icons, which keeps the landing on the ledger's own vocabulary. The third critique pass and its fixes are in [acceptance-matrix.md](acceptance-matrix.md).
