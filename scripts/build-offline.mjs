import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve through Vite's declared dependency; this works with npm and pnpm.
const require=createRequire(import.meta.url);
const viteRequire=createRequire(require.resolve('vite/package.json'));
const { build }=viteRequire('esbuild');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'offline');
await fs.mkdir(out,{recursive:true});
await build({entryPoints:[path.join(root,'src/main.tsx')],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(out,'app.js'),minify:true,sourcemap:false,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'css'},logLevel:'warning'});
await fs.copyFile(path.join(root,'public/floorplan.jpg'),path.join(out,'floorplan.jpg'));
await fs.writeFile(path.join(out,'index.html'),'<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>盈翠雅筑 · 离线空间漫游</title><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script src="./app.js"></script></body></html>\n');
console.log('Offline application ready: offline/index.html (classic scripts, no CDN or module fetches).');
