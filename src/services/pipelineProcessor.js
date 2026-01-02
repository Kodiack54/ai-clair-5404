/**
 * Clair Pipeline Processor
 * 
 * Reads items with status='pending' from destination tables
 * Refines them (assigns priority, phase, etc.)
 * Updates status to final (open, cataloged, etc.)
 */

const { from } = require('../lib/db');
const { Logger } = require('../lib/logger');

const logger = new Logger('Clair:Pipeline');

// Table-specific final status mapping
const FINAL_STATUS = {
  'dev_ai_todos': 'open',
  'dev_ai_bugs': 'open',
  'dev_ai_knowledge': 'published',
  'dev_ai_docs': 'draft',
  'dev_ai_conventions': 'active',
  'dev_ai_snippets': 'published',
  'dev_ai_decisions': 'decided',
  'dev_ai_lessons': 'published',
  'dev_ai_journal': 'published'
};

// All destination tables that need processing
const DESTINATION_TABLES = Object.keys(FINAL_STATUS);

/**
 * Refine an item based on its table
 */
function refineItem(tableName, item) {
  const updates = {
    status: FINAL_STATUS[tableName],
    refined_at: new Date().toISOString()
  };
  
  // Table-specific refinements
  switch (tableName) {
    case 'dev_ai_todos':
      updates.priority = item.priority || 'medium';
      break;
    case 'dev_ai_bugs':
      updates.severity = item.severity || 'medium';
      // If bucket says 'Bugs Fixed', mark as fixed
      if (item.bucket === 'Bugs Fixed') {
        updates.status = 'fixed';
      }
      break;
    case 'dev_ai_knowledge':
      updates.importance = item.importance || 5;
      break;
    case 'dev_ai_docs':
      updates.doc_type = item.doc_type || 'reference';
      break;
    case 'dev_ai_conventions':
      updates.convention_type = item.convention_type || 'other';
      break;
    case 'dev_ai_journal':
      updates.entry_type = item.entry_type || 'journal';
      if (item.bucket === 'Work Log') {
        updates.entry_type = 'work_log';
      }
      break;
  }
  
  return updates;
}

/**
 * Process pending items from a single table
 */
async function processTable(tableName) {
  let processed = 0;
  let errors = 0;
  
  try {
    // Get pending items
    const { data: items, error } = await from(tableName)
      .select('id, bucket, priority, severity, importance, doc_type, convention_type, entry_type')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (error) {
      logger.error('Failed to fetch pending items', { table: tableName, error: error.message });
      return { processed: 0, errors: 1 };
    }
    
    if (!items || items.length === 0) {
      return { processed: 0, errors: 0 };
    }
    
    logger.info('Processing pending items', { table: tableName, count: items.length });
    
    for (const item of items) {
      try {
        const updates = refineItem(tableName, item);
        
        const { error: updateError } = await from(tableName)
          .update(updates)
          .eq('id', item.id);
        
        if (updateError) {
          logger.error('Failed to update item', { table: tableName, id: item.id, error: updateError.message });
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        logger.error('Error processing item', { table: tableName, id: item.id, error: err.message });
        errors++;
      }
    }
    
  } catch (err) {
    logger.error('Table processing failed', { table: tableName, error: err.message });
    errors++;
  }
  
  return { processed, errors };
}

/**
 * Process all destination tables
 */
async function process() {
  let totalProcessed = 0;
  let totalErrors = 0;
  
  for (const table of DESTINATION_TABLES) {
    const result = await processTable(table);
    totalProcessed += result.processed;
    totalErrors += result.errors;
  }
  
  if (totalProcessed > 0) {
    logger.info('Pipeline cycle complete', {
      processed: totalProcessed,
      errors: totalErrors
    });
  }
  
  return { processed: totalProcessed, errors: totalErrors };
}

/**
 * Start the pipeline processor (runs every 30 seconds)
 */
let intervalId = null;

function start() {
  if (intervalId) return;
  
  logger.info('Starting pipeline processor (30s interval)');
  
  // Run immediately, then every 30 seconds
  process();
  intervalId = setInterval(process, 30 * 1000);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Pipeline processor stopped');
  }
}

module.exports = {
  process,
  start,
  stop
};
