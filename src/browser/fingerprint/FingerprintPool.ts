import * as fs from 'fs';
import * as path from 'path';
import { IFingerprintProfile, IFingerprintPool } from './IFingerprintProfile';
import { AppConfig } from '../../data/config/appConfig';

export class FingerprintPool implements IFingerprintPool {
  private available: IFingerprintProfile[];
  private active: Set<IFingerprintProfile> = new Set();
  private readonly config: AppConfig;

  constructor() {
    this.config = AppConfig.getInstance();

    const profilesFile: string = this.config.fingerprintFile;
    const fullPath = path.resolve(profilesFile);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Файл профилей не найден: ${fullPath}`);
    }

    const raw = fs.readFileSync(fullPath, 'utf-8');
    const profiles: IFingerprintProfile[] = JSON.parse(raw);

    if (profiles.length === 0) throw new Error('Пул профилей пустой');

    this.available = [...profiles];
    this.active = new Set<IFingerprintProfile>();
  }

  get(): IFingerprintProfile | null {
    const free = this.available.filter(p => !this.active.has(p));
    if (free.length === 0) return null; // все заняты
    const profile = free[Math.floor(Math.random() * free.length)];
    this.active.add(profile);
    return profile;
  }

  release(profile: IFingerprintProfile): void {
    this.active.delete(profile);
  }
}
