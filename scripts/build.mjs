import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist');

// The node relies on ajv (and its plugins) at runtime. Community node packages
// must ship with an empty "dependencies" field, so we bundle those libraries
// into the compiled node instead of installing them into the n8n instance.
// n8n-workflow is provided by the host n8n at runtime and must stay external.
const entry = resolve(root, 'nodes/DataValidator/DataValidator.node.ts');
const outFile = resolve(outDir, 'nodes/DataValidator/DataValidator.node.js');

// Static assets n8n loads next to the compiled node (icon + codex metadata).
const assets = [
	['nodes/DataValidator/analysis.svg', 'nodes/DataValidator/analysis.svg'],
	['nodes/DataValidator/DataValidator.node.json', 'nodes/DataValidator/DataValidator.node.json'],
];

await rm(outDir, { recursive: true, force: true });

await build({
	entryPoints: [entry],
	outfile: outFile,
	bundle: true,
	platform: 'node',
	target: 'node18',
	format: 'cjs',
	sourcemap: false,
	minify: false,
	external: ['n8n-workflow'],
	logLevel: 'info',
});

for (const [from, to] of assets) {
	const dest = resolve(outDir, to);
	await mkdir(dirname(dest), { recursive: true });
	await cp(resolve(root, from), dest);
}
