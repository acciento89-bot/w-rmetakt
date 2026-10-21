// Expo57 iOS command quoting. Applied during prebuild; no postinstall/native execution.
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {withDangerousMod,withXcodeProject}=require('expo/config-plugins');

const envOriginal=`env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT']} " : ""`;
const envManual=String.raw`env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=\\\"#{ENV['PROJECT_ROOT']}\\\" " : ""`;
const envFixed=`env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{Shellwords.escape(ENV['PROJECT_ROOT'])} " : ""`;
const constantsFixed=String.raw`"#{env_vars}bash -l \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\""`;
const oldBundle='`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`';
const fixedBundle='"$('+oldBundle.slice(1,-1)+')"';

function patchConstantsPodspec(source) {
  const envLines=source.split('\n').filter(line=>line.trim().startsWith('env_vars ='));
  if(envLines.length!==1||![envOriginal,envManual,envFixed].includes(envLines[0].trim()))throw new Error('Unknown Expo Constants PROJECT_ROOT format; re-audit SDK before patching');
  const lines=source.split('\n');const indices=lines.map((line,index)=>/^\s*:script => /.test(line)?index:-1).filter(index=>index>=0);
  if(indices.length!==1)throw new Error('Expected exactly one Expo Constants script');
  const index=indices[0];const match=lines[index].match(/^(\s*):script => (".*"),\s*$/);
  const unquoted=match?.[2].replace(/[\\"]/g,'');
  const known=['bash -l -c #{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh','#{env_vars}bash -l $PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh'];
  if(!match||!known.includes(unquoted))throw new Error('Unknown Expo Constants script format; re-audit SDK before patching');
  lines[index]=match[1]+':script => '+constantsFixed+',';
  let result=lines.join('\n').replace(envLines[0],envLines[0].replace(envLines[0].trim(),envFixed));
  if(!/^require ['"]shellwords['"]$/m.test(result)) {
    if(!/^require ['"]json['"]$/m.test(result))throw new Error('Unknown Expo Constants Ruby imports');
    result=result.replace(/^(require ['"]json['"])$/m,"$1\nrequire 'shellwords'");
  }
  return result;
}
function patchBundleScript(source) {
  const lines=source.split('\n');const indices=lines.map((line,index)=>line.includes('react-native-xcode.sh')?index:-1).filter(index=>index>=0);
  if(indices.length!==1)throw new Error('Expected exactly one React Native bundle executable');
  const index=indices[0];const current=lines[index].trim();if(current!==oldBundle&&current!==fixedBundle)throw new Error('Unknown React Native bundle executable; re-audit Expo template');
  lines[index]=lines[index].replace(current,fixedBundle);return lines.join('\n');
}
function patchXcodeProject(project) {
  const section=project.hash?.project?.objects?.PBXShellScriptBuildPhase;
  if(!section)throw new Error('Missing Xcode shell phases');
  const phases=Object.values(section).filter(value=>value&&typeof value==='object'&&value.name?.replace(/^"|"$/g,'')==='Bundle React Native code and images');
  if(phases.length!==1)throw new Error('Expected exactly one React Native bundle phase');
  const phase=phases[0];if(typeof phase.shellScript!=='string'||!phase.shellScript.startsWith('"'))throw new Error('Unknown Xcode shell serialization');
  const script=JSON.parse(phase.shellScript);phase.shellScript=JSON.stringify(patchBundleScript(script));return project;
}
function patchConstantsAtProjectRoot(projectRoot) {
  const appRequire=createRequire(path.join(projectRoot,'package.json'));
  const expoPath=appRequire.resolve('expo/package.json');const expoRequire=createRequire(expoPath);
  const constantsPath=expoRequire.resolve('expo-constants/package.json');
  const expo=JSON.parse(fs.readFileSync(expoPath,'utf8'));const constants=JSON.parse(fs.readFileSync(constantsPath,'utf8'));
  if(!expo.version?.startsWith('57.')||!constants.version?.startsWith('57.'))throw new Error('Space-safe iOS plugin requires audited Expo57 packages');
  const file=path.join(path.dirname(constantsPath),'ios','EXConstants.podspec');const before=fs.readFileSync(file,'utf8');const after=patchConstantsPodspec(before);
  if(before!==after)fs.writeFileSync(file,after,'utf8');
}
function withSpaceSafeIos(config) {
  config=withDangerousMod(config,['ios',async result=>{patchConstantsAtProjectRoot(result.modRequest.projectRoot);return result;}]);
  return withXcodeProject(config,result=>{patchXcodeProject(result.modResults);return result;});
}
module.exports=withSpaceSafeIos;
Object.assign(module.exports,{patchConstantsPodspec,patchBundleScript,patchXcodeProject,patchConstantsAtProjectRoot});
