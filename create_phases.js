require('dotenv').config();
const { query, from } = require('./src/lib/db');

const STUDIOS_PHASES = [
  { number: 1, name: 'Pipeline', description: 'Chad/Jen/Susan capture and extraction working' },
  { number: 2, name: 'Organization', description: 'Projects/clients/paths/hierarchy setup' },
  { number: 3, name: 'Visibility', description: 'Dashboard/UI/display/search working' },
  { number: 4, name: 'Workflow', description: 'Calendar/todos/assignments/Clair' },
  { number: 5, name: 'Intelligence', description: 'Proposals/AI features/Ryan' },
  { number: 6, name: 'Scale', description: 'Deploy/patcher/multi-droplet' }
];

(async () => {
  try {
    // 1. Create phases table
    await query(`
      CREATE TABLE IF NOT EXISTS dev_project_phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES dev_projects(id),
        phase_number INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, phase_number)
      )
    `);
    console.log('1. Created dev_project_phases table');

    // 2. Add phase_id to todos
    await query(`ALTER TABLE dev_ai_todos ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES dev_project_phases(id)`);
    console.log('2. Added phase_id column to dev_ai_todos');

    // 3. Get Studios Platform project ID
    const { data: studios } = await from('dev_projects')
      .select('id')
      .eq('name', 'Studios Platform')
      .single();

    if (!studios) {
      console.log('Studios Platform project not found!');
      process.exit(1);
    }
    console.log('3. Found Studios Platform:', studios.id);

    // 4. Insert phases for Studios Platform
    for (const phase of STUDIOS_PHASES) {
      const { error } = await from('dev_project_phases').insert({
        project_id: studios.id,
        phase_number: phase.number,
        name: phase.name,
        description: phase.description,
        status: phase.number <= 2 ? 'completed' : 'pending'
      });

      if (error && !error.message.includes('duplicate')) {
        console.log('Error inserting phase:', phase.name, error.message);
      } else {
        console.log('   Phase', phase.number + ':', phase.name);
      }
    }

    // 5. Delete all garbage todos
    const { data: deleted } = await from('dev_ai_todos')
      .delete()
      .eq('status', 'pending')
      .select('id');

    console.log('5. Deleted', (deleted || []).length, 'pending todos');

    console.log('\nDone! Phases created, todos cleared.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
