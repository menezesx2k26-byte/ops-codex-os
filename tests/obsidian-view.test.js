'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildObsidianView } = require('../scripts/obsidian-view');

const sources = [
  {id:'agent-platform',title:'Agent Platform',scope:'project/example/agent-platform',authority:'git',url:'https://github.com/example/agent-platform/blob/main/README.md'},
  {id:'personal-memory',title:'Personal Memory',scope:'personal/current',authority:'git',url:'https://github.com/example/Memory/blob/main/MEMORY.md'},
];

async function withTemp(fn) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-view-'));
  try { return await fn(path.join(parent, 'vault')); }
  finally { await fs.rm(parent, {recursive:true,force:true}); }
}

test('creates a read-only Obsidian Markdown graph of canonical pointers', async()=>{
  await withTemp(async(outputDir)=>{
    const result=await buildObsidianView({sources,outputDir});
    assert.equal(result.notes,2);
    const home=await fs.readFile(path.join(outputDir,'00-Home.md'),'utf8');
    const a=await fs.readFile(path.join(outputDir,'agent-platform.md'),'utf8');
    const b=await fs.readFile(path.join(outputDir,'personal-memory.md'),'utf8');
    assert.match(home,/\[\[agent-platform\|Agent Platform\]\]/);
    assert.match(home,/\[\[personal-memory\|Personal Memory\]\]/);
    assert.match(a,/Source authority: git/);
    assert.match(a,/project\/example\/agent-platform/);
    assert.match(a,/https:\/\/github\.com\/example\/agent-platform\/blob\/main\/README\.md/);
    assert.match(b,/personal\/current/);
    assert.doesNotMatch(home+a+b,/document body|retrieved evidence|secret-token/);
  });
});

test('refuses credential-bearing URLs and unknown domains', async()=>{
  await withTemp(async(outputDir)=>{
    for(const url of [
      'https://github.com/example/repo?token=secret-token',
      'https://username:pass@github.com/example/repo',
      'https://github.com/example/repo)(Injected)',
      'https://evil.example/doc',
      'http://github.com/example/repo',
    ]){
      await assert.rejects(buildObsidianView({sources:[{...sources[0],url}],outputDir}), /SOURCE_URL_INVALID/);
      await assert.rejects(fs.stat(outputDir), /ENOENT/);
    }
  });
});

test('refuses scope escalation, traversal, duplicate IDs and unexpected fields', async()=>{
  await withTemp(async(outputDir)=>{
    for(const candidate of [
      {...sources[0],scope:'project/example/agent-platform/../secret'},
      {...sources[0],id:'../escape'},
      {...sources[0],secret:'do-not-store'},
      {...sources[0],title:'Bad\nTitle'},
      {...sources[0],authority:'rag'},
    ]){
      await assert.rejects(buildObsidianView({sources:[candidate],outputDir}), /SOURCE_METADATA_INVALID/);
    }
    await assert.rejects(buildObsidianView({sources:[sources[0],sources[0]],outputDir}), /SOURCE_ID_DUPLICATE/);
    await assert.rejects(fs.stat(outputDir), /ENOENT/);
  });
});

test('does not overwrite a pre-existing vault or other user files', async()=>{
  await withTemp(async(outputDir)=>{
    await fs.mkdir(outputDir);
    await fs.writeFile(path.join(outputDir,'keep.md'),'human note');
    await assert.rejects(buildObsidianView({sources,outputDir}), /OUTPUT_EXISTS/);
    assert.equal(await fs.readFile(path.join(outputDir,'keep.md'),'utf8'),'human note');
  });
});
