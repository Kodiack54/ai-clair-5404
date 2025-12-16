# Clair-5406: Project Documentation Manager

## Role
Clair is the **Documentation Manager** for all projects. She actively maintains, organizes, and synthesizes project documentation across all tabs in the Project Management panel.

---

## AI Worker Roster
| Port | Name | Role | Status |
|------|------|------|--------|
| 5400 | Claude | Inside man / bridge to outside Claude | Active |
| 5401 | Chad | Transcriber - captures & extracts | Active |
| 5402 | Ryan | Orchestrator | Planned |
| 5403 | Susan | Librarian - catalogs raw knowledge | Active |
| 5404 | Tiffany | Tester | Planned |
| 5405 | Mike | Tester #2 (parallel testing) | Planned |
| 5406 | **Clair** | **Documentation Manager** | **NEW** |

---

## Data Flow

User/Dev conversations
        |
        v
Chad (5401) - extracts raw data
        |
        v
Susan (5403) - stores in tables
        |
        v
+-----------------------------------------------+
|  Clair (5406) - DOCUMENTATION MANAGER         |
|                                               |
|  Inputs:                                      |
|  - Susans raw knowledge tables                |
|  - Mike and Tiffanys test results             |
|  - File system scans (TODO.md, folder trees)  |
|  - Developer decisions and architecture notes |
|                                               |
|  Outputs:                                     |
|  - Organized tab content                      |
|  - Technical documentation                    |
|  - How-to guides (-> future user portal)      |
|  - Coding convention docs                     |
+-----------------------------------------------+
        |
        v
UI - displays organized, maintained docs
        |
        v
Future: User Portal Knowledge Base

---

## Tab Responsibilities

### 1. TODOS TAB
**What Clair Does:** Scans project folders for TODO.md files, organizes by subfolder

**Features:**
- Folder tabs (like Structure tab does)
- Each folder shows its TODO.md content
- Click to expand/collapse
- Sync status indicator (last scanned)
- Create TODO.md if missing

**File pattern:** {project_folder}/*/TODO.md

---

### 2. KNOWLEDGE TAB
**What Clair Does:** Maintains project journal - logs, ideas, work history

**Content Types:**
- **Work Log** - What was done, when, by who
- **Ideas Journal** - Future features, improvements brainstormed
- **Decisions Log** - Why things were built a certain way
- **Lessons Learned** - What worked, what didnt

**Sources:**
- Chads extracted session summaries
- Developer notes
- Susans knowledge entries

---

### 3. DOCS TAB (Technical Documentation)
**What Clair Does:** Creates and maintains technical documentation

**Document Types:**

#### System Breakdowns
- Grid layouts showing system architecture
- What each component does
- How components connect

#### How-To Guides (from Mike and Tiffanys testing)
- How to add a client
- How to close out a job
- How to invoice someone
- How to run reports
- Step-by-step with screenshots

#### Schematics
- Database relationships
- API flow diagrams
- Component hierarchies
- PDF-ready formatting (copy and export)

**Future Use:** These how-to guides become the **User Portal Knowledge Base**

**Format:** Clean markdown that can be copied and converted to PDF

---

### 4. DATABASE TAB
**What Clair Does:** Documents all database objects

**Content:**
- Tables with columns and types
- RLS Policies
- Schemas (public, auth, storage)
- Functions/Triggers

**Sources:**
- Supabase schema introspection
- Manual documentation
- Susans schema entries

---

### 5. STRUCTURE TAB
**What Clair Does:** Full clickable file/folder trees with descriptions

**Enhanced Features:**
- Real folder tree from file system
- Click to expand/collapse
- **Folder descriptions** - whats inside each folder
- **File purposes** - what each key file does
- Color coding (active/deprecated/config/test)

---

### 6. CODE CHANGES TAB
**What Clair Does:** Documents coding conventions for Claude

**Purpose:** Help Claude (inside and outside) understand project patterns

**Content:**
- Naming Conventions (camelCase, PascalCase, snake_case)
- File patterns (server.js vs index.js)
- Database prefixes ({tradeline}_ patterns)
- Tech Stack documentation
- Quirks and Gotchas

---

### 7. NOTEPAD TAB
**What Clair Does:** Nothing - this is the developers personal space

Dev keeps their own notes here. Clair doesnt touch it.

---

### 8. BUGS TAB
**What Clair Does:** Manages bug lifecycle

**Workflow:**
Bug Reported -> Open -> Investigating -> Fixed -> COMPLETE -> Archive/Delete

**Features:**
- Auto-archive after X days when fixed
- Link to related code changes
- Resolution notes
- Option to delete or keep archived

---

## Implementation Plan

### Phase 1: Core Service
Build clair-5406/ service with routes for each tab

### Phase 2: API Endpoints
- GET/POST /api/todos/:project
- GET/POST /api/journal/:project
- GET/POST /api/docs/:project
- GET /api/database/:project/tables|schemas|rls
- GET/POST /api/structure/:project
- GET/POST /api/conventions/:project
- PATCH/DELETE/POST /api/bugs/:id

### Phase 3: UI Enhancements
Update each tab to use Clairs API

### Phase 4: Tester Integration
Connect Mike and Tiffany outputs to Clair for how-to guide generation

---

## Database Changes

### New Tables
- **dev_ai_journal** - Work logs, ideas, decisions, lessons
- **dev_ai_generated_docs** - Technical docs, how-tos, schematics
- **dev_ai_folder_descriptions** - Structure annotations
- **dev_ai_conventions** - Coding patterns

---

## Success Criteria

1. **Todos**: See all TODO.md files organized by project folder
2. **Knowledge**: Project has living journal of work/ideas/decisions
3. **Docs**: Generate PDF-ready technical documentation
4. **Database**: Full schema documentation with RLS policies
5. **Structure**: Clickable tree with meaningful folder descriptions
6. **Code Changes**: Claude can reference coding conventions quickly
7. **Bugs**: Fixed bugs auto-archive, clean bug list

**Ultimate Goal**: How-to guides ready to export to User Portal Knowledge Base
