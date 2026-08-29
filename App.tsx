import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { database, Experiment, Measurement, SystemProfile } from './src/database';
import { analyzeMeasurements, InsightKey } from './src/domain';
import { flowStrings, Language, strings, unitStrings } from './src/i18n';
import { useProPurchase } from './src/useProPurchase';

type Screen = 'home' | 'tests' | 'newTest' | 'entry' | 'history' | 'settings' | 'pro';
type UnitSystem = 'metric' | 'imperial';

const screenshotMode = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';
const screenshotMeasurements: Measurement[] = [
  { id: 'demo-1', measuredAt: '2026-08-17T12:00:00.000Z', phase: 'before', electricityKwh: 7.4, heatKwh: 24.1, outsideC: 2.1, roomC: 21.0, compressorStarts: 14, flowC: 39, returnC: 32, compressorHours: 6.0, hotWaterKwh: 3.2 },
  { id: 'demo-2', measuredAt: '2026-08-18T12:00:00.000Z', phase: 'before', electricityKwh: 7.1, heatKwh: 23.8, outsideC: 2.8, roomC: 21.1, compressorStarts: 13, flowC: 38, returnC: 32, compressorHours: 6.1, hotWaterKwh: 3.0 },
  { id: 'demo-3', measuredAt: '2026-08-19T12:00:00.000Z', phase: 'before', electricityKwh: 6.8, heatKwh: 23.1, outsideC: 3.5, roomC: 21.0, compressorStarts: 12, flowC: 38, returnC: 31, compressorHours: 6.2, hotWaterKwh: 2.9 },
  { id: 'demo-4', measuredAt: '2026-08-24T12:00:00.000Z', phase: 'after', electricityKwh: 5.7, heatKwh: 22.4, outsideC: 3.0, roomC: 21.0, compressorStarts: 8, flowC: 34, returnC: 29, compressorHours: 6.4, hotWaterKwh: 2.8 },
  { id: 'demo-5', measuredAt: '2026-08-25T12:00:00.000Z', phase: 'after', electricityKwh: 5.5, heatKwh: 22.0, outsideC: 3.8, roomC: 21.1, compressorStarts: 7, flowC: 34, returnC: 29, compressorHours: 6.5, hotWaterKwh: 2.9 },
  { id: 'demo-6', measuredAt: '2026-08-26T12:00:00.000Z', phase: 'after', electricityKwh: 5.2, heatKwh: 21.5, outsideC: 4.4, roomC: 21.0, compressorStarts: 7, flowC: 33, returnC: 28, compressorHours: 6.6, hotWaterKwh: 2.7 },
];
const screenshotExperiment: Experiment = { id: 'demo-test', setting: 'heatingCurve', previousValue: '0.6', newValue: '0.5', unit: '', durationDays: 14, startedAt: '2026-08-22T12:00:00.000Z', status: 'active' };
const screenshotProfile: SystemProfile = { manufacturer: 'Vaillant', model: 'aroTHERM plus', buildingArea: '165', constructionYear: '2018', heatDistribution: 'floor', electricityPrice: '0' };

const colors = {
  night: '#0B2422', forest: '#123A35', pine: '#185147', teal: '#16796A', leaf: '#32A77B',
  lime: '#D8F36A', mist: '#DDF0E5', sage: '#BEDDCB', pale: '#EAF5EE', surface: '#D2E8DA',
  ink: '#102C28', muted: '#547068', line: '#A9CDBB', cream: '#F0F7F2', white: '#FFFFFF', amber: '#E7A63D', danger: '#B45B4D',
};

