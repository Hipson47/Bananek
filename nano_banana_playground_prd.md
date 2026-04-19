# PRD — Private Nano Banana Playground

## Document Status
- **Status:** Draft v1
- **Owner:** Hipson
- **Audience:** AI coding model / engineer implementing the MVP
- **Product Type:** Private single-user web app for rapid image generation tests

## 1. Product Summary
Build a private web playground for Google Gemini image models that behaves as closely as practical to the fal.ai playground pattern shown in the reference screenshot.

The app is a fast testing tool for one user. Its purpose is to let the user:
- paste a ready-made prompt,
- optionally upload one or more reference images,
- choose generation mode,
- choose model,
- choose output settings such as aspect ratio / resolution / quality,
- click **Generate**,
- view the generated image on the right side,
- download the result,
- reuse the result as a new reference image.

The app is **not** a prompt-writing assistant. It is a thin execution playground.

## 2. Problem Statement
Existing playgrounds provide the desired fast testing UX, but this project needs a private version focused on Gemini image models and future extensibility.

The user wants a tool that:
- feels familiar and low-friction,
- does not add prompt helpers or opinionated AI layers,
- supports both text-to-image and image-to-image flows,
- makes switching between Nano Banana variants fast,
- remains easy to extend later without rewriting the UI.

## 3. Goals
### Primary Goals
1. Reproduce the core fal.ai-style playground interaction pattern.
2. Support raw prompt input with no prompt assistance.
3. Support `txt>img` and `img>img` in one screen.
4. Expose three visible model choices in the UI:
   - **Nano Banana 2 — Fast**
   - **Nano Banana 2 — Thinking**
   - **Nano Banana Pro**
5. Show the generated result in a right-side preview panel.
6. Provide exactly two post-generation actions for the result:
   - **Download**
   - **Use as reference**
7. Keep the internal architecture open for future providers, more models, history, and persistence.

### Secondary Goals
1. Minimize implementation complexity for MVP.
2. Keep the product close to a front-end-first private tool.
3. Make the UI responsive and usable on a laptop screen.

## 4. Non-Goals
The MVP must **not** include:
- prompt suggestions,
- prompt enhancement,
- prompt rewriting,
- auto-complete for prompts,
- chat interface,
- generation history page,
- authentication,
- multi-user support,
- billing,
- workflow builder,
- batch job management,
- team collaboration,
- moderation dashboard,
- advanced asset library.

## 5. Core Product Principles
1. **Raw Prompt In, Raw Result Out**  
   The application does not interpret, rewrite, improve, or score the prompt.

2. **One Main Screen**  
   The full generation workflow must happen in a single playground view.

3. **Low Friction**  
   The user should be able to go from opening the app to generating in a few clicks.

4. **Fal.ai-Like Interaction Pattern**  
   The layout and interaction model should feel familiar to users of AI generation playgrounds.

5. **Future-Proof Internals**  
   The UI should not be tightly coupled to one provider-specific request format.

## 6. Target User
### Primary User
- The product owner only.
- Technical user.
- Comfortable pasting prompts and testing model behavior.
- Wants fast iteration more than enterprise robustness.

### Usage Context
- Private experiments.
- Quick model comparisons.
- Testing prompt-output behavior.
- Reusing generated images as next-step references.

## 7. Supported Model Experience
### User-Facing Options
The UI must display exactly these three model options in MVP:
1. **Nano Banana 2 — Fast**
2. **Nano Banana 2 — Thinking**
3. **Nano Banana Pro**

### Internal Mapping Requirement
The implementation must support a model registry layer so that user-facing labels are mapped internally to provider-specific model IDs and settings.

The expected MVP behavior is:
- **Nano Banana 2 — Fast** → Gemini 3.1 Flash Image model with low-latency / minimal-thinking preset
- **Nano Banana 2 — Thinking** → Gemini 3.1 Flash Image model with higher-thinking preset
- **Nano Banana Pro** → Gemini 3 Pro Image model

### Important Constraint
The visible UI must present three choices even if two of them map to the same provider model with different configuration presets.

## 8. Supported Modes
The app must support two generation modes:
- **Text to Image (`txt>img`)**
- **Image to Image (`img>img`)**

### Mode Behavior
#### Text to Image
- Prompt is required.
- Reference image upload is optional unless constrained by provider behavior.

#### Image to Image
- Prompt is required.
- At least one reference image is required.

## 9. UX / Layout Requirements
## 9.1 Overall Layout
The MVP should use a two-panel layout similar to the reference playground:
- **Left panel:** inputs and controls
- **Right panel:** output preview and result actions

## 9.2 Left Panel Requirements
The left panel must contain:
1. **Mode selector**
   - `txt>img`
   - `img>img`
2. **Model selector**
   - 3 visible options only
3. **Prompt textarea**
   - one large raw prompt box
   - no extra prompt-related helper UI
4. **Aspect ratio selector**
5. **Resolution selector**
6. **Quality selector**
7. **Reference image input area**
   - upload button
   - drag-and-drop support preferred
   - preview thumbnails of selected references
8. **Generate button**

## 9.3 Right Panel Requirements
The right panel must contain:
1. **Main result preview**
   - large enough for practical inspection
2. **Generation state area**
   - loading state while request is running
   - error message area if request fails
3. **Result actions**
   - **Download**
   - **Use as reference**

No additional result actions are required in MVP.

## 9.4 Prompt Field Rules
The prompt area is strictly a plain user-input field.

The UI must not include:
- prompt templates,
- prompt examples generated by the app,
- prompt rewrite buttons,
- optimization buttons,
- “improve prompt” actions,
- hidden system prompt builders.

