// Root-owned cheap Node/Ruby/bash checks only: never prebuild, pods, Xcode or devices.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createRequire}=require('node:module');
const plugin=require('../../plugins/with-space-safe-ios.cjs');
const oldBundle='`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`';
const originalPodspec=String.raw`require 'json'
  env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT']} " : ""
  script_phase = {
    :name => 'Generate app.config for prebuilt Constants.manifest',
    :script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",
    :execution_position => :before_compile
  }
`;
function temporary(block){const root=fs.mkdtempSync(path.join(os.tmpdir(),"Expo SSD ' path "));try{return block(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
function run(command,args,options={}){return spawnSync(command,args,{encoding:'utf8',...options});}
function constantsCommand(source,environment){return temporary(root=>{const file=path.join(root,'EXConstants.podspec');fs.writeFileSync(file,source);const ruby=String.raw`source=File.read(ARGV[0]); env_vars=eval(source.lines.find{|l|l.include?('env_vars =')}); expression=source.lines.find{|l|l.include?(':script =>')}.split(':script => ',2).last.sub(/,\s*$/, ''); print eval(expression)`;const result=run('/usr/bin/ruby',['-rjson','-rshellwords','-e',ruby,file],{env:{...process.env,...environment}});assert.equal(result.status,0,result.stderr);return result.stdout;});}
function fakeScripts(root){const moduleRoot=path.join(root,'dependency module');const scripts=path.join(moduleRoot,'scripts');fs.mkdirSync(scripts,{recursive:true});fs.writeFileSync(path.join(scripts,'get-app-config-ios.sh'),'#!/bin/bash\nprintf "%s\\n" "$PROJECT_ROOT"\n');fs.writeFileSync(path.join(scripts,'react-native-xcode.sh'),'#!/bin/bash\nprintf "BUNDLE_OK\\n"\n');fs.chmodSync(path.join(scripts,'react-native-xcode.sh'),0o755);return moduleRoot;}
test('clean-installed original Constants command actually fails in a space path, patched command preserves exact PROJECT_ROOT',()=>temporary(root=>{
 const moduleRoot=fakeScripts(root);const projectRoot=path.join(root,'project $value `literal`');const environment={...process.env,PODS_TARGET_SRCROOT:path.join(moduleRoot,'ios'),PROJECT_ROOT:projectRoot};fs.mkdirSync(environment.PODS_TARGET_SRCROOT);
 const old=run('/bin/bash',['-c',constantsCommand(originalPodspec,environment)],{env:environment});assert.notEqual(old.status,0,'fixture must reproduce original failure');
 const patched=plugin.patchConstantsPodspec(originalPodspec);const result=run('/bin/bash',['-c',constantsCommand(patched,environment)],{env:environment});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,projectRoot+'\n');assert.equal(plugin.patchConstantsPodspec(patched),patched);
}));
test('both known upstream Constants variants and current root hotfix are supported without touching other fields',()=>{
 const variants=[originalPodspec,originalPodspec.replace('$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh',String.raw`\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"`),originalPodspec.replace(String.raw`"bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\""`,String.raw`"#{env_vars}bash -l \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\""`)];
 for(const source of variants){const patched=plugin.patchConstantsPodspec(source);assert.ok(patched.includes(":execution_position => :before_compile"));assert.ok(patched.includes("Generate app.config for prebuilt Constants.manifest"));assert.equal(plugin.patchConstantsPodspec(patched),patched);}
 assert.throws(()=>plugin.patchConstantsPodspec("require 'json'\n:script => 'unknown'"));
});
test('generated RN executable is quoted as one path with a space-containing NODE_BINARY, preserving script body',()=>temporary(root=>{
 const moduleRoot=fakeScripts(root);const node=path.join(root,'node binary');fs.writeFileSync(node,'#!/bin/bash\nprintf "%s\\n" "$FAKE_RN_SCRIPT"\n');fs.chmodSync(node,0o755);
 const env={...process.env,NODE_BINARY:node,FAKE_RN_SCRIPT:path.join(moduleRoot,'scripts/react-native-xcode.sh')};
 const old=run('/bin/bash',['-c',oldBundle],{env});assert.equal(old.status,127,old.stderr);
 const before='# exact existing header\n'+oldBundle+'\n# exact existing footer\n';const after=plugin.patchBundleScript(before);const result=run('/bin/bash',['-c',after],{env});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'BUNDLE_OK\n');assert.ok(after.startsWith('# exact existing header\n'));assert.ok(after.endsWith('# exact existing footer\n'));assert.equal(plugin.patchBundleScript(after),after);assert.throws(()=>plugin.patchBundleScript('# unknown new upstream layout'));
}));
test('real installed Expo template Xcode phase is patched through actual xcode serialization and only bundle shell changes',()=>temporary(root=>{
 const expoRequire=createRequire(require.resolve('expo/package.json'));const xcode=expoRequire('xcode');const template=path.join(path.dirname(require.resolve('expo/package.json')),'template.tgz');
 const result=run('/usr/bin/tar',['-xOf',template,'package/ios/HelloWorld.xcodeproj/project.pbxproj']);assert.equal(result.status,0,result.stderr);
 const fixture=path.join(root,'fixture.pbxproj');fs.writeFileSync(fixture,result.stdout);const project=xcode.project(fixture);project.parseSync();const objects=project.hash.project.objects;const before=structuredClone(objects);plugin.patchXcodeProject(project);
 const phases=objects.PBXShellScriptBuildPhase;let changed=0;for(const [id,phase]of Object.entries(phases)){if(typeof phase!=='object')continue;const old=before.PBXShellScriptBuildPhase[id];if(phase.shellScript!==old.shellScript){changed++;assert.match(phase.name,/Bundle React Native code and images/);const restored={...phase,shellScript:old.shellScript};assert.deepEqual(restored,old);}}
 assert.equal(changed,1);const serialized=project.writeSync();const roundtripFile=path.join(root,'roundtrip.pbxproj');fs.writeFileSync(roundtripFile,serialized);const roundtrip=xcode.project(roundtripFile);roundtrip.parseSync();const once=roundtrip.writeSync();plugin.patchXcodeProject(roundtrip);assert.equal(roundtrip.writeSync(),once);
}));
test('fresh hoisted and nested expo-constants installs are located without writing generated ios or unrelated modules',()=>temporary(root=>{
 for(const nested of [false,true]){const app=path.join(root,nested?'nested app':'hoisted app');const expo=path.join(app,'node_modules/expo');const constants=path.join(nested?path.join(expo,'node_modules'):path.join(app,'node_modules'),'expo-constants');fs.mkdirSync(path.join(constants,'ios'),{recursive:true});fs.mkdirSync(expo,{recursive:true});fs.writeFileSync(path.join(expo,'package.json'),'{"name":"expo","version":"57.0.18"}');fs.writeFileSync(path.join(constants,'package.json'),'{"name":"expo-constants","version":"57.0.7"}');const podspec=path.join(constants,'ios/EXConstants.podspec');fs.writeFileSync(podspec,originalPodspec);const ios=path.join(app,'ios');fs.mkdirSync(ios);fs.writeFileSync(path.join(ios,'untouched'),'QA_GENERATED');plugin.patchConstantsAtProjectRoot(app);const once=fs.readFileSync(podspec,'utf8');assert.notEqual(once,originalPodspec);plugin.patchConstantsAtProjectRoot(app);assert.equal(fs.readFileSync(podspec,'utf8'),once);assert.equal(fs.readFileSync(path.join(ios,'untouched'),'utf8'),'QA_GENERATED');}
}));
test('checked-in Expo configuration registers the durable plugin once and plugin supplies both iOS mods',()=>{
 const config=require('../../app.json').expo;const entries=config.plugins.filter(x=>(Array.isArray(x)?x[0]:x)==='./plugins/with-space-safe-ios.cjs');assert.equal(entries.length,1);
 const result=plugin({name:'Path fixture',slug:'path-fixture'});assert.equal(typeof result.mods.ios.dangerous,'function');assert.equal(typeof result.mods.ios.xcodeproj,'function');assert.equal(result.mods.android,undefined);
});
test('actual installed Reklaio manual PROJECT_ROOT quoting normalizes and preserves complete project root',()=>temporary(root=>{
 // Byte-exact read-only snapshot of the independently reviewed installed podspec, not a hand-built script-only variant.
 const source=fs.readFileSync(path.join(__dirname,'fixtures/exconstants-manual-project-root.podspec'),'utf8');
 const moduleRoot=fakeScripts(root);const projectRoot=path.join(root,'manual project $value `literal`');const environment={...process.env,PODS_TARGET_SRCROOT:path.join(moduleRoot,'ios'),PROJECT_ROOT:projectRoot};fs.mkdirSync(environment.PODS_TARGET_SRCROOT);
 const patched=plugin.patchConstantsPodspec(source);const result=run('/bin/bash',['-c',constantsCommand(patched,environment)],{env:environment});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,projectRoot+'\n');assert.equal(plugin.patchConstantsPodspec(patched),patched);
 assert.ok(patched.includes("s.dependency 'ExpoModulesCore'"));assert.ok(patched.includes("'ExpoConstants_privacy' => ['PrivacyInfo.xcprivacy']"));
}));
