'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const y=fs.readFileSync(path.join(__dirname,'../render.yaml'),'utf8');
assert.match(y,/key:\s*DATABASE_URL[\s\S]*fromDatabase:[\s\S]*name:\s*area-seo-ai-db[\s\S]*property:\s*connectionString/);
assert.match(y,/databases:[\s\S]*name:\s*area-seo-ai-db[\s\S]*plan:\s*free[\s\S]*region:\s*singapore/);
assert(!/postgres(?:ql)?:\/\//i.test(y),'render.yaml must not hardcode a database connection string');
console.log('PASS: Render Blueprint links DATABASE_URL through fromDatabase without committing credentials');
