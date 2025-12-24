/**
 * todoOrganizer.js - Clair's Todo Organization Service
 *
 * Reads todos from dev_ai_todos, organizes into categories per project
 * Uses GPT-4o-mini with strict guardrails (JSON only, no delete)
 *
 * Parent projects consolidate children todos into unified actionable items
 */

const { from } = require('../lib/db');
const ai = require('../lib/ai');
const { Logger } = require('../lib/logger');

const logger = new Logger('Clair:TodoOrganizer');

// Guardrails: Only these actions are allowed
const ALLOWED_ACTIONS = ['categorize', 'mark_complete', 'add_new'];

// System prompt for child project organization
const CHILD_SYSTEM_PROMPT = `You are a todo organizer that filters and organizes ACTIONABLE tasks only.

CRITICAL: Only include ACTIONABLE items - things that can be done:
- KEEP: "Create user auth module", "Fix login bug", "Build API endpoint", "Add validation", "Update schema"
- REJECT: "Consider moving...", "Maybe we should...", "What if...", "Investigate why...", questions, ideas, notes

STRICT RULES:
1. Output ONLY valid JSON - no explanations, no markdown
2. Allowed actions: categorize, mark_complete (NEVER delete)
3. FILTER OUT non-actionable items (ideas, questions, notes, considerations)
4. Actionable items START with action verbs: Create, Build, Fix, Add, Update, Implement, Write, Remove, Refactor, Deploy, Configure, Set up, Migrate, Test
5. Categories should be phases (Phase 1, Phase 2, etc.) or logical groupings
6. Keep category names short (1-3 words)
7. Consolidate duplicate/similar items into one clear actionable task
8. If an item is vague, try to make it actionable or mark it for rejection

OUTPUT SCHEMA:
{
  "categories": {
    "Phase 1": [
      {"id": "uuid", "title": "Create X feature", "completed": false}
    ]
  },
  "rejected": [{"id": "uuid", "reason": "idea not action"}],
  "mark_complete": ["uuid1", "uuid2"],
  "consolidated": [{"kept_id": "uuid", "merged_ids": ["uuid2", "uuid3"], "title": "merged actionable title"}]
}`;

// System prompt for parent project consolidation
const PARENT_SYSTEM_PROMPT = `You are a todo consolidator for a parent project. You receive organized todos from multiple child projects and must consolidate related items into unified parent-level actionable tasks.

RULES:
1. Output ONLY valid JSON - no explanations
2. Look for RELATED items across children (same feature, same bug, same component)
3. Consolidate related items into ONE clear parent-level action
4. Keep child references so we know which children are affected
5. Assign phases based on dependencies and priority

OUTPUT SCHEMA:
{
  "consolidated_todos": [
    {
      "title": "Clear parent-level actionable task",
      "phase": "Phase 1",
      "child_todos": [
        {"child_project": "project-name", "todo_id": "uuid", "title": "original child todo"}
      ],
      "priority": "high"
    }
  ]
}`;

/**
 * Get project hierarchy info from dev_projects
 */
async function getProjectHierarchy(projectPath) {
  // Find project by path
  const { data: pathData } = await from('dev_project_paths')
    .select('project_id, path')
    .eq('path', projectPath)
    .single();

  if (!pathData) return { isParent: false, children: [] };

  // Get project info
  const { data: project } = await from('dev_projects')
    .select('id, name, slug, is_parent, parent_id')
    .eq('id', pathData.project_id)
    .single();

  if (!project) return { isParent: false, children: [] };

  if (!project.is_parent) {
    return { isParent: false, children: [], project };
  }

  // Get children projects
  const { data: children } = await from('dev_projects')
    .select('id, name, slug')
    .eq('parent_id', project.id);

  // Get paths for each child
  const childPaths = [];
  for (const child of (children || [])) {
    const { data: paths } = await from('dev_project_paths')
      .select('path')
      .eq('project_id', child.id);

    if (paths && paths.length > 0) {
      childPaths.push({
        projectId: child.id,
        name: child.name,
        slug: child.slug,
        paths: paths.map(p => p.path)
      });
    }
  }

  return { isParent: true, children: childPaths, project };
}

/**
 * Get all todos for a project
 */
async function getTodosForProject(projectPath) {
  const { data, error } = await from('dev_ai_todos')
    .select('id, title, description, status, priority, category, created_at')
    .eq('project_path', projectPath)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch todos', { error: error.message, projectPath });
    throw error;
  }

  return data || [];
}