const extra = {
  de: {
    free: 'FREE', proActiveShort: 'PRO AKTIV', analysis: 'Analyse', history: 'Verlauf', systemPulse: 'ANLAGEN-CHECK',
    dataQuality: 'Datenqualität', avgPower: 'Ø Strom/Tag', avgHeat: 'Ø Wärme/Tag', avgStarts: 'Ø Starts/Tag',
    flowSpread: 'Spreizung', runtimeStart: 'Laufzeit/Start', estimatedCost: 'Geschätzte Stromkosten/Tag',
    recommendations: 'Empfehlungen', recommendationsIntro: 'Aus deinen Messwerten abgeleitete Hinweise – priorisiert und verständlich.',
    testsAndChanges: 'Tests & Änderungen', allReadings: 'Alle Messungen', readingsIntro: 'Deine lokal gespeicherte Anlagenhistorie.',
    noReadings: 'Noch keine Messwerte vorhanden.', beforePhase: 'Vorher', afterPhase: 'Nachher',
    measurementPhase: 'Messabschnitt', advancedValues: 'Erweiterte Anlagenwerte', flowTemp: 'Vorlauftemperatur',
    returnTemp: 'Rücklauftemperatur', compressorHours: 'Verdichterlaufzeit', hotWaterHeat: 'Wärme für Warmwasser',
    hours: 'Stunden', profile: 'Anlagenprofil', profileIntro: 'Damit Empfehlungen besser zu deinem Gebäude und deiner Wärmepumpe passen.',
    manufacturer: 'Hersteller', model: 'Modell', buildingArea: 'Beheizte Fläche', constructionYear: 'Baujahr Gebäude',
    distribution: 'Wärmeverteilung', floor: 'Fußbodenheizung', radiators: 'Heizkörper', mixed: 'Gemischt',
    electricityPrice: 'Strompreis', saveProfile: 'Anlagenprofil speichern', saved: 'Gespeichert',
    latestReading: 'Letzte Messung', noCurrentValue: 'Noch kein Wert', goAnalysis: 'Analyse öffnen',
    insightTitles: {
      collectData: 'Vergleichsdaten vervollständigen', excellentCop: 'Sehr gute Arbeitszahl', lowCop: 'Arbeitszahl prüfen',
      shortCycles: 'Kurze Verdichterzyklen', highFlow: 'Hohe Vorlauftemperatur', wideDelta: 'Große Spreizung',
      comfortStable: 'Raumkomfort stabil', comfortRisk: 'Komfortabweichung erkannt', weatherImproved: 'Änderung wirkt positiv',
    } as Record<InsightKey, string>,
    insightTexts: {
      collectData: 'Für eine belastbare Wetterbereinigung werden mindestens drei Vorher- und drei Nachher-Tage benötigt.',
      excellentCop: 'Die erzeugte Wärmemenge steht in einem sehr guten Verhältnis zum Stromverbrauch.',
      lowCop: 'Prüfe Heizkurve, Vorlauf und Warmwasser-Sollwert. Ändere dabei immer nur einen Parameter.',
      shortCycles: 'Weniger als 25 Minuten je Start deutet auf Takten hin. Heizkurve und Hysterese können Ansatzpunkte sein.',
      highFlow: 'Über 45 °C sinkt die Effizienz vieler Wärmepumpen. Nur innerhalb der Herstellervorgaben optimieren.',
      wideDelta: 'Mehr als 8 K zwischen Vor- und Rücklauf kann auf Volumenstrom- oder Hydraulikthemen hindeuten.',
      comfortStable: 'Die mittlere Raumtemperatur bleibt im gewünschten Komfortbereich.',
      comfortRisk: 'Die Effizienz darf nicht zulasten des Raumkomforts gehen. Beobachte die Räume vor weiteren Änderungen.',
      weatherImproved: 'Der Verbrauch je Heizgrad ist nach der Änderung gesunken – nicht nur wegen wärmeren Wetters.',
    } as Record<InsightKey, string>,
  },
  en: {
    free: 'FREE', proActiveShort: 'PRO ACTIVE', analysis: 'Analysis', history: 'History', systemPulse: 'SYSTEM CHECK',
    dataQuality: 'Data quality', avgPower: 'Avg. power/day', avgHeat: 'Avg. heat/day', avgStarts: 'Avg. starts/day',
    flowSpread: 'Flow spread', runtimeStart: 'Runtime/start', estimatedCost: 'Estimated electricity cost/day',
    recommendations: 'Recommendations', recommendationsIntro: 'Prioritized, easy-to-understand guidance derived from your readings.',
    testsAndChanges: 'Tests & changes', allReadings: 'All readings', readingsIntro: 'Your locally stored system history.',
    noReadings: 'No readings recorded yet.', beforePhase: 'Before', afterPhase: 'After',
    measurementPhase: 'Measurement phase', advancedValues: 'Advanced system values', flowTemp: 'Flow temperature',
    returnTemp: 'Return temperature', compressorHours: 'Compressor runtime', hotWaterHeat: 'Domestic hot water heat',
    hours: 'Hours', profile: 'System profile', profileIntro: 'Helps tailor recommendations to your building and heat pump.',
    manufacturer: 'Manufacturer', model: 'Model', buildingArea: 'Heated area', constructionYear: 'Building year',
    distribution: 'Heat distribution', floor: 'Underfloor heating', radiators: 'Radiators', mixed: 'Mixed',
    electricityPrice: 'Electricity price', saveProfile: 'Save system profile', saved: 'Saved',
    latestReading: 'Latest reading', noCurrentValue: 'No value yet', goAnalysis: 'Open analysis',
    insightTitles: {
      collectData: 'Complete comparison data', excellentCop: 'Excellent performance factor', lowCop: 'Review performance factor',
      shortCycles: 'Short compressor cycles', highFlow: 'High flow temperature', wideDelta: 'Wide temperature spread',
      comfortStable: 'Indoor comfort is stable', comfortRisk: 'Comfort deviation detected', weatherImproved: 'Change is working',
    } as Record<InsightKey, string>,
    insightTexts: {
      collectData: 'At least three before and three after days are required for reliable weather adjustment.',
      excellentCop: 'Heat output is very strong relative to electricity consumption.',
      lowCop: 'Review heating curve, flow temperature and hot-water target. Change one parameter at a time.',
      shortCycles: 'Less than 25 minutes per start suggests cycling. Heating curve and hysteresis may be relevant.',
      highFlow: 'Efficiency often drops above 45 °C. Optimize only within manufacturer specifications.',
      wideDelta: 'More than 8 K between flow and return may indicate flow-rate or hydraulic issues.',
      comfortStable: 'Average indoor temperature remains in the target comfort range.',
      comfortRisk: 'Efficiency must not reduce comfort. Monitor rooms before making further changes.',
      weatherImproved: 'Electricity per heating degree fell after the change, not merely because weather became warmer.',
    } as Record<InsightKey, string>,
  },
} as const;

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [language, setLanguage] = useState<Language>(() => Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('de') ? 'de' : 'en');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => Intl.DateTimeFormat().resolvedOptions().locale.toUpperCase().includes('-US') ? 'imperial' : 'metric');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [profile, setProfile] = useState<SystemProfile>({ manufacturer: '', model: '', buildingArea: '', constructionYear: '', heatDistribution: 'floor', electricityPrice: '0.32' });
  const [isReady, setIsReady] = useState(false);
  const purchase = useProPurchase();
  const t = { ...strings[language], ...unitStrings[language], ...flowStrings[language], ...extra[language] };

  useEffect(() => {
    database.initialize().then(async () => {
      let storedMeasurements = await database.listMeasurements();
      let storedExperiments = await database.listExperiments();
      if (screenshotMode && storedMeasurements.length === 0) {
        await Promise.all(screenshotMeasurements.map((item) => database.saveMeasurement(item)));
        await database.saveExperiment(screenshotExperiment);
        await database.saveProfile(screenshotProfile);
        storedMeasurements = await database.listMeasurements();
        storedExperiments = await database.listExperiments();
      }
      setMeasurements(storedMeasurements);
      setExperiments(storedExperiments);
      setProfile(screenshotMode ? screenshotProfile : await database.getProfile());
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!screenshotMode) return;
    const openScreenshotRoute = (url: string | null) => {
      if (!url) return;
      const route = url.replace(/^.*?:\/\//, '').split('?')[0] as Screen;
      const lang = /(?:\?|&)lang=en(?:&|$)/.test(url) ? 'en' : 'de';
      if (['home', 'tests', 'history', 'settings', 'pro'].includes(route)) setScreen(route);
      setLanguage(lang);
      setUnitSystem(lang === 'en' ? 'imperial' : 'metric');
    };
    void Linking.getInitialURL().then(openScreenshotRoute);
    const subscription = Linking.addEventListener('url', ({ url }) => openScreenshotRoute(url));
    return () => subscription.remove();
  }, []);

  const analysis = useMemo(() => analyzeMeasurements(measurements), [measurements]);
  const saveMeasurement = async (measurement: Measurement) => { await database.saveMeasurement(measurement); setMeasurements(await database.listMeasurements()); setScreen('home'); };
  const startTest = () => setScreen(!purchase.isPro && experiments.length >= 1 ? 'settings' : 'newTest');
  const saveExperiment = async (experiment: Experiment) => { await database.saveExperiment(experiment); setExperiments(await database.listExperiments()); setScreen('tests'); };
  const saveProfile = async (next: SystemProfile) => { await database.saveProfile(next); setProfile(next); };

  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><View style={styles.app}>
    <Header language={language} isPro={purchase.isPro} t={t} onStatus={() => setScreen('settings')} />
    <View style={styles.content}>
      {screen === 'home' && <Dashboard t={t} analysis={analysis} ready={isReady} unitSystem={unitSystem} experiment={experiments[0]} latest={measurements[0]} profile={profile} onNew={() => setScreen('entry')} onNewTest={startTest} onAnalysis={() => setScreen('tests')} />}
      {screen === 'tests' && <Analysis t={t} analysis={analysis} experiments={experiments} onNew={startTest} />}
      {screen === 'newTest' && <NewTest t={t} onSave={saveExperiment} onCancel={() => setScreen('tests')} />}
      {screen === 'entry' && <Entry t={t} language={language} unitSystem={unitSystem} onSave={saveMeasurement} />}
      {screen === 'history' && <History t={t} language={language} unitSystem={unitSystem} measurements={measurements} analysis={analysis} />}
      {screen === 'settings' && <Settings t={t} language={language} unitSystem={unitSystem} purchase={purchase} profile={profile} onProfile={saveProfile} onLanguage={setLanguage} onUnitSystem={setUnitSystem} />}
      {screen === 'pro' && <ProReview t={t} language={language} />}
    </View>
    <Navigation screen={screen} setScreen={setScreen} t={t} />
  </View></SafeAreaView>;
}

function Header({ language, isPro, t, onStatus }: { language: Language; isPro: boolean; t: any; onStatus: () => void }) {
  return <View style={styles.header}><View><Text style={styles.brand}>WärmeTakt</Text><Text style={styles.brandLine}>{language === 'de' ? 'KLARER HEIZEN' : 'HEAT SMARTER'}</Text></View><Pressable style={[styles.statusPill, isPro && styles.statusPillPro]} onPress={onStatus}><View style={[styles.statusDot, isPro && styles.statusDotPro]} /><Text style={[styles.statusText, isPro && styles.statusTextPro]}>{isPro ? t.proActiveShort : t.free}</Text></Pressable></View>;
}

function Dashboard({ t, analysis, ready, unitSystem, experiment, latest, profile, onNew, onNewTest, onAnalysis }: any) {
  const temp = (c: number) => unitSystem === 'imperial' ? c * 9 / 5 + 32 : c;
  const currency = Number(String(profile.electricityPrice).replace(',', '.')) || 0;
  const dailyCost = analysis.avgElectricity * currency;
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>{t.systemPulse}</Text><Text style={styles.title}>{t.greeting}</Text><Text style={styles.subtitle}>{t.intro}</Text>
    <View style={styles.heroCard}>
      <View style={styles.heroTop}><View><Text style={styles.heroLabel}>{t.efficiencyChange}</Text><Text style={styles.heroValue}>{ready && analysis.enoughData ? `${analysis.change > 0 ? '+' : ''}${analysis.change}%` : '–'}</Text></View><View style={styles.scoreCircle}><Text style={styles.score}>{analysis.score}</Text><Text style={styles.scoreOf}>/100</Text></View></View>
      <View style={styles.darkDivider} /><Text style={styles.heroText}>{analysis.change > 0 ? t.resultPositive : t.resultWaiting}</Text>
      <View style={styles.qualityRow}><Text style={styles.qualityLabel}>{t.dataQuality}</Text><Text style={styles.qualityValue}>{analysis.dataQuality}%</Text></View><View style={styles.qualityTrack}><View style={[styles.qualityFill, { width: `${analysis.dataQuality}%` }]} /></View>
    </View>
    <View style={styles.kpiGrid}>
      <Kpi icon="⚡" value={analysis.avgElectricity ? `${analysis.avgElectricity} kWh` : '–'} label={t.avgPower} />
      <Kpi icon="♨" value={analysis.cop ? analysis.cop.toFixed(2) : '–'} label={t.cop} />
      <Kpi icon="↻" value={analysis.starts ? String(analysis.starts) : '–'} label={t.avgStarts} />
      <Kpi icon="⌂" value={analysis.comfort ? `${temp(analysis.comfort).toFixed(1)} °${unitSystem === 'imperial' ? 'F' : 'C'}` : '–'} label={t.comfort} />
    </View>
    <View style={styles.costStrip}><View><Text style={styles.costLabel}>{t.estimatedCost}</Text><Text style={styles.costValue}>{dailyCost ? `${dailyCost.toFixed(2).replace('.', languageDecimal(t))} ${unitSystem === 'imperial' ? '$' : '€'}` : '–'}</Text></View><View style={styles.costIcon}><Text style={styles.costIconText}>◎</Text></View></View>
    <SectionTitle title={t.activeTest} action={t.goAnalysis} onPress={onAnalysis} />
    {experiment ? <ExperimentCard t={t} experiment={experiment} change={analysis.change} /> : <Pressable style={styles.emptyCard} onPress={onNewTest}><Text style={styles.emptyTitle}>{t.noActiveTest}</Text><Text style={styles.emptyText}>{t.noActiveTestText}</Text><Text style={styles.link}>{t.startFirstTest} →</Text></Pressable>}
    <SectionTitle title={t.latestReading} />
    <View style={styles.latestCard}>{latest ? <><View><Text style={styles.latestDate}>{formatDate(latest.measuredAt, t)}</Text><Text style={styles.latestMeta}>{latest.phase === 'before' ? t.beforePhase : t.afterPhase} · {latest.outsideC.toFixed(1)} °C außen</Text></View><View style={styles.latestValueWrap}><Text style={styles.latestValue}>{latest.electricityKwh.toFixed(1)}</Text><Text style={styles.latestUnit}>kWh</Text></View></> : <Text style={styles.emptyText}>{t.noCurrentValue}</Text>}</View>
    <Pressable style={styles.primaryButton} onPress={onNew}><Text style={styles.primaryButtonText}>＋  {t.addMeasurement}</Text></Pressable><Text style={styles.disclaimer}>{t.disclaimer}</Text>
  </ScrollView>;
}

function languageDecimal(t: any) { return t.free === 'FREE' && t.analysis === 'Analyse' ? ',' : '.'; }
function formatDate(value: string, t: any) { return new Intl.DateTimeFormat(t.analysis === 'Analyse' ? 'de-DE' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
function Kpi({ icon, value, label }: { icon: string; value: string; label: string }) { return <View style={styles.kpiCard}><Text style={styles.kpiIcon}>{icon}</Text><Text style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>; }
function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress}><Text style={styles.link}>{action} →</Text></Pressable>}</View>; }

