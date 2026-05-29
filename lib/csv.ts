import Papa from "papaparse";

// Evercall出力フォーマット定義（2行ヘッダー構造）
// header: 1行目のシステム列名、label: 2行目の補足ラベル、dbCol: DBの列名（nullは空欄）
export const EVERCALL_EXPORT_COLUMNS = [
  { header: "電話番号",  label: "",         dbCol: "電話番号"  },
  { header: "カナ",      label: "",         dbCol: null        },
  { header: "名前",      label: "店名",     dbCol: "名前"      },
  { header: "郵便番号",  label: "",         dbCol: null        },
  { header: "住所１",    label: "都道府県", dbCol: "住所1"     },
  { header: "住所２",    label: "住所",     dbCol: "住所2"     },
  { header: "代表者名",  label: "",         dbCol: null        },
  { header: "携帯番号",  label: "",         dbCol: "携帯番号"  },
  { header: "本社番号",  label: "",         dbCol: null        },
  { header: "URL",       label: "",         dbCol: null        },
  { header: "好適時間",  label: "",         dbCol: null        },
  { header: "会社名",    label: "",         dbCol: null        },
  { header: "備考７",    label: "席数",     dbCol: "席数"      },
  { header: "備考８",    label: "定休日",   dbCol: "定休日"    },
  { header: "備考９",    label: "ジャンル", dbCol: "ジャンル"  },
  { header: "備考１０",  label: "担当者",   dbCol: "担当者"    },
  { header: "メモ",      label: "",         dbCol: null        },
  { header: "時間振り",  label: "",         dbCol: "時間振り"  },
] as const;

export function parseCSV(content: string): Promise<{
  headers: string[];
  data: Record<string, string>[];
  errors: Papa.ParseError[];
}> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          data: results.data,
          errors: results.errors,
        });
      },
      error: (error: Error) => {
        resolve({
          headers: [],
          data: [],
          errors: [{ message: error.message, type: "FieldMismatch", code: "TooFewFields", row: 0 }],
        });
      },
    });
  });
}

export function generateCSV(
  headers: string[],
  data: Record<string, string>[]
): string {
  return Papa.unparse({
    fields: headers,
    data: data.map((row) =>
      headers.reduce((acc, header) => {
        acc[header] = row[header] ?? "";
        return acc;
      }, {} as Record<string, string>)
    ),
  });
}

function csvField(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function generateEvercallCSV(data: Record<string, string>[]): string {
  const row1 = EVERCALL_EXPORT_COLUMNS.map(c => csvField(c.header)).join(",");
  const row2 = EVERCALL_EXPORT_COLUMNS.map(c => csvField(c.label)).join(",");
  const dataRows = data.map(row =>
    EVERCALL_EXPORT_COLUMNS.map(c => csvField(c.dbCol ? (row[c.dbCol] ?? "") : "")).join(",")
  );
  return [row1, row2, ...dataRows].join("\r\n");
}

export function extractPhoneNumber(data: Record<string, string>): string | null {
  const phoneColumns = ["電話番号", "phone", "phone_number", "tel", "telephone", "携帯", "電話"];
  for (const column of phoneColumns) {
    const value = data[column];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

// 精査ファイルのカラム名をリストDBのカラム名に正規化
export function mapCsvColumnsToDb(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "住所１") {
      result["住所1"] = value;
    } else if (key === "住所２") {
      result["住所2"] = value;
    } else if (key === "番号確認") {
      result["電話番号確認"] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function validateCSV(
  headers: string[],
  requiredFields: string[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (headers.length === 0) {
    errors.push("CSVファイルにヘッダーが含まれていません");
  }
  for (const field of requiredFields) {
    if (!headers.includes(field)) {
      errors.push(`必須カラム '${field}' が見つかりません`);
    }
  }
  return { valid: errors.length === 0, errors };
}
