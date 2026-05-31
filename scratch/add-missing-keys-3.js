const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

const idKeys = {
  "production.weight_lbl": "Bobot",
  "production.info_contractor": "Kontraktor Utama",
  "production.info_value": "Nilai Kontrak",
  "production.info_duration": "Durasi Pengerjaan",
  "production.info_spec": "Spesifikasi Teknis",
  "production.progress_title": "Detail Progres Lapangan",
  "production.progress_desc": "Riwayat input bobot kemajuan konstruksi unit.",
  "production.btn_handover_calc": "Hitung Estimasi Serah Terima",
  "production.construction_units_title": "Unit dalam Konstruksi",
  "production.status_overdue": "Terlambat",
  "production.status_construction": "Konstruksi",
  "production.field_weight": "Progres Fisik",
  "production.unit_detail_title": "Detail Unit & SPK",
  "production.unit_linked_spk": "SPK Aktif",
  "production.unit_no_spk": "Belum Ada SPK",
  "production.spk_component_title": "Komponen Pekerjaan SPK",
  "production.component_empty": "Belum ada komponen pekerjaan terdaftar.",
  "production.handover_est_title": "Estimasi Tanggal Serah Terima",
  "production.handover_empty": "Belum ada estimasi serah terima dihitung.",
  "production.handover_target_lbl": "Target Serah Terima:",
  "production.col_category": "Kategori"
};

const enKeys = {
  "production.weight_lbl": "Weight",
  "production.info_contractor": "Main Contractor",
  "production.info_value": "Contract Value",
  "production.info_duration": "Work Duration",
  "production.info_spec": "Technical Specs",
  "production.progress_title": "Field Progress Details",
  "production.progress_desc": "Unit construction progress weight input history.",
  "production.btn_handover_calc": "Calculate Handover Estimation",
  "production.construction_units_title": "Units Under Construction",
  "production.status_overdue": "Overdue",
  "production.status_construction": "Construction",
  "production.field_weight": "Physical Progress",
  "production.unit_detail_title": "Unit & SPK Details",
  "production.unit_linked_spk": "Active SPK",
  "production.unit_no_spk": "No SPK Issued",
  "production.spk_component_title": "SPK Work Components",
  "production.component_empty": "No work components registered yet.",
  "production.handover_est_title": "Estimated Handover Date",
  "production.handover_empty": "No handover estimation calculated yet.",
  "production.handover_target_lbl": "Handover Target:",
  "production.col_category": "Category"
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
console.log('Successfully added missing keys to dictionaries.ts!');
