/**
 * projectRouter.js - Clair's Content-Based Project Routing
 *
 * The FINAL LINE OF DEFENSE for content routing.
 * Scans items and re-routes them to correct projects based on content analysis.
 */

const { from } = require('../lib/db');
const { Logger } = require('../lib/logger');

const logger = new Logger('Clair:ProjectRouter');

// Table-specific column mappings
const TABLE_COLUMNS = {
  'dev_ai_todos': { title: 'title', content: 'description' },
  'dev_ai_bugs': { title: 'title', content: 'description' },
  'dev_ai_knowledge': { title: 'title', content: 'content' },
  'dev_ai_decisions': { title: 'title', content: 'description' },
  'dev_ai_lessons': { title: 'title', content: 'description' },
  'dev_ai_docs': { title: 'title', content: 'content' },
  'dev_ai_conventions': { title: 'name', content: 'description' },
  'dev_ai_journal': { title: 'title', content: 'content' },
  'dev_ai_snippets': { title: 'name', content: 'content' }
};

// Product keywords to project name mapping (case-insensitive)
const PRODUCT_PATTERNS = [
  // NextBid family
  { patterns: ['nextbid engine', 'nextbid-engine', 'engine api', 'auction engine'], project: 'NextBid Engine' },
  { patterns: ['nextbid core', 'nextbid-core', 'core module', 'core api'], project: 'NextBid Core' },
  { patterns: ['nextbid internal', 'nextbid-internal', 'internal tools'], project: 'NextBid Internal' },
  { patterns: ['nexttask', 'next-task', 'task management'], project: 'NextTask' },
  { patterns: ['nextlive', 'next-live', 'live streaming', 'live auction'], project: 'NextLive' },
  { patterns: ['nextseller', 'next-seller', 'seller dashboard'], project: 'NextSeller' },
  { patterns: ['nextbid prime', 'nextbid-prime', 'prime module'], project: 'NextBid Prime' },
  { patterns: ['nextbid pro', 'nextbid-pro', 'pro features'], project: 'NextBid Pro' },
  // Studios platform
  { patterns: ['kodiack studio', 'kodiack-studio', 'studios platform', 'ai team'], project: 'Studios Platform' },
  { patterns: ['kodiack dashboard', 'kodiack-dashboard', 'dashboard 5500'], project: 'Kodiack Dashboard' },
  { patterns: ['internal claude', 'claude mcp', 'susan ', 'jen ', 'clair ', 'ryan ', 'chad '], project: 'Internal Claude' },
];

// Build project lookup cache
let projectCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadProjectCache() {
  const now = Date.now();
  if (projectCache && now < cacheExpiry) return projectCache;

  const { data } = await from('dev_projects')
    .select('id, name, slug, client_id');

  projectCache = {};
  for (const proj of (data || [])) {
    projectCache[proj.name.toLowerCase()] = proj;
    if (proj.slug) {
      projectCache[proj.slug.toLowerCase()] = proj;
    }
  }
  cacheExpiry = now + CACHE_TTL;
  return projectCache;
}

/**
 * Detect which project content is REALLY about
 */
async function detectProjectFromContent(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  for (const { patterns, project } of PRODUCT_PATTERNS) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        const cache = await loadProjectCache();
        const projectInfo = cache[project.toLowerCase()];
        if (projectInfo) {
          return {
            project_id: projectInfo.id,
            project_name: projectInfo.name,
            client_id: projectInfo.client_id,
            matched_pattern: pattern
          };
        }
      }
    }
  }
  return null;
}

/**
 * Route items in a specific table to their correct projects
 */
