'use strict';
const assert=require('node:assert/strict');
const {summarizeStateRows,EXPECTED_STATE_KEYS}=require('../lib/persistent-store');
assert.deepEqual(EXPECTED_STATE_KEYS,['approval_queue','site_history','quality_history']);
const partial=summarizeStateRows([{key:'approval_queue',updated_at:'a'},{key:'site_history',updated_at:'b'}]);
assert.equal(partial.complete,false);
assert.deepEqual(partial.present,['approval_queue','site_history']);
assert.deepEqual(partial.missing,['quality_history']);
const complete=summarizeStateRows([
  {key:'quality_history',updated_at:'c'},
  {key:'approval_queue',updated_at:'a'},
  {key:'site_history',updated_at:'b'},
  {key:'other',updated_at:'x'},
  {key:'site_history',updated_at:'b2'}
]);
assert.equal(complete.complete,true);
assert.deepEqual(complete.present,['approval_queue','quality_history','site_history']);
assert.deepEqual(complete.missing,[]);
assert.equal(complete.updatedAt.site_history,'b2');
console.log('PASS: durable state completeness only accepts required storage keys');
