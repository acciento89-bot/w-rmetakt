import * as SQLite from 'expo-sqlite';
export type Measurement = { id: string; measuredAt: string; phase: 'before' | 'after'; electricityKwh: number; heatKwh: number; outsideC: number; roomC: number; compressorStarts: number };
let connection: SQLite.SQLiteDatabase | undefined;
async function db() { if (!connection) connection = await SQLite.openDatabaseAsync('waermetakt.db'); return connection; }
export const database = {
  async initialize() { const client = await db(); await client.execAsync(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY NOT NULL, measured_at TEXT NOT NULL, phase TEXT NOT NULL, electricity_kwh REAL NOT NULL, heat_kwh REAL NOT NULL, outside_c REAL NOT NULL, room_c REAL NOT NULL, compressor_starts INTEGER NOT NULL);`); },
  async listMeasurements(): Promise<Measurement[]> { const client = await db(); const rows = await client.getAllAsync<any>('SELECT * FROM measurements ORDER BY measured_at ASC'); return rows.map((row) => ({ id: row.id, measuredAt: row.measured_at, phase: row.phase, electricityKwh: row.electricity_kwh, heatKwh: row.heat_kwh, outsideC: row.outside_c, roomC: row.room_c, compressorStarts: row.compressor_starts })); },
  async saveMeasurement(item: Measurement) { const client = await db(); await client.runAsync(`INSERT OR REPLACE INTO measurements (id, measured_at, phase, electricity_kwh, heat_kwh, outside_c, room_c, compressor_starts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, item.id, item.measuredAt, item.phase, item.electricityKwh, item.heatKwh, item.outsideC, item.roomC, item.compressorStarts); },
};
