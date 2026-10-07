export type CsvTable = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(input: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headers = [], ...data] = rows;
  return {
    headers: headers.map((header) => header.replace(/^\uFEFF/, "").trim()),
    rows: data,
  };
}

export function findHeader(headers: string[], candidates: string[]) {
  const normalized = headers.map((header) =>
    header.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ""),
  );
  const wanted = candidates.map((candidate) =>
    candidate.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ""),
  );
  const index = normalized.findIndex((header) => wanted.includes(header));
  return index >= 0 ? String(index) : "none";
}
