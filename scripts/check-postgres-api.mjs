import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(
  process.argv[2] ?? new URL("../infrastructure/main.bicep", import.meta.url),
  "utf8",
);
const declarations = [...template.matchAll(
  /^\s*resource\s+\w+\s+'(Microsoft\.DBforPostgreSQL\/[^'@]+)@([^']+)'/gm,
)];
const expected = [
  "Microsoft.DBforPostgreSQL/flexibleServers",
  "Microsoft.DBforPostgreSQL/flexibleServers/databases",
  "Microsoft.DBforPostgreSQL/flexibleServers/firewallRules",
];

assert.deepEqual(
  declarations.map((match) => match[1]).sort(),
  expected.sort(),
  "The PostgreSQL API guard must cover the server, database and firewall resources",
);
for (const [, type, version] of declarations) {
  assert.equal(version, "2026-10-01", `${type} must use the reviewed stable API`);
}
console.log("PostgreSQL API guard: all 3 resource types use 2026-10-01 (GA)");
