# H0 submission checklist

Deadline: **June 29, 2026, 5:00pm PDT** (h01.devpost.com). Track: **Monetizable B2B**.

## Hard requirements (from the official rules)

- [ ] **AWS database**: Aurora PostgreSQL (our pick; rules require Aurora PostgreSQL,
      Aurora DSQL, or DynamoDB)
- [ ] **Frontend deployed on Vercel or v0.app**
- [ ] Text description naming which AWS database is used
- [ ] **Demo video under 3 minutes** (YouTube), script: `docs/demo-script.md`
- [ ] **Published Vercel project link + Vercel Team ID**
- [ ] **Architecture diagram** showing app-to-backend connections:
      `public/architecture.svg` (also served at `/architecture.svg` on the live app)
- [ ] **Screenshots of the v0/Vercel project Storage Configuration proving AWS database
      usage** (capture AFTER Aurora is attached)
- [ ] Public repo with an OSI license (MIT: `LICENSE`)
- [ ] Optional bonus: published write-up tagged **#H0Hackathon** (`docs/writeup-devto.md`)

## Launch runbook (when AWS credits land)

1. AWS console: enable Bedrock model access (Anthropic Claude + Titan Text Embeddings v2),
   region noted.
2. Provision Aurora PostgreSQL Serverless v2 via the Vercel Marketplace AWS integration
   (project: this repo). Enable pgvector.
3. Set env on Vercel: `DATABASE_URL` (owner), `READONLY_DATABASE_URL`, `AWS_REGION`
   (+ key/secret if not using the integration's OIDC), `BEDROCK_CHAT_MODEL`,
   `BEDROCK_EMBED_MODEL`.
4. `npm run migrate` against Aurora, then once:
   `ALTER ROLE app_readonly WITH LOGIN PASSWORD '<generated>';`
5. `npm run seed:spike` (WITH embeddings: do not set SKIP_EMBED) + `npm run seed:market`.
6. Deploy (Vercel or v0.app import). Verify `/` renders from Aurora.
7. Smoke the Ask box against `docs/demo-questions.md` (all 11, including both degrades).
8. **Capture the Storage Configuration screenshot** (Vercel project -> Storage tab
   showing Aurora) for the submission.
9. Run Lighthouse on the deployed URL (project QA rule).
10. Record the video (`docs/demo-script.md`), upload to YouTube.
11. Devpost form: description (name Aurora PostgreSQL explicitly), repo link, Vercel
    project link, Team ID, video URL, diagram, screenshots.
12. Publish the write-up with #H0Hackathon, add its URL to the submission.

## Pre-publish sanity (already done, re-verify before submitting)

- [x] No secrets in repo or git history (synth credentials, AWS keys: swept clean)
- [x] `.env*`, real seed data, local prep scripts, private docs all gitignored
- [x] MIT LICENSE present; `package.json` license field MIT
- [x] Production build passes (`npm run build`)
- [x] Tests green: 13 unit + 8 real-DB integration
- [ ] Repo public on GitHub under kitfunso
- [ ] Final read of README on GitHub (images render, no broken links)