async function routeTable(tableName, options = {}) {
  const { limit = 100, dryRun = false } = options;
  const columns = TABLE_COLUMNS[tableName];

  if (!columns) {
    logger.error('Unknown table', { table: tableName });
    return { rerouted: 0, errors: 1 };
  }

  logger.info(`Routing ${tableName}`, { limit, dryRun, columns });

  try {
    // Build select string based on table columns
    const selectCols = `id, ${columns.title}, ${columns.content}, project_path, project_id, client_id`;

    const { data: items, error } = await from(tableName)
      .select(selectCols)
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch items', { table: tableName, error: error.message });
      return { rerouted: 0, errors: 1 };
    }

    let rerouted = 0;
    let checked = 0;

    for (const item of (items || [])) {
      checked++;
      const titleValue = item[columns.title] || '';
      const contentValue = item[columns.content] || '';
      const detected = await detectProjectFromContent(titleValue, contentValue);

      if (detected && detected.project_id !== item.project_id) {
        logger.info('Rerouting item', {
          table: tableName,
          id: item.id,
          from_project: item.project_id,
          to_project: detected.project_id,
          to_name: detected.project_name,
          pattern: detected.matched_pattern
        });

        if (!dryRun) {
          const { error: updateError } = await from(tableName)
            .update({
              project_id: detected.project_id,
              client_id: detected.client_id
            })
            .eq('id', item.id);

          if (updateError) {
            logger.error('Failed to update', { id: item.id, error: updateError.message });
          } else {
            rerouted++;
          }
        } else {
          rerouted++;
        }
      }
    }

    logger.info(`Routing complete for ${tableName}`, { checked, rerouted, dryRun });
    return { checked, rerouted };
  } catch (err) {
    logger.error('Route table error', { table: tableName, error: err.message });
    return { rerouted: 0, errors: 1 };
  }
}

/**
 * Route all content tables
 */
async function routeAllTables(options = {}) {
  const tables = Object.keys(TABLE_COLUMNS);

  const results = {};
  let totalRerouted = 0;

  for (const table of tables) {
    try {
      const result = await routeTable(table, options);
      results[table] = result;
      totalRerouted += result.rerouted || 0;
    } catch (err) {
      logger.error('Failed to route table', { table, error: err.message });
      results[table] = { error: err.message };
    }
  }

  return { tables: results, totalRerouted };
}

/**
 * Route items from a specific project path to correct project_ids
 */
async function routeByPath(projectPath, options = {}) {
  const { limit = 500, dryRun = false } = options;
  const tables = ['dev_ai_todos', 'dev_ai_bugs', 'dev_ai_knowledge'];

  let totalRerouted = 0;

  for (const table of tables) {
    try {
      const columns = TABLE_COLUMNS[table];
      const selectCols = `id, ${columns.title}, ${columns.content}, project_id`;

      const { data: items } = await from(table)
        .select(selectCols)
        .ilike('project_path', `%${projectPath}%`)
        .limit(limit);

      for (const item of (items || [])) {
        const titleValue = item[columns.title] || '';
        const contentValue = item[columns.content] || '';
        const detected = await detectProjectFromContent(titleValue, contentValue);

        if (detected && detected.project_id !== item.project_id) {
          if (!dryRun) {
            await from(table)
              .update({
                project_id: detected.project_id,
                client_id: detected.client_id
              })
              .eq('id', item.id);
          }
          totalRerouted++;
        }
      }
    } catch (err) {
      logger.error('Route by path failed', { table, error: err.message });
    }
  }

  return { path: projectPath, rerouted: totalRerouted, dryRun };
}

/**
 * Add custom product pattern at runtime
 */
function addProductPattern(patterns, projectName) {
  PRODUCT_PATTERNS.push({ patterns, project: projectName });
  logger.info('Added product pattern', { patterns, project: projectName });
}

/**
 * Clear project cache
 */
function clearCache() {
  projectCache = null;
  cacheExpiry = 0;
}

module.exports = {
  detectProjectFromContent,
  routeTable,
  routeAllTables,
  routeByPath,
  addProductPattern,
  clearCache,
  loadProjectCache,
  PRODUCT_PATTERNS,
  TABLE_COLUMNS
};
