import * as SQLite from 'expo-sqlite';
export type Measurement = { id: string; measuredAt: string; phase: 'before' | 'after'; electricityKwh: number; heatKwh: number; outsideC: number; roomC: number; compressorStarts: number };
export type Experiment = { id: string; setting: string; previousValue: string; newValue: string; unit: string; durationDays: number; startedAt: string; status: 'active' | 'completed' };
let connection: SQLite.SQLiteDatabase | undefined;
async function db() { if (!connection) connection = await SQLite.openDatabaseAsync('waermetakt.db'); return connection; }
export const database = {
  async initialize() { const client = await db(); await client.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY NOT NULL, measured_at TEXT NOT NULL, phase TEXT NOT NULL, electricity_kwh REAL NOT NULL, heat_kwh REAL NOT NULL, outside_c REAL NOT NULL, room_c REAL NOT NULL, compressor_starts INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS experiments (id TEXT PRIMARY KEY NOT NULL, setting TEXT NOT NULL, previous_value TEXT NOT NULL, new_value TEXT NOT NULL, unit TEXT NOT NULL, duration_days INTEGER NOT NULL, started_at TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `); },
  async listMeasurements(): Promise<Measurement[]> { const client = await db(); const rows = await client.getAllAsync<any>('SELECT * FROM measurements ORDER BY measured_at ASC'); return rows.map((row) => ({ id: row.id, measuredAt: row.measured_at, phase: row.phase, electricityKwh: row.electricity_kwh, heatKwh: row.heat_kwh, outsideC: row.outside_c, roomC: row.room_c, compressorStarts: row.compressor_starts })); },
  async saveMeasurement(item: Measurement) { const client = await db(); await client.runAsync(`INSERT OR REPLACE INTO measurements (id, measured_at, phase, electricity_kwh, heat_kwh, outside_c, room_c, compressor_starts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, item.id, item.measuredAt, item.phase, item.electricityKwh, item.heatKwh, item.outsideC, item.roomC, item.compressorStarts); },
  async listExperiments(): Promise<Experiment[]> { const client = await db(); const rows = await client.getAllAsync<any>('SELECT * FROM experiments ORDER BY started_at DESC'); return rows.map((row) => ({ id: row.id, setting: row.setting, previousValue: row.previous_value, newValue: row.new_value, unit: row.unit, durationDays: row.duration_days, startedAt: row.started_at, status: row.status })); },
  async saveExperiment(item: Experiment) { const client = await db(); await client.runAsync(`INSERT OR REPLACE INTO experiments (id, setting, previous_value, new_value, unit, duration_days, started_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, item.id, item.setting, item.previousValue, item.newValue, item.unit, item.durationDays, item.startedAt, item.status); },
  async getState(key: string) { const client = await db(); const row = await client.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', key); return row?.value ?? null; },
  async setState(key: string, value: string) { const client = await db(); await client.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', key, value); },
};