function ExperimentCard({ t, experiment, change }: { t: any; experiment: Experiment; change: number }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(experiment.startedAt).getTime()) / 86400000));
  const progress = Math.min(100, Math.max(8, elapsed / experiment.durationDays * 100));
  return <View style={styles.testCard}><View style={styles.testIcon}><Text style={styles.testIconText}>↘</Text></View><View style={styles.testContent}><View style={styles.cardTop}><Text style={styles.testTitle}>{t.settingNames[experiment.setting] ?? experiment.setting}</Text><Text style={styles.badge}>{experiment.status === 'active' ? t.inProgress : t.completed}</Text></View><Text style={styles.testMeta}>{experiment.previousValue} → {experiment.newValue} {experiment.unit} · {elapsed}/{experiment.durationDays} {t.days}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.testHint}>{change ? `${change > 0 ? '+' : ''}${change}% · ${t.weatherAdjusted}` : t.weatherAdjusted}</Text></View></View>;
}

function Analysis({ t, analysis, experiments, onNew }: any) {
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><Text style={styles.eyebrow}>{t.analysis}</Text><Text style={styles.title}>{t.recommendations}</Text><Text style={styles.subtitle}>{t.recommendationsIntro}</Text>
    <View style={styles.techGrid}><TechMetric value={analysis.deltaT ? `${analysis.deltaT} K` : '–'} label={t.flowSpread} /><TechMetric value={analysis.runtimePerStart ? `${analysis.runtimePerStart} min` : '–'} label={t.runtimeStart} /><TechMetric value={analysis.avgFlow ? `${analysis.avgFlow} °C` : '–'} label={t.flowTemp} /></View>
    {analysis.insights.map((key: InsightKey, index: number) => <View key={key} style={[styles.insightCard, index === 0 && styles.insightCardLead]}><View style={[styles.insightIcon, index === 0 && styles.insightIconLead]}><Text style={styles.insightIconText}>{key === 'collectData' ? 'i' : key.includes('Risk') || key === 'lowCop' ? '!' : '✓'}</Text></View><View style={styles.insightContent}><Text style={styles.insightTitle}>{t.insightTitles[key]}</Text><Text style={styles.insightText}>{t.insightTexts[key]}</Text></View></View>)}
    <SectionTitle title={t.testsAndChanges} />
    {experiments.length ? experiments.map((experiment: Experiment) => <ExperimentCard key={experiment.id} t={t} experiment={experiment} change={analysis.change} />) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{t.noTests}</Text><Text style={styles.emptyText}>{t.noTestsText}</Text></View>}
    <Pressable style={styles.primaryButton} onPress={onNew}><Text style={styles.primaryButtonText}>＋  {t.newTest}</Text></Pressable>
  </ScrollView>;
}

