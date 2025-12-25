/**
 * phaseRouter.js - Assign todos/bugs to parent project phases
 *
 * When child project items come in, match them to parent roadmap phases.
 */

const { from } = require('../lib/db');
const { Logger } = require('../lib/logger');

const logger = new Logger('Clair:PhaseRouter');

// Phase keyword patterns
const PHASE_PATTERNS = {
  'Core Platform': [
    'auth', 'login', 'permission', 'role', 'access control', 'user management',
    'project management', 'dashboard', 'task tracking', 'deadline',
    'file storage', 'upload', 'file management', 'asset storage',
    'collaboration', 'team', 'chat', 'notification', 'messaging',
    'client portal', 'client access', 'customer portal',
    'billing', 'invoice', 'payment', 'subscription',
    'crm', 'lead', 'contract', 'client relationship'
  ],
  'Code Development': [
    'git', 'version control', 'branch', 'commit', 'merge', 'repository',
    'ci/cd', 'cicd', 'pipeline', 'deploy', 'build process', 'automation',
    'code review', 'pull request', 'pr review', 'merge request',
    'documentation', 'docs', 'readme', 'api docs', 'jsdoc',
    'testing', 'test', 'unit test', 'integration test', 'e2e', 'jest', 'mocha',
    'dev environment', 'docker', 'container', 'devops'
  ],
  'Creative/Graphics': [
    'asset', 'image', 'graphic', 'design', 'artwork', 'illustration',
    'style guide', 'design system', 'color', 'typography', 'ui kit',
    'brand', 'logo', 'icon', 'brand kit', 'visual identity',
    'image processing', 'video', 'resize', 'compress', 'optimize',
    '3d', 'model', 'blender', 'maya', 'render',
    'texture', 'sprite', 'animation', 'tileset'
  ],
  'Web Development': [
    'website', 'template', 'theme', 'landing page', 'web page',
    'cms', 'content management', 'wordpress', 'strapi',
    'ecommerce', 'e-commerce', 'shopping', 'cart', 'checkout', 'store',
    'seo', 'meta tag', 'sitemap', 'search engine',
    'analytics', 'tracking', 'conversion', 'google analytics',
    'hosting', 'server', 'ssl', 'domain', 'dns', 'nginx'
  ],
  'App Development': [
    'mobile', 'app', 'ios', 'android', 'smartphone',
    'react native', 'flutter', 'native app', 'expo',
    'app store', 'play store', 'submission', 'app release',
    'push notification', 'firebase messaging', 'apns',
    'in-app purchase', 'iap', 'subscription', 'monetization',
    'crash report', 'app analytics', 'crashlytics'
  ],
  'Game Development': [
    'game', 'gaming', 'gameplay', 'player',
    'game engine', 'unity', 'unreal', 'godot', 'phaser',
    'level editor', 'level', 'map', 'world builder',
    'character', 'rigging', 'skeletal', 'npc',
    'multiplayer', 'matchmaking', 'netcode', 'realtime',
    'leaderboard', 'achievement', 'score', 'ranking'
  ]
};

// Cache for parent phases
let phaseCache = {};
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Load phases for a parent project
 */
async function loadParentPhases(parentId) {
  const now = Date.now();
  const cacheKey = parentId;

  if (phaseCache[cacheKey] && now < cacheExpiry) {
    return phaseCache[cacheKey];
  }

  const { data: phases } = await from('dev_project_phases')
    .select('id, name, project_id')
    .eq('project_id', parentId);

  if (phases && phases.length > 0) {
    phaseCache[cacheKey] = phases;
    cacheExpiry = now + CACHE_TTL;
  }

  return phases || [];
}

/**
 * Get parent project for a child project
 */
async function getParentProject(projectId) {
  const { data: project } = await from('dev_projects')
    .select('id, parent_id')
    .eq('id', projectId)
    .single();

  return project?.parent_id || null;
}

/**
 * Detect which phase content belongs to
 */
function detectPhaseFromContent(title, content, phases) {
  const text = `${title} ${content}`.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const phase of phases) {
    const patterns = PHASE_PATTERNS[phase.name];
    if (!patterns) continue;

    let score = 0;
    for (const pattern of patterns) {
      if (text.includes(pattern.toLowerCase())) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = phase;
    }
  }

  return bestMatch;
}

