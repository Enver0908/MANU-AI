type FactorMap = Record<string, readonly string[]>;

function buildPairwiseRows(factors: FactorMap): Record<string, string>[] {
  const keys = Object.keys(factors);
  if (keys.length === 0) return [];
  if (keys.length === 1) {
    return factors[keys[0]].map((value) => ({ [keys[0]]: value }));
  }

  const uncovered = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      for (const left of factors[keys[i]]) {
        for (const right of factors[keys[j]]) {
          uncovered.add(`${keys[i]}=${left}|${keys[j]}=${right}`);
        }
      }
    }
  }

  const rows: Record<string, string>[] = [];
  let guard = 0;
  while (uncovered.size > 0 && guard < 500) {
    guard += 1;
    const candidate: Record<string, string> = {};
    for (const key of keys) {
      let bestValue = factors[key][0];
      let bestScore = -1;
      for (const value of factors[key]) {
        candidate[key] = value;
        const score = scoreCandidate(candidate, keys, uncovered);
        if (score > bestScore) {
          bestScore = score;
          bestValue = value;
        }
      }
      candidate[key] = bestValue;
    }
    rows.push({ ...candidate });
    const newlyCovered = coveredPairs(candidate, keys).filter((pair) => uncovered.has(pair));
    if (newlyCovered.length === 0) {
      const [forced] = uncovered;
      const [left, right] = forced.split("|");
      const [leftKey, leftValue] = left.split("=");
      const [rightKey, rightValue] = right.split("=");
      candidate[leftKey] = leftValue;
      candidate[rightKey] = rightValue;
      rows[rows.length - 1] = { ...candidate };
    }
    for (const pair of coveredPairs(candidate, keys)) {
      uncovered.delete(pair);
    }
  }
  return rows;
}

function coveredPairs(row: Record<string, string>, keys: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    if (!row[keys[i]]) continue;
    for (let j = i + 1; j < keys.length; j += 1) {
      if (!row[keys[j]]) continue;
      pairs.push(`${keys[i]}=${row[keys[i]]}|${keys[j]}=${row[keys[j]]}`);
    }
  }
  return pairs;
}

function scoreCandidate(row: Record<string, string>, keys: string[], uncovered: Set<string>): number {
  return coveredPairs(row, keys).filter((pair) => uncovered.has(pair)).length;
}

export const pairwiseCombinations = buildPairwiseRows;
export const pairwiseMatrix = buildPairwiseRows;
