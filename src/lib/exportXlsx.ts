import ExcelJS from "exceljs";

export type XlsxCell = string | number | boolean | Date | null | undefined;
export type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  widths?: number[];
  merges?: Array<[number, number, number, number]>;
};

const safeFilename = (value: string) =>
  value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "export.xlsx";

export async function exportWorkbook(filename: string, sheets: XlsxSheet[]) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || "Data");
    worksheet.addRows(sheet.rows);
    if (sheet.widths) {
      sheet.widths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = Math.max(4, Math.min(80, width));
      });
    }
    sheet.merges?.forEach(([startRow, startCol, endRow, endCol]) => {
      worksheet.mergeCells(startRow, startCol, endRow, endCol);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function exportObjects(
  filename: string,
  rows: Array<Record<string, unknown>>,
) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const values = rows.map((row) => headers.map((header) => row[header] as XlsxCell));
  return exportWorkbook(filename, [{ name: "Data", rows: [headers, ...values] }]);
}
