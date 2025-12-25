require('dotenv').config();
const { from } = require('./src/lib/db');

(async () => {
  // Get all projects with server_path
  const { data: projects } = await from('dev_projects')
    .select('id, name, server_path');

  let added = 0;
  for (const p of (projects || [])) {
    if (!p.server_path) continue;

    // Check if server_path already in dev_project_paths
    const { data: existing } = await from('dev_project_paths')
      .select('id')
      .eq('path', p.server_path)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Add server_path
    const { error } = await from('dev_project_paths').insert({
      project_id: p.id,
      path: p.server_path,
      path_type: 'server'
    });

    if (!error) {
      console.log('Added:', p.server_path, '->', p.name);
      added++;
    }
  }

  console.log('\nTotal added:', added);
  process.exit(0);
})();