function History({ t, language, unitSystem, measurements, analysis }: { t: any; language: Language; unitSystem: UnitSystem; measurements: Measurement[]; analysis: ReturnType<typeof analyzeMeasurements> }) {
  const temp = (c: number) => unitSystem === 'imperial' ? c * 9 / 5 + 32 : c;
  const unit = unitSystem === 'imperial' ? '°F' : '°C';
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><Text style={styles.eyebrow}>{t.history}</Text><Text style={styles.title}>{t.allReadings}</Text><Text style={styles.subtitle}>{t.readingsIntro}</Text>
    <View style={styles.historySummary}><TechMetric value={String(measurements.length)} label={t.dailyValues} /><TechMetric value={String(analysis.beforeCount)} label={t.beforePhase} /><TechMetric value={String(analysis.afterCount)} label={t.afterPhase} /></View>
    {measurements.length ? measurements.map((item) => <View style={styles.historyCard} key={item.id}><View style={styles.historyTop}><View><Text style={styles.historyDate}>{new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(item.measuredAt))}</Text><Text style={[styles.phaseBadge, item.phase === 'before' && styles.phaseBadgeBefore]}>{item.phase === 'before' ? t.beforePhase : t.afterPhase}</Text></View><Text style={styles.historyPower}>{item.electricityKwh.toFixed(1)} <Text style={styles.historyPowerUnit}>kWh</Text></Text></View><View style={styles.historyMetrics}><HistoryMetric value={item.heatKwh.toFixed(1)} label={t.generatedHeat} /><HistoryMetric value={`${temp(item.outsideC).toFixed(1)} ${unit}`} label={t.outsideTemp} /><HistoryMetric value={String(item.compressorStarts)} label={t.compressorStarts} /></View></View>) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{t.noReadings}</Text></View>}
  </ScrollView>;
}

