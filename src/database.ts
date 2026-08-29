import * as SQLite from 'expo-sqlite';

export type Measurement = {
  id: string;
  measuredAt: string;
  phase: 'before' | 'after';
  electricityKwh: number;
  heatKwh: number;
  outsideC: number;
  roomC: number;
  compressorStarts: number;
  flowC: number;
  returnC: number;
  compressorHours: number;
  hotWaterKwh: number;
};

export type Experiment = {
  id: string;
  setting: string;
  previousValue: string;
  newValue: string;
  unit: string;
  durationDays: number;
  startedAt: string;
  status: 'active' | 'completed';
};

export type SystemProfile = {
  manufacturer: string;
  model: string;
  buildingArea: string;
  constructionYear: string;
  heatDistribution: 'floor' | 'radiators' | 'mixed';
  electricityPrice: string;
};

const defaultProfile: SystemProfile = {
  manufacturer: '',
  model: '',
  buildingArea: '',
  constructionYear: '',
  heatDistribution: 'floor',
  electricityPrice: '0.32',
};

let connection: SQLite.SQLiteDatabase | undefined;
async function db() {
  if (!connection) connection = await SQLite.openDatabaseAsync('waermetakt.db');
  return connection;
}

async function ensureMeasurementColumns(client: SQLite.SQLiteDatabase) {
  const columns = await client.getAllAsync<{ name: string }>('PRAGMA table_info(measurements)');
  const existing = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ['flow_c', 'REAL NOT NULL DEFAULT 0'],
    ['return_c', 'REAL NOT NULL DEFAULT 0'],
    ['compressor_hours', 'REAL NOT NULL DEFAULT 0'],
    ['hot_water_kwh', 'REAL NOT NULL DEFAULT 0'],
  ];
  for (const [name, definition] of additions) {
    if (!existing.has(name)) await client.execAsync(`ALTER TABLE measurements ADD COLUMN ${name} ${definition}`);
  }
}

export const database = {
  async initialize() {
    const client = await db();
    await client.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY NOT NULL,
        measured_at TEXT NOT NULL,
        phase TEXT NOT NULL,
        electricity_kwh REAL NOT NULL,
        heat_kwh REAL NOT NULL,
        outside_c REAL NOT NULL,
        room_c REAL NOT NULL,
        compressor_starts INTEGER NOT NULL,
        flow_c REAL NOT NULL DEFAULT 0,
        return_c REAL NOT NULL DEFAULT 0,
        compressor_hours REAL NOT NULL DEFAULT 0,
        hot_water_kwh REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY NOT NULL,
        setting TEXT NOT NULL,
        previous_value TEXT NOT NULL,
        new_value TEXT NOT NULL,
        unit TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
    await ensureMeasurementColumns(client);
  },

  async listMeasurements(): Promise<Measurement[]> {
    const client = await db();
    const rows = await client.getAllAsync<any>('SELECT * FROM measurements ORDER BY measured_at DESC');
    return rows.map((row) => ({
      id: row.id, measuredAt: row.measured_at, phase: row.phase, electricityKwh: row.electricity_kwh,
      heatKwh: row.heat_kwh, outsideC: row.outside_c, roomC: row.room_c,
      compressorStarts: row.compressor_starts, flowC: row.flow_c ?? 0, returnC: row.return_c ?? 0,
      compressorHours: row.compressor_hours ?? 0, hotWaterKwh: row.hot_water_kwh ?? 0,
    }));
  },

  async saveMeasurement(item: Measurement) {
    const client = await db();
    await client.runAsync(
      `INSERT OR REPLACE INTO measurements
       (id, measured_at, phase, electricity_kwh, heat_kwh, outside_c, room_c, compressor_starts, flow_c, return_c, compressor_hours, hot_water_kwh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id, item.measuredAt, item.phase, item.electricityKwh, item.heatKwh, item.outsideC,
      item.roomC, item.compressorStarts, item.flowC, item.returnC, item.compressorHours, item.hotWaterKwh,
    );
  },

  async listExperiments(): Promise<Experiment[]> {
    const client = await db();
    const rows = await client.getAllAsync<any>('SELECT * FROM experiments ORDER BY started_at DESC');
    return rows.map((row) => ({ id: row.id, setting: row.setting, previousValue: row.previous_value, newValue: row.new_value, unit: row.unit, durationDays: row.duration_days, startedAt: row.started_at, status: row.status }));
  },

  async saveExperiment(item: Experiment) {
    const client = await db();
    await client.runAsync(
      `INSERT OR REPLACE INTO experiments (id, setting, previous_value, new_value, unit, duration_days, started_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id, item.setting, item.previousValue, item.newValue, item.unit, item.durationDays, item.startedAt, item.status,
    );
  },

  async getProfile(): Promise<SystemProfile> {
    const raw = await this.getState('system_profile');
    if (!raw) return defaultProfile;
    try { return { ...defaultProfile, ...JSON.parse(raw) }; } catch { return defaultProfile; }
  },

  async saveProfile(profile: SystemProfile) { await this.setState('system_profile', JSON.stringify(profile)); },
  async getState(key: string) { const client = await db(); const row = await client.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', key); return row?.value ?? null; },
  async setState(key: string, value: string) { const client = await db(); await client.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', key, value); },
};
