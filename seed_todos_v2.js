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

  // Clear existing todos for this project
  await from('dev_ai_todos').delete().eq('project_id', studios.id);
  console.log('Cleared existing todos\n');

  const TODOS = [
    // Phase 1: Pipeline ✓ (mostly complete)
    { phase: 1, title: 'Chad captures sessions to dev_ai_sessions', done: true },
    { phase: 1, title: 'Chad stores messages to dev_ai_staging', done: true },
    { phase: 1, title: 'Jen extracts patterns from staging', done: true },
    { phase: 1, title: 'Jen sends extractions to Susan', done: true },
    { phase: 1, title: 'Susan routes to correct project by content', done: true },
    { phase: 1, title: 'Susan deduplicates before insert', done: true },
    { phase: 1, title: 'Verify 5-min session rotation working', done: false },
    { phase: 1, title: 'Test all 4 Chad ports capturing (5401/5411/5421/5431)', done: false },

    // Phase 2: Organization ✓ (current - almost done)
    { phase: 2, title: 'Client → Parent → Child hierarchy defined', done: true },
    { phase: 2, title: 'dev_project_paths maps Windows paths', done: true },
    { phase: 2, title: 'dev_project_paths maps server paths', done: true },
    { phase: 2, title: 'Dashboard summary queries by project_id', done: true },
    { phase: 2, title: 'Dashboard detail routes query by project_id', done: true },
    { phase: 2, title: 'dev_project_phases table created', done: true },
    { phase: 2, title: 'phase_id column added to todos', done: true },
    { phase: 2, title: 'Define phases for NextBid Engine', done: false },
    { phase: 2, title: 'Define phases for NextBidder', done: false },
    { phase: 2, title: 'Define phases for remaining projects', done: false },

    // Phase 3: Visibility (next up)
    { phase: 3, title: 'Dashboard groups todos by phase', done: false },
    { phase: 3, title: 'Phase progress bar (X/Y complete)', done: false },
    { phase: 3, title: 'Todo status toggle (pending/done)', done: false },
    { phase: 3, title: 'Knowledge search endpoint', done: false },
    { phase: 3, title: 'Knowledge search UI in dashboard', done: false },
    { phase: 3, title: 'Snippets display with syntax highlighting', done: false },
    { phase: 3, title: 'Session history viewer', done: false },

    // Phase 4: Workflow
    { phase: 4, title: 'Calendar linked to projects', done: false },
    { phase: 4, title: 'Milestone dates on phases', done: false },
    { phase: 4, title: 'Clair assigns phase_id to new todos', done: false },
    { phase: 4, title: 'Clair auto-prioritizes by keywords', done: false },
    { phase: 4, title: 'Todo assignment to team members', done: false },
    { phase: 4, title: 'Daily standup summary generation', done: false },
    { phase: 4, title: 'Blocked/waiting status for todos', done: false },

    // Phase 5: Intelligence
    { phase: 5, title: 'Ryan reads phase structure', done: false },
    { phase: 5, title: 'Ryan recommends "what\'s next"', done: false },
    { phase: 5, title: 'Ryan tracks blockers across phases', done: false },
    { phase: 5, title: 'Pattern detection from sessions', done: false },
    { phase: 5, title: 'Auto-generate conventions from patterns', done: false },
    { phase: 5, title: 'Proposal generation (NextBid)', done: false },
    { phase: 5, title: 'Code review suggestions', done: false },

    // Phase 6: Scale
    { phase: 6, title: 'Multi-droplet deployment config', done: false },
    { phase: 6, title: 'Patcher: dev → test promotion', done: false },
    { phase: 6, title: 'Patcher: test → prod promotion', done: false },
    { phase: 6, title: 'Health monitoring across all services', done: false },
    { phase: 6, title: 'Alert system for failures', done: false },
    { phase: 6, title: 'Automated backup procedures', done: false },
    { phase: 6, title: 'Disaster recovery runbook', done: false }
  ];

  let added = 0;
  for (const todo of TODOS) {
    const { error } = await from('dev_ai_todos').insert({
      project_id: studios.id,
      phase_id: phaseMap[todo.phase],
      title: todo.title,
      priority: 'medium',
      status: todo.done ? 'completed' : 'pending'
    });

    if (error) {
      console.log('Error:', todo.title, error.message);
    } else {
      const mark = todo.done ? '✓' : '○';
      console.log('Phase ' + todo.phase + ' [' + mark + '] ' + todo.title);
      added++;
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  for (let i = 1; i <= 6; i++) {
    const phaseItems = TODOS.filter(t => t.phase === i);
    const done = phaseItems.filter(t => t.done).length;
    const total = phaseItems.length;
    const phaseName = phases.find(p => p.phase_num === i)?.name;
    console.log('Phase ' + i + ' (' + phaseName + '): ' + done + '/' + total);
  }

  console.log('\nTotal:', added, 'todos');
  process.exit(0);
})();
