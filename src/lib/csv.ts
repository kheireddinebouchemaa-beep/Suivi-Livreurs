// Parsing CSV robuste, partagé entre le Web Worker d'import et le reste de l'app.

// Décode un fichier CSV en texte : UTF-8 d'abord, puis re-décodage Windows-1252
// si des motifs de mojibake sont détectés (fichiers issus de scripts de fusion non-UTF-8).
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  let text = new TextDecoder("utf-8").decode(buffer);
  const sample = text.slice(0, 5000);
  const looksLikeMojibake = /�/.test(sample) || /Ã./.test(sample) || /â€/.test(sample);
  if (looksLikeMojibake) {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text;
}

// Parseur CSV qui s'auto-adapte aux délimiteurs (, ; ou tab) et gère le BOM UTF-8
export function parseCSV(text: string): Record<string, any>[] {
  let cleanedText = text;
  // Retirer le BOM s'il existe (généré souvent par Excel pour signaler du UTF-8)
  if (cleanedText.startsWith("\ufeff")) {
    cleanedText = cleanedText.substring(1);
  }

  const lines: string[][] = [];
  let row: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  // Compter les délimiteurs potentiels sur le début de texte pour deviner le séparateur
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;

  let firstLineLength = cleanedText.indexOf("\n");
  if (firstLineLength === -1) firstLineLength = cleanedText.length;
  const limit = Math.min(firstLineLength, 2000);

  let inQ = false;
  for (let i = 0; i < limit; i++) {
    const char = cleanedText[i];
    if (char === '"') {
      inQ = !inQ;
    }
    if (!inQ) {
      if (char === ',') commaCount++;
      else if (char === ';') semiCount++;
      else if (char === '\t') tabCount++;
    }
  }

  let sep = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    sep = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    sep = '\t';
  }

  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    const nextChar = cleanedText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Sauter le second guillemet
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === sep && !insideQuotes) {
      row.push(currentField);
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField);
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
        lines.push(row);
      }
      row = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField !== "" || row.length > 0) {
    row.push(currentField);
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
      lines.push(row);
    }
  }

  if (lines.length === 0) return [];

  // Nettoyage et trim des en-têtes
  const headers = lines[0].map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const values = lines[r];
    const obj: Record<string, any> = {};
    let hasData = false;

    headers.forEach((header, index) => {
      let val = values[index];
      if (val === undefined) {
        val = "";
      } else {
        val = val.trim().replace(/^"|"$/g, "");
      }
      if (val !== "") {
        hasData = true;
      }
      if (header) {
        obj[header] = val;
      }
    });

    if (hasData) {
      rows.push(obj);
    }
  }
  return rows;
}