/**
 * Organize todos for a single child project
 */
async function organizeChildProject(projectPath) {
  logger.info('Organizing child project todos', { projectPath });

  const todos = await getTodosForProject(projectPath);

  if (todos.length === 0) {
    logger.info('No todos found for project', { projectPath });
    return { projectPath, categories: {}, organized: 0 };
  }

  const todoList = todos.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: t.status,
    currentCategory: t.category || 'uncategorized'
  }));

  const prompt = `Organize these ${todos.length} todos into logical categories:

${JSON.stringify(todoList, null, 2)}

Remember: Output ONLY valid JSON matching the schema.`;

  const response = await ai.generate('todo_organization', prompt, {
    system: CHILD_SYSTEM_PROMPT,
    maxTokens: 2000,
    jsonMode: true
  });

  let result;
  try {
    result = JSON.parse(response.content);
  } catch (parseError) {
    logger.error('AI returned invalid JSON', { error: parseError.message });
    throw new Error('AI returned invalid JSON');
  }

  // Block delete attempts
  if (result.delete || result.remove) {
    delete result.delete;
    delete result.remove;
  }

  // Apply category updates
  let updated = 0;
  if (result.categories) {
    for (const [category, items] of Object.entries(result.categories)) {
      for (const item of items) {
        if (!item.id) continue;
        const { error: updateError } = await from('dev_ai_todos')
          .update({ category })
          .eq('id', item.id);
        if (!updateError) updated++;
      }
    }
  }

  // Move rejected items to knowledge
  let rejected = 0;
  if (result.rejected && Array.isArray(result.rejected)) {
    for (const item of result.rejected) {
      if (!item.id) continue;
      const { data: todoItem } = await from('dev_ai_todos')
        .select('*')
        .eq('id', item.id)
        .single();

      if (todoItem) {
        await from('dev_ai_knowledge').insert({
          project_path: projectPath,
          title: todoItem.title,
          content: `${todoItem.description || todoItem.title}\n\n[Moved from todo - Reason: ${item.reason}]`,
          category: 'Ideas',
          source: 'clair_filter'
        });
        await from('dev_ai_todos')
          .update({ category: 'moved_to_knowledge', status: 'completed' })
          .eq('id', item.id);
        rejected++;
      }
    }
  }

  // Handle consolidations
  let merged = 0;
  if (result.consolidated && Array.isArray(result.consolidated)) {
    for (const consolidation of result.consolidated) {
      if (!consolidation.kept_id || !consolidation.merged_ids?.length) continue;
      if (consolidation.title) {
        await from('dev_ai_todos')
          .update({ title: consolidation.title })
          .eq('id', consolidation.kept_id);
      }
      for (const mergedId of consolidation.merged_ids) {
        const { error: mergeError } = await from('dev_ai_todos')
          .update({ category: 'duplicate', status: 'completed' })
          .eq('id', mergedId);
        if (!mergeError) merged++;
      }
    }
  }

  logger.info('Child organization complete', { projectPath, categorized: updated, rejected, merged });

  return {
    projectPath,
    categories: result.categories || {},
    organized: updated,
    rejected,
    merged
  };
}

/**
 * Consolidate children todos into parent project
 */
