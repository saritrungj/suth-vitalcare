import type express from "express";

export interface RankingFilterValues {
  roleTypes: string[];
}

export interface UserFilterSql {
  sql: string;
  p: any[];
  hasFilters: boolean;
}

export interface RankingFilterOptions {
  roleTypes: string[];
}

const splitFilterValue = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((v) => String(v || "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
};

export const parseRankingFilterValues = (
  query: Pick<express.Request, "query">["query"] | Record<string, unknown>,
): RankingFilterValues => ({
  roleTypes: splitFilterValue((query as any).role_type),
});

export const buildUserFilterFromValues = (
  filters: RankingFilterValues,
  alias: string,
): UserFilterSql => {
  let sql = "";
  const p: any[] = [];
  if (filters.roleTypes.length) {
    sql += ` AND ${alias}.role_type IN (?)`;
    p.push(filters.roleTypes);
  }
  return { sql, p, hasFilters: p.length > 0 };
};

export const buildUserFilter = (
  req: express.Request,
  alias: string,
): UserFilterSql =>
  buildUserFilterFromValues(parseRankingFilterValues(req.query), alias);

export const collectRankingFilterOptions = (
  rows: Array<{
    role_type?: string | null;
  }>,
): RankingFilterOptions => {
  const roleTypeSet = new Set<string>();

  for (const row of rows) {
    const roleType = String(row.role_type || "").trim();

    if (roleType) roleTypeSet.add(roleType);
  }

  return {
    roleTypes: Array.from(roleTypeSet).sort((a, b) => a.localeCompare(b, "th")),
  };
};
