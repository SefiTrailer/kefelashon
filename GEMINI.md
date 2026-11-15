# Kefel Lashon (קפל לשון) - Agent Instructions

## Modern Web Standards (Default Development Baseline)
For all frontend, UI, HTML, CSS, and client-side JavaScript tasks in this project, **modern web platform standards are mandatory and enabled by default**.
- **Always consult and follow `modern-web-guidance`** (located at `_agent/skills/modern-web-guidance/SKILL.md` and official plugin).
- **Prefer native HTML and CSS**:
  - Native `<dialog>` and Popover API instead of legacy modal libraries.
  - Native CSS anchor positioning, subgrid, container queries, `@starting-style`, and scroll-driven animations instead of heavy JavaScript layout packages.
  - Modern web APIs (View Transitions, Sanitizer API, native form validation, Web Streams) rather than outdated polyfills and bloated third-party dependencies.
- Refer to `_agent/skills/modern-web-guidance/guides/` or use `npx -y modern-web-guidance@latest search/retrieve` whenever architecting or updating UI components.

## Project Context
For detailed project overview, architecture (Admin System vs Public Viewer), and execution commands, refer to [_agent/PROJECT_CONTEXT.md](file:///c:/Users/Sefi/projects/kefel-lashon/_agent/PROJECT_CONTEXT.md).
