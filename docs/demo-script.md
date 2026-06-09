# Demo video script (3 minutes, hard cap)

Target: judges skim. Lead with the wow, prove the database is the star, end on money.
One take per section; total speaking pace ~150 wpm = ~430 words.

## 0:00-0:20 — The problem (over a shot of a 200-page syndicate PDF)

> "Every Lloyd's of London syndicate reports its results in a PDF like this one.
> The people who allocate billions across syndicates dig through hundreds of these
> every results season, by hand. Questions that sound simple take an analyst days."

## 0:20-0:50 — The hero question (screen: the app, type it live)

> "This is Ask the Market. Watch: *which syndicates grew premium while improving
> their combined ratio in 2023?*"

(Answer renders: ranked, cited.)

> "Five syndicates, ranked by premium growth, every number footnoted. MS Amlin grew
> £172 million while improving its combined ratio by nearly ten points."

## 0:50-1:20 — The wow: click-to-source (the trust moment)

(Click MS Amlin -> "View gross premium on p.28".)

> "Here's the part that matters in finance: don't trust me, check. Click any figure
> and you get the actual page of the annual report, with the number highlighted.
> £1,748.7 million, page 28, straight off the filing. Every figure in this product
> was machine-reconciled against its PDF before it earned a verified flag."

## 1:20-1:50 — The database is the star (screen: dashboard + a quick schema flash)

> "Under the hood this is one Aurora PostgreSQL database doing two jobs at once:
> relational facts for the rankings, and pgvector for the narrative, joined in SQL.
> Figures are stored in their native currency, exactly as filed, plus a GBP value
> for fair comparison. Toggle to dollars: everything re-bases, but the citation
> still shows the as-filed number. Toggle to 2022: real comparatives, same provenance."

(Show currency toggle, then year toggle, fast.)

## 1:50-2:20 — The safety model (screen: ask something off-catalog)

> "The language model never writes SQL. Claude on Bedrock picks from eight allowlisted
> query intents, a validator checks every parameter, and the SQL itself is a fixed
> template on a read-only role with a statement timeout. Ask it something it can't
> source, and it says so instead of making something up."

(Show the graceful degrade.)

## 2:20-2:50 — Who pays + the close

> "Lloyd's writes over £55 billion in premium across more than a hundred syndicates.
> Capital allocators, members' agents and reinsurers pay for exactly this analysis
> today; they just pay analysts to do it slowly. Ask the Market is the research desk
> that answers in seconds and shows its work on every number.
> Aurora PostgreSQL plus pgvector, Bedrock for language, Next.js on Vercel.
> Ask the market anything. Then check it."

## Shot list

1. Syndicate PDF scrolling (5s, screen record)
2. App: hero question typed + answer (live)
3. Click-to-source modal on MS Amlin p.28 (the money shot, hold 4s)
4. Currency toggle, year toggle (fast cuts)
5. Off-catalog degrade
6. Architecture diagram (public/architecture.svg) as the closing frame

## Recording checklist

- 1440x900 browser, 125% zoom, hide bookmarks bar
- Seed freshly; confirm all 10 demo questions pass first (docs/demo-questions.md)
- Mic check; no background music over the click-to-source moment, let it land
- Export 1080p, under 3:00, upload YouTube (public or unlisted), title:
  "Ask the Market - H0 Hackathon demo"
