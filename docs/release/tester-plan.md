# KitaMo Pilot — Tester Plan

## Targets

- **5–10 real seller testers** for the working pilot (people who will actually run the app at a stall).
- **12–15 total tester Gmail addresses** collected in advance — enough to also satisfy the Closed Testing "≥12 testers" gate later without scrambling.
- Mix: mostly food-stall / karinderia / night-market owners (the target user), plus 2–3 tech-comfortable friends to catch obvious bugs first.

## Collecting testers

- Each tester needs a **Gmail address** (Play internal/closed testing is invite-by-Google-account).
- Collect: name, Gmail, phone model, stall type. Keep a simple list (spreadsheet or notes).
- Get consent that this is a **pilot** — data is on their phone only and can be lost.

## Internal testing invite flow

1. Add each Gmail to the Internal testing tester list in the Play Console.
2. Send them the **opt-in link** plus `docs/play-store/internal-tester-guide.md`.
3. They open the link on their phone (signed into the listed Gmail) → Become a tester → install from Play.
4. Updates arrive automatically through Play when you upload a new build.

## Closed testing requirement (for later production)

- New personal developer accounts generally need **≥12 testers opted in for 14 continuous days on a Closed testing track** before production access unlocks.
- Internal testing time does **not** count toward the 14 days — so if production is the goal, start a Closed track early with your 12–15 testers and let the clock run while the pilot continues.

## Feedback format

Ask testers to report using `docs/play-store/internal-tester-guide.md`'s format:

```
Phone model / Android version:
Screen:
What I tapped:
Expected:
Actual:
Screenshot:
```

Plus the five pilot questions (from the Pilot Guide): most confusing part, anything hard to find, do the numbers look right, most-needed missing feature, would you use it for real.

## 2-month night-market pilot plan

- **Weeks 1–2**: onboarding. Each seller sets up business + stall, adds real paninda and grocery items, records real sales for a few nights. Collect setup friction.
- **Weeks 3–4**: full engine. Recipes + Niluto + cook-upon-order for food sellers; check that Kita Report matches their own sense of tubo. Collect money-accuracy feedback.
- **Weeks 5–6**: daily habit. Bayarin (rent, gas), spoilage, transfers between stalls if they have two. Watch whether they keep using it unprompted.
- **Weeks 7–8**: decision. Does the seller trust the numbers? Would they pay / keep using? Prioritize Chapter 3 (Supabase backup/sync, accounts) from what they ask for most.
- Ship fixes as new internal builds throughout (bump versionCode each time).
