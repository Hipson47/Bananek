# Product Definition

## Product Thesis

- `Proposal`: customers will pay a small amount for a finished, predictable photo enhancement outcome, not for access to a creative AI tool

## Target User

- `Proposal`: small and mid-sized e-commerce sellers
- sells on marketplaces or a small storefront
- often uses phone-shot product photos
- cares about conversion and listing quality
- wants a result quickly without learning AI workflows

## Job To Be Done

“When I have a product photo that looks amateur, I want to turn it into a clean commerce-ready image in a few clicks so my listing looks more professional and converts better.”

## Value Proposition

Upload one product photo and get a polished commerce-ready result without prompts, editing skills, or model choices.

## Paid Automation-First User Flow

1. User lands on a simple enhancement page.
2. User uploads one photo.
3. User chooses one predefined task, for example:
   - `White Background Cleanup`
   - `Studio Light Polish`
   - `Marketplace Ready`
4. User optionally provides one simple business input if needed, for example:
   - product category
   - background preference from a fixed list
5. System processes the image automatically.
6. User sees result preview.
7. User pays per result or uses one credit.
8. User downloads the finished asset.

## Customer-Facing UX Rules

- no prompts
- no provider names
- no model names
- no seeds, ratios, or raw generation controls
- no API keys
- no manual image-generation workflow concepts

## Internal System Responsibility

The system must translate:
- uploaded image
- selected task
- optional structured business input

into:
- hidden prompt logic
- provider routing
- preprocessing
- postprocessing
- quality checks
- delivery

## Pricing Model Assumptions

### Assumptions

- `Assumption`: low-ticket paid action can work around `$2–$5` per completed result
- `Assumption`: simple credits or packs are easier to understand than a complex subscription on day one

### Proposal

- pay-on-result option for first launch
- optional small credit packs after core workflow quality is proven
- no customer-facing pricing complexity before the first conversion path is clear

## V1 Scope

- single-photo upload
- one narrow enhancement use case for product photos
- one or a few fixed presets only
- automatic processing
- result preview
- paid result delivery
- internal-only prompt/model orchestration
- minimal analytics on upload, completion, purchase, download

## Out Of Scope

- raw prompts for customers
- model marketplace
- batch enhancement
- API product
- white-label offering
- team collaboration
- generalized image-editing surface
- broad multi-use-case creative studio

## Success Metrics

- upload to result completion rate
- result preview to paid download conversion
- median time to finished result
- cost per completed job
- repeat paid usage
