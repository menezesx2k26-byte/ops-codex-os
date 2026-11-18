'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const SCOPE = /^(?:personal\/current|project\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99})$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const AUTHORITIES = new Set(['git','drive']);
const HOSTS = new Set(['github.com','docs.google.com','drive.google.com']);

function validateSources(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 100) throw new Error('SOURCE_METADATA_INVALID');
  const used = new Set(['00-home']);
  for(const source of sources) {
    if (!source || Array.isArray(source) || typeof source !== 'object'
      || Object.keys(source).sort().join(',') !== 'authority,id,scope,title,url'
      || typeof source.id !== 'string' || !ID.test(source.id)
      || typeof source.scope !== 'string' || !SCOPE.test(source.scope)
      || !AUTHORITIES.has(source.authority)
      || typeof source.title !== 'string' || source.title.trim() !== source.title
      || source.title.length < 1 || source.title.length > 80
      || /[\x00-\x1f\x7f\[\]<>|\\]/.test(source.title)) {
      throw new Error('SOURCE_METADATA_INVALID');
    }
    if(used.has(source.id)) throw new Error('SOURCE_ID_DUPLICATE');
    used.add(source.id);
    if (typeof source.url !== 'string') throw new Error('SOURCE_URL_INVALID');
    let url;
    try { url = new URL(source.url); } catch { throw new Error('SOURCE_URL_INVALID'); }
    if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)
      || url.username || url.password || url.search || url.hash || url.port
      || !/^\/[A-Za-z0-9._~%/-]+$/.test(url.pathname)
      || url.pathname === '/'
      || url.href !== source.url) {
      throw new Error('SOURCE_URL_INVALID');
    }
  }
}

async function buildObsidianView({sources,outputDir}={}) {
  validateSources(sources);
  if (typeof outputDir !== 'string' || !path.isAbsolute(outputDir)) throw new Error('OUTPUT_PATH_REQUIRED');
  try { await fs.lstat(outputDir); throw new Error('OUTPUT_EXISTS'); }
  catch(error) { if(error.code !== 'ENOENT') throw error; }
  await fs.mkdir(outputDir);
  const banner='<!-- Generated read-only Obsidian view. NOT a RAG index or authority. -->\n';
  const home=[banner,'# Knowledge sources','','Derived pointers only. Contextual recall must go through the authenticated Context Gateway, never through this directory.','',''];
  for(const source of sources) {
    home.push(`- [[${source.id}|${source.title}]]`);
    const note=[banner,`# ${source.title}`,'','**Derived view, not an authoritative source.**','',
      `- Scope: \`${source.scope}\``,`- Source authority: ${source.authority}`,
      `- Canonical source: [Open record](${source.url})`,'','[[00-Home|Return to sources]]',''];
    await fs.writeFile(path.join(outputDir,`${source.id}.md`),note.join('\n'),{flag:'wx'});
  }
  await fs.writeFile(path.join(outputDir,'00-Home.md'),home.join('\n')+'\n',{flag:'wx'});
  return {notes:sources.length,outputDir};
}

if (require.main === module) {
  (async()=>{
    const [manifestFile,outputDir]=process.argv.slice(2);
    if (!manifestFile || !outputDir) throw new Error('USAGE: node scripts/obsidian-view.js manifest.json absolute-output-folder');
    const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
      || Object.keys(manifest).join(',') !== 'sources') throw new Error('SOURCE_METADATA_INVALID');
    const result=await buildObsidianView({sources:manifest.sources,outputDir:path.resolve(outputDir)});
    process.stdout.write(`Obsidian view generated: ${result.notes} source links.\n`);
  })().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
}

module.exports={buildObsidianView};
