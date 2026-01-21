# Design Document – UX & UI

## Product
AI‑Native Agile Project Management Platform ("AI Scrum Master")

---

## 1. Design Philosophy

### 1.1 UX North Star
> **Effortless clarity.** The system should feel like it *removes cognitive load*, not adds process.

The UI must:
- Reduce decision fatigue
- Make the next best action obvious
- Surface insight before the user asks
- Feel calm, professional, and trustworthy

This is **not** a busy productivity tool. It is a **thinking workspace**.

---

### 1.2 Core UX Principles

1. **AI is embedded, not centralised**
   - No "chat-first" experience
   - AI appears where decisions are made

2. **Progressive disclosure**
   - Show only what matters now
   - Advanced details are one click away

3. **Human-in-control AI**
   - AI always explains
   - AI always proposes, never enforces (MVP)

4. **Fast visual parsing**
   - Clear hierarchy
   - Minimal color palette
   - Strong typography

5. **Design for demos**
   - Every screen should communicate value in 5 seconds

---

## 2. Visual Identity (High-Level)

### 2.1 Tone
- Professional
- Calm
- Modern
- Confident

Think: **Linear + Notion + modern AI tooling** (not Jira).

### 2.2 Color System
- Neutral base (gray / slate)
- One primary accent (blue or violet)
- Semantic colors only for meaning:
  - Green: on track
  - Yellow: risk
  - Red: blocked

Avoid excessive color usage.

### 2.3 Typography
- Sans-serif, highly readable
- Clear size hierarchy:
  - Page title
  - Section header
  - Card title
  - Metadata

Spacing > decoration.

---

## 3. Global Layout System

### 3.1 App Shell

**Left Sidebar**
- Project switcher
- Navigation:
  - Dashboard
  - Board
  - Sprint
  - Insights
  - Chat

**Top Bar**
- Breadcrumbs
- Context actions (Plan sprint, Ask AI)
- User menu

**Main Content Area**
- Focused, uncluttered
- One primary task per screen

---

## 4. Core UX Patterns

### 4.1 Drawers Over Modals
- Card details open in right-side drawer
- Preserves context
- Enables quick edits

### 4.2 AI Suggestion Cards
Every AI interaction follows the same pattern:

- What I suggest
- Why (short explanation)
- Evidence (optional expand)
- Actions:
  - Apply
  - Edit
  - Dismiss

Consistency builds trust.

### 4.3 Confidence & Risk Indicators
- Never hidden
- Always subtle
- Tooltip explanations on hover

---

## 5. Key Screens – UX Design

## 5.1 Project Setup Wizard (First Impression)

### Goal
Turn a vague idea into structure without intimidation.

### UX Flow
1. Idea input (large text area, friendly copy)
2. Constraints (simple sliders/selects)
3. Generate plan (loading with explanation)
4. Review screen (editable, expandable hierarchy)

### UX Notes
- AI generation must feel *transparent*
- Users can edit before committing
- No jargon in early steps

---

## 5.2 Dashboard ("What should I care about?")

### Layout
- Sprint status card (top)
- Key risks (ranked)
- AI suggestions queue
- Quick actions

### UX Rules
- Max 5 items per section
- No scrolling required for key info
- Everything links deeper

---

## 5.3 Board (Core Workspace)

### Default View
Kanban by status

### UX Enhancements
- Group by Epic toggle
- Inline card creation
- Keyboard-friendly drag/drop

### AI Integration
- Column-level AI suggestions
- Per-card AI actions

### Visual Hierarchy
- Epic → Story → Task clearly distinguishable
- Metadata muted, title prominent

---

## 5.4 Card Detail Drawer (Decision Hub)

### Sections (Top → Bottom)
1. Title + status + priority
2. Description
3. Acceptance Criteria (checklist)
4. Estimate + confidence
5. Dependencies
6. Activity timeline
7. AI actions

### UX Goal
This drawer should answer:
> "What is this, why does it exist, and what should I do next?"

---

## 5.5 Sprint Screen (Agile Intelligence)

### Layout
- Sprint goal + health indicator
- Sprint backlog list
- Burndown chart
- AI analysis panel

### UX Highlight
Burndown **always** paired with explanation.

Example:
> "Remaining work is flat because 2 tasks are blocked by API design."

---

## 5.6 Insights (Trust Builder)

### Sections
- Velocity trend
- Risk register
- Blocker analysis
- Scope creep indicator

### UX Rule
Charts without explanation are forbidden.

Each insight must include:
- What changed
- Why it matters
- Suggested action

---

## 5.7 Project Chat (Contextual AI)

### Positioning
- Secondary surface, not the main UI

### UX Requirements
- Context preview (what AI sees)
- Suggested prompts
- Action buttons in responses

### Design Goal
Chat should feel like a **shortcut**, not a dependency.

---

## 6. Interaction & Motion Design

### Animations
- Subtle transitions
- Fast feedback on actions
- Loading states that explain what's happening

### Do NOT
- Over-animate
- Use gimmicky AI effects

---

## 7. Accessibility & Usability

- Keyboard navigable
- High contrast text
- Clear focus states
- No color-only signals

---

## 8. Design Consistency Rules (Non-Negotiable)

1. AI suggestions always follow the same visual pattern
2. Risk and confidence always visible
3. No screen exceeds one primary goal
4. No unexplained AI output
5. Editing is always reversible

---

## 9. UX Success Criteria

The design is successful if:
- A new user creates a sprint plan without guidance
- Users understand *why* AI suggests something
- The UI feels calm even on complex projects
- Demos feel obvious and impressive

---

## 10. Future UX Considerations

- VS Code extension UI reuse
- Dark/light theme
- Personalised AI verbosity levels
- Team-level dashboards

---

**End of Design Document**

