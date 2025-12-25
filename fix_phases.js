require('dotenv').config();
const { query, from } = require('./src/lib/db');

const STUDIOS_PHASES = [
  { num: 1, name: 'Pipeline', description: 'Chad/Jen/Susan capture and extraction working' },
  { num: 2, name: 'Organization', description: 'Projects/clients/paths/hierarchy setup' },
  { num: 3, name: 'Visibility', description: 'Dashboard/UI/display/search working' },
  { num: 4, name: 'Workflow', description: 'Calendar/todos/assignments/Clair' },
  { num: 5, name: 'Intelligence', description: 'Proposals/AI features/Ryan' },
  { num: 6, name: 'Scale', description: 'Deploy/patcher/multi-droplet' }
];

(async () => {
  try {
    // Drop and recreate
    await query(`DROP TABLE IF EXISTS dev_project_phases CASCADE`);
    console.log('1. Dropped old table');

    await query(`
      CREATE TABLE dev_project_phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES dev_projects(id),
        phase_num INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, phase_num)
      )
    `);
    console.log('2. Created dev_project_phases table');

    // Re-add phase_id to todos (in case it was dropped with CASCADE)
    await query(`ALTER TABLE dev_ai_todos ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES dev_project_phases(id)`);
    console.log('3. Added phase_id to todos');

    // Get Studios Platform
    const { data: studios } = await from('dev_projects')
      .select('id')
      .eq('name', 'Studios Platform')
      .single();

    console.log('4. Studios Platform ID:', studios.id);

    // Insert phases using raw query to avoid ORM issues
    for (const phase of STUDIOS_PHASES) {
      await query(`
        INSERT INTO dev_project_phases (project_id, phase_num, name, description, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id, phase_num) DO NOTHING
      `, [studios.id, phase.num, phase.name, phase.description, phase.num <= 2 ? 'completed' : 'pending']);
      console.log('   Phase ' + phase.num + ': ' + phase.name);
    }

    // Verify
    const { data: phases } = await from('dev_project_phases').select('*').eq('project_id', studios.id);
    console.log('\n5. Phases created:', (phases || []).length);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
