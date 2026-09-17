const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../DYNAMIC/assets/dynamic-puzzle.js'),'utf8');
const start = source.indexOf('  async function findLatestSelection(){');
const end = source.indexOf('  function updateLatestChoiceText(){',start);
const selectionCode = source.slice(start,end)+'\nfindLatestSelection();';
const folders = [{id:'AJ',index:'AJ/index.json'},{id:'EE',index:'EE/index.json'}];
const catalogs = {
  'AJ/index.json':{puzzles:[{id:'260927',complete:true}]},
  'EE/index.json':{puzzles:[{id:'260920',title:'Sunday EE',complete:true}]}
};
async function select(latestPuzzle, overrides={}) {
  return vm.runInNewContext(selectionCode,{
    state:{sources:{folders,latestFolder:'AJ',latestPuzzle}},
    fetchJson:async file=>{
      const result={...catalogs,...overrides}[file];
      if(result instanceof Error) throw result;
      return result;
    },
    getCompletePuzzlesFromIndex:index=>index.puzzles.filter(p=>p.complete),
    selectPuzzle:index=>index.puzzles.find(p=>p.complete),
    firstFolderId:()=>folders[0].id
  });
}
test('explicit latest uploaded puzzle wins over a larger id in another magazine',async()=>{
  const result=await select({folderId:'EE',puzzleId:'260920'});
  assert.equal(result.folderId,'EE');
  assert.equal(result.puzzleId,'260920');
});
test('sites without an explicit latest selection retain automatic selection',async()=>{
  assert.equal((await select()).puzzleId,'260927');
});
test('invalid or missing preferred puzzle falls back to available complete puzzles',async()=>{
  assert.equal((await select({folderId:'EE',puzzleId:'missing'})).puzzleId,'260927');
  assert.equal((await select({folderId:'EE',puzzleId:'260920'},{'EE/index.json':new Error('offline')})).puzzleId,'260927');
  assert.equal((await select({folderId:'EE',puzzleId:'260920'},{'EE/index.json':{puzzles:[{id:'260920',complete:false}]}})).puzzleId,'260927');
});
