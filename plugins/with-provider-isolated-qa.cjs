// Reproducible native QA opt-in; no provider credentials or shipping entitlements.
const {withAppDelegate,withInfoPlist}=require('expo/config-plugins');
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
const initial='      initialProperties: ["providerDisabledForQA": true],';
const offline='    if WaermeNativeQA.providerDisabled { return Bundle.main.url(forResource: "main", withExtension: "jsbundle") }';
const nativeQASceneDelegate=`
// Production always delegates to Expo's official scene lifecycle, including links and events.
@objc(WaermeSceneDelegate)
class WaermeSceneDelegate: ExpoAppSceneDelegate {
  override func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard WaermeNativeQA.providerDisabled else {
      super.scene(scene, willConnectTo: session, options: connectionOptions)
      return
    }
    // Only the explicitly test-compiled, opt-in run supplies provider-isolated root properties.
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { preconditionFailure("Missing native QA scene factory") }
    let qaWindow = UIWindow(windowScene: windowScene)
    window = qaWindow
    appDelegate.window = qaWindow
    factory.startReactNative(
      withModuleName: "main",
      in: qaWindow,
${initial}
      launchOptions: nil)
  }
}
`;
function patchAppDelegate(source) {
 if(source.includes('// WAERMETAKT_NATIVE_QA')) {
  if(!source.includes(nativeQAHelper.trim())||!source.includes(nativeQASceneDelegate.trim())||!source.includes(offline))throw Error('Unknown partially patched native QA template');
  return source;
 }
 const provider='class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
 const bundle='#if DEBUG\n    return RCTBundleURLProvider';
 if(!source.includes(provider)||source.includes('factory.startReactNative(')||source.split(bundle).length!==2)throw Error('Unknown Expo scene AppDelegate template; official scene lifecycle must be enabled');
 return 'import Foundation\n'+source.replace(bundle,'#if DEBUG\n'+offline+'\n    return RCTBundleURLProvider')+'\n'+nativeQAHelper+'\n'+nativeQASceneDelegate;
}
function patchSceneManifest(manifest) {
 const configs=manifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
 const owned='$(PRODUCT_MODULE_NAME).WaermeSceneDelegate';
 if(manifest?.UIApplicationSupportsMultipleScenes!==false||!Array.isArray(configs)||configs.length!==1||!['EXExpoAppSceneDelegate',owned].includes(configs[0].UISceneDelegateClassName))throw Error('Unknown scene manifest; audit official Expo scene configuration');
 return {...manifest,UISceneConfigurations:{...manifest.UISceneConfigurations,UIWindowSceneSessionRoleApplication:[{...configs[0],UISceneDelegateClassName:owned}]}};
}
function withProviderIsolatedQA(config) {
 config=withAppDelegate(config,result=>{
  if(result.modResults.language!=='swift')throw Error('Unknown non-Swift AppDelegate');
  result.modResults.contents=patchAppDelegate(result.modResults.contents);return result;
 });
 return withInfoPlist(config,result=>{result.modResults.UIApplicationSceneManifest=patchSceneManifest(result.modResults.UIApplicationSceneManifest);return result;});
}
module.exports=withProviderIsolatedQA;
Object.assign(module.exports,{patchAppDelegate,nativeQAHelper,patchSceneManifest});
