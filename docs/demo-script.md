# Demo video script (3 minutes, hard cap) - refreshed 2026-06-29

Target: judges skim. Lead with the wow, prove the database is the star, end on money.
One take per section; ~150 wpm = ~430 words. Live URL: https://h0-syndicate-intel.vercel.app

## 0:00-0:18 - The problem (over a shot of a 200-page syndicate PDF)

> "Every Lloyd's of London syndicate reports its results in a PDF like this one.
> The people who allocate billions across syndicates dig through a hundred of these
> every results season, by hand. A question that sounds simple takes an analyst days."

## 0:18-0:45 - The hero question (screen: the app, type it live)

> "This is Ask the Market. Watch: which syndicates grew premium while improving
> their combined ratio in 2023?"

(Answer renders: ranked, cited.)

> "Ranked by premium growth, every number footnoted. And these are not numbers I am
> asking you to trust."

## 0:45-1:10 - The wow: click-to-source (the trust moment)

(Click a figure -> the report page opens, number highlighted.)

> "Click any figure and you get the actual page of the annual report, with the number
> highlighted, straight off the filing. Every figure on this desk was machine-reconciled
> against its PDF before it earned a verified flag. In finance, don't trust me, check."

## 1:10-1:38 - Breadth: ask about any syndicate, by name (screen: type it)

> "The cited desk is 25 syndicates. But we extracted all 132, from 2020 to 2025.
> So I can ask about one that isn't in the cited set: how has Chaucer's combined ratio
> trended since 2020?"

(Answer renders: Chaucer 1084, the series, cited rows.)

> "It resolved the name to its syndicate number, pulled the series, and wrote the answer.
> A hundred and thirty syndicates, one question box."

## 1:38-2:05 - The database is the star (screen: dashboard + currency/year toggles)

> "Under the hood this is one Aurora PostgreSQL database doing two jobs at once:
> relational facts for the rankings, and pgvector for the narrative, joined in SQL.
> Figures are stored in native currency, exactly as filed, plus a GBP value for fair
> comparison. Toggle to dollars and everything re-bases, but the citation still shows
> the as-filed number."

(Currency toggle, then year toggle, fast.)

## 2:05-2:28 - The market in charts (screen: the Market tab, hover a chart)

> "And a whole-market view: Lloyd's aggregates back to 2016, every series an interactive
> chart. Hover any year and you read off the exact value. This is the macro context the
> per-syndicate desk sits inside."

(Hover a couple of charts so the tooltips show.)

## 2:28-2:45 - The safety model (screen: ask something off-catalog)

> "The language model never writes SQL. Claude on Bedrock picks from eight allowlisted
> intents, a validator checks every parameter, and the query runs read-only. Ask it
> something it can't source, and it says so instead of making something up."

(Show the graceful degrade.)

## 2:45-3:00 - Who pays + the close

> "Lloyd's writes over fifty-five billion pounds across more than a hundred syndicates.
> Capital allocators and reinsurers pay for exactly this analysis today; they just pay
> analysts to do it slowly. Aurora plus pgvector, Bedrock for language, Next.js on Vercel.
> Ask the market anything. Then check it."

## Shot list
1. Syndicate PDF scrolling (5s, screen record)
2. App: hero growers question typed + answer (live)
3. Click-to-source modal (the money shot, hold 4s)
4. Breadth: Chaucer question typed + cited answer
5. Currency toggle, year toggle (fast cuts)
6. Market tab: hover two interactive charts (tooltips visible)
7. Off-catalog degrade
8. Architecture diagram (docs/architecture.png or /architecture.html) as the closing frame

## Recording checklist
- 1440x900 browser, 125% zoom, hide bookmarks bar
- Warm the app first (one ask) so the first live ask is fast; Bedrock cold start can take a few seconds
- Mic check; no background music over the click-to-source moment, let it land
- Export 1080p, under 3:00, upload YouTube (public or unlisted), title:
  "Ask the Market - H0 Hackathon demo"
