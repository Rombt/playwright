import { IDataImag } from '../../../data/entities/IDataImag';

export function normalizeAllData(source: IDataImag): IDataImag {
  const map = new Map<string, Set<string>>();

  for (const [key, urls] of Object.entries(source)) {
    if (!map.has(key)) {
      map.set(key, new Set());
    }

    const set = map.get(key)!;
    for (const url of urls) {
      set.add(url);
    }
  }

  return Object.fromEntries([...map.entries()].map(([key, set]) => [key, [...set]]));
}
