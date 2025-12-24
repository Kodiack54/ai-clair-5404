/**
 * Clair Project Routing API
 * Final line of defense for content-based project routing
 */

const express = require('express');
const router = express.Router();
const projectRouter = require('../services/projectRouter');
const { Logger } = require('../lib/logger');

const logger = new Logger('Clair:RoutingAPI');

/**
 * POST /api/routing/all
 * Route all items in all tables to correct projects
 */
router.post('/all', async (req, res) => {
  try {
    const { dryRun = false, limit = 100 } = req.body;
    logger.info('Routing all tables', { dryRun, limit });

    const result = await projectRouter.routeAllTables({ dryRun, limit });

    res.json({
      success: true,
      message: `Rerouted ${result.totalRerouted} items`,
      ...result
    });
  } catch (err) {
    logger.error('Route all failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routing/table
 * Route items in a specific table
 */
router.post('/table', async (req, res) => {
  try {
    const { table, dryRun = false, limit = 100 } = req.body;

    if (!table) {
      return res.status(400).json({ error: 'table required' });
    }

    const result = await projectRouter.routeTable(table, { dryRun, limit });

    res.json({
      success: true,
      table,
      ...result
    });
  } catch (err) {
    logger.error('Route table failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routing/by-path
 * Route all items from a specific project_path to correct projects
 * Useful for batch-fixing items from kodiack-studio sessions
 */
router.post('/by-path', async (req, res) => {
  try {
    const { projectPath, dryRun = false, limit = 500 } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath required' });
    }

    const result = await projectRouter.routeByPath(projectPath, { dryRun, limit });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('Route by path failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routing/detect
 * Test content detection without routing
 */
router.post('/detect', async (req, res) => {
  try {
    const { title, content } = req.body;

    const detected = await projectRouter.detectProjectFromContent(
      title || '',
      content || ''
    );

    res.json({
      detected: detected ? {
        project_id: detected.project_id,
        project_name: detected.project_name,
        matched_pattern: detected.matched_pattern
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/routing/patterns
 * Get current product patterns
 */
router.get('/patterns', (req, res) => {
  res.json({
    patterns: projectRouter.PRODUCT_PATTERNS
  });
});

/**
 * POST /api/routing/add-pattern
 * Add a new product pattern dynamically
 */
router.post('/add-pattern', (req, res) => {
  try {
    const { patterns, projectName } = req.body;

    if (!patterns || !projectName) {
      return res.status(400).json({ error: 'patterns and projectName required' });
    }

    projectRouter.addProductPattern(patterns, projectName);

    res.json({
      success: true,
      message: `Added pattern for ${projectName}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routing/clear-cache
 * Clear project cache
 */
router.post('/clear-cache', (req, res) => {
  projectRouter.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

module.exports = router;