function TechMetric({ value, label }: { value: string; label: string }) { return <View style={styles.techMetric}><Text style={styles.techValue}>{value}</Text><Text style={styles.techLabel}>{label}</Text></View>; }
function HistoryMetric({ value, label }: { value: string; label: string }) { return <View style={styles.historyMetric}><Text style={styles.historyMetricValue}>{value}</Text><Text numberOfLines={1} style={styles.historyMetricLabel}>{label}</Text></View>; }

function NewTest({ t, onSave, onCancel }: { t: any; onSave: (experiment: Experiment) => void; onCancel: () => void }) {
  const [step, setStep] = useState(1), [setting, setSetting] = useState('heatingCurve'), [previousValue, setPreviousValue] = useState('0.6'), [newValue, setNewValue] = useState('0.5'), [durationDays, setDurationDays] = useState(7), [confirmed, setConfirmed] = useState(false);
  const settings = ['heatingCurve', 'flowTemperature', 'hotWater', 'hysteresis', 'roomTarget', 'other'];
  const units: Record<string, string> = { heatingCurve: '', flowTemperature: '°C', hotWater: '°C', hysteresis: 'K', roomTarget: '°C', other: '' };
  const next = () => { if (step < 3) setStep(step + 1); else if (confirmed) onSave({ id: String(Date.now()), setting, previousValue, newValue, unit: units[setting], durationDays, startedAt: new Date().toISOString(), status: 'active' }); };
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.wizardTop}><Pressable onPress={onCancel}><Text style={styles.link}>‹ {t.cancel}</Text></Pressable><Text style={styles.stepLabel}>{t.step} {step}/3</Text></View><Text style={styles.eyebrow}>{t.newExperiment}</Text><Text style={styles.title}>{step === 1 ? t.chooseSetting : step === 2 ? t.enterChange : t.checkAndStart}</Text><Text style={styles.subtitle}>{step === 1 ? t.chooseSettingText : step === 2 ? t.enterChangeText : t.checkText}</Text>
    {step === 1 && settings.map((item) => <Pressable key={item} style={[styles.optionCard, setting === item && styles.optionActive]} onPress={() => setSetting(item)}><View style={[styles.radio, setting === item && styles.radioActive]} /><Text style={[styles.optionText, setting === item && styles.optionTextActive]}>{t.settingNames[item]}</Text></Pressable>)}
    {step === 2 && <><View style={styles.formCard}><Field label={t.previousValue} unit={units[setting]} value={previousValue} onChange={setPreviousValue} /><Field label={t.newValue} unit={units[setting]} value={newValue} onChange={setNewValue} /><Text style={styles.fieldLabel}>{t.testDuration}</Text><Segment options={[{ value: 7, label: `7 ${t.days}` }, { value: 14, label: `14 ${t.days}` }]} value={durationDays} onChange={setDurationDays} /></View><View style={styles.infoCard}><Text style={styles.infoTitle}>ⓘ {t.oneChangeOnly}</Text><Text style={styles.infoText}>{t.oneChangeOnlyText}</Text></View></>}
    {step === 3 && <><View style={styles.summaryCard}><SummaryRow label={t.setting} value={t.settingNames[setting]} /><SummaryRow label={t.change} value={`${previousValue} → ${newValue} ${units[setting]}`} /><SummaryRow label={t.testDuration} value={`${durationDays} ${t.days}`} /></View><Pressable style={[styles.confirmCard, confirmed && styles.confirmActive]} onPress={() => setConfirmed(!confirmed)}><View style={[styles.checkbox, confirmed && styles.checkboxActive]}><Text style={styles.checkmark}>{confirmed ? '✓' : ''}</Text></View><Text style={styles.confirmText}>{t.safetyConfirm}</Text></Pressable></>}
    <View style={styles.wizardActions}>{step > 1 && <Pressable style={styles.secondaryButton} onPress={() => setStep(step - 1)}><Text style={styles.secondaryButtonText}>{t.back}</Text></Pressable>}<Pressable style={[styles.primaryButton, styles.wizardPrimary, step === 3 && !confirmed && styles.disabledButton]} disabled={step === 3 && !confirmed} onPress={next}><Text style={styles.primaryButtonText}>{step === 3 ? t.startTest : t.continue}</Text></Pressable></View>
  </ScrollView></KeyboardAvoidingView>;
}

function Entry({ t, language, unitSystem, onSave }: { t: any; language: Language; unitSystem: UnitSystem; onSave: (m: Measurement) => void }) {
  const [phase, setPhase] = useState<'before' | 'after'>('after');
  const [electricity, setElectricity] = useState('5.1'), [heat, setHeat] = useState('18.4'), [outside, setOutside] = useState(unitSystem === 'imperial' ? '39.6' : '4.2'), [room, setRoom] = useState(unitSystem === 'imperial' ? '69.8' : '21.0'), [starts, setStarts] = useState('8');
  const [flow, setFlow] = useState(unitSystem === 'imperial' ? '95' : '35'), [returnTemp, setReturnTemp] = useState(unitSystem === 'imperial' ? '84' : '29'), [runtime, setRuntime] = useState('6.2'), [hotWater, setHotWater] = useState('3.0');
  const number = (value: string) => Number(value.replace(',', '.')) || 0;
  const toCelsius = (value: number) => unitSystem === 'imperial' ? (value - 32) * 5 / 9 : value;
  const submit = () => onSave({ id: String(Date.now()), measuredAt: new Date().toISOString(), phase, electricityKwh: number(electricity), heatKwh: number(heat), outsideC: toCelsius(number(outside)), roomC: toCelsius(number(room)), compressorStarts: number(starts), flowC: toCelsius(number(flow)), returnC: toCelsius(number(returnTemp)), compressorHours: number(runtime), hotWaterKwh: number(hotWater) });
  const tempUnit = unitSystem === 'imperial' ? '°F' : '°C';
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>{t.dailyValues}</Text><Text style={styles.title}>{t.entryTitle}</Text><Text style={styles.subtitle}>{t.entryIntro}</Text>
    <View style={styles.phaseCard}><Text style={styles.fieldLabel}>{t.measurementPhase}</Text><Segment options={[{ value: 'before', label: t.beforePhase }, { value: 'after', label: t.afterPhase }]} value={phase} onChange={setPhase} /></View>
    <View style={styles.formCard}><Field label={t.electricity} unit="kWh" value={electricity} onChange={setElectricity} /><Field label={t.generatedHeat} unit="kWh" value={heat} onChange={setHeat} /><Field label={t.outsideTemp} unit={tempUnit} value={outside} onChange={setOutside} /><Field label={t.roomTemp} unit={tempUnit} value={room} onChange={setRoom} /><Field label={t.compressorStarts} unit={t.count} value={starts} onChange={setStarts} /></View>
    <Text style={styles.formSectionTitle}>{t.advancedValues}</Text><View style={styles.formCard}><Field label={t.flowTemp} unit={tempUnit} value={flow} onChange={setFlow} /><Field label={t.returnTemp} unit={tempUnit} value={returnTemp} onChange={setReturnTemp} /><Field label={t.compressorHours} unit={t.hours} value={runtime} onChange={setRuntime} /><Field label={t.hotWaterHeat} unit="kWh" value={hotWater} onChange={setHotWater} /></View>
    <Pressable style={styles.primaryButton} onPress={submit}><Text style={styles.primaryButtonText}>{t.saveAndAnalyze}</Text></Pressable><Text style={styles.formHint}>{t.localStorage}</Text>
  </ScrollView></KeyboardAvoidingView>;
}

