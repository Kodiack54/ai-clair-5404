require('dotenv').config();
const { from } = require('./src/lib/db');

(async () => {
  // Get all pending todos
  const { data } = await from('dev_ai_todos')
    .select('id, title, description, status')
    .eq('status', 'pending');

  console.log('Total pending todos:', (data || []).length);

  // Categorize by theme
  const themes = {
    'AI Team/Pipeline': [],
    'Calendar': [],
    'Dashboard/UI': [],
    'Logging/Monitoring': [],
    'Configuration': [],
    'Testing': [],
    'Deployment': [],
    'Documentation': [],
    'Obsolete/Vague': [],
    'Other': []
  };

  const keywords = {
    'AI Team/Pipeline': ['chad', 'jen', 'susan', 'clair', 'capture', 'extraction', 'session', 'pipeline', 'bucket'],
    'Calendar': ['calendar'],
    'Dashboard/UI': ['dashboard', 'tab', 'ui', 'project management', 'folder', 'visuals'],
    'Logging/Monitoring': ['log', 'pm2', 'monitor', 'verify'],
    'Configuration': ['config', 'env', 'mcp', 'port'],
    'Testing': ['test', 'hook'],
    'Deployment': ['deploy', 'patcher', 'droplet', 'clone', 'instance'],
    'Documentation': ['document', 'readme', 'update']
  };

  // Vague/obsolete patterns
  const vaguePatterns = [
    /^plan to/i,
    /^need to/i,
    /^consider/i,
    /^be patient/i,
    /^user/i,
    /^intend to/i,
    /^a command was/i,
    /details$/i,
  ];

  for (const todo of (data || [])) {
    const title = (todo.title || '').toLowerCase();
    let assigned = false;

    // Check if vague/obsolete
    for (const pattern of vaguePatterns) {
      if (pattern.test(todo.title || '')) {
        themes['Obsolete/Vague'].push(todo);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      for (const [theme, words] of Object.entries(keywords)) {
        for (const word of words) {
          if (title.includes(word)) {
            themes[theme].push(todo);
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
    }

    if (!assigned) {
      themes['Other'].push(todo);
    }
  }

  console.log('\n=== TODOS BY THEME ===');
  for (const [theme, todos] of Object.entries(themes)) {
    if (todos.length > 0) {
      console.log('\n' + theme + ': ' + todos.length);
      for (const t of todos.slice(0, 3)) {
        console.log('  - ' + (t.title || '').substring(0, 60));
      }
      if (todos.length > 3) console.log('  ... and ' + (todos.length - 3) + ' more');
    }
  }

  // Count what can be deleted
  const toDelete = themes['Obsolete/Vague'].length;
  console.log('\n=== RECOMMENDED CLEANUP ===');
  console.log('Delete obsolete/vague:', toDelete);
  console.log('Consolidate remaining:', (data || []).length - toDelete);

  process.exit(0);
})();
