import fs from 'node:fs/promises';
import path from 'node:path';

const emptyState = () => ({
  users: {},
  reports: [],
  rateLimits: {},
});

export class Store {
  constructor(file) {
    this.file = path.resolve(file);
    this.state = emptyState();
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.state = {
        ...emptyState(),
        ...parsed,
        users: parsed.users && typeof parsed.users === 'object' && !Array.isArray(parsed.users) ? parsed.users : {},
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        rateLimits: parsed.rateLimits && typeof parsed.rateLimits === 'object' && !Array.isArray(parsed.rateLimits) ? parsed.rateLimits : {},
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.flush();
    }
  }

  async flush() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(temp, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temp, this.file);
    });
    return this.writeQueue;
  }

  async registerUser(user) {
    const current = this.state.users[user.number] || {};
    this.state.users[user.number] = { ...current, ...user, updatedAt: new Date().toISOString() };
    await this.flush();
    return this.state.users[user.number];
  }

  canRun(key, cooldownMs) {
    const last = Number(this.state.rateLimits[key] || 0);
    return Date.now() - last >= cooldownMs;
  }

  async markRun(key) {
    this.state.rateLimits[key] = Date.now();
    await this.flush();
  }

  async addReport(report) {
    this.state.reports.push(report);
    await this.flush();
    return report;
  }

  async updateReport(id, patch) {
    const report = this.state.reports.find((item) => item.id === id);
    if (!report) return null;
    Object.assign(report, patch);
    await this.flush();
    return report;
  }
}
