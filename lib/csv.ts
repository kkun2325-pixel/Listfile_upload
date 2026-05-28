import Papa from "papaparse";

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
