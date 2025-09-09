import type { UserProfilePayload } from "@/api/users";

// Small CSV parser utilities used by the membership directory bulk upload.
// This intentionally keeps dependencies out of the bundle; for more
// robust parsing consider swapping to 'papaparse'.

function splitCSVLine(line: string) {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function normalizePhone(value?: string) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return String(value).trim();
}

export function parseUsersCsv(text: string): UserProfilePayload[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  // Normalize headers: trim, lowercase, and strip BOM if present
  const header = splitCSVLine(lines[0]).map((h) =>
    String(h || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  );
  const out: UserProfilePayload[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      // header[j] already normalized to lowercase
      row[header[j]] = (cols[j] || "").trim();
    }

    function parseBoolean(val?: string | undefined) {
      if (!val) return undefined;
      const v = String(val).trim().toLowerCase();
      return (
        v === "true" || v === "1" || v === "yes" || v === "y" || v === "on"
      );
    }

    const payload: UserProfilePayload = {
      displayName:
        row["displayname"] ||
        row["name"] ||
        row["full_name"] ||
        row["full name"] ||
        "",
      email: row["email"] || row["e-mail"] || "",
      phone: normalizePhone(
        row["phone"] || row["phonenumber"] || row["phone_number"] || ""
      ),
      ghinNumber: row["ghin"] || row["ghin_number"] || row["ghinnumber"] || "",
      photoURL: row["photo"] || row["photo_url"] || null,
      active:
        parseBoolean(row["active"]) ??
        parseBoolean(row["is_active"]) ??
        parseBoolean(row["isactive"]) ??
        parseBoolean(row["active?"]),
      registered:
        parseBoolean(row["registered"]) ??
        parseBoolean(row["is_registered"]) ??
        parseBoolean(row["isregistered"]) ??
        parseBoolean(row["registered?"]),
    };
    out.push(payload);
  }
  return out;
}
