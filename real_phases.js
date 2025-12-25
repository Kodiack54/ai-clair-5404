require('dotenv').config();
const { query, from } = require('./src/lib/db');

(async () => {
  // Get Studios Platform
  const { data: studios } = await from('dev_projects')
    .select('id')
    .eq('name', 'Studios Platform')
    .single();

  console.log('Studios Platform:', studios.id);

  // Clear old phases and todos
  await from('dev_ai_todos').delete().eq('project_id', studios.id);
  await from('dev_project_phases').delete().eq('project_id', studios.id);
  console.log('Cleared old data\n');

  // The REAL 6 phases for Kodiack Studio
  const PHASES = [
    { num: 1, name: 'Core Platform', desc: 'Project/client/team management, knowledge base, dashboard' },
    { num: 2, name: 'Code Development', desc: 'IDE integration, version control, CI/CD, deployment' },
    { num: 3, name: 'Creative/Graphics', desc: 'Image generation, design tools, asset management' },
    { num: 4, name: 'Web Development', desc: 'Frontend frameworks, CMS, hosting, analytics' },
    { num: 5, name: 'App Development', desc: 'Mobile frameworks, cross-platform, app stores' },
    { num: 6, name: 'Game Development', desc: 'Engine integration, asset pipelines, platform builds' }
  ];

  // Insert phases
  const phaseMap = {};
  for (const p of PHASES) {
    const { data, error } = await from('dev_project_phases').insert({
      project_id: studios.id,
      phase_num: p.num,
      name: p.name,
      description: p.desc,
      status: p.num === 1 ? 'in_progress' : 'pending'
    }).select('id').single();

    if (error) {
      console.log('Error inserting phase:', p.name, error.message);
      continue;
    }
    phaseMap[p.num] = data.id;
    console.log('Phase ' + p.num + ': ' + p.name);
  }

  // Todos for each phase
  const TODOS = [
    // Phase 1: Core Platform
    { phase: 1, title: 'Project CRUD working in dashboard', done: true },
    { phase: 1, title: 'Client management working', done: true },
    { phase: 1, title: 'Team/user management', done: false },
    { phase: 1, title: 'Knowledge base searchable', done: false },
    { phase: 1, title: 'Todos grouped by phase in UI', done: false },
    { phase: 1, title: 'Dashboard shows progress per phase', done: false },
    { phase: 1, title: 'Calendar with deadlines', done: false },
    { phase: 1, title: 'Session capture working (Chad)', done: true },
    { phase: 1, title: 'Knowledge extraction working (Jen)', done: true },
    { phase: 1, title: 'Routing to projects working (Susan)', done: true },
    { phase: 1, title: 'Prioritization working (Ryan)', done: false },

    // Phase 2: Code Development
    { phase: 2, title: 'Claude Code integrated', done: true },
    { phase: 2, title: 'Git version control', done: true },
    { phase: 2, title: 'PM2 process management', done: true },
    { phase: 2, title: 'SSH deployment to droplets', done: true },
    { phase: 2, title: 'CI/CD pipeline automation', done: false },
    { phase: 2, title: 'Automated testing framework', done: false },
    { phase: 2, title: 'Code review integration', done: false },
    { phase: 2, title: 'Multi-environment deploys (dev/test/prod)', done: false },

    // Phase 3: Creative/Graphics
    { phase: 3, title: 'Image generation tool integrated', done: false },
    { phase: 3, title: 'Asset library/management', done: false },
    { phase: 3, title: 'Brand guidelines storage', done: false },
    { phase: 3, title: 'Design file integration (Figma)', done: false },
    { phase: 3, title: 'Screenshot/mockup tools', done: false },

    // Phase 4: Web Development
    { phase: 4, title: 'Next.js project scaffolding', done: true },
    { phase: 4, title: 'React component library', done: false },
    { phase: 4, title: 'CMS integration', done: false },
    { phase: 4, title: 'Domain/hosting management', done: false },
    { phase: 4, title: 'Analytics integration', done: false },
    { phase: 4, title: 'SEO tools', done: false },

    // Phase 5: App Development
    { phase: 5, title: 'React Native setup', done: false },
    { phase: 5, title: 'Cross-platform build config', done: false },
    { phase: 5, title: 'App store deployment process', done: false },
    { phase: 5, title: 'Push notification service', done: false },
    { phase: 5, title: 'Mobile API integration', done: false },

    // Phase 6: Game Development
    { phase: 6, title: 'Unreal Engine integration', done: false },
    { phase: 6, title: '3D asset pipeline', done: false },
    { phase: 6, title: 'Audio asset pipeline', done: false },
    { phase: 6, title: 'Platform build configs (PC/console)', done: false },
    { phase: 6, title: 'Multiplayer backend services', done: false },
    { phase: 6, title: 'Game analytics integration', done: false }
  ];

  // Insert todos
  console.log('\n--- TODOS ---');
  for (const t of TODOS) {
    await from('dev_ai_todos').insert({
      project_id: studios.id,
      phase_id: phaseMap[t.phase],
      title: t.title,
      priority: 'medium',
      status: t.done ? 'completed' : 'pending'
    });
    const mark = t.done ? '✓' : '○';
    console.log('Phase ' + t.phase + ' [' + mark + '] ' + t.title);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  for (const p of PHASES) {
    const items = TODOS.filter(t => t.phase === p.num);
    const done = items.filter(t => t.done).length;
    console.log('Phase ' + p.num + ' (' + p.name + '): ' + done + '/' + items.length);
  }

  process.exit(0);
})();
