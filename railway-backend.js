#!/usr/bin/env node
  const { spawn } = require('child_process');

const port = process.env.PORT || '8080';
const args = ['run', 'start', '--', '-p', String(port), '-H', '0.0.0.0'];

const child = spawn('npm', args, {
	stdio: 'inherit',
	env: process.env,
	shell: false,
});

const shutdown = (signal) => () => {
	try {
		child.kill(signal);
	} finally {
		process.exit(0);
	}
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

child.on('exit', (code, signal) => {
	if (signal) {
		process.exit(0);
  } else {
		process.exit(code || 0);
	}
}); 