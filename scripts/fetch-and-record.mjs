// scripts/fetch-and-record.mjs
// GitHub Actions 스케줄러가 매일 실행. 비밀키 없이 USGS 공개 GeoJSON을 조회해
// data/daily-readings.json (일별 정규화 값)과 data/receipts.json (봉인 영수증)을 갱신한다.
// 실행: node scripts/fetch-and-record.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  resetEvaluationState, applySuccessfulReading, applyError, kstDate
} from '../engine.js';

const SIGNAL_ID = 'usgs-max-mag-24h';
const SOURCE_NAME = 'USGS Earthquake Hazards Program';
const LIVE_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const STATE_PATH = new URL('../data/daily-readings.json', import.meta.url);
const RECEIPTS_PATH = new URL('../data/receipts.json', import.meta.url);

async function loadJson(url, fallback) {
  try {
    const text = await readFile(url, 'utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function fetchNormalizedReading() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(LIVE_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`USGS 응답 실패: HTTP ${res.status}`);
  }
  const body = await res.json();
  const features = Array.isArray(body.features) ? body.features : [];
  if (features.length === 0) throw new Error('features 배열이 비어 있음 (형식 변경 의심)');

  let top = features[0];
  for (const f of features) {
    if (typeof f.properties?.mag === 'number' && f.properties.mag > (top.properties?.mag ?? -Infinity)) {
      top = f;
    }
  }
  if (typeof top.properties?.mag !== 'number' || typeof top.properties?.time !== 'number') {
    throw new Error('필수 필드(mag/time) 누락 (형식 변경 의심)');
  }

  const fetchedAt = new Date().toISOString();
  const reading = {
    signal_id: SIGNAL_ID,
    normalized_value: top.properties.mag,
    unit: 'M',
    source_name: SOURCE_NAME,
    source_url: LIVE_URL,
    source_time: new Date(top.properties.time).toISOString(),
    fetched_at: fetchedAt,
    record_timezone: 'Asia/Seoul',
    record_date: kstDate(fetchedAt)
  };
  return { reading, place: top.properties.place || null };
}

async function main() {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  let state = await loadJson(STATE_PATH, resetEvaluationState());
  let receipts = await loadJson(RECEIPTS_PATH, []);

  try {
    const { reading, place } = await fetchNormalizedReading();
    state = applySuccessfulReading(state, reading, { fixture_id: null, virtual_now: reading.fetched_at });

    // 봉인 영수증: 같은 record_date 재실행이면 기존 영수증을 값만 갱신(하루 1건 유지),
    // 다른 record_date면 새 영수증 추가.
    const existingIdx = receipts.findIndex(
      (r) => r.canonical_kind === 't04_day' && r.payload.record_date === reading.record_date
    );
    const receipt = {
      canonical_kind: 't04_day',
      server_created_at: reading.fetched_at,
      payload: {
        source_url: reading.source_url,
        source_observed_at: reading.source_time,
        normalized_value: reading.normalized_value,
        unit: reading.unit,
        record_date: reading.record_date,
        place
      }
    };
    if (existingIdx >= 0) receipts[existingIdx] = receipt; else receipts.push(receipt);

    console.log(`[OK] ${reading.record_date} KST — magnitude ${reading.normalized_value}${reading.unit} (${place || 'unknown location'})`);
  } catch (err) {
    // 실제 자동 수집 실패 — 상태만 stale로 남기고 daily_readings는 건드리지 않는다.
    const code = err.name === 'AbortError' ? 'timeout' : 'schema_error';
    state = applyError(state, code, { fixture_id: null, virtual_now: new Date().toISOString() });
    console.error(`[FAIL] ${err.message} → error_code=${code} (마지막 정상값은 보존)`);
  }

  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await writeFile(RECEIPTS_PATH, JSON.stringify(receipts, null, 2) + '\n', 'utf8');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
