package de.kamilunavo.waermetaktqa;

import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityWindowInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.*;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.*;
import java.util.regex.*;
import static org.junit.Assert.*;

/** External disposable host; ordinary records and every review decision are entered in the shipping Release UI. */
@RunWith(AndroidJUnit4.class)
public final class QualityNativeTest {
 private static final String APP="de.kamilunavo.waermetakt";
 private final UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
 private final android.content.Context host=InstrumentationRegistry.getInstrumentation().getTargetContext();
 private final File proof=new File(host.getFilesDir(),"native-proof");
 @Rule public final TestWatcher watcher=new TestWatcher(){@Override protected void failed(Throwable e,Description d){try{capture("failure-screen");}catch(Exception ignored){}}};
 @Before public void owned()throws Exception {
  assertEquals(35,Build.VERSION.SDK_INT);assertEquals("1",device.executeShellCommand("getprop ro.kernel.qemu").trim());proof.mkdirs();
  android.accessibilityservice.AccessibilityServiceInfo info=InstrumentationRegistry.getInstrumentation().getUiAutomation().getServiceInfo();assertNotNull(info);info.flags|=android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;InstrumentationRegistry.getInstrumentation().getUiAutomation().setServiceInfo(info);
  launch(); test("nav-settings"); text("Deutsch"); text("Celsius (°C)"); test("nav-home");
 }
 private void launch(){Intent i=host.getPackageManager().getLaunchIntentForPackage(APP);assertNotNull(i);host.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));assertTrue(device.wait(Until.hasObject(By.pkg(APP)),20000));device.waitForIdle();}
 private UiObject2 unique(BySelector selector){List<UiObject2> nodes=device.findObjects(selector);assertEquals("Unique visible target: "+selector,1,nodes.size());return nodes.get(0);}
 private UiObject2 find(BySelector selector){
  // React can finish navigation after Android becomes idle; wait for a visible target first.
  if(device.wait(Until.hasObject(selector),1500))return unique(selector);
  // A target may be above the retained viewport. Search from the actual top, never only downward.
  top();
  for(int n=0;n<30;n++){
   List<UiObject2> nodes=device.findObjects(selector);if(nodes.size()==1)return nodes.get(0);if(nodes.size()>1)fail("Ambiguous target "+selector);
   device.swipe(device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.78),device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.28),25);device.waitForIdle();
  }
  fail("Target missing: "+selector);return null;
 }
 private BySelector id(String id){return By.res(Pattern.compile("(?:"+Pattern.quote(APP)+":id/)?"+Pattern.quote(id)));}
 private void click(BySelector selector){UiObject2 n=find(selector);assertTrue("Target disabled",n.isEnabled());n.click();device.waitForIdle();}
 private void text(String value){click(By.text(value));}
 private void test(String value){click(id(value));}
 private void expect(String value){
  BySelector selector=By.text(value);if(device.wait(Until.hasObject(selector),1500))return;top();
  for(int n=0;n<30;n++){if(device.hasObject(selector))return;device.swipe(device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.78),device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.28),25);device.waitForIdle();}fail("Expected text missing: "+value);
 }
 private void present(String value){assertTrue("Expected text: "+value,device.wait(Until.hasObject(By.text(value)),5000));}
 private void hideKeyboard(){for(AccessibilityWindowInfo w:InstrumentationRegistry.getInstrumentation().getUiAutomation().getWindows())if(w.getType()==AccessibilityWindowInfo.TYPE_INPUT_METHOD){device.pressBack();device.waitForIdle();return;}}
 private void enter(BySelector selector,String value){UiObject2 n=find(selector);n.click();device.waitForIdle();unique(selector).setText(value);device.waitForIdle();assertEquals(value,unique(selector).getText());hideKeyboard();}
 private void top(){for(int n=0;n<16;n++){device.swipe(device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.3),device.getDisplayWidth()/2,(int)(device.getDisplayHeight()*.82),20);device.waitForIdle();}}
 private void capture(String name)throws Exception {
  device.waitForIdle();if(!name.equals("failure-screen"))assertEquals(APP,device.getCurrentPackageName());
  assertTrue(device.takeScreenshot(new File(proof,name+".png")));device.dumpWindowHierarchy(new File(proof,name+".xml"));
 }

 @Test public void ordinaryFreeExperimentAndMeasurement()throws Exception {
  text("Ersten Test starten →");present("Schritt 1/3");test("experiment-next");present("Schritt 2/3");test("experiment-next");present("Schritt 3/3");
  test("experiment-confirm");
  // Native idleness does not imply that React has committed the new confirmation state.
  assertTrue("Confirmation must be rendered before the dependent start tap",device.wait(Until.hasObject(id("experiment-confirm").checked(true)),10000));
  assertTrue("Start must be enabled after confirmation",device.wait(Until.hasObject(id("experiment-next").enabled(true)),10000));
  // Use a deliberate finger-length press after the native disabled→enabled transition.
  // Keep the real post-save navigation assertion; never retry a possibly successful save.
  unique(id("experiment-next")).click(200);
  boolean leftWizard=device.wait(Until.gone(id("experiment-confirm")),10000);
  if(!leftWizard){
   // Diagnostic only: isolate touch dispatch from the accessible click callback.
   // This fallback NEVER turns failed physical touch acceptance into a pass.
   android.view.accessibility.AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
   java.util.ArrayDeque<android.view.accessibility.AccessibilityNodeInfo> pending=new java.util.ArrayDeque<>();if(root!=null)pending.add(root);boolean acted=false;
   while(!pending.isEmpty()){
    android.view.accessibility.AccessibilityNodeInfo node=pending.remove();
    if("experiment-next".equals(node.getViewIdResourceName())){acted=node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK);break;}
    for(int index=0;index<node.getChildCount();index++){android.view.accessibility.AccessibilityNodeInfo child=node.getChild(index);if(child!=null)pending.add(child);}
   }
   boolean accessibleNavigation=device.wait(Until.gone(id("experiment-confirm")),10000);
   fail("Physical start failed; diagnostic accessible action="+acted+", wizard left="+accessibleNavigation);
  }
  assertNotNull(find(By.res(Pattern.compile("(?:"+Pattern.quote(APP)+":id/)?quality-open-.+"))));capture("01-ordinary-experiment");
  test("nav-entry");test("measurement-save");test("nav-history");assertNotNull(find(By.textContains("5.1")));capture("02-ordinary-measurement");
 }
 private void openGolden(){test("nav-tests");test("quality-open-qa-quality-golden");assertTrue(device.wait(Until.hasObject(id("quality-beforeStart")),10000));}
 private void goldenDates(){top();assertEquals("2026-10-01",find(id("quality-beforeStart")).getText());assertEquals("2026-10-04",find(id("quality-beforeEnd")).getText());assertEquals("2026-10-05",find(id("quality-afterStart")).getText());assertEquals("2026-10-08",find(id("quality-afterEnd")).getText());}
 @Test public void reviewHistoricalFixtureWithoutChangingRawReadings()throws Exception {
  openGolden();goldenDates();expect("-50%");capture("03-all-selected-golden");
  enter(id("quality-afterEnd"),"2026-02-30");assertFalse(find(id("quality-save")).isEnabled());expect("Bitte prüfe die Datumsangaben: gleich lange, getrennte Zeiträume mit je 3–31 Tagen, Vorher zuerst. Jeder ausgelassene Tag braucht einen Grund mit 1–500 Zeichen und muss im gewählten Zeitraum liegen.");capture("04-invalid-date-blocked");
  enter(id("quality-afterEnd"),"2026-10-08");test("quality-exclude-after-2026-10-08");enter(id("quality-reason-after-2026-10-08"),"QA meter check");test("quality-save");assertTrue(device.wait(Until.hasObject(id("quality-saved")),10000));
  expect("+50%");expect("+100 Prozentpunkte");capture("05-reasoned-comparison");
 }
 @Test public void englishReviewGallery()throws Exception {
  test("nav-settings");text("English");text("Celsius (°C)");test("nav-tests");expect("Test a setting.");
  openGolden();goldenDates();capture("09-english-review");
  expect("All selected days");expect("After explicit selection");expect("+50%");expect("+100 percentage points");capture("10-english-comparison");
 }
 @Test public void coldReviewAndResponsiveLayout()throws Exception {
  openGolden();goldenDates();expect("QA meter check");expect("+50%");expect("+100 Prozentpunkte");capture("06-cold-reviewed");
  device.setOrientationLeft();device.waitForIdle();top();assertEquals("2026-10-01",find(id("quality-beforeStart")).getText());capture("07-wide-review");device.setOrientationNatural();device.waitForIdle();
  expect("+100 Prozentpunkte");test("quality-back");test("nav-tests");expect("Einstellung testen.");capture("08-original-analysis-retained");
 }
}
