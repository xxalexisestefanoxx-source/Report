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
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.state = { ...emptyState(), ...JSON.parse(await fs.readFile(this.file, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.flush();
    }
  }

  async flush() {
    const temp = `${this.file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2), 'utf8');
    await fs.rename(temp, this.file);
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
}
