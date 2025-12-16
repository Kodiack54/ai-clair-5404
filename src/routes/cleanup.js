/**
 * Clair Cleanup Routes
 * Manual and scheduled garbage collection
 */

const express = require('express');
const router = express.Router();
const cleanup = require('../services/cleanup');

/**
 * GET /api/cleanup/stats - Get cleanup statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await cleanup.getCleanupStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cleanup/run - Run full cleanup cycle
 */
router.post('/run', async (req, res) => {
  try {
    console.log('[Clair:Cleanup] Manual cleanup triggered');
    const results = await cleanup.runCleanup();
    res.json({
      success: true,
      message: 'Cleanup completed',
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cleanup/sessions - Clean old session raw data only
 */
router.post('/sessions', async (req, res) => {
  try {
    const result = await cleanup.cleanSessionRawData();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cleanup/corrections - Clean old applied corrections only
 */
router.post('/corrections', async (req, res) => {
  try {
    const result = await cleanup.cleanAppliedCorrections();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cleanup/dedupe - Flag duplicate knowledge entries
 */
router.post('/dedupe', async (req, res) => {
  try {
    const result = await cleanup.flagDuplicateKnowledge();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cleanup/condense - Condense old sessions
 */
router.post('/condense', async (req, res) => {
  try {
    const result = await cleanup.condenseSessions();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cleanup/thresholds - Get cleanup thresholds
 */
router.get('/thresholds', (req, res) => {
  res.json(cleanup.THRESHOLDS);
});

module.exports = router;
