import "server-only";
import ExcelJS from "exceljs";

export type ExportColumn = { header: string; key: string; width?: number };

// Un nom de fichier lisible et sûr (accents remplacés, pas de caractères
// spéciaux) pour préfixer les exports par le nom du projet — sinon deux
// exports de projets différents portent le même nom de fichier générique.
export function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function buildXlsxResponse(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title?: string
): Promise<Response> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 20 }));

  let headerRowIndex = 1;
  if (title) {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 13 };
    sheet.mergeCells(1, 1, 1, columns.length);
    headerRowIndex = 2;
  }
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  headerRow.font = { bold: true };

  sheet.addRows(rows);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
