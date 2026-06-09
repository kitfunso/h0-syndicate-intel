# Ask the Market

Lloyd's of London syndicate intelligence. Ask the market a question in plain English,
get a ranked answer where every number is cited to its source report page.

Built for the H0 hackathon (Vercel v0 + AWS Databases). Stack: Next.js on Vercel,
Aurora PostgreSQL + pgvector, Claude + Titan via AWS Bedrock (Vercel AI SDK).

> Full design + locked plan: `~/.gstack/projects/h0-syndicate-intel/skf_s-main-locked-plan-20260608.md`

## How it works

```
NL question
  -> Bedrock Claude ROUTER (structured output) => {intent, params}   no SQL from the model, ever
  -> validator: intent in catalog? params allowlisted?         reject => graceful degrade
  -> named parameterized SQL on a READ-ONLY role               statement_timeout + LIMIT
     + scoped pgvector retrieval for narrative + citations
  -> Bedrock Claude COMPOSER: numbers from rows, narrative from chunks, every claim cited
  -> answer => each number links to its source report page
```

The model never writes SQL. It picks an intent from a fixed catalog and fills
allowlisted params. Defence in depth: SELECT-only role, READ ONLY transaction,
statement timeout, row limit. Numbers are rendered from fact rows, citations from
provenance columns, so a figure cannot be hallucinated.

## Setup (Day 1-3 spike)

1. Install deps:
   ```bash
   npm install
   ```
2. Provision Aurora PostgreSQL via the Vercel dashboard (Marketplace -> AWS -> Aurora
   PostgreSQL). Enable pgvector. Auth in production is OIDC + RDS IAM (no stored secret).
3. Enable Bedrock model access (one-time): AWS console -> Bedrock -> Model access ->
   enable Anthropic Claude + Amazon Titan Text Embeddings v2. The app reads AWS creds
   from the standard chain (AWS_REGION + key/secret, or the Vercel AWS integration in prod).
4. Copy env + fill it:
   ```bash
   cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
   ```
   Set `AWS_REGION` + AWS creds, `BEDROCK_CHAT_MODEL`, `DATABASE_URL` (owner), and
   `READONLY_DATABASE_URL`.
5. Migrate + set the read-only role's password:
   ```bash
   npm run migrate
   # then, once, against the owner connection:
   #   ALTER ROLE app_readonly WITH LOGIN PASSWORD '<pick-one>';
   ```
6. Seed 5 VERIFIED syndicates. Copy `data/spike-seed.example.json` to
   `data/spike-seed.json` and fill it with verified Synth output, then:
   ```bash
   npm run seed:spike
   ```
7. Run the GO/NO-GO gate:
   ```bash
   npm run spike      # one analytical, one trend, one qualitative question, all cited
   ```
8. Run the app:
   ```bash
   npm run dev        # http://localhost:3000
   ```

## GO/NO-GO gate (the crux)

Proceed to the full intent catalog only if `npm run spike` returns a sensible, CITED
answer for all three question classes AND the numbers reconcile to the source reports.
If citations are wrong, fix extraction/provenance before building anything else.

## Tests

```bash
npm run test        # validator: allowlist rejects injection / off-list params (no DB)
npm run test:int    # safety: read-only blocks writes + timeout fires (needs TEST_DATABASE_URL)
```

## Layout

```
app/                 Next.js (App Router). /api/ask = the endpoint. page.tsx = spike UI.
lib/                 router -> validate -> run -> compose. db.ts = read-only exec.
lib/intents/         the query catalog (the ONLY queries that can run) + validator.
db/migrations/       schema, read-only role, materialized views.
db/seed-spike.ts     loads + embeds the verified dataset.
scripts/spike.ts     the GO/NO-GO harness.
tests/               validator (unit) + safety (real-DB integration).
```

## License

MIT. See `LICENSE`.
