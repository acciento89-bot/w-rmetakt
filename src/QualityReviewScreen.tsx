import { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Experiment, Measurement } from './database';
import { database } from './database';
import { assessQualityReview, defaultQualityReview, validateQualityReview } from './experimentQuality';
import type { QualityCohort, QualityReview } from './experimentQuality';
import { qualityStrings } from './i18n';
import type { Language } from './i18n';

type Props = { experiment: Experiment; measurements: Measurement[]; language: Language; unitSystem: 'metric' | 'imperial'; keyboardOffset: number; onBack: () => void };
type DateKey = 'beforeStart' | 'beforeEnd' | 'afterStart' | 'afterEnd';
export function QualityReviewScreen({ experiment, measurements, language, unitSystem, keyboardOffset, onBack }: Props) {
  const t = qualityStrings[language];
  const [draft, setDraft] = useState<QualityReview | null>(null);
  const [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false), [saveFailed, setSaveFailed] = useState(false), [saved, setSaved] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadFailed(false); setDraft(null); setSaved(false); setSaveFailed(false);
    database.loadQualityReview(experiment.id).then((stored) => {
      const next = stored ?? defaultQualityReview(experiment);
      if (active) setDraft(next);
    }).catch(() => { if (active) setLoadFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [experiment.id, attempt]);
  const assessment = useMemo(() => {
    if (!draft) return null;
    try { return assessQualityReview(measurements, validateQualityReview(draft, experiment.id)); } catch { return null; }
  }, [draft, experiment.id, measurements]);
  const update = (next: QualityReview) => { setDraft(next); setSaved(false); setSaveFailed(false); };
  const save = async () => {
    if (!draft || !assessment || saving || loadFailed) return;
    setSaving(true); setSaveFailed(false); setSaved(false);
    try { await database.saveQualityReview(validateQualityReview(draft, experiment.id)); setSaved(true); Keyboard.dismiss(); }
    catch { setSaveFailed(true); }
    finally { setSaving(false); }
  };
  const number = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits).replace('.', language === 'de' ? ',' : '.') : t.badValue;
  const temp = (value: number) => `${number(unitSystem === 'imperial' ? value * 9 / 5 + 32 : value)} °${unitSystem === 'imperial' ? 'F' : 'C'}`;
  const diff = (value: number | null) => value === null ? '—' : `${number(unitSystem === 'imperial' ? value * 9 / 5 : value)} ${unitSystem === 'imperial' ? '°F' : '°C'}`;
  const phase = (value: 'before' | 'after') => value === 'before' ? t.before : t.after;
  const action = (label: string, onPress: () => void, disabled = false, primary = false, id?: string) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} testID={id} onPress={onPress} disabled={disabled} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text></Pressable>;
  const summary = (title: string, value: QualityCohort) => <View style={s.card}><Text style={s.section}>{title}</Text><Text style={s.result}>{value.change === null ? t.unavailable : `${value.change > 0 ? '+' : ''}${number(value.change, 0)}%`}</Text><Text style={s.body}>{t.count}: {t.before} {value.beforeCount} / {value.beforeDays} · {t.after} {value.afterCount} / {value.afterDays}</Text><Text style={s.body}>{t.normalized}: {value.beforeNormalizedMean === null ? '—' : number(value.beforeNormalizedMean, 3)} → {value.afterNormalizedMean === null ? '—' : number(value.afterNormalizedMean, 3)}</Text></View>;
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={keyboardOffset}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.scroll} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      {action(t.back, onBack, saving, false, 'quality-back')}
      <Text style={s.title}>{t.title}</Text><Text style={s.body}>{experiment.previousValue} → {experiment.newValue} {experiment.unit}</Text><Text style={s.body}>{t.intro}</Text>
      {loading && <Text accessibilityRole="text" style={s.body}>{t.loading}</Text>}
      {loadFailed && <View style={s.warning}><Text accessibilityRole="alert" style={s.body}>{t.loadError}</Text>{action(t.retry, () => setAttempt((value) => value + 1), false, false, 'quality-retry')}</View>}
      {draft && <>
        <View style={s.card}><Text style={s.section}>{t.calendar}</Text><View style={[s.fields, contentWidth >= 560 && s.wideFields]}>{(['beforeStart', 'beforeEnd', 'afterStart', 'afterEnd'] as DateKey[]).map((key) => <View key={key} style={[s.field, contentWidth >= 560 && s.wideField]}><Text style={s.label}>{t[key]}</Text><TextInput accessibilityLabel={t[key]} testID={`quality-${key}`} value={draft[key]} editable={!saving} onChangeText={(value) => update({ ...draft, [key]: value })} style={s.input} autoCapitalize="none" autoCorrect={false} placeholder="2026-10-01" maxLength={10} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} /></View>)}</View></View>
        {!assessment && <Text accessibilityRole="alert" style={s.error}>{t.invalid}</Text>}
        {!!draft.exclusions.length && <View style={s.card}><Text style={s.section}>{t.decisions}</Text><Text style={s.body}>{t.decisionHelp}</Text>{draft.exclusions.map((item, index) => <View key={`${item.phase}:${item.date}`} style={s.decision}><Text style={s.label}>{phase(item.phase)} · {item.date}</Text><Text style={s.body}>{t.retained}</Text><Text style={s.label}>{t.reason}</Text><TextInput accessibilityLabel={`${t.reason} ${item.date}`} testID={`quality-reason-${item.phase}-${item.date}`} multiline value={item.reason} editable={!saving} maxLength={500} onChangeText={(reason) => update({ ...draft, exclusions: draft.exclusions.map((entry, entryIndex) => entryIndex === index ? { ...entry, reason } : entry) })} style={[s.input, s.reason]} />{action(`${t.include}: ${item.date}`, () => update({ ...draft, exclusions: draft.exclusions.filter((_, entryIndex) => entryIndex !== index) }), saving, false, `quality-include-${item.phase}-${item.date}`)}</View>)}</View>}
        {assessment && <>
          <Text style={s.status}>{assessment.status === 'insufficient' ? t.insufficient : assessment.status === 'review' ? t.review : t.ready}</Text>
          {summary(t.all, assessment.all)}{summary(t.reviewed, assessment.reviewed)}
          <View style={s.card}><Text style={s.section}>{t.sensitivity}</Text><Text style={s.result}>{assessment.sensitivityPoints === null ? '—' : `${assessment.sensitivityPoints > 0 ? '+' : ''}${number(assessment.sensitivityPoints, 0)} ${t.points}`}</Text><Text style={s.body}>{t.method}</Text></View>
          <View style={s.card}><Text style={s.section}>{t.review}</Text><Text style={s.body}>{t.missing}: {t.before} {assessment.missingDates.before.join(', ') || t.none} · {t.after} {assessment.missingDates.after.join(', ') || t.none}</Text><Text style={s.body}>{t.duplicate}: {t.before} {assessment.duplicateDates.before.join(', ') || t.none} · {t.after} {assessment.duplicateDates.after.join(', ') || t.none}</Text><Text style={s.body}>{t.invalidReadings}: {assessment.invalidIds.length}</Text><Text style={s.body}>{t.outside}: {assessment.outsideSelectionCount}</Text><Text style={s.label}>{t.differences}</Text><Text style={s.body}>{t.outdoor}: {diff(assessment.comparability.outsideDifferenceC)} · {t.room}: {diff(assessment.comparability.roomDifferenceC)}</Text><Text style={s.body}>{t.comparability}</Text><Text style={s.body}>{t.heuristic}</Text></View>
          <Text style={s.section}>{t.days}</Text>
          {assessment.days.map((day) => <View key={`${day.phase}:${day.date}`} style={[s.card, day.excluded && s.excluded]}><Text style={s.section}>{phase(day.phase)} · {day.date}</Text>{day.excluded && <Text style={s.status}>{t.excluded}</Text>}{!day.measurements.length && <Text style={s.body}>{t.empty}</Text>}{day.measurements.map((row, index) => <View key={`${row.id}:${index}`} style={s.reading}><Text style={s.body}>{row.measuredAt}</Text>{assessment.unusualIds.includes(row.id) && <Text style={s.error}>{t.unusual}</Text>}{assessment.invalidIds.includes(row.id) && <Text style={s.error}>{t.invalidReadings}</Text>}<Text selectable style={s.body}>{t.power}: {number(row.electricityKwh)} kWh · {t.heat}: {number(row.heatKwh)} kWh</Text><Text style={s.body}>{t.outdoor}: {temp(row.outsideC)} · {t.room}: {temp(row.roomC)}</Text><Text style={s.body}>{t.starts}: {number(row.compressorStarts, 0)} · {t.hours}: {number(row.compressorHours)} h</Text><Text style={s.body}>{t.flow}: {temp(row.flowC)} · {t.return}: {temp(row.returnC)}</Text><Text style={s.body}>{t.hotWater}: {number(row.hotWaterKwh)} kWh</Text></View>)}{!day.excluded && action(`${t.exclude}: ${day.date}`, () => update({ ...draft, exclusions: [...draft.exclusions, { phase: day.phase, date: day.date, reason: '' }] }), saving, false, `quality-exclude-${day.phase}-${day.date}`)}</View>)}
        </>}
        {saveFailed && <Text accessibilityRole="alert" style={s.error}>{t.saveError}</Text>}{saved && <Text accessibilityRole="text" testID="quality-saved" style={s.status}>{t.saved}</Text>}
        {action(t.done, Keyboard.dismiss, false, false, 'quality-keyboard-done')}
        {action(saving ? t.saving : t.save, () => { void save(); }, !assessment || saving || loading || loadFailed, true, 'quality-save')}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, scroll: { padding: 20, paddingBottom: 40, gap: 14 }, title: { fontSize: 28, fontWeight: '800', color: '#102C28' },
  section: { fontSize: 18, fontWeight: '700', color: '#102C28', flexShrink: 1 }, body: { fontSize: 15, lineHeight: 22, color: '#36584F', flexShrink: 1 },
  label: { fontSize: 14, fontWeight: '700', color: '#102C28', marginTop: 6 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A9CDBB', padding: 16, borderRadius: 18, gap: 10 },
  fields: { gap: 14 }, wideFields: { flexDirection: 'row', flexWrap: 'wrap' }, field: { gap: 6 }, wideField: { width: '47%', flexGrow: 1 },
  input: { borderWidth: 1, borderColor: '#547068', borderRadius: 10, minHeight: 48, padding: 12, fontSize: 17, color: '#102C28', backgroundColor: '#F0F7F2' },
  reason: { minHeight: 90, textAlignVertical: 'top' }, decision: { gap: 10, borderTopWidth: 1, borderColor: '#BEDDCB', paddingTop: 12 },
  button: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#16796A', justifyContent: 'center' }, buttonText: { color: '#123A35', fontWeight: '700', fontSize: 15, textAlign: 'center', flexShrink: 1 },
  primary: { backgroundColor: '#123A35' }, primaryText: { color: '#FFFFFF' }, disabled: { opacity: 0.45 }, result: { fontSize: 24, fontWeight: '800', color: '#123A35' },
  warning: { padding: 14, gap: 12, backgroundColor: '#FFF2D5', borderRadius: 12 }, error: { color: '#92382B', fontSize: 15, lineHeight: 22 }, status: { color: '#185147', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  reading: { borderTopWidth: 1, borderColor: '#BEDDCB', paddingTop: 10, gap: 6 }, excluded: { backgroundColor: '#EAF5EE' },
});
