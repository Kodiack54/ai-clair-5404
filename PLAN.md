# Plan: Organized Knowledge System with Clair Document Writer

## Goal
Transform raw knowledge dumps into organized, searchable, synthesized documentation using Clair-5406 as the dedicated document writer.

## AI Worker Roster
| Port | Name | Role | Status |
|------|------|------|--------|
| 5400 | claude | Inside man / bridge to outside Claude | Active |
| 5401 | Chad | Transcriber - captures & extracts | Active |
| 5402 | Tiffany | Tester | Planned |
| 5403 | Susan | Librarian - catalogs knowledge | Active |
| 5404 | Ryan | Orchestrator | Planned |
| 5405 | (available) | | |
| 5406 | **Clair** | **Document Writer** | **NEW** |

## Current State
- **Chad (5401)**: Extracts raw knowledge every 30 min → sends to Susan
- **Susan (5403)**: Stores in tables (knowledge, bugs, todos, docs, structure)
- **UI**: Basic tabs with minimal search, no synthesis

## What User Wants
1. **Organized views** - Not random boxes, grouped logically
2. **Global search** - Search across all tabs/content
3. **Structured drawings** - Visual project structure diagrams
4. **Full documents** - Synthesized docs, not raw snippets

---

## Data Flow (After Implementation)

```
User conversations
      ↓
Chad (5401) - extracts raw knowledge
      ↓
Susan (5403) - stores in tables
      ↓
Clair (5406) - SYNTHESIZES into documents  ← NEW
      ↓
UI - displays organized, searchable docs   ← ENHANCED
```

---

## Implementation Order

### Step 1: Build Clair-5406 Document Writer
**New service:** `ai-workers/clair-5406/`

```
clair-5406/
├── index.js
├── package.json
├── pm2.config.js
├── src/
│   ├── routes/
│   │   ├── generate.js      # Document generation endpoints
│   │   ├── structure.js     # Structure tree building
│   │   └── health.js
│   ├── services/
│   │   ├── documentWriter.js    # Uses Claude to synthesize docs
│   │   ├── treeBuilder.js       # Builds ASCII/visual trees
│   │   └── susanClient.js       # Queries Susan for raw data
│   └── templates/
│       ├── project-overview.md
│       ├── architecture.md
│       └── api-reference.md
```

**API Endpoints:**
- `POST /api/generate/overview` - Project overview from all knowledge
- `POST /api/generate/architecture` - Architecture doc from decisions + structure
- `POST /api/generate/api-docs` - API reference from endpoints
- `POST /api/generate/tree` - Project structure diagram
- `GET /api/documents` - List generated documents
- `POST /api/regenerate-all` - Manual trigger to rebuild all docs

**Scheduled Job:** Every 4 hours, regenerate docs for projects with new knowledge

### Step 2: Add Global Search to UI
- New `GlobalSearch.tsx` component above tabs
- Searches across: knowledge, bugs, todos, docs, structure, code-changes
- Returns grouped results with quick navigation to source

### Step 3: Enhanced Tab Organization
- Sorting dropdowns per tab (date, priority, alphabetical)
- Category grouping with collapsible sections
- Multi-select tag filtering

### Step 4: Documents Tab
- New tab showing Clair's synthesized documents
- "Generate Now" button per doc type
- Markdown preview with export options
- Last generated timestamp

### Step 5: Structure Visualizer
- ASCII tree generator (for docs/export)
- Interactive expandable tree (in UI)
- Shows file purposes and status colors (active/deprecated)

---

## User Decisions
1. **Document Types**: All three - Project Overview, Architecture Docs, API Reference
2. **Regeneration**: Both auto-regen (every 4 hours) AND manual trigger button
3. **Structure Diagrams**: Both ASCII (for export) AND interactive tree (in UI)

---

## Database Changes
New table: `dev_ai_generated_docs`
- id, project_path, doc_type, title, content, generated_at, source_ids[]

---

## Files to Create/Modify

**New (Clair-5406):**
- `ai-workers/clair-5406/` - entire new service

**Modify (dev-studio-5000):**
- `src/app/project-management/components/GlobalSearch.tsx` (NEW)
- `src/app/project-management/ProjectManagementPanel.tsx`
- `src/app/project-management/tabs/GeneratedDocsTab.tsx` (NEW)
- `src/app/project-management/types.ts` (add new tab)
- All existing tabs (add sorting/filtering)
