/**
 * Todos Routes - DB-backed todo management with organization
 *
 * GET /api/todos/:project - Get organized todos from DB
 * POST /api/todos/:project/organize - Trigger AI organization
 * POST /api/todos/:project/complete/:id - Mark todo complete
 * POST /api/todos/:project/add - Add new todo
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { glob } = require('glob');
const todoOrganizer = require('../services/todoOrganizer');

// GET /api/todos/:project - Get TODO.md files organized by folder
router.get('/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = decodeURIComponent(project);

    // Find all TODO.md files in the project
    const pattern = path.join(projectPath, '**/TODO.md').replace(/\\/g, '/');
    const todoFiles = await glob(pattern, { nodir: true });

    const todos = await Promise.all(todoFiles.map(async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        const folder = path.dirname(relativePath);

        // Parse TODO items from markdown
        const items = parseTodoItems(content);

        return {
          folder: folder === '.' ? '(root)' : folder,
          filePath,
          content,
          items,
          itemCount: items.length,
          lastModified: (await fs.stat(filePath)).mtime
        };
      } catch (err) {
        return {
          folder: path.dirname(path.relative(projectPath, filePath)),
          filePath,
          error: err.message
        };
      }
    }));

    // Group by folder
    const byFolder = todos.reduce((acc, todo) => {
      if (!acc[todo.folder]) {
        acc[todo.folder] = [];
      }
      acc[todo.folder].push(todo);
      return acc;
    }, {});

    res.json({
      success: true,
      project: projectPath,
      folderCount: Object.keys(byFolder).length,
      totalFiles: todos.length,
      folders: byFolder,
      scannedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Clair/Todos] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/:project/scan - Rescan project for TODO.md files
router.post('/:project/scan', async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = decodeURIComponent(project);

    // Same as GET but force refresh
    const pattern = path.join(projectPath, '**/TODO.md').replace(/\\/g, '/');
    const todoFiles = await glob(pattern, { nodir: true });

    res.json({
      success: true,
      project: projectPath,
      filesFound: todoFiles.length,
      files: todoFiles.map(f => path.relative(projectPath, f)),
      scannedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Clair/Todos] Scan error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/:project/create - Create TODO.md in a folder
router.post('/:project/create', async (req, res) => {
  try {
    const { project } = req.params;
    const { folder } = req.body;
    const projectPath = decodeURIComponent(project);

    const todoPath = path.join(projectPath, folder, 'TODO.md');

    // Check if already exists
    try {
      await fs.access(todoPath);
      return res.status(400).json({ success: false, error: 'TODO.md already exists' });
    } catch {
      // File doesn't exist, create it
    }

    const template = `# TODO

## Pending
- [ ]

## In Progress

## Completed
`;

    await fs.writeFile(todoPath, template, 'utf-8');

    res.json({
      success: true,
      created: todoPath,
      folder
    });
  } catch (error) {
    console.error('[Clair/Todos] Create error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Parse TODO items from markdown content
 */
function parseTodoItems(content) {
  const items = [];
  const lines = content.split('\n');

  let currentSection = 'Uncategorized';

  for (const line of lines) {
    // Check for section headers
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].trim();
      continue;
    }

    // Check for checkbox items
    const todoMatch = line.match(/^[\s-]*\[([ xX])\]\s*(.+)/);
    if (todoMatch) {
      items.push({
        completed: todoMatch[1].toLowerCase() === 'x',
        text: todoMatch[2].trim(),
        section: currentSection
      });
    }

    // Check for bullet items without checkbox
    const bulletMatch = line.match(/^[\s]*[-*]\s+(?!\[)(.+)/);
    if (bulletMatch && !line.includes('[')) {
      items.push({
        completed: false,
        text: bulletMatch[1].trim(),
        section: currentSection,
        isNote: true
      });
    }
  }

  return items;
}

// ============================================
// DB-BACKED TODO ROUTES (todoOrganizer)
// ============================================

// GET /api/todos/db/:project - Get organized todos from database
router.get('/db/:project', async (req, res) => {
  try {
    const projectPath = decodeURIComponent(req.params.project);
    const result = await todoOrganizer.getFormattedTodos(projectPath);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Clair/Todos] DB get error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/db/:project/organize - Trigger AI organization
router.post('/db/:project/organize', async (req, res) => {
  try {
    const projectPath = decodeURIComponent(req.params.project);
    const result = await todoOrganizer.organizeProject(projectPath);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Clair/Todos] Organize error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/db/organize-all - Organize all projects
router.post('/db/organize-all', async (req, res) => {
  try {
    const results = await todoOrganizer.organizeAllProjects();

    res.json({
      success: true,
      projectsProcessed: results.length,
      results
    });
  } catch (error) {
    console.error('[Clair/Todos] Organize all error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/db/:project/complete/:id - Mark todo complete
router.post('/db/:project/complete/:id', async (req, res) => {
  try {
    const todoId = req.params.id;
    const result = await todoOrganizer.markComplete(todoId);

    res.json({
      success: true,
      todo: result
    });
  } catch (error) {
    console.error('[Clair/Todos] Complete error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/todos/db/:project/add - Add new todo
router.post('/db/:project/add', async (req, res) => {
  try {
    const projectPath = decodeURIComponent(req.params.project);
    const { title, category, priority } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title required' });
    }

    const result = await todoOrganizer.addTodo(projectPath, title, category, priority);

    res.json({
      success: true,
      todo: result
    });
  } catch (error) {
    console.error('[Clair/Todos] Add error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
