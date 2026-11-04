export function normalizePedigree(raw) {

  if (!Array.isArray(raw)) return [];
  const used = new Set();
  return raw
    .slice(0, 14)
    .filter(
      (r) =>
        r &&
        Number.isInteger(r.id) &&
        r.id >= 0 &&
        r.id <= 1000000 &&
        !used.has(r.id) &&
        used.add(r.id),
    )

    .map((r) => {
      const out = { id: r.id };

      for (const key of ['name', 'species', 'color', 'pattern', 'finish', 'variant', 'mutation'])
        out[key] = typeof r[key] === 'string' ? r[key].slice(0, 32) : null;

      for (const key of ['generation', 'bodyRatio', 'finSize', 'eyeSize'])
        out[key] = Number.isFinite(r[key]) ? Math.max(0, Math.min(1000000, r[key])) : null;
      out.parents =
        Array.isArray(r.parents) &&
        r.parents.length === 2 &&
        r.parents.every((id) => Number.isInteger(id) && id >= 0 && id <= 1000000)
          ? r.parents
          : null;

      return out;
    });
}
