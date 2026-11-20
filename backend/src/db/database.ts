import fs from "fs";
import path from "path";
import { MongoClient, type Db as MongoDb, type Collection as MongoCollection } from "mongodb";
import type {
  ApplicationRecord,
  AuditLogRecord,
  AuthUser,
  Company,
  InterviewQuestionSet,
  InterviewReport,
  InterviewSession,
  JobEvaluationProfile,
  JobPosting,
  NotificationEmailRecord,
  ReferralTokenRecord,
  ReportFlagRecord,
  ResumeEvaluationRecord,
  ResumeFileRecord,
  StudentPortfolio,
  TieResolutionRecord,
} from "../../../shared/types";
import { config } from "../config";

export interface CollectionRepo<T extends { id: string }> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findMany(predicate: (item: T) => boolean): Promise<T[]>;
  findOne(predicate: (item: T) => boolean): Promise<T | null>;
  insert(doc: T): Promise<T>;
  upsert(doc: T): Promise<T>;
  updateById(id: string, patch: Partial<T>): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

type StoreShape = {
  users: AuthUser[];
  companies: Company[];
  portfolios: StudentPortfolio[];
  jobs: JobPosting[];
  jobEvaluationProfiles: JobEvaluationProfile[];
  resumeFiles: ResumeFileRecord[];
  resumeEvaluations: ResumeEvaluationRecord[];
  applications: ApplicationRecord[];
  referrals: ReferralTokenRecord[];
  tieResolutions: TieResolutionRecord[];
  interviewQuestionSets: InterviewQuestionSet[];
  interviews: InterviewSession[];
  interviewReports: InterviewReport[];
  flags: ReportFlagRecord[];
  auditLogs: AuditLogRecord[];
  notifications: NotificationEmailRecord[];
};

const EMPTY_STORE = (): StoreShape => ({
  users: [],
  companies: [],
  portfolios: [],
  jobs: [],
  jobEvaluationProfiles: [],
  resumeFiles: [],
  resumeEvaluations: [],
  applications: [],
  referrals: [],
  tieResolutions: [],
  interviewQuestionSets: [],
  interviews: [],
  interviewReports: [],
  flags: [],
  auditLogs: [],
  notifications: [],
});

class LocalJsonStore {
  private data: StoreShape = EMPTY_STORE();
  private filePath: string;
  private persistToDisk: boolean;
  private locks = new Map<string, Promise<unknown>>();

  constructor(persistToDisk: boolean) {
    this.persistToDisk = persistToDisk;
    this.filePath = path.join(config.dataDir, "hirezilla-db.json");
    if (this.persistToDisk) {
      fs.mkdirSync(config.dataDir, { recursive: true });
      if (fs.existsSync(this.filePath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
          this.data = { ...EMPTY_STORE(), ...parsed };
        } catch {
          this.data = EMPTY_STORE();
        }
      }
    }
  }

  private flush() {
    if (!this.persistToDisk) return;
    fs.mkdirSync(config.dataDir, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  async withLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => {
      release = res;
    });
    const chained = prev.then(() => next);
    this.locks.set(key, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === chained) {
        this.locks.delete(key);
      }
    }
  }

  repo<K extends keyof StoreShape>(key: K): CollectionRepo<StoreShape[K][number]> {
    type Item = StoreShape[K][number];
    const getArr = () => this.data[key] as unknown as Item[];
    const setArr = (next: Item[]) => {
      (this.data[key] as unknown as Item[]) = next;
    };

    return {
      findAll: async () => getArr().map((x) => structuredClone(x)),
      findById: async (id: string) => {
        const found = getArr().find((x) => x.id === id);
        return found ? structuredClone(found) : null;
      },
      findMany: async (predicate) => getArr().filter(predicate).map((x) => structuredClone(x)),
      findOne: async (predicate) => {
        const found = getArr().find(predicate);
        return found ? structuredClone(found) : null;
      },
      insert: async (doc: Item) => {
        const arr = getArr();
        if (arr.some((x) => x.id === doc.id)) {
          throw new Error(`Duplicate id ${doc.id} in ${String(key)}`);
        }
        arr.push(structuredClone(doc));
        this.flush();
        return structuredClone(doc);
      },
      upsert: async (doc: Item) => {
        const arr = getArr();
        const idx = arr.findIndex((x) => x.id === doc.id);
        if (idx >= 0) {
          arr[idx] = structuredClone(doc);
        } else {
          arr.push(structuredClone(doc));
        }
        this.flush();
        return structuredClone(doc);
      },
      updateById: async (id: string, patch: Partial<Item>) => {
        const arr = getArr();
        const idx = arr.findIndex((x) => x.id === id);
        if (idx < 0) return null;
        arr[idx] = { ...arr[idx], ...structuredClone(patch) };
        this.flush();
        return structuredClone(arr[idx]);
      },
      deleteById: async (id: string) => {
        const arr = getArr();
        const next = arr.filter((x) => x.id !== id);
        if (next.length === arr.length) return false;
        setArr(next);
        this.flush();
        return true;
      },
      clear: async () => {
        setArr([]);
        this.flush();
      },
    };
  }

  resetAll() {
    this.data = EMPTY_STORE();
    this.flush();
  }
}

