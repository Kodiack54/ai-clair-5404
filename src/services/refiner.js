/**
 * Clair Refiner - Process pending items and set final status
 * 
 * PIPELINE STAGE 4: CLAIR
 * - Input: Items with status='pending' from 6 destination tables
 * - Sets final status based on table type
 * - Output: Items ready for dashboard display
 */

const { from } = require('../lib/db');

// Table -> Final status mapping
const TABLE_FINAL_STATUS = {
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

const DESTINATION_TABLES = Object.keys(TABLE_FINAL_STATUS);

/**
 * Process all pending items in a table
 */
async function processTable(tableName) {
  let refined = 0;
  let errors = 0;
  const finalStatus = TABLE_FINAL_STATUS[tableName];

  try {
    // Get all pending items
    const { data: items, error } = await from(tableName)
      .select('id')
      .eq('status', 'pending')
      .limit(100);

    if (error) throw error;
    if (!items || items.length === 0) return { refined: 0, errors: 0 };

    for (const item of items) {
      try {
        // Build update object
        const update = {
          status: finalStatus,
          refined_at: new Date().toISOString()
        };

        // Table-specific refinements
        if (tableName === 'dev_ai_todos') {
          update.priority = 'medium'; // Default priority
        }
        if (tableName === 'dev_ai_bugs') {
          update.severity = 'medium'; // Default severity
        }

        // Update the item
        const { error: updateError } = await from(tableName)
          .update(update)
          .eq('id', item.id);

        if (updateError) throw updateError;
        refined++;

      } catch (err) {
        console.error('[Clair:Refiner] Item update failed:', err.message);
        errors++;
      }
    }

  } catch (err) {
    console.error('[Clair:Refiner] Table process failed:', tableName, err.message);
    errors++;
  }

  return { refined, errors };
}

/**
 * Main refinement process - runs through all tables
 */
async function process() {
  let totalRefined = 0;
  let totalErrors = 0;

  console.log('[Clair:Refiner] Starting refinement cycle...');

  for (const table of DESTINATION_TABLES) {
    const result = await processTable(table);
    totalRefined += result.refined;
    totalErrors += result.errors;
    
    if (result.refined > 0) {
      console.log('[Clair:Refiner]', table, ':', result.refined, 'refined to', TABLE_FINAL_STATUS[table]);
    }
  }

  if (totalRefined > 0 || totalErrors > 0) {
    console.log('[Clair:Refiner] Complete:', totalRefined, 'refined,', totalErrors, 'errors');
  }
  
  return { refined: totalRefined, errors: totalErrors };
}

/**
 * Start the refiner interval
 */
function start(intervalMs = 30000) {
  console.log('[Clair:Refiner] Starting refiner (', intervalMs/1000, 's interval)');
  
  // Run immediately
  process();
  
  // Then run on interval
  setInterval(process, intervalMs);
}

module.exports = {
  process,
  processTable,
  start
};
