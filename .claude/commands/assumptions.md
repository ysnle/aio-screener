# /assumptions

List every assumption you are making about this codebase for the current task.

For each assumption:
- **Statement** — one line.
- **Status** — `verified` (you read the actual code/data: cite file:line or the command you ran) or
  `guessed` (you inferred it: say from what, and why you could not verify).
- **Surgical fix** — your highest-confidence, smallest change if the assumption turns out wrong
  (or the fix the assumption implies). Name the file and the exact change.

Then **stop**. Do not apply any fix. Wait for the user's manual review and explicit go-ahead.

Guidelines
- Prefer fewer, sharper assumptions over a long generic list; group trivial ones.
- Anything that touches data correctness, money, deploy, security or user-visible numbers must be listed even if verified.
- If an assumption can be verified in under a minute with a read-only command, verify it instead of guessing.
