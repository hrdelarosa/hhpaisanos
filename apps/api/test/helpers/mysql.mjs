import { spawnSync } from 'node:child_process';

export function rootSql(statement) {
  // SQL is sent on stdin; root credentials stay inside the Compose container.
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'mysql',
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --batch --skip-column-names',
    ],
    { cwd: '../..', input: statement, encoding: 'utf8', timeout: 30000 },
  );
  if (result.status !== 0)
    throw new Error('Isolated database setup/cleanup failed; check the Compose MySQL service');
  return result.stdout.trim();
}