## 10. Reference Image Behavior
## 10.1 Upload Behavior
The user must be able to:
- add one or more reference images,
- see thumbnails of uploaded references,
- remove a reference before generating.

## 10.2 Use as Reference
After a successful generation, the user must be able to click **Use as reference**.

This action must:
- take the currently displayed output image,
- add it to the reference image list,
- make it immediately available for the next generation request.

## 10.3 MVP Simplification
The app does not need a full asset library. The current session reference list is enough.

## 11. Functional Requirements
## 11.1 Input Validation
The system must validate:
- prompt presence,
- required reference image presence in `img>img` mode,
- supported image file types,
- maximum number of references allowed by the selected model,
- setting compatibility if a model does not support a chosen combination.

## 11.2 Generation Request
When the user clicks **Generate**:
1. the current form state is validated,
2. the request payload is built from normalized internal state,
3. the selected provider adapter is called,
4. the UI enters loading state,
5. the result image is rendered in the right panel on success,
6. the error area is shown on failure.

## 11.3 Output Handling
On success, the system must expose:
- rendered preview,
- downloadable output,
- reuse-as-reference action.

## 11.4 Download Behavior
Clicking **Download** must download the currently displayed generated image in a common browser-supported way.

## 11.5 Error Handling
The app must handle at minimum:
- invalid file upload,
- missing prompt,
- missing reference image in `img>img`,
- unsupported setting combination,
- provider request failure,
- malformed provider response,
- network error,
- empty output.

The UI must never fail silently.

## 12. Settings Requirements
## 12.1 Aspect Ratio
The app must provide a selector for aspect ratio.

The available aspect ratios may be filtered by model capability if needed.

## 12.2 Resolution
The app must provide a selector for output resolution.

## 12.3 Quality
The app must provide a selector for output quality or equivalent fidelity/performance setting.

## 12.4 Model-Aware Settings
The UI should prevent or clearly communicate unsupported settings for the currently selected model.

## 13. State Requirements
The playground must maintain, at minimum, the following state:
- selected mode,
- selected model option,
- prompt text,
- selected aspect ratio,
- selected resolution,
- selected quality,
- current reference images,
- generation loading status,
- current result image,
- current error state.

## 14. Architecture Requirements
## 14.1 Provider-Abstraction Requirement
The UI must not directly depend on provider-specific request shapes.

Instead, the implementation must use:
1. **Model Registry**  
   Holds user-facing model options, internal IDs, capability flags, and defaults.

2. **Provider Adapter**  
   Converts normalized playground state into provider-specific API calls.

3. **Normalized Request/Response Types**  
   A stable internal contract independent of Google-specific payload details.

## 14.2 Extensibility Requirement
The architecture must make it easy later to add:
- more Gemini models,
- non-Google image providers,
- session history,
- persisted presets,
- backend proxy,
- auth.

## 14.3 MVP Security Position
This is a private single-user tool.

For MVP, it is acceptable for the API key to be used in the frontend if necessary for speed of implementation.

However, the code structure should not block a future move to a backend or proxy model.

## 15. Recommended MVP Technical Direction
### Preferred Direction
- Front-end-first web app
- TypeScript
- component-based UI
- clear separation of UI state, model registry, and provider adapter

### Optional Implementation Direction
A Vite + React + TypeScript approach is acceptable and aligned with the desire to keep the tool similar in spirit to an existing lightweight private tester application.

## 16. UX States
The app must define and support these states clearly:
- idle,
- ready,
- loading,
- success,
- validation error,
- provider error,
- empty result.

## 17. Accessibility / Usability Requirements
Minimum usability expectations for MVP:
- controls have visible labels,
- buttons have clear disabled/loading states,
- uploaded references are visually identifiable,
- result actions are easy to find,
- the layout remains usable on standard desktop/laptop widths.

## 18. Acceptance Criteria
The MVP is complete when all of the following are true:

1. The user can open a single playground screen and immediately see a left input panel and right result panel.
2. The user can paste a raw prompt into one textarea.
3. The UI contains no prompt-helper, prompt-rewrite, or prompt-suggestion features.
4. The user can switch between `txt>img` and `img>img`.
5. The user can select exactly one of three visible model options:
   - Nano Banana 2 — Fast
   - Nano Banana 2 — Thinking
   - Nano Banana Pro
6. The user can choose aspect ratio, resolution, and quality.
7. The user can upload at least one reference image.
8. The user can remove a reference image before generation.
9. Clicking **Generate** sends the request and shows a loading state.
10. On success, the generated image is shown in the right panel.
11. The user can click **Download** and save the generated image.
12. The user can click **Use as reference** and immediately reuse the output as input.
13. The UI handles invalid inputs and provider failures without crashing.
14. The internal code structure separates UI, model registry, and provider adapter.
15. The implementation does not hardwire business logic directly into presentation components.

## 19. Post-MVP Roadmap
Not part of MVP, but should be easy to add later:
- generation history,
- local persistence,
- backend proxy for secrets,
- saved presets,
- side-by-side model comparison,
- multiple output variants,
- metadata inspector,
- retry / regenerate controls,
- additional provider adapters.

## 20. Open Questions
These items may require confirmation during implementation:
1. Exact set of aspect ratios to expose by default.
2. Exact set of resolution / quality presets to expose in MVP.
3. Whether multiple reference images are required in MVP or just supported when available.
4. Whether the app should remember the last used settings locally.
5. Whether a backend proxy should be added immediately or deferred.

## 21. Definition of Done
The feature set is done when:
- the MVP playground works end-to-end for `txt>img` and `img>img`,
- all acceptance criteria are met,
- the UI remains intentionally minimal,
- raw prompt input is preserved without app-side prompt manipulation,
- the internal architecture is ready for future extension without major refactor.

