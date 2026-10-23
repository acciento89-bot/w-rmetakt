import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {patchAppDelegate,nativeQAHelper,patchSceneManifest}=require('../plugins/with-provider-isolated-qa.cjs');
test('known generated delegate is patched idempotently and unknown templates fail closed',()=>{
 const source=fs.readFileSync(new URL('./fixtures/Expo57SceneAppDelegate.swift',import.meta.url),'utf8');
 const result=patchAppDelegate(source);assert.equal(patchAppDelegate(result),result);
 assert.match(result,/initialProperties: \["providerDisabledForQA": true\]/);
 assert.match(result,/if WaermeNativeQA.providerDisabled/);
 assert.match(result,/class WaermeSceneDelegate: ExpoAppSceneDelegate/);
 assert.match(result,/guard WaermeNativeQA.providerDisabled else/);
 assert.match(result,/super.scene\(scene, willConnectTo: session, options: connectionOptions\)/);
 assert.equal((result.match(/factory\.startReactNative\(/g)||[]).length,1);
 assert.doesNotMatch(result,/UIWindow\(frame: UIScreen.main.bounds\)/);
 assert.throws(()=>patchAppDelegate('unknown delegate'),/Unknown/);
 assert.throws(()=>patchAppDelegate(fs.readFileSync(new URL('./fixtures/Expo57AppDelegate.swift',import.meta.url),'utf8')),/Unknown Expo scene/);
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

test("official scene manifest points at the own scene bootstrap and rejects unknown configurations",()=>{
 const original={UIApplicationSupportsMultipleScenes:false,UISceneConfigurations:{UIWindowSceneSessionRoleApplication:[{UISceneConfigurationName:"Default Configuration",UISceneDelegateClassName:"EXExpoAppSceneDelegate"}]}};
 const result=patchSceneManifest(original);assert.equal(result.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName,"$(PRODUCT_MODULE_NAME).WaermeSceneDelegate");assert.deepEqual(patchSceneManifest(result),result);assert.equal(original.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName,"EXExpoAppSceneDelegate");assert.throws(()=>patchSceneManifest({}),/Unknown/);
});

test('actual generated scene class resolves through the Objective-C runtime name in its manifest',{skip:process.platform!=='darwin'},()=>{
 const source=fs.readFileSync(new URL('./fixtures/Expo57SceneAppDelegate.swift',import.meta.url),'utf8');
 const patched=patchAppDelegate(source);const declaration=patched.match(/(@objc\(WaermeSceneDelegate\)\nclass WaermeSceneDelegate): ExpoAppSceneDelegate/);assert.ok(declaration);
 const manifest=patchSceneManifest({UIApplicationSupportsMultipleScenes:false,UISceneConfigurations:{UIWindowSceneSessionRoleApplication:[{UISceneConfigurationName:'Default Configuration',UISceneDelegateClassName:'EXExpoAppSceneDelegate'}]}});
 const name=manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName.replace('$(PRODUCT_MODULE_NAME)','WrmeTakt');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'waerme-scene-runtime-'));
 try {const file=path.join(dir,'Probe.swift'),binary=path.join(dir,'Probe');
 fs.writeFileSync(file,'import Foundation\nimport ObjectiveC\n'+declaration[1]+': NSObject {}\n@main struct Main {static func main(){ let canonical: AnyClass? = objc_lookUpClass("'+name+'"); print(canonical != nil && NSClassFromString("'+name+'") != nil) }}');
 execFileSync('xcrun',['swiftc','-module-name','WrmeTakt','-parse-as-library',file,'-o',binary],{env:{...process.env,DEVELOPER_DIR:'/Applications/Xcode-27.1-RC.app/Contents/Developer'}});
 assert.equal(execFileSync(binary,[],{encoding:'utf8'}).trim(),'true');
 }finally {fs.rmSync(dir,{recursive:true,force:true});}
});