/**
 * Assign phase to a single item
 */
async function assignPhaseToItem(table, item) {
  // Skip if already has phase
  if (item.phase_id) return null;

  // Get project's parent
  const parentId = await getParentProject(item.project_id);
  if (!parentId) {
    // Check if this IS the parent project
    const phases = await loadParentPhases(item.project_id);
    if (phases.length === 0) return null;

    // This is a parent project with phases - match its own items
    const phase = detectPhaseFromContent(
      item.title || item.name || '',
      item.description || item.content || '',
      phases
    );

    if (phase) {
      await from(table).update({ phase_id: phase.id }).eq('id', item.id);
      return { itemId: item.id, phaseName: phase.name };
    }
    return null;
  }

  // Load parent's phases
  const phases = await loadParentPhases(parentId);
  if (phases.length === 0) return null;

  // Detect phase
  const phase = detectPhaseFromContent(
    item.title || item.name || '',
    item.description || item.content || '',
    phases
  );

  if (phase) {
    await from(table).update({ phase_id: phase.id }).eq('id', item.id);
    return { itemId: item.id, phaseName: phase.name };
  }

  return null;
}

/**
 * Route unassigned todos to phases
 */
async function routeTodosToPhases(options = {}) {
  const { limit = 100 } = options;

  // Get todos without phase_id
  const { data: todos } = await from('dev_ai_todos')
    .select('id, title, description, project_id, phase_id')
    .is('phase_id', null)
    .limit(limit);

  let assigned = 0;
  for (const todo of (todos || [])) {
    if (!todo.project_id) continue;
    const result = await assignPhaseToItem('dev_ai_todos', todo);
    if (result) {
      assigned++;
      logger.info('Todo assigned to phase', result);
    }
  }

  return { assigned, total: (todos || []).length };
}

/**
 * Route unassigned bugs to phases
 * NOTE: Requires phase_id column on dev_ai_bugs table
 */
async function routeBugsToPhases(options = {}) {
  const { limit = 100 } = options;

  try {
    // Get bugs without phase_id
    const { data: bugs, error } = await from('dev_ai_bugs')
      .select('id, title, description, project_id, phase_id')
      .is('phase_id', null)
      .limit(limit);

    if (error) {
      logger.warn('Bugs phase routing skipped - phase_id column may not exist');
      return { assigned: 0, total: 0, skipped: true };
    }

    let assigned = 0;
    for (const bug of (bugs || [])) {
      if (!bug.project_id) continue;
      const result = await assignPhaseToItem('dev_ai_bugs', bug);
      if (result) {
        assigned++;
        logger.info('Bug assigned to phase', result);
      }
    }

    return { assigned, total: (bugs || []).length };
  } catch (err) {
    logger.warn('Bugs phase routing error', { error: err.message });
    return { assigned: 0, total: 0, skipped: true };
  }
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Simple word overlap similarity
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  const total = words1.size + words2.size;
  return total > 0 ? (2 * overlap) / total : 0;
}

/**
 * Merge similar todos into one
 */
