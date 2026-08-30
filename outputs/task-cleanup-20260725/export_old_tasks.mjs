import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/jayantnahata/Desktop/ChatGPT Codex Folder/ReviewDashboardClone (from Claude)/outputs/task-cleanup-20260725";
const jsonPath = `${outputDir}/tasks-before-2026-07-05.json`;
const workbookPath = `${outputDir}/tasks-before-2026-07-05.xlsx`;
const previewPath = `${outputDir}/tasks-before-2026-07-05-preview.png`;

const raw = await fs.readFile(jsonPath, "utf8");
const tasks = JSON.parse(raw);

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Summary");
const sheet = workbook.worksheets.add("Tasks Before 2026-07-05");

summary.showGridLines = false;
sheet.showGridLines = false;

summary.getRange("A1:F1").merge();
summary.getRange("A1").values = [["Task Backup Before 2026-07-05"]];
summary.getRange("A2:F2").merge();
summary.getRange("A2").values = [["Generated on 2026-07-25 from production Review Dashboard"]];

summary.getRange("A4:B8").values = [
  ["Metric", "Value"],
  ["Cutoff Date", "2026-07-05"],
  ["Tasks Exported", tasks.length],
  ["Kept In Portal", 130],
  ["Source", "Production backup and live task API"],
];

summary.getRange("A1:F1").format.font = { bold: true, size: 16, color: "#1F2937" };
summary.getRange("A2:F2").format.font = { italic: true, color: "#64748B" };
summary.getRange("A4:B4").format.font = { bold: true, color: "#FFFFFF" };
summary.getRange("A4:B4").format.fill = { color: "#4338CA" };
summary.getRange("A5:B8").format.borders = { preset: "all", style: "thin", color: "#D1D5DB" };
summary.getRange("A4:B8").format.columnWidth = 24;
summary.getRange("B5:B8").format.horizontalAlignment = "right";
summary.freezePanes.freezeRows(4);

const headers = [[
  "Task ID",
  "Task Number",
  "Description",
  "Assigned Agency",
  "Department ID",
  "Source",
  "Status",
  "Priority",
  "Allocated Date",
  "Deadline Date",
  "Completion Date",
  "Created At",
  "Updated At",
  "Assigned Employee",
  "Assigned Username",
  "Secondary Employee",
  "Secondary Username",
  "Is Pinned",
  "Is Today",
  "Time Given",
  "Steno Comment",
  "Remarks",
  "Image URL",
]];

const rows = tasks.map((task) => ([
  task.id ?? null,
  task.task_number ?? "",
  task.description ?? "",
  task.assigned_agency ?? "",
  task.department_id ?? null,
  task.source ?? "",
  task.status ?? "",
  task.priority ?? "",
  task.allocated_date ?? "",
  task.deadline_date ?? "",
  task.completion_date ?? "",
  task.created_at ?? "",
  task.updated_at ?? "",
  task.assigned_employee_name ?? "",
  task.assigned_employee_display_username ?? "",
  task.secondary_assigned_employee_name ?? "",
  task.secondary_assigned_employee_display_username ?? "",
  task.is_pinned ? "Yes" : "No",
  task.is_today ? "Yes" : "No",
  task.time_given ?? "",
  task.steno_comment ?? "",
  task.remarks ?? "",
  task.image_url ?? "",
]));

sheet.getRangeByIndexes(0, 0, 1, headers[0].length).values = headers;
if (rows.length) {
  sheet.getRangeByIndexes(1, 0, rows.length, headers[0].length).values = rows;
}

sheet.getRangeByIndexes(0, 0, 1, headers[0].length).format.font = { bold: true, color: "#FFFFFF" };
sheet.getRangeByIndexes(0, 0, 1, headers[0].length).format.fill = { color: "#1D4ED8" };
sheet.getRangeByIndexes(0, 0, rows.length + 1, headers[0].length).format.borders = { preset: "all", style: "thin", color: "#D1D5DB" };
sheet.freezePanes.freezeRows(1);

sheet.getRange(`A2:A${rows.length + 1}`).setNumberFormat("0");
sheet.getRange(`E2:E${rows.length + 1}`).setNumberFormat("0");

const dateColumns = ["I", "J"];
for (const col of dateColumns) {
  sheet.getRange(`${col}2:${col}${rows.length + 1}`).setNumberFormat("yyyy-mm-dd");
}

const dateTimeColumns = ["L", "M"];
for (const col of dateTimeColumns) {
  sheet.getRange(`${col}2:${col}${rows.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
}

sheet.getRange("A:W").format.wrapText = false;
sheet.getRange("C:C").format.columnWidth = 48;
sheet.getRange("D:D").format.columnWidth = 22;
sheet.getRange("K:K").format.columnWidth = 16;
sheet.getRange("L:M").format.columnWidth = 20;
sheet.getRange("N:Q").format.columnWidth = 20;
sheet.getRange("T:U").format.columnWidth = 32;
sheet.getRange("V:W").format.columnWidth = 24;
sheet.getUsedRange().format.autofitRows();

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

const preview = await workbook.render({ sheetName: "Summary", range: "A1:F8", scale: 2, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const inspect = await workbook.inspect({
  kind: "table",
  sheetId: "Tasks Before 2026-07-05",
  range: "A1:H8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 8,
  maxChars: 4000,
});

console.log(inspect.ndjson);
console.log(JSON.stringify({ workbookPath, previewPath, rows: tasks.length }, null, 2));
