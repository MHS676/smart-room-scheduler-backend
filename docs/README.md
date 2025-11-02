# Project Documentation

This `docs/` folder contains technical documentation for the Smart Room Scheduler backend.

Files
- `SYSTEM_ARCHITECTURE.md` — high-level architecture and data flow
- `API.md` — HTTP and WebSocket API reference and examples
- `DATABASE.md` — data model, Prisma notes and queries
- `ROADMAP.md` — recommended development roadmap and milestones
- `RISK_ASSESSMENT.md` — risks and mitigations
- `TECHNOLOGIES.md` — technologies used and rationale

How to use
1. Review `prisma/schema.prisma` for the canonical DB schema. Update `DATABASE.md` if you change the schema.
2. Keep `API.md` synchronized with DTOs in `src/**/dto/*.ts`.
3. Add a diagrams folder `docs/diagrams/` and place architecture/ER diagrams (SVG/PNG) there.
4. When changing behavior (e.g., booking rules), update relevant docs and the roadmap if this impacts rollout.

Next steps
- Add an ER diagram generated from Prisma (mermaid or draw.io) to `docs/diagrams/`.
- Add a `docs/CHANGELOG.md` if documentation needs tracked non-code changes.

Contributing
- Update docs as part of PRs that change behavior or API. Keep docs close to code changes for easy review.

Contact
- See repository owners and code authors in `package.json` / Git history for questions.