class MongoRepo<T extends { id: string }> implements CollectionRepo<T> {
  private col: MongoCollection<T & { _id?: unknown }>;

  constructor(mongoDb: MongoDb, name: string) {
    this.col = mongoDb.collection(name);
  }

  private strip(doc: unknown): T | null {
    if (!doc || typeof doc !== "object") return null;
    const { _id: _unused, ...rest } = doc as Record<string, unknown>;
    return rest as unknown as T;
  }

  async findAll(): Promise<T[]> {
    const docs = await this.col.find({}).toArray();
    return docs.map((d) => this.strip(d)!);
  }

  async findById(id: string): Promise<T | null> {
    const doc = await this.col.findOne({ id } as never);
    return this.strip(doc);
  }

  async findMany(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.findAll();
    return all.filter(predicate);
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    const all = await this.findAll();
    return all.find(predicate) ?? null;
  }

  async insert(doc: T): Promise<T> {
    await this.col.insertOne(structuredClone(doc) as never);
    return structuredClone(doc);
  }

  async upsert(doc: T): Promise<T> {
    await this.col.replaceOne({ id: doc.id } as never, structuredClone(doc) as never, {
      upsert: true,
    });
    return structuredClone(doc);
  }

  async updateById(id: string, patch: Partial<T>): Promise<T | null> {
    const res = await this.col.findOneAndUpdate(
      { id } as never,
      { $set: structuredClone(patch) } as never,
      { returnDocument: "after" }
    );
    return this.strip(res as (T & { _id?: unknown }) | null);
  }

  async deleteById(id: string): Promise<boolean> {
    const res = await this.col.deleteOne({ id } as never);
    return res.deletedCount > 0;
  }

  async clear(): Promise<void> {
    await this.col.deleteMany({});
  }
}

const localStore = new LocalJsonStore(!config.isTest);
let mongoClient: MongoClient | null = null;
let mongoDb: MongoDb | null = null;
const jobLocks = new Map<string, Promise<unknown>>();

async function withMongoLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
  const prev = jobLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => {
    release = res;
  });
  const chained = prev.then(() => next);
  jobLocks.set(key, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (jobLocks.get(key) === chained) {
      jobLocks.delete(key);
    }
  }
}

function getRepo<K extends keyof StoreShape>(key: K): CollectionRepo<StoreShape[K][number]> {
  if (mongoDb) {
    return new MongoRepo<StoreShape[K][number]>(mongoDb, String(key));
  }
  return localStore.repo(key);
}

export async function connectDatabase(): Promise<{ mode: "mongodb" | "local_file" | "memory" }> {
  if (config.mongodbUri && !config.isTest) {
    try {
      mongoClient = new MongoClient(config.mongodbUri);
      await mongoClient.connect();
      mongoDb = mongoClient.db(config.mongodbDbName);
      await ensureMongoIndexes(mongoDb);
      return { mode: "mongodb" };
    } catch (err) {
      console.warn(
        `[HireZilla DB] Failed to connect to MONGODB_URI (${
          err instanceof Error ? err.message : "unknown error"
        }); falling back to disk persistence.`
      );
      mongoClient = null;
      mongoDb = null;
    }
  }
  return { mode: config.isTest ? "memory" : "local_file" };
}

async function ensureMongoIndexes(database: MongoDb): Promise<void> {
  await Promise.all([
    database.collection("users").createIndex({ id: 1 }, { unique: true }),
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("companies").createIndex({ id: 1 }, { unique: true }),
    database.collection("portfolios").createIndex({ slug: 1 }, { unique: true }),
    database.collection("portfolios").createIndex({ userId: 1 }, { unique: true }),
    database.collection("jobs").createIndex({ id: 1 }, { unique: true }),
    database.collection("jobs").createIndex({ companyId: 1, status: 1 }),
    database.collection("jobEvaluationProfiles").createIndex({ jobId: 1, profileVersion: -1 }),
    database.collection("resumeEvaluations").createIndex({ jobId: 1, evaluationStatus: 1 }),
    database.collection("applications").createIndex({ id: 1 }, { unique: true }),
    database
      .collection("applications")
      .createIndex({ jobId: 1, candidateId: 1 }, { unique: true }),
    database.collection("referrals").createIndex({ code: 1 }, { unique: true }),
    database.collection("interviews").createIndex({ token: 1 }, { unique: true }),
  ]);
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}

