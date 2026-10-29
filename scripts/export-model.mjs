#!/usr/bin/env node
/**
 * Export the SAME model generators used by the web app, without a browser.
 * Optional local dependency: npm install -D @napi-rs/canvas
 * Usage: node scripts/export-model.mjs [--output PATH] [--stats PATH]
 * No renderer, API credentials, external assets or network access is used.
 */
import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (key, fallback) => {
  const i = args.indexOf(key);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`);
  return isAbsolute(args[i + 1]) ? args[i + 1] : resolve(process.cwd(), args[i + 1]);
};
const outputPath = option('--output', join(projectRoot, 'models/yingcui-villa.glb'));
const statsPath = option('--stats', join(projectRoot, 'docs/model-stats.json'));

async function loadCanvas() {
  try { return await import('@napi-rs/canvas'); } catch (error) {
    // The authoring runtime supplies this dependency; the portable project does not require it for Web use.
    const runtimeRoot = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    const candidates = [runtimeRoot && join(runtimeRoot, '@napi-rs/canvas/index.js')].filter(Boolean);
    for (const path of candidates) {
      try { return await import(pathToFileURL(path).href); } catch { /* Try the next confirmed runtime location. */ }
    }
    throw new Error('Local GLB export needs the optional canvas package. Run: npm install -D @napi-rs/canvas\nThe Web app and its GLB export button work without this package.', { cause: error });
  }
}

class NodeFileReader {
  result = null;
  error = null;
  readyState = 0;
  onload = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) { this.read(blob, bytes => bytes); }
  readAsDataURL(blob) { this.read(blob, bytes => `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`); }
  read(blob, map) {
    this.readyState = 1;
    Promise.resolve().then(() => blob.arrayBuffer()).then(bytes => {
      this.result = map(bytes);
      this.readyState = 2;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    }).catch(error => {
      this.error = error;
      this.readyState = 2;
      this.onerror?.({ target: this, error });
      this.onloadend?.({ target: this, error });
    });
  }
}

function installCanvasDOM(napi) {
  const api = napi.default ?? napi;
  const createCanvas = napi.createCanvas ?? api.createCanvas;
  globalThis.HTMLCanvasElement = napi.CanvasElement ?? api.CanvasElement;
  globalThis.HTMLImageElement = napi.Image ?? api.Image;
  globalThis.ImageData = napi.ImageData ?? api.ImageData;
  globalThis.FileReader = NodeFileReader;
  globalThis.document = {
    createElement(tag) {
      if (tag.toLowerCase() !== 'canvas') throw new Error(`Unexpected DOM element in model export: ${tag}`);
      const canvas = createCanvas(1, 1);
      // Three's exporter expects an asynchronous browser-style Blob callback.
      canvas.toBlob = (callback, type = 'image/png') => {
        Promise.resolve().then(() => canvas.toBuffer(type)).then(bytes => callback(new Blob([bytes], { type })));
      };
      return canvas;
    },
  };
}

const ENTRY = `
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMaterials } from './src/materials.ts';
import { buildArchitecture } from './src/architecture.ts';
import { furnishFloor } from './src/furniture.ts';
import { FLOORS, ROOMS } from './src/plans.ts';

const round = (v) => Math.round(v * 10000) / 10000;
const xyz = (v) => [round(v.x), round(v.y), round(v.z)];
function count(group) {
  let meshes = 0, triangles = 0;
  const materials = new Set();
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m.uuid);
  });
  return { meshes, triangles, materials: materials.size };
}

