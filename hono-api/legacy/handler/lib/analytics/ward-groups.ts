/**
 * Ward → Assembly Constituency grouping for legacy analytics.
 *
 * Legacy rows (Excel import) carry a "Ward" answer, and many also carry a
 * resolvable Assembly Constituency (AC) answer. There is no ward→AC reference
 * table anywhere, so the mapping is DERIVED from co-occurrence: every row that
 * has both a ward and a canonical AC casts one vote; a ward's assembly region
 * is the AC it most often appears with. Wards that never co-occur with a
 * resolvable AC land in the "Unmapped wards" group.
 */

export type WardGroup = {
  name: string;
  value: number;
  wards: [string, number][];
};

export const UNMAPPED_WARDS = "Unmapped wards";

export function normWardKey(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** ward → AC votes from (ward, ac) pairs; winner AC per ward. */
export function buildWardAcVotes(
  pairs: { ward: unknown; ac: unknown }[],
): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const { ward, ac } of pairs) {
    const w = normWardKey(ward);
    const a = String(ac ?? "").trim();
    if (!w || !a) continue;
    const inner = votes.get(w) || new Map<string, number>();
    inner.set(a, (inner.get(a) || 0) + 1);
    votes.set(w, inner);
  }
  const out = new Map<string, string>();
  for (const [w, inner] of votes) {
    let best = "";
    let bestN = 0;
    for (const [a, n] of inner) {
      if (n > bestN) {
        best = a;
        bestN = n;
      }
    }
    if (best) out.set(w, best);
  }
  return out;
}

/** Group ward→count entries under their mapped AC (wards sorted desc inside each). */
export function groupWards(
  entries: [string, number][],
  wardToAc: Map<string, string>,
): WardGroup[] {
  const groups = new Map<string, Map<string, number>>();
  for (const [ward, n] of entries) {
    const key = normWardKey(ward);
    if (!key) continue;
    const ac = wardToAc.get(key) || UNMAPPED_WARDS;
    const g = groups.get(ac) || new Map<string, number>();
    g.set(ward, (g.get(ward) || 0) + n);
    groups.set(ac, g);
  }
  return [...groups.entries()]
    .map(([name, wards]) => ({
      name,
      value: [...wards.values()].reduce((s, x) => s + x, 0),
      wards: [...wards.entries()].sort((a, b) => b[1] - a[1]) as [string, number][],
    }))
    .sort((a, b) => b.value - a.value);
}
