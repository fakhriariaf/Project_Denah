const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

const idKeys = {
  "finance.expense_notes_ph": "Contoh: Biaya pasang listrik kavling B1...",
  "production.kpi_done": "Selesai",
  "production.kpi_this_year": "Tahun Ini",
  "production.kpi_overdue_desc": "Total SPK terlambat melewati batas target penyelesaian.",
  "production.kpi_avg_desc": "Rata-rata durasi penyelesaian konstruksi unit.",
  "production.kpi_complaints_desc": "Jumlah keluhan dan komplain kualitas dari konsumen.",
  "production.perf_board_title": "Papan Performa Kontraktor",
  "production.perf_board_desc": "Evaluasi performa penyelesaian pekerjaan fisik oleh rekanan kontraktor.",
  "production.perf_contractor_lbl": "Rekanan Kontraktor / Vendor",
  "production.perf_avg_progress": "Rerata Progres",
  "production.perf_total_spk": "Total SPK",
  "production.perf_done": "Selesai",
  "production.perf_overdue": "Terlambat",
  "production.btn_start_work": "Mulai Konstruksi",
  "production.btn_detail": "Detail",
  "production.spk_detail_lbl": "Rincian SPK",
  "production.btn_print_spmb": "Cetak SPMB",
  "production.btn_input_progress": "Input Progres",
  "production.btn_close": "Tutup"
};

const enKeys = {
  "finance.expense_notes_ph": "Example: Electricity installation cost for lot B1...",
  "production.kpi_done": "Done",
  "production.kpi_this_year": "This Year",
  "production.kpi_overdue_desc": "Total SPK overdue beyond target completion date.",
  "production.kpi_avg_desc": "Average unit construction completion duration.",
  "production.kpi_complaints_desc": "Number of quality complaints and issues from customers.",
  "production.perf_board_title": "Contractor Performance Board",
  "production.perf_board_desc": "Evaluate physical work completion performance by contractor partners.",
  "production.perf_contractor_lbl": "Contractor Partner / Vendor",
  "production.perf_avg_progress": "Avg Progress",
  "production.perf_total_spk": "Total SPK",
  "production.perf_done": "Done",
  "production.perf_overdue": "Overdue",
  "production.btn_start_work": "Start Construction",
  "production.btn_detail": "Detail",
  "production.spk_detail_lbl": "SPK Details",
  "production.btn_print_spmb": "Print SPMB",
  "production.btn_input_progress": "Input Progress",
  "production.btn_close": "Close"
};

const lines = content.replace(/\r\n/g, '\n').split('\n');

let idEndIndex = -1;
let enEndIndex = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('  },') && idEndIndex === -1) {
    idEndIndex = i; // Line with the closing brace of id
  } else if (line.trim() === '}' && idEndIndex !== -1 && enEndIndex === -1) {
    enEndIndex = i; // Line with the closing brace of en
  }
}

console.log(`idEndIndex: ${idEndIndex}, enEndIndex: ${enEndIndex}`);

const idLinesToAdd = Object.entries(idKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);
const enLinesToAdd = Object.entries(enKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);

lines.splice(idEndIndex, 0, ...idLinesToAdd);
enEndIndex += idLinesToAdd.length;
lines.splice(enEndIndex, 0, ...enLinesToAdd);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully added missing keys (4) to dictionaries.ts!');