export async function exportModel() {
  const materials = createMaterials();
  const model = buildArchitecture(materials);
  model.root.name = 'Yingcui Residence - five levels - metres';
  model.root.userData = {
    project: '合盛·盈翠雅筑', units: 'metres', source: 'floorplan.jpg',
    coordinateSystem: 'Y up; X left to right in plan; +Z toward the front (bottom of source plan)',
    modelPurpose: 'Interactive architectural visualisation reconstructed from a marketing floor plan; not a surveyed construction BIM',
    floorCount: FLOORS.length, roomCount: ROOMS.length,
    dimensionsAndAssumptions: 'docs/measurements.md',
    interiorDesign: 'Original parametric furniture with locally generated PBR textures',
  };
  for (const floor of model.floors) {
    const furniture = furnishFloor(floor.plan, materials);
    floor.group.add(furniture.group);
    floor.group.position.y = floor.plan.elevation;
    floor.group.visible = floor.shell.visible = floor.ceilings.visible = floor.roof.visible = true;
    floor.group.userData = {
      floorId: floor.plan.id, floorName: floor.plan.name, elevationMetres: floor.plan.elevation,
      storeyHeightMetres: floor.plan.height, rooms: floor.plan.rooms, notes: floor.plan.notes,
    };
  }
  model.root.traverse(object => {
    object.visible = true;
    if (object.isMesh) for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.clippingPlanes = null;
  });
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const stats = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), units: 'metres',
    source: 'public/floorplan.jpg', model: 'models/yingcui-villa.glb',
    floorCount: FLOORS.length, roomCount: ROOMS.length,
    ...count(model.root),
    bounds: { min: xyz(bounds.min), max: xyz(bounds.max), size: xyz(bounds.getSize(new THREE.Vector3())) },
    floors: model.floors.map(floor => {
      const b = new THREE.Box3().setFromObject(floor.group);
      return { id: floor.plan.id, name: floor.plan.name, elevation: floor.plan.elevation, height: floor.plan.height, rooms: floor.plan.rooms.length, ...count(floor.group), bounds: { min: xyz(b.min), max: xyz(b.max) } };
    }),
    exportState: { allFiveFloors: true, originalElevations: true, wallsComplete: true, ceilingsIncluded: true, roofIncluded: true, furnitureIncluded: true, environmentGroundIncluded: false, textureMaxResolution: 1024 },
    limitations: ['Reconstructed from one marketing floor-plan image', 'Elevations, storey heights, roof form and some openings are inferred', 'Rooms use estimated net rectangular areas', 'GLB is a static editing asset; browser controls and collision logic are part of the source code', 'Furniture is batched by material to control browser draw calls'],
  };
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(model.root, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
  if (!(binary instanceof ArrayBuffer)) throw new Error('Exporter did not return a binary GLB');
  return { binary, stats };
}
`;

let temporaryDirectory;
try {
  installCanvasDOM(await loadCanvas());
  temporaryDirectory = await mkdtemp(join(projectRoot, '.model-export-'));
  const bundle = join(temporaryDirectory, 'export-entry.mjs');
  await build({ stdin: { contents: ENTRY, resolveDir: projectRoot, sourcefile: 'export-entry.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node20', packages: 'external', outfile: bundle, logLevel: 'silent' });
  const { exportModel } = await import(pathToFileURL(bundle).href);
  const { binary, stats } = await exportModel();
  const bytes = Buffer.from(binary);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB 2.0 header or byte length');
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Missing GLB JSON chunk');
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const exportedFloorNodes = (json.nodes ?? []).filter(n => n.extras?.floorId && n.extras?.floorName);
  if (exportedFloorNodes.length !== 5) throw new Error(`Expected five exported floor nodes; got ${exportedFloorNodes.length}`);
  stats.glb = { version: json.asset.version, bytes: bytes.length, nodes: json.nodes?.length ?? 0, meshes: json.meshes?.length ?? 0, materials: json.materials?.length ?? 0, textures: json.textures?.length ?? 0, embeddedImages: json.images?.length ?? 0, exportedFloorIds: exportedFloorNodes.map(n => n.extras.floorId), extensionsUsed: json.extensionsUsed ?? [] };
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(statsPath), { recursive: true });
  await writeFile(outputPath, bytes);
  await writeFile(statsPath, JSON.stringify(stats, null, 2) + '\n');
  console.log(JSON.stringify({ output: outputPath, stats: statsPath, bytes: bytes.length, floors: stats.floorCount, rooms: stats.roomCount, meshes: stats.meshes, triangles: stats.triangles, embeddedImages: stats.glb.embeddedImages }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
