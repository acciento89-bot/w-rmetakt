// Reproducible native QA opt-in; no provider credentials or shipping entitlements.
const {withAppDelegate}=require('expo/config-plugins');
const nativeQAHelper=`// WAERMETAKT_NATIVE_QA
private enum WaermeNativeQA {
  static var providerDisabled: Bool {
#if DEBUG || WAERMETAKT_NATIVE_QA
    ProcessInfo.processInfo.arguments.contains("--waermeProviderDisabledQA")
#else
    false
#endif
  }
}
`;
const initial='      initialProperties: ["providerDisabledForQA": WaermeNativeQA.providerDisabled],';
const offline='    if WaermeNativeQA.providerDisabled { return Bundle.main.url(forResource: "main", withExtension: "jsbundle") }';
function patchAppDelegate(source) {
 if(source.includes('// WAERMETAKT_NATIVE_QA')) {
  if(!source.includes(nativeQAHelper.trim())||!source.includes(initial)||!source.includes(offline))throw Error('Unknown partially patched native QA template');
  return source;
 }
 const launch='      in: window,\n      launchOptions: launchOptions)';
 const bundle='#if DEBUG\n    return RCTBundleURLProvider';
 if(source.split(launch).length!==2||source.split(bundle).length!==2)throw Error('Unknown Expo AppDelegate template; audit before patching');
 return 'import Foundation\n'+source.replace(launch,'      in: window,\n'+initial+'\n      launchOptions: launchOptions)').replace(bundle,'#if DEBUG\n'+offline+'\n    return RCTBundleURLProvider')+'\n'+nativeQAHelper;
}
function withProviderIsolatedQA(config) {
 return withAppDelegate(config,result=>{
  if(result.modResults.language!=='swift')throw Error('Unknown non-Swift AppDelegate');
  result.modResults.contents=patchAppDelegate(result.modResults.contents);return result;
 });
}
module.exports=withProviderIsolatedQA;
Object.assign(module.exports,{patchAppDelegate,nativeQAHelper});
