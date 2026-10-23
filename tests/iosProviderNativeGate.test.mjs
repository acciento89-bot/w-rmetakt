import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {patchAppDelegate,nativeQAHelper}=require('../plugins/with-provider-isolated-qa.cjs');
test('known generated delegate is patched idempotently and unknown templates fail closed',()=>{
 const source=fs.readFileSync(new URL('./fixtures/Expo57AppDelegate.swift',import.meta.url),'utf8');
 const result=patchAppDelegate(source);assert.equal(patchAppDelegate(result),result);
 assert.match(result,/initialProperties: \["providerDisabledForQA": WaermeNativeQA.providerDisabled\]/);
 assert.match(result,/if WaermeNativeQA.providerDisabled/);
 assert.throws(()=>patchAppDelegate('unknown delegate'),/Unknown/);
});
test('actual native QA helper is opt-in only in test-compiled builds and absent/inert in shipping Release',{skip:process.platform!=='darwin'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'waermetakt-native-qa-'));
 try{
  const helper=path.join(dir,'Helper.swift');
  fs.writeFileSync(helper,'import Foundation\n'+nativeQAHelper+'\n@main struct Main {static func main(){print(WaermeNativeQA.providerDisabled)}}');
  const env={...process.env,DEVELOPER_DIR:'/Applications/Xcode-27.1-RC.app/Contents/Developer'};
  for(const mode of ['debug','qa','release']){
   const binary=path.join(dir,mode);const flags=mode==='debug'?['-DDEBUG']:mode==='qa'?['-DWAERMETAKT_NATIVE_QA']:[];execFileSync('xcrun',['swiftc',...flags,'-parse-as-library',helper,'-o',binary],{env});
   assert.equal(execFileSync(binary,[],{encoding:'utf8'}).trim(),'false');
   assert.equal(execFileSync(binary,['--waermeProviderDisabledQA'],{encoding:'utf8'}).trim(),mode!=='release'?'true':'false');
   if(mode==='release')assert.equal(fs.readFileSync(binary).includes(Buffer.from('--waermeProviderDisabledQA')),false);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
