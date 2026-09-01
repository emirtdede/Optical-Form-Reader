import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  CHOICES,
  type AnswerChoice,
  type AnswerStatus,
  type ExamSession,
  type ProcessingJob,
  type QuestionResult,
  type Score,
  type SessionProgress,
  type StudentResult,
} from '../types';

type SessionMeta = Omit<ExamSession, 'results'>;

interface StoredResult {
  id: string;
  sessionId: string;
  result: StudentResult;
}

interface OptikDatabase extends DBSchema {
  sessions: {
    key: string;
    value: ExamSession;
    indexes: { 'by-updated': string };
  };
  sessionMeta: {
    key: string;
    value: SessionMeta;
    indexes: { 'by-updated': string };
  };
  results: {
    key: string;
    value: StoredResult;
    indexes: { 'by-session': string };
  };
  jobs: {
    key: string;
    value: ProcessingJob;
    indexes: { 'by-session': string; 'by-fingerprint': string };
  };
}

let databasePromise: ReturnType<typeof openDB<OptikDatabase>> | null = null;
let migrationPromise: Promise<void> | null = null;

function getDatabase() {
  databasePromise ??= openDB<OptikDatabase>('optik-form-okuyucu', 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-updated', 'updatedAt');
      }
      if (oldVersion < 2) {
        const meta = database.createObjectStore('sessionMeta', { keyPath: 'id' });
        meta.createIndex('by-updated', 'updatedAt');
        const results = database.createObjectStore('results', { keyPath: 'id' });
        results.createIndex('by-session', 'sessionId');
        const jobs = database.createObjectStore('jobs', { keyPath: 'id' });
        jobs.createIndex('by-session', 'sessionId');
        jobs.createIndex('by-fingerprint', 'sourceFingerprint');
      }
    },
  });
  return databasePromise;
}

async function migrateLegacySessions(database: IDBPDatabase<OptikDatabase>): Promise<void> {
  migrationPromise ??= (async () => {
    const legacy = await database.getAll('sessions');
    if (!legacy.length) return;
    for (const session of legacy) await putNormalizedSession(database, session);
    await database.clear('sessions');
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });
  await migrationPromise;
}

async function normalizedDatabase(): Promise<IDBPDatabase<OptikDatabase>> {
  const database = await getDatabase();
  await migrateLegacySessions(database);
  return database;
}

function resultStorageId(sessionId: string, resultId: string): string {
  return `${sessionId}:${resultId}`;
}

async function putNormalizedSession(database: IDBPDatabase<OptikDatabase>, session: ExamSession): Promise<void> {
  const { results, ...meta } = session;
  const transaction = database.transaction(['sessionMeta', 'results'], 'readwrite');
  const resultStore = transaction.objectStore('results');
  const existingResultKeys = await resultStore.index('by-session').getAllKeys(session.id);
  await Promise.all(existingResultKeys.map((key) => resultStore.delete(key)));
  await transaction.objectStore('sessionMeta').put(meta);
  await Promise.all(results.map((result) => transaction.objectStore('results').put({
    id: resultStorageId(session.id, result.id),
    sessionId: session.id,
    result,
  })));
  await transaction.done;
}

async function assembleSession(database: IDBPDatabase<OptikDatabase>, meta: SessionMeta): Promise<ExamSession> {
  const storedResults = await database.getAllFromIndex('results', 'by-session', meta.id);
  const results = storedResults
    .map((entry) => entry.result)
    .sort((left, right) => left.sourceName.localeCompare(right.sourceName, 'tr', { numeric: true, sensitivity: 'base' }));
  return { ...meta, results };
}