function Settings({ t, language, unitSystem, purchase, profile, onProfile, onLanguage, onUnitSystem }: { t: any; language: Language; unitSystem: UnitSystem; purchase: ReturnType<typeof useProPurchase>; profile: SystemProfile; onProfile: (p: SystemProfile) => Promise<void>; onLanguage: (l: Language) => void; onUnitSystem: (u: UnitSystem) => void }) {
  const [draft, setDraft] = useState(profile), [saved, setSaved] = useState(false);
  useEffect(() => setDraft(profile), [profile]);
  const update = (key: keyof SystemProfile, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => { await onProfile(draft); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const price = purchase.price ?? (language === 'de' ? '39,99 €' : '$39.99');
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><Text style={styles.eyebrow}>{t.settings}</Text><Text style={styles.title}>{t.profile}</Text><Text style={styles.subtitle}>{t.profileIntro}</Text>
    <View style={styles.formCard}><TextField label={t.manufacturer} value={draft.manufacturer} onChange={(v: string) => update('manufacturer', v)} /><TextField label={t.model} value={draft.model} onChange={(v: string) => update('model', v)} /><Field label={t.buildingArea} unit="m²" value={draft.buildingArea} onChange={(v: string) => update('buildingArea', v)} /><Field label={t.constructionYear} unit="" value={draft.constructionYear} onChange={(v: string) => update('constructionYear', v)} /><Text style={styles.fieldLabel}>{t.distribution}</Text><Segment options={[{ value: 'floor', label: t.floor }, { value: 'radiators', label: t.radiators }, { value: 'mixed', label: t.mixed }]} value={draft.heatDistribution} onChange={(v: any) => update('heatDistribution', v)} /><View style={styles.fieldGap} /><Field label={t.electricityPrice} unit={language === 'de' ? '€/kWh' : '$/kWh'} value={draft.electricityPrice} onChange={(v: string) => update('electricityPrice', v)} /></View>
    <Pressable style={styles.secondaryGreenButton} onPress={save}><Text style={styles.secondaryGreenText}>{saved ? `✓ ${t.saved}` : t.saveProfile}</Text></Pressable>
    <View style={styles.settingsCard}><Text style={styles.fieldLabel}>{t.language}</Text><Segment options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} value={language} onChange={onLanguage} /><View style={styles.fieldGap} /><Text style={styles.fieldLabel}>{t.unitSystem}</Text><Segment options={[{ value: 'metric', label: t.celsius }, { value: 'imperial', label: t.fahrenheit }]} value={unitSystem} onChange={onUnitSystem} /></View>
    <View style={styles.proCard}><Text style={styles.proCardEyebrow}>WÄRMETAKT PRO</Text><Text style={styles.proCardTitle}>{purchase.isPro ? t.proActive : t.unlockTitle}</Text><Text style={styles.proCardText}>{purchase.isPro ? t.proActiveText : t.unlockText}</Text>{!purchase.isPro && <><Text style={styles.price}>{price} <Text style={styles.once}>{t.once}</Text></Text><Pressable style={[styles.proButton, !purchase.connected && styles.disabledButton]} disabled={!purchase.connected} onPress={() => void purchase.buy()}><Text style={styles.proButtonText}>{purchase.connected ? t.unlock : t.storeConnecting}</Text></Pressable><Pressable onPress={() => void purchase.restore()}><Text style={styles.restore}>{t.restore}</Text></Pressable></>}{purchase.message && <Text style={styles.purchaseError}>{purchase.message === 'NO_PURCHASE_FOUND' ? t.noPurchaseFound : purchase.message}</Text>}</View>
    <Text style={styles.version}>WärmeTakt 1.0.0 · Kamilunavo</Text>
  </ScrollView>;
}

function ProReview({ t, language }: { t: any; language: Language }) {
  const price = language === 'de' ? '39,99 €' : '$39.99';
  const benefits = language === 'de'
    ? ['Unbegrenzte Optimierungstests', 'Wetterbereinigte Vorher-/Nachher-Analyse', 'Detaillierte Anlagenwerte & Empfehlungen', 'Einmal kaufen – dauerhaft nutzen']
    : ['Unlimited optimization tests', 'Weather-adjusted before/after analysis', 'Detailed system metrics & recommendations', 'One purchase — lifetime access'];
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>WÄRMETAKT PRO</Text><Text style={styles.title}>{t.unlockTitle}</Text><Text style={styles.subtitle}>{t.unlockText}</Text>
    <View style={styles.proCard}><Text style={styles.proCardEyebrow}>PRO LIFETIME</Text><Text style={styles.proCardTitle}>{language === 'de' ? 'Mehr verstehen. Besser einstellen.' : 'Understand more. Tune smarter.'}</Text>
      {benefits.map((benefit) => <View key={benefit} style={styles.proBenefit}><View style={styles.proBenefitDot}><Text style={styles.proBenefitCheck}>✓</Text></View><Text style={styles.proBenefitText}>{benefit}</Text></View>)}
      <Text style={styles.price}>{price} <Text style={styles.once}>{t.once}</Text></Text><Pressable style={styles.proButton}><Text style={styles.proButtonText}>{t.unlock}</Text></Pressable><Text style={styles.restore}>{t.restore}</Text>
    </View><Text style={styles.disclaimer}>{t.disclaimer}</Text>
  </ScrollView>;
}

function Field({ label, unit, value, onChange }: any) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}><TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0.0" accessibilityLabel={label} /><Text style={styles.unit}>{unit}</Text></View></View>; }
function TextField({ label, value, onChange }: any) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}><TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="words" accessibilityLabel={label} /></View></View>; }
function Segment<T extends string | number>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) { return <View style={styles.segment}>{options.map((option) => <Pressable key={String(option.value)} style={[styles.segmentItem, value === option.value && styles.segmentActive]} onPress={() => onChange(option.value)}><Text numberOfLines={2} style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }

function Navigation({ screen, setScreen, t }: { screen: Screen; setScreen: (s: Screen) => void; t: any }) {
  const items: Array<{ key: Screen; icon: string; label: string }> = [
    { key: 'home', icon: '⌂', label: t.home }, { key: 'tests', icon: '◉', label: t.analysis },
    { key: 'entry', icon: '＋', label: t.entry }, { key: 'history', icon: '▥', label: t.history },
    { key: 'settings', icon: '⚙', label: t.settings },
  ];
  return <View style={styles.nav}>{items.map((item) => <Pressable key={item.key} style={styles.navItem} onPress={() => setScreen(item.key)}><Text style={[styles.navIcon, screen === item.key && styles.navActive]}>{item.icon}</Text><Text style={[styles.navLabel, screen === item.key && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.night }, app: { flex: 1, backgroundColor: colors.cream }, content: { flex: 1 },
  header: { height: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.night, borderBottomWidth: 1, borderBottomColor: colors.forest },
  brand: { color: colors.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.8 }, brandLine: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 1 },
  statusPill: { backgroundColor: colors.forest, borderRadius: 18, borderWidth: 1, borderColor: '#2A5B50', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusPillPro: { backgroundColor: colors.lime, borderColor: colors.lime }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sage }, statusDotPro: { backgroundColor: colors.night }, statusText: { color: colors.mist, fontWeight: '800', fontSize: 10, letterSpacing: 0.8 }, statusTextPro: { color: colors.night },
  scroll: { padding: 20, paddingBottom: 42 }, eyebrow: { color: colors.teal, fontWeight: '900', fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 3 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 7 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 18 },
  heroCard: { backgroundColor: colors.night, borderRadius: 25, padding: 20, shadowColor: colors.night, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroLabel: { color: colors.sage, fontSize: 11, fontWeight: '700' }, heroValue: { color: colors.lime, fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 2 },
  scoreCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 5, borderColor: colors.leaf, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, score: { color: colors.white, fontWeight: '900', fontSize: 20 }, scoreOf: { color: colors.sage, fontSize: 9, marginTop: 7 },
  darkDivider: { height: 1, backgroundColor: colors.forest, marginVertical: 15 }, heroText: { color: colors.mist, fontSize: 13, lineHeight: 19 }, qualityRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 17 }, qualityLabel: { color: colors.sage, fontSize: 10, fontWeight: '700' }, qualityValue: { color: colors.lime, fontSize: 10, fontWeight: '900' },
  qualityTrack: { height: 6, backgroundColor: colors.forest, borderRadius: 4, marginTop: 7 }, qualityFill: { height: 6, backgroundColor: colors.lime, borderRadius: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, kpiCard: { width: '48.5%', minHeight: 108, backgroundColor: colors.surface, borderRadius: 19, padding: 15, borderWidth: 1, borderColor: colors.sage },
  kpiIcon: { color: colors.teal, fontSize: 18 }, kpiValue: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 8 }, kpiLabel: { color: colors.muted, fontSize: 10, marginTop: 3, fontWeight: '700' },
  costStrip: { backgroundColor: colors.pine, borderRadius: 18, padding: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, costLabel: { color: colors.sage, fontSize: 10, fontWeight: '700' }, costValue: { color: colors.white, fontSize: 21, fontWeight: '900', marginTop: 4 }, costIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }, costIconText: { color: colors.white, fontSize: 21 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 }, sectionTitle: { color: colors.ink, fontWeight: '900', fontSize: 17 }, link: { color: colors.teal, fontWeight: '800', fontSize: 11 },
  testCard: { backgroundColor: colors.mist, borderRadius: 19, padding: 15, flexDirection: 'row', borderWidth: 1, borderColor: colors.sage, marginBottom: 10 }, testIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal }, testIconText: { color: colors.lime, fontSize: 23, fontWeight: '900' }, testContent: { flex: 1, marginLeft: 13 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, testTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', flex: 1 }, testMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, progressTrack: { height: 6, borderRadius: 4, backgroundColor: colors.sage, marginTop: 11 }, progressFill: { height: 6, borderRadius: 4, backgroundColor: colors.teal }, testHint: { color: colors.muted, fontSize: 9, marginTop: 6 },
  badge: { color: colors.pine, backgroundColor: colors.lime, fontSize: 8, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  emptyCard: { backgroundColor: colors.pale, borderRadius: 18, padding: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.teal, marginBottom: 10 }, emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginVertical: 7 },
  latestCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.sage, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, latestDate: { color: colors.ink, fontWeight: '900', fontSize: 14 }, latestMeta: { color: colors.muted, fontSize: 10, marginTop: 4 }, latestValueWrap: { alignItems: 'flex-end' }, latestValue: { color: colors.teal, fontSize: 24, fontWeight: '900' }, latestUnit: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.teal, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 17, paddingHorizontal: 15, shadowColor: colors.teal, shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 5 } }, primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' }, disclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 13, paddingHorizontal: 9 },
  techGrid: { backgroundColor: colors.forest, borderRadius: 20, flexDirection: 'row', padding: 15, marginBottom: 12 }, techMetric: { flex: 1, alignItems: 'center', paddingHorizontal: 4 }, techValue: { color: colors.lime, fontSize: 17, fontWeight: '900' }, techLabel: { color: colors.sage, fontSize: 9, textAlign: 'center', marginTop: 4 },
  insightCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 15, flexDirection: 'row', marginBottom: 9, borderWidth: 1, borderColor: colors.sage }, insightCardLead: { backgroundColor: colors.pale, borderColor: colors.teal }, insightIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }, insightIconLead: { backgroundColor: colors.pine }, insightIconText: { color: colors.lime, fontSize: 15, fontWeight: '900' }, insightContent: { flex: 1, marginLeft: 12 }, insightTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, insightText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  historySummary: { backgroundColor: colors.forest, borderRadius: 20, flexDirection: 'row', padding: 15, marginBottom: 13 }, historyCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.sage, marginBottom: 9 }, historyTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, historyDate: { color: colors.ink, fontSize: 14, fontWeight: '900' }, phaseBadge: { color: colors.pine, backgroundColor: colors.lime, alignSelf: 'flex-start', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '900', marginTop: 5 }, phaseBadgeBefore: { backgroundColor: colors.sage }, historyPower: { color: colors.teal, fontSize: 22, fontWeight: '900' }, historyPowerUnit: { color: colors.muted, fontSize: 9 }, historyMetrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 13, paddingTop: 12 }, historyMetric: { flex: 1 }, historyMetricValue: { color: colors.ink, fontSize: 12, fontWeight: '900' }, historyMetricLabel: { color: colors.muted, fontSize: 8, marginTop: 3 },
  phaseCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: colors.sage }, formSectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 20, marginBottom: 9 },
  formCard: { backgroundColor: colors.surface, borderRadius: 21, padding: 17, borderWidth: 1, borderColor: colors.sage }, field: { marginBottom: 15 }, fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }, inputWrap: { minHeight: 49, borderWidth: 1, borderColor: colors.line, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pale }, input: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800', paddingHorizontal: 13, height: 49 }, unit: { color: colors.muted, fontSize: 11, fontWeight: '800', paddingRight: 13 }, formHint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 11 },
  segment: { flexDirection: 'row', backgroundColor: colors.sage, padding: 4, borderRadius: 13 }, segmentItem: { flex: 1, minHeight: 39, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, segmentActive: { backgroundColor: colors.pine }, segmentText: { color: colors.muted, fontWeight: '800', fontSize: 10, textAlign: 'center' }, segmentTextActive: { color: colors.white }, fieldGap: { height: 17 },
  settingsCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 17, borderWidth: 1, borderColor: colors.sage, marginTop: 17 }, secondaryGreenButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: colors.pale }, secondaryGreenText: { color: colors.teal, fontWeight: '900', fontSize: 13 },
  proCard: { backgroundColor: colors.night, borderRadius: 24, padding: 21, marginTop: 17 }, proCardEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 }, proCardTitle: { color: colors.white, fontSize: 23, fontWeight: '900', marginTop: 8 }, proCardText: { color: colors.sage, fontSize: 12, lineHeight: 19, marginTop: 7 },
  proBenefit: { flexDirection: 'row', alignItems: 'center', marginTop: 15 }, proBenefitDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, proBenefitCheck: { color: colors.lime, fontSize: 12, fontWeight: '900' }, proBenefitText: { color: colors.mist, fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  price: { color: colors.white, fontSize: 26, fontWeight: '900', marginTop: 17 }, once: { color: colors.sage, fontSize: 11, fontWeight: '500' }, proButton: { backgroundColor: colors.lime, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 14 }, proButtonText: { color: colors.night, fontWeight: '900' }, restore: { color: colors.sage, textAlign: 'center', fontSize: 10, marginTop: 12 }, purchaseError: { color: '#FFB7A8', textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 9 }, version: { color: colors.muted, textAlign: 'center', fontSize: 9, marginTop: 17 },
  wizardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }, stepLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, optionCard: { minHeight: 55, borderRadius: 15, borderWidth: 1, borderColor: colors.sage, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, optionActive: { borderColor: colors.teal, backgroundColor: colors.mist }, optionText: { color: colors.ink, fontSize: 13, fontWeight: '800', flex: 1 }, optionTextActive: { color: colors.pine }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.teal, marginRight: 11 }, radioActive: { borderWidth: 5, borderColor: colors.teal },
  infoCard: { backgroundColor: colors.mist, borderRadius: 15, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.sage }, infoTitle: { color: colors.pine, fontSize: 12, fontWeight: '900' }, infoText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }, summaryCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.sage, paddingHorizontal: 16 }, summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, summaryLabel: { color: colors.muted, fontSize: 11 }, summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '900', maxWidth: '62%', textAlign: 'right' },
  confirmCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.sage, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginTop: 13 }, confirmActive: { borderColor: colors.teal, backgroundColor: colors.mist }, checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 2, borderColor: colors.teal, marginRight: 10, alignItems: 'center', justifyContent: 'center' }, checkboxActive: { backgroundColor: colors.teal }, checkmark: { color: colors.white, fontWeight: '900' }, confirmText: { color: colors.ink, fontSize: 11, lineHeight: 17, flex: 1 }, wizardActions: { flexDirection: 'row', gap: 9, marginTop: 1 }, wizardPrimary: { flex: 1 }, secondaryButton: { flex: 0.65, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 17, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.pale }, secondaryButtonText: { color: colors.teal, fontSize: 13, fontWeight: '900' }, disabledButton: { opacity: 0.5 },
  nav: { height: 72, paddingBottom: 5, flexDirection: 'row', backgroundColor: colors.night, borderTopWidth: 1, borderTopColor: colors.forest }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIcon: { color: '#78A499', fontSize: 20, height: 25 }, navLabel: { color: '#78A499', fontSize: 8, fontWeight: '800' }, navActive: { color: colors.lime },
});
