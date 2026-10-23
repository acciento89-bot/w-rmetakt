import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual React component boundary; synthetic SDK loading is deliberate.
// Never import the real IAP package in this probe.
function boundary() {
 const source=fs.readFileSync(new URL('../src/PurchaseBoundary.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let loads=0,hooks=0;const marker={isPro:true,connected:true,price:'synthetic'};
 const exports={};const module={exports};
 vm.runInNewContext(code,{module,exports,require(name){
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='./useProPurchase'){loads++;return {useProPurchase(){hooks++;return marker;}};}
  throw new Error('Unexpected dependency '+name);
 }});
 function render(disabledForQA) {
  let node=exports.PurchaseBoundary({disabledForQA,render:purchase=>({purchase})});
  for(let i=0;i<10&&typeof node?.type==='function';i++)node=node.type(node.props);
  return node.purchase;
 }
 return {render,marker,counts:()=>({loads,hooks})};
}
test('explicit native QA mounts without loading IAP and cannot grant or transact',async()=>{
 const b=boundary();const purchase=b.render(true);assert.equal(purchase.isPro,false);assert.equal(purchase.connected,false);
 await purchase.buy();await purchase.restore();assert.deepEqual(b.counts(),{loads:0,hooks:0});assert.equal(purchase.isPro,false);
});
test('ordinary launch still mounts the original purchase hook without substituting entitlements',()=>{
 for(const flag of [undefined,false]){const b=boundary();assert.equal(b.render(flag),b.marker);assert.deepEqual(b.counts(),{loads:1,hooks:1});}
});