export const db = {
  get users() {
    return getRepo("users");
  },
  get companies() {
    return getRepo("companies");
  },
  get portfolios() {
    return getRepo("portfolios");
  },
  get jobs() {
    return getRepo("jobs");
  },
  get jobEvaluationProfiles() {
    return getRepo("jobEvaluationProfiles");
  },
  get resumeFiles() {
    return getRepo("resumeFiles");
  },
  get resumeEvaluations() {
    return getRepo("resumeEvaluations");
  },
  get applications() {
    return getRepo("applications");
  },
  get referrals() {
    return getRepo("referrals");
  },
  get tieResolutions() {
    return getRepo("tieResolutions");
  },
  get interviewQuestionSets() {
    return getRepo("interviewQuestionSets");
  },
  get interviews() {
    return getRepo("interviews");
  },
  get interviewReports() {
    return getRepo("interviewReports");
  },
  get flags() {
    return getRepo("flags");
  },
  get auditLogs() {
    return getRepo("auditLogs");
  },
  get notifications() {
    return getRepo("notifications");
  },

  withJobLock<R>(jobId: string, fn: () => Promise<R>): Promise<R> {
    if (mongoDb) {
      return withMongoLock(`job:${jobId}`, fn);
    }
    return localStore.withLock(`job:${jobId}`, fn);
  },

  async atomicCreateApplication(params: {
    jobId: string;
    candidateId: string;
    createRecord: (currentJob: JobPosting) => Promise<ApplicationRecord>;
  }): Promise<
    | { ok: true; application: ApplicationRecord; job: JobPosting }
    | {
        ok: false;
        reason: "job_not_found" | "job_not_open" | "duplicate" | "cap_reached";
        existingApplication?: ApplicationRecord;
      }
  > {
    return this.withJobLock(params.jobId, async () => {
      if (mongoDb) {
        const jobsCol = mongoDb.collection<JobPosting & { _id?: unknown }>("jobs");
        const appsCol = mongoDb.collection<ApplicationRecord & { _id?: unknown }>("applications");

        const job = await jobsCol.findOne({ id: params.jobId });
        if (!job) return { ok: false, reason: "job_not_found" };
        if (job.status !== "open") return { ok: false, reason: "job_not_open" };

        const existing = await appsCol.findOne({
          jobId: params.jobId,
          candidateId: params.candidateId,
        });
        if (existing) {
          const { _id: _x, ...cleanExisting } = existing;
          return {
            ok: false,
            reason: "duplicate",
            existingApplication: cleanExisting as ApplicationRecord,
          };
        }

        const updatedJob = await jobsCol.findOneAndUpdate(
          {
            id: params.jobId,
            status: "open",
            $expr: { $lt: ["$applicationCount", "$applicationCap"] },
          } as never,
          {
            $inc: { applicationCount: 1 },
            $set: { updatedAt: new Date().toISOString() },
          } as never,
          { returnDocument: "after" }
        );

        if (!updatedJob) {
          return { ok: false, reason: "cap_reached" };
        }

        const application = await params.createRecord(updatedJob as unknown as JobPosting);
        await appsCol.insertOne(structuredClone(application) as never);
        const { _id: _y, ...cleanJob } = updatedJob as JobPosting & { _id?: unknown };
        return { ok: true, application, job: cleanJob as JobPosting };
      }

      const job = await this.jobs.findById(params.jobId);
      if (!job) return { ok: false, reason: "job_not_found" };
      if (job.status !== "open") return { ok: false, reason: "job_not_open" };

      const existing = await this.applications.findOne(
        (a) => a.jobId === params.jobId && a.candidateId === params.candidateId
      );
      if (existing) {
        return { ok: false, reason: "duplicate", existingApplication: existing };
      }

      if (job.applicationCount >= job.applicationCap) {
        return { ok: false, reason: "cap_reached" };
      }

      const updatedJob = (await this.jobs.updateById(job.id, {
        applicationCount: job.applicationCount + 1,
        updatedAt: new Date().toISOString(),
      }))!;

      const application = await params.createRecord(updatedJob);
      await this.applications.insert(application);
      return { ok: true, application, job: updatedJob };
    });
  },

  resetLocalStoreForTests() {
    localStore.resetAll();
  },
};
