# Redesign

The redesign turns OpenConferences from a platform customised for one organiser into a product any conference organiser can sign up for and run. It has two goals, in this order:

1. **A rigid core.** A small fixed set of building blocks, with every difference between conferences stored as validated settings instead of code.
2. **A calmer interface.** A new frontend built around what each person is trying to do, replacing the current dashboard.

SaaS features (self-serve sign-up, per-organisation payments, plans, public conference pages) come after those two, because they are built on top of them.

## Where things live

| What              | Where                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Rules we work by  | [GROUND_RULES.md](GROUND_RULES.md)                                   |
| Phases and order  | [PLAN.md](PLAN.md)                                                   |
| Decisions and why | [DECISIONS.md](DECISIONS.md)                                         |
| Task board        | Private page, link kept in [DECISIONS.md](DECISIONS.md#board)        |
| Live product      | `main` branch, deployed to `app.fresi.org` and `api.fresi.org`       |
| Redesign code     | `redesign` branch, never deployed to production                      |
| New frontend      | `apps/web-v2` on the `redesign` branch                               |
| Redesign database | Local Postgres database `openconferences_redesign`, never production |

## How to read these documents

- Start with the ground rules. They are short and they are binding.
- The plan says what order the work happens in and what "done" means for each phase. It does not list individual tasks; the board does.
- When a rule or plan item changes, the change is recorded in the decision log first, then the rule or plan is edited.

## Documents this will add

Each of these is written in the phase that needs it, not before.

| Document                      | Written in | Contents                                                        |
| ----------------------------- | ---------- | --------------------------------------------------------------- |
| `CUSTOMISATION_AUDIT.md`      | Phase 1    | Every organiser-specific behaviour, marked core, setting or cut |
| `SCREEN_INVENTORY.md`         | Phase 1    | Every current screen, who uses it and for what                  |
| `DOMAIN_MODEL.md`             | Phase 2    | The fixed building blocks and the settings each one accepts     |
| `INFORMATION_ARCHITECTURE.md` | Phase 3    | Navigation and screens per role                                 |
| `DESIGN_SYSTEM.md`            | Phase 3    | Tokens, components and usage rules                              |
| `CUTOVER.md`                  | Phase 6    | Rehearsal results and the step-by-step switch to production     |
