'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {CATEGORIES} = require('./content-quality');
const clone = value => JSON.parse(JSON.stringify(value));
const LIMIT = 100;

function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > LIMIT) throw Error('Invalid quality history');
  const ids = new Set();
  for (const item of data.items) {
    const report = item?.report;
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        typeof item.title !== 'string' || typeof item.primaryKeyword !== 'string' ||
        !report || report.schema_version !== '1.0' || !/^[a-f0-9]{64}$/.test(report.article_hash) ||
        !Number.isFinite(Date.parse(report.reviewed_at)) || !Array.isArray(report.categories) ||
        report.categories.length !== 5 || !Array.isArray(report.priority_fixes)) throw Error('Invalid quality history report');
    let total = 0;
    for (const [id] of CATEGORIES) {
      const matches = report.categories.filter(category => category?.id === id);
      const category = matches[0];
      if (matches.length !== 1 || !Number.isInteger(category.score) || category.score < 0 || category.score > 20 || !Array.isArray(category.findings)) throw Error('Invalid quality history scores');
      total += category.score;
    }
    if (report.overall_score !== total) throw Error('Invalid quality history total');
    ids.add(item.id);
  }
  return data;
}

function createQualityHistory({dataDir, persistent}) {
  const file = path.join(dataDir, 'quality-history.json');
  const configured = !!persistent?.configured;
  let memory = null, ready = !configured, writeError = false, cacheError = false;
  let pending = Promise.resolve();
  function readLocal() {
    return fs.existsSync(file) ? validate(JSON.parse(fs.readFileSync(file, 'utf8'))) : {version: 1, items: []};
  }
  function writeLocal(data) {
    fs.mkdirSync(dataDir, {recursive: true});
    const temp = file + '.' + randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temp, JSON.stringify(data), {mode: 0o600});
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  function cache(data) {
    try { writeLocal(data); cacheError = false; } catch { cacheError = true; }
  }
  async function init() {
    if (!configured) { readLocal(); return; }
    ready = false;
    try {
      const saved = await persistent.get('quality_history', null);
      const data = saved === null ? readLocal() : validate(saved);
      if (saved === null) await persistent.set('quality_history', data);
      memory = clone(data); ready = true; writeError = false; cache(data);
    } catch { writeError = true; throw Error('Quality history initialization failed'); }
  }
  function read() {
    if (!configured) return readLocal();
    if (!ready) throw Error('Quality history is not ready');
    return clone(memory);
  }
  function add(article, report) {
    // Serialize read/modify/write so simultaneous completed reviews are retained.
    const operation = pending.then(async () => {
      try {
        const data = read();
        const item = {id: randomUUID(), title: article.title, primaryKeyword: article.primaryKeyword, report: clone(report)};
        data.items = [item, ...data.items].slice(0, LIMIT);
        validate(data);
        if (configured) {
          await persistent.set('quality_history', data);
          memory = clone(data); cache(data);
        } else writeLocal(data);
        writeError = false;
        return clone(item);
      } catch {
        writeError = true;
        throw Object.assign(Error('บันทึกประวัติผลตรวจไม่สำเร็จ กรุณาดาวน์โหลด JSON เก็บไว้'), {status: 503});
      }
    });
    pending = operation.catch(() => {});
    return operation;
  }
  function list() {
    return read().items.map(({id, title, primaryKeyword, report}) => ({id, title, primaryKeyword,
      reviewed_at: report.reviewed_at, article_hash: report.article_hash,
      overall_score: report.overall_score, verdict: report.verdict,
      priority_fix_count: report.priority_fixes.length}));
  }
  function detail(id) { return read().items.find(item => item.id === id) || null; }
  async function replace(data,{skipPersistent=false}={}) {
    validate(data);
    if (configured && !skipPersistent) {
      if (!ready) throw Object.assign(Error('Quality history is not ready'), {status:503});
      await persistent.set('quality_history', data);
    }
    if (configured) { memory = clone(data); ready = true; writeError = false; cache(data); }
    else writeLocal(data);
    return clone(data);
  }
  function status() {
    return {storageKind: configured ? 'postgres' : 'file', storageReady: ready && !writeError,
      storageDurable: configured && ready && !writeError, storageWriteError: writeError, storageCacheError: cacheError,
      limit: LIMIT, storageNote: writeError ? 'บันทึกประวัติล่าสุดไม่สำเร็จ ดาวน์โหลดผล JSON เก็บไว้' :
        configured && ready ? 'เก็บประวัติผลตรวจใน PostgreSQL' + (cacheError ? ' · สำเนาไฟล์ในเครื่องเขียนไม่สำเร็จ' : '') :
        'เก็บประวัติในไฟล์เซิร์ฟเวอร์ อาจหายเมื่อ Deploy บน Render ที่ไม่มีพื้นที่ถาวร ดาวน์โหลด JSON เก็บไว้'};
  }
  return {init, add, list, detail, replace, status, exportHistory: read};
}
module.exports = {createQualityHistory, validate};
