/**
 * Tiny dependency-free CSV reader for the lots import («استيراد من ملف»).
 * Handles quoted fields, commas or semicolons, CRLF, and a UTF-8 BOM —
 * which is exactly what an Excel export from a dealership looks like.
 */

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const sep = detectSeparator(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field.trim());
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function detectSeparator(src: string): "," | ";" {
  const head = src.slice(0, 2000);
  return (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";
}

export interface CsvMapping {
  title: number | null;
  price: number | null;
  increment: number | null;
  duration: number | null;
  category: number | null;
}

/** Header-name heuristics — Arabic and English variants a dealership file uses. */
export function guessMapping(headers: string[]): CsvMapping {
  const find = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = headers.findIndex((h) => p.test(h.trim()));
      if (i !== -1) return i;
    }
    return null;
  };
  return {
    title: find([/اسم|عنوان|القطعة|المنتج|الصنف|وصف/i, /title|name|item|product/i]),
    price: find([/سعر|البداية|افتتاح/i, /price|start|opening/i]),
    increment: find([/زيادة|مزايدة/i, /increment|step|raise/i]),
    duration: find([/مدة|دقائق|وقت/i, /duration|minutes|time/i]),
    category: find([/تصنيف|قسم|فئة/i, /category|section|type/i]),
  };
}
