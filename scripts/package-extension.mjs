import { readFile, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
if(manifest.version!==pkg.version)throw new Error('La versión compilada no coincide.');
await mkdir('releases',{recursive:true});
const archive=resolve(`releases/chain-chapters-${pkg.version}.zip`);
await rm(archive,{force:true});
// Lista explícita de artefactos; manifest.json queda en la raíz del ZIP.
const files=await readdir('dist');
execFileSync('zip',['-qr',archive,...files],{cwd:'dist'});
console.log(`Paquete creado: ${archive}`);