async function consolidateParentProject(projectPath, children) {
  logger.info('Consolidating parent project', { projectPath, childCount: children.length });

  // Gather all actionable todos from children
  const allChildTodos = [];
  for (const child of children) {
    for (const path of child.paths) {
      const todos = await getTodosForProject(path);
      const actionable = todos.filter(t =>
        t.status !== 'completed' &&
        t.category !== 'moved_to_knowledge' &&
        t.category !== 'duplicate'
      );
      for (const todo of actionable) {
        allChildTodos.push({
          child_project: child.name,
          child_path: path,
          todo_id: todo.id,
          title: todo.title,
          category: todo.category,
          priority: todo.priority
        });
      }
    }
  }

  if (allChildTodos.length === 0) {
    logger.info('No child todos to consolidate');
    return { projectPath, consolidated: 0 };
  }

  const prompt = `Consolidate these ${allChildTodos.length} todos from child projects into unified parent-level actionable tasks:

${JSON.stringify(allChildTodos, null, 2)}

Look for related items across children and combine them. Output ONLY valid JSON.`;

  const response = await ai.generate('todo_organization', prompt, {
    system: PARENT_SYSTEM_PROMPT,
    maxTokens: 3000,
    jsonMode: true
  });

  let result;
  try {
    result = JSON.parse(response.content);
  } catch (parseError) {
    logger.error('AI returned invalid JSON for parent', { error: parseError.message });
    throw new Error('AI returned invalid JSON');
  }

  // Create parent todos from consolidated items
  let created = 0;
  if (result.consolidated_todos && Array.isArray(result.consolidated_todos)) {
    for (const consolidated of result.consolidated_todos) {
      const childRefs = (consolidated.child_todos || [])
        .map(c => `- ${c.child_project}: ${c.title}`)
        .join('\n');

      await from('dev_ai_todos').insert({
        project_path: projectPath,
        title: consolidated.title,
        description: `Consolidated from children:\n${childRefs}`,
        category: consolidated.phase || 'Phase 1',
        priority: consolidated.priority || 'medium',
        status: 'pending',
        created_by: 'clair'
      });
      created++;
    }
  }

  logger.info('Parent consolidation complete', { projectPath, created });

  return { projectPath, consolidated: created };
}

/**
 * Organize a project (auto-detects parent/child)
 */
async function organizeProject(projectPath) {
  const hierarchy = await getProjectHierarchy(projectPath);

  if (hierarchy.isParent && hierarchy.children.length > 0) {
    // First organize all children
    const childResults = [];
    for (const child of hierarchy.children) {
      for (const path of child.paths) {
        try {
          const result = await organizeChildProject(path);
          childResults.push(result);
        } catch (err) {
          logger.error('Failed to organize child', { path, error: err.message });
        }
      }
    }

    // Then consolidate into parent
    const parentResult = await consolidateParentProject(projectPath, hierarchy.children);

    return {
      projectPath,
      isParent: true,
      childrenOrganized: childResults.length,
      ...parentResult
    };
  } else {
    return await organizeChildProject(projectPath);
  }
}

/**
 * Get formatted todo list for a project
 */
async function getFormattedTodos(projectPath) {
  const todos = await getTodosForProject(projectPath);
  const categories = {};
  for (const todo of todos) {
    const cat = todo.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      id: todo.id,
      title: todo.title,
      completed: todo.status === 'completed'
    });
  }

  return {
    projectPath,
    categories,
    stats: {
      total: todos.length,
      completed: todos.filter(t => t.status === 'completed').length,
      pending: todos.filter(t => t.status !== 'completed').length
    }
  };
}

/**
 * Organize all projects (children first, then parents)
 */
async function organizeAllProjects() {
  const { data: projects, error } = await from('dev_ai_todos')
    .select('project_path');

  if (error) throw error;

  const uniquePaths = [...new Set(projects.map(p => p.project_path).filter(p => p))];

  // Separate parents and children
  const parents = [];
  const children = [];

  for (const path of uniquePaths) {
    const hierarchy = await getProjectHierarchy(path);
    if (hierarchy.isParent) {
      parents.push({ path, hierarchy });
    } else {
      children.push(path);
    }
  }

  logger.info('Organizing projects', { parents: parents.length, children: children.length });

  // Organize children first
  const results = [];
  for (const path of children) {
    try {
      results.push(await organizeChildProject(path));
    } catch (err) {
      results.push({ projectPath: path, error: err.message });
    }
  }

  // Then consolidate parents
  for (const { path, hierarchy } of parents) {
    try {
      results.push(await consolidateParentProject(path, hierarchy.children));
    } catch (err) {
      results.push({ projectPath: path, error: err.message });
    }
  }

  return results;
}

/**
 * Mark a todo as complete
 */
async function markComplete(todoId) {
  const { data, error } = await from('dev_ai_todos')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', todoId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add a new todo
 */
async function addTodo(projectPath, title, category = 'General', priority = 'medium') {
  const { data, error } = await from('dev_ai_todos')
    .insert({
      project_path: projectPath,
      title,
      category,
      priority,
      status: 'pending',
      created_by: 'clair'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  organizeProject,
  organizeAllProjects,
  organizeChildProject,
  consolidateParentProject,
  getProjectHierarchy,
  getFormattedTodos,
  getTodosForProject,
  markComplete,
  addTodo,
  ALLOWED_ACTIONS
};
