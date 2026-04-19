# Security And Risk Rules

## P0 Rules

- Provider API keys must remain server-side only in customer product mode.
- Uploads are untrusted input.
- Do not expose internal playground controls to customers by default.
- Do not introduce destructive changes without explicit approval.

## Upload Rules

- Validate file type server-side.
- Validate file size server-side.
- Treat metadata and file contents as hostile.
- Do not trust browser MIME declarations alone.

## Billing, Auth, And Storage Caution

- Billing changes require explicit correctness checks.
- Auth/session changes require explicit threat modeling.
- Storage paths and delivery URLs require authorization rules.
- Credit deduction must be deliberate and auditable once implemented.

## Product Safety Rules

- Customer flow should promise a predefined outcome, not open-ended generation.
- Internal prompt logic must stay hidden from customers.
- Internal model/provider details should not leak into customer UX.

## Operational Risks To Track

- provider cost per job
- failed job handling
- upload abuse
- storage retention
- low-quality output that harms conversion
- mistaken blending of internal and customer modes
