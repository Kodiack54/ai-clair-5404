require('dotenv').config();
const { query, from } = require('./src/lib/db');

(async () => {
  // Get Studios Platform and its phases
  const { data: studios } = await from('dev_projects')
    .select('id')
    .eq('name', 'Studios Platform')
    .single();

  const { data: phases } = await from('dev_project_phases')
    .select('id, phase_num, name')
    .eq('project_id', studios.id)
    .order('phase_num');

  const phaseMap = {};
  for (const p of phases) {
    phaseMap[p.phase_num] = p.id;
  }

  console.log('Studios Platform:', studios.id);
  console.log('Phases:', phases.map(p => p.phase_num + ':' + p.name).join(', '));

  const TODOS = [
    // Phase 1: Pipeline
    { phase: 1, title: 'Verify 5-minute session rotation is working', description: 'Chad should be rotating sessions every 5 minutes for smaller chunks' },
    { phase: 1, title: 'Confirm Jen processes all 4 terminal ports', description: 'Jen-5402 handles 5400, need to verify 5410/5420/5430 coverage' },

    // Phase 2: Organization
    { phase: 2, title: 'Verify all NextBid project paths are mapped', description: 'Check dev_project_paths has Windows + server paths for all NextBid projects' },
    { phase: 2, title: 'Test parent/child accumulation in dashboard', description: 'Studios Platform should show sum of all child project items' },

    // Phase 3: Visibility
    { phase: 3, title: 'Update dashboard to show todos by phase', description: 'Group todos by phase_num instead of random categories' },
    { phase: 3, title: 'Add phase selector to todo creation UI', description: 'When creating a todo, pick which phase it belongs to' },
    { phase: 3, title: 'Make knowledge searchable from dashboard', description: 'Add search bar to query dev_ai_knowledge' },
    { phase: 3, title: 'Fix snippets display in dashboard', description: 'Snippets tab should show actual code snippets' },

    // Phase 4: Workflow
    { phase: 4, title: 'Set up calendar with real project deadlines', description: 'Link calendar to projects, add milestone dates' },
    { phase: 4, title: 'Clair auto-prioritizes incoming todos', description: 'Clair analyzes content and assigns priority + phase' },
    { phase: 4, title: 'Todo assignment to team members', description: 'Assign todos to specific AI agents or human devs' },
    { phase: 4, title: 'Daily standup summary from Clair', description: 'Clair generates daily progress report' },

    // Phase 5: Intelligence
    { phase: 5, title: 'NextBid proposal generation', description: 'Generate service proposals from session context' },
    { phase: 5, title: 'Pattern learning from sessions', description: 'Detect recurring patterns and create conventions automatically' },
    { phase: 5, title: 'Ryan roadmap tracking', description: 'Ryan maintains project roadmap and milestones' },
    { phase: 5, title: 'Smart code review suggestions', description: 'AI suggests improvements based on session history' },

    // Phase 6: Scale
    { phase: 6, title: 'Multi-droplet orchestration', description: 'Deploy and manage services across multiple servers' },
    { phase: 6, title: 'Patcher deployment system', description: 'Automated patching from dev to test to prod' },
    { phase: 6, title: 'Production monitoring & alerts', description: 'Health checks and alerting for all services' },
    { phase: 6, title: 'Backup and recovery procedures', description: 'Automated backups and disaster recovery' }
  ];

  let added = 0;
  for (const todo of TODOS) {
    const { error } = await from('dev_ai_todos').insert({
      project_id: studios.id,
      phase_id: phaseMap[todo.phase],
      title: todo.title,
      description: todo.description,
      priority: 'medium',
      status: 'pending'
    });

    if (error) {
      console.log('Error:', todo.title, error.message);
    } else {
      console.log('Phase ' + todo.phase + ':', todo.title);
      added++;
    }
  }

  console.log('\nAdded', added, 'todos');
  process.exit(0);
})();