async function mergeSimilarTodos(options = {}) {
  const { threshold = 0.5, limit = 500 } = options;

  // Get ALL active todos, not just pending
  const { data: todos } = await from('dev_ai_todos')
    .select('id, title, description, project_id, phase_id, status, created_at')
    .in('status', ['open', 'pending', 'in_progress', 'flagged'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!todos || todos.length < 2) return { merged: 0 };

  const toDelete = new Set();
  let merged = 0;

  for (let i = 0; i < todos.length; i++) {
    if (toDelete.has(todos[i].id)) continue;

    const primary = todos[i];
    const duplicates = [];

    for (let j = i + 1; j < todos.length; j++) {
      if (toDelete.has(todos[j].id)) continue;

      const secondary = todos[j];

      // Must be same project
      if (primary.project_id !== secondary.project_id) continue;

      // Check for exact title match first (case insensitive)
      const title1 = (primary.title || '').toLowerCase().trim();
      const title2 = (secondary.title || '').toLowerCase().trim();

      const isExactMatch = title1 === title2;
      const similarity = isExactMatch ? 1 : calculateSimilarity(primary.title, secondary.title);

      if (isExactMatch || similarity >= threshold) {
        duplicates.push(secondary);
        toDelete.add(secondary.id);
      }
    }

    if (duplicates.length > 0) {
      // Combine descriptions
      let combinedDesc = primary.description || '';
      for (const dup of duplicates) {
        if (dup.description && !combinedDesc.includes(dup.description)) {
          combinedDesc += '\n\n---\n' + dup.description;
        }
      }

      // Update primary with combined content
      await from('dev_ai_todos')
        .update({
          description: combinedDesc.substring(0, 5000),
          title: primary.title + ` (+${duplicates.length} merged)`
        })
        .eq('id', primary.id);

      // Mark duplicates as completed (merged)
      for (const dup of duplicates) {
        await from('dev_ai_todos')
          .update({
            status: 'completed',
            description: (dup.description || '') + '\n\n[Merged into: ' + primary.title + ']'
          })
          .eq('id', dup.id);
        merged++;
      }

      logger.info('Merged todos', {
        primary: primary.id,
        merged: duplicates.length,
        title: primary.title
      });
    }
  }

  return { merged, checked: todos.length };
}

/**
 * Merge similar bugs into one
 */
async function mergeSimilarBugs(options = {}) {
  const { threshold = 0.6, limit = 200 } = options;

  const { data: bugs } = await from('dev_ai_bugs')
    .select('id, title, description, project_id, status, created_at')
    .in('status', ['open', 'pending', 'flagged'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!bugs || bugs.length < 2) return { merged: 0 };

  const toDelete = new Set();
  let merged = 0;

  for (let i = 0; i < bugs.length; i++) {
    if (toDelete.has(bugs[i].id)) continue;

    const primary = bugs[i];
    const duplicates = [];

    for (let j = i + 1; j < bugs.length; j++) {
      if (toDelete.has(bugs[j].id)) continue;

      const secondary = bugs[j];

      // Must be same project
      if (primary.project_id !== secondary.project_id) continue;

      // Check title similarity
      const similarity = calculateSimilarity(primary.title, secondary.title);

      if (similarity >= threshold) {
        duplicates.push(secondary);
        toDelete.add(secondary.id);
      }
    }

    if (duplicates.length > 0) {
      // Combine descriptions
      let combinedDesc = primary.description || '';
      for (const dup of duplicates) {
        if (dup.description && !combinedDesc.includes(dup.description)) {
          combinedDesc += '\n\n---\n' + dup.description;
        }
      }

      // Update primary with combined content
      await from('dev_ai_bugs')
        .update({
          description: combinedDesc.substring(0, 5000),
          title: primary.title + ` (+${duplicates.length} merged)`
        })
        .eq('id', primary.id);

      // Mark duplicates as fixed (merged)
      for (const dup of duplicates) {
        await from('dev_ai_bugs')
          .update({
            status: 'fixed',
            description: (dup.description || '') + '\n\n[Merged into: ' + primary.title + ']'
          })
          .eq('id', dup.id);
        merged++;
      }

      logger.info('Merged bugs', {
        primary: primary.id,
        merged: duplicates.length,
        title: primary.title
      });
    }
  }

  return { merged, checked: bugs.length };
}

/**
 * Merge all similar items
 */
async function mergeAllSimilar(options = {}) {
  const todosResult = await mergeSimilarTodos(options);
  const bugsResult = await mergeSimilarBugs(options);

  return {
    todos: todosResult,
    bugs: bugsResult,
    totalMerged: todosResult.merged + bugsResult.merged
  };
}

/**
 * Route all unassigned items to phases
 */
async function routeAllToPhases(options = {}) {
  const todosResult = await routeTodosToPhases(options);
  const bugsResult = await routeBugsToPhases(options);

  return {
    todos: todosResult,
    bugs: bugsResult,
    totalAssigned: todosResult.assigned + bugsResult.assigned
  };
}

/**
 * Clear cache
 */
function clearCache() {
  phaseCache = {};
  cacheExpiry = 0;
}

module.exports = {
  loadParentPhases,
  getParentProject,
  detectPhaseFromContent,
  assignPhaseToItem,
  routeTodosToPhases,
  routeBugsToPhases,
  routeAllToPhases,
  mergeSimilarTodos,
  mergeSimilarBugs,
  mergeAllSimilar,
  clearCache,
  PHASE_PATTERNS
};