export async function listSessions(): Promise<ExamSession[]> {
  const database = await normalizedDatabase();
  const metas = await database.getAllFromIndex('sessionMeta', 'by-updated');
  const sessions = await Promise.all(metas.map((meta) => assembleSession(database, meta)));
  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getSession(id: string): Promise<ExamSession | undefined> {
  const database = await normalizedDatabase();
  const meta = await database.get('sessionMeta', id);
  return meta ? assembleSession(database, meta) : undefined;
}

export async function putSession(session: ExamSession): Promise<void> {
  await putNormalizedSession(await normalizedDatabase(), session);
}

export async function createProcessingSession(session: ExamSession): Promise<void> {
  await putNormalizedSession(await normalizedDatabase(), session);
}

export async function checkpointResult(
  session: ExamSession,
  result: StudentResult,
  job: ProcessingJob,
): Promise<void> {
  const database = await normalizedDatabase();
  const { results: _results, ...meta } = session;
  const transaction = database.transaction(['sessionMeta', 'results', 'jobs'], 'readwrite');
  await transaction.objectStore('sessionMeta').put(meta);
  await transaction.objectStore('results').put({ id: resultStorageId(session.id, result.id), sessionId: session.id, result });
  await transaction.objectStore('jobs').put(job);
  await transaction.done;
}

export async function putStudentResult(sessionId: string, result: StudentResult, updatedAt: string): Promise<void> {
  const database = await normalizedDatabase();
  const meta = await database.get('sessionMeta', sessionId);
  if (!meta) throw new Error('Değerlendirme kaydı bulunamadı.');
  const transaction = database.transaction(['sessionMeta', 'results'], 'readwrite');
  await transaction.objectStore('sessionMeta').put({ ...meta, updatedAt });
  await transaction.objectStore('results').put({ id: resultStorageId(sessionId, result.id), sessionId, result });
  await transaction.done;
}

export async function updateSessionProgress(sessionId: string, progress: SessionProgress, updatedAt = new Date().toISOString()): Promise<void> {
  const database = await normalizedDatabase();
  const meta = await database.get('sessionMeta', sessionId);
  if (!meta) throw new Error('Değerlendirme kaydı bulunamadı.');
  await database.put('sessionMeta', { ...meta, progress, updatedAt });
}

export async function putProcessingJob(job: ProcessingJob): Promise<void> {
  await (await normalizedDatabase()).put('jobs', job);
}

export async function putProcessingJobs(jobs: ProcessingJob[]): Promise<void> {
  if (!jobs.length) return;
  const transaction = (await normalizedDatabase()).transaction('jobs', 'readwrite');
  await Promise.all([...jobs.map((job) => transaction.store.put(job)), transaction.done]);
}

export async function listProcessingJobs(sessionId: string): Promise<ProcessingJob[]> {
  const jobs = await (await normalizedDatabase()).getAllFromIndex('jobs', 'by-session', sessionId);
  return jobs.sort((left, right) => left.sourceName.localeCompare(right.sourceName, 'tr', { numeric: true, sensitivity: 'base' }));
}

export async function removeResult(sessionId: string, resultId: string): Promise<void> {
  await (await normalizedDatabase()).delete('results', resultStorageId(sessionId, resultId));
}

export async function removeSession(id: string): Promise<void> {
  const database = await normalizedDatabase();
  const transaction = database.transaction(['sessionMeta', 'results', 'jobs'], 'readwrite');
  const resultStore = transaction.objectStore('results');
  const jobStore = transaction.objectStore('jobs');
  const [resultKeys, jobKeys] = await Promise.all([
    resultStore.index('by-session').getAllKeys(id),
    jobStore.index('by-session').getAllKeys(id),
  ]);
  await Promise.all([
    ...resultKeys.map((key) => resultStore.delete(key)),
    ...jobKeys.map((key) => jobStore.delete(key)),
  ]);
  await transaction.objectStore('sessionMeta').delete(id);
  await transaction.done;
}

export async function clearSessions(): Promise<void> {
  const database = await normalizedDatabase();
  const transaction = database.transaction(['sessions', 'sessionMeta', 'results', 'jobs'], 'readwrite');
  await Promise.all([
    transaction.objectStore('sessions').clear(),
    transaction.objectStore('sessionMeta').clear(),
    transaction.objectStore('results').clear(),
    transaction.objectStore('jobs').clear(),
    transaction.done,
  ]);
}

const answerChoices = new Set<string>(CHOICES);
const answerStatuses = new Set<AnswerStatus>(['correct', 'wrong', 'blank', 'ambiguous']);
const studentNumberSources = new Set<StudentResult['studentNumberSource']>(['form', 'filename', 'manual', 'generated']);
const queueStatuses = new Set<ProcessingJob['status']>(['waiting', 'hashing', 'processing', 'completed', 'skipped', 'error']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function isQuestionResult(value: unknown, index: number, key: AnswerChoice): value is QuestionResult {
  if (!isRecord(value)) return false;
  const marked = value.marked;
  const status = value.status;
  return value.question === index + 1
    && value.key === key
    && (marked === null || (typeof marked === 'string' && answerChoices.has(marked)))
    && typeof status === 'string'
    && answerStatuses.has(status as AnswerStatus)
    && isFiniteNumber(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && (status === 'ambiguous' ? marked === null : true)
    && (status === 'blank' ? marked === null : true)
    && (status === 'correct' ? marked === key : true)
    && (status === 'wrong' ? marked !== null && marked !== key : true);
}

function isScore(value: unknown, answers: QuestionResult[]): value is Score {
  if (!isRecord(value)) return false;
  const totals = answers.reduce<Record<AnswerStatus, number>>(
    (all, answer) => ({ ...all, [answer.status]: all[answer.status] + 1 }),
    { correct: 0, wrong: 0, blank: 0, ambiguous: 0 },
  );
  const expectedNet = Number((totals.correct - totals.wrong / 4).toFixed(2));
  const expectedPercentage = Number(totals.correct.toFixed(2));
  return value.correct === totals.correct
    && value.wrong === totals.wrong
    && value.blank === totals.blank
    && value.ambiguous === totals.ambiguous
    && value.net === expectedNet
    && value.percentage === expectedPercentage;
}

function isStudentResult(value: unknown, answerKey: AnswerChoice[]): value is StudentResult {
  if (!isRecord(value) || !Array.isArray(value.answers) || value.answers.length !== 100) return false;
  const answers = value.answers as unknown[];
  if (!answers.every((answer, index) => isQuestionResult(answer, index, answerKey[index]))) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 80
    && typeof value.studentNumber === 'string'
    && /^[A-Za-z0-9_-]{3,24}$/.test(value.studentNumber)
    && typeof value.studentNumberSource === 'string'
    && studentNumberSources.has(value.studentNumberSource as StudentResult['studentNumberSource'])
    && typeof value.studentNumberNeedsReview === 'boolean'
    && typeof value.sourceName === 'string'
    && value.sourceName.length > 0
    && value.sourceName.length <= 255
    && (value.sourceFingerprint === undefined || (typeof value.sourceFingerprint === 'string' && value.sourceFingerprint.length <= 128))
    && (value.partIndex === undefined || (Number.isInteger(value.partIndex) && Number(value.partIndex) >= 0))
    && isDateString(value.processedAt)
    && isScore(value.score, answers as QuestionResult[])
    && isRecord(value.diagnostics)
    && isFiniteNumber(value.diagnostics.averageConfidence)
    && value.diagnostics.averageConfidence >= 0
    && value.diagnostics.averageConfidence <= 1
    && isFiniteNumber(value.diagnostics.contourCount)
    && value.diagnostics.contourCount >= 0
    && isFiniteNumber(value.diagnostics.processingMs)
    && value.diagnostics.processingMs >= 0;
}

export function isExamSession(value: unknown): value is ExamSession {
  if (!isRecord(value) || !Array.isArray(value.answerKey) || value.answerKey.length !== 100 || !Array.isArray(value.results)) return false;
  const answerKey = value.answerKey as unknown[];
  if (!answerKey.every((answer) => typeof answer === 'string' && answerChoices.has(answer))) return false;
  const typedKey = answerKey as AnswerChoice[];
  return typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 80
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && value.title.length <= 80
    && isDateString(value.createdAt)
    && isDateString(value.updatedAt)
    && typeof value.algorithmVersion === 'string'
    && value.algorithmVersion.length <= 40
    && value.questionCount === 100
    && value.results.every((result) => isStudentResult(result, typedKey));
}

export async function importSessions(values: unknown[]): Promise<number> {
  if (values.length > 250) throw new Error('Bir yedekte en fazla 250 değerlendirme içe aktarılabilir.');
  const valid = values.filter(isExamSession);
  const database = await normalizedDatabase();
  for (const session of valid) await putNormalizedSession(database, session);
  return valid.length;
}

function isProcessingJob(value: unknown): value is ProcessingJob {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 80
    && typeof value.sessionId === 'string'
    && value.sessionId.length > 0
    && value.sessionId.length <= 80
    && typeof value.sourceName === 'string'
    && value.sourceName.length > 0
    && value.sourceName.length <= 255
    && Number.isInteger(value.partIndex)
    && Number(value.partIndex) >= 0
    && typeof value.status === 'string'
    && queueStatuses.has(value.status as ProcessingJob['status'])
    && (value.sourceFingerprint === undefined || (typeof value.sourceFingerprint === 'string' && value.sourceFingerprint.length <= 128))
    && (value.studentNumber === undefined || (typeof value.studentNumber === 'string' && value.studentNumber.length <= 24))
    && (value.resultId === undefined || (typeof value.resultId === 'string' && value.resultId.length <= 80))
    && (value.error === undefined || (typeof value.error === 'string' && value.error.length <= 500))
    && isDateString(value.updatedAt);
}

export async function importProcessingJobs(values: unknown[]): Promise<number> {
  const database = await normalizedDatabase();
  const sessionIds = new Set(await database.getAllKeys('sessionMeta'));
  const valid = values.filter(isProcessingJob).filter((job) => sessionIds.has(job.sessionId));
  const transaction = database.transaction('jobs', 'readwrite');
  await Promise.all([...valid.map((job) => transaction.store.put(job)), transaction.done]);
  return valid.length;
}
