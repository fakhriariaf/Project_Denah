const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

const idKeys = {
  "production.col_spk_linked": "Terkait SPK",
  "production.col_material_desc": "Uraian Material",
  "production.col_kavling": "Unit Kavling",
  "production.col_est_cost": "Estimasi Biaya",
  "production.col_req_date": "Tanggal Ajuan",
  "production.col_finance_status": "Status Keuangan",
  "production.mat_status_approved": "Disetujui",
  "production.mat_status_pending": "Menunggu Persetujuan",
  "production.mat_status_rejected": "Ditolak",
  "production.btn_submit_to_finance": "Ajukan ke Keuangan",
  "production.complaints_title": "Keluhan & Komplain Unit",
  "production.complaints_desc": "Pantau dan atasi komplain kualitas dari pembeli kavling.",
  "production.btn_new_complaint": "Buat Tiket Komplain",
  "production.col_ticket_no": "No. Tiket",
  "production.col_customer": "Konsumen",
  "production.col_complaint_desc": "Keluhan / Masalah",
  "production.col_report_date": "Tanggal Masuk",
  "production.status_open": "Terbuka",
  "production.status_done": "Selesai",
  "production.btn_resolve": "Selesaikan",
  "production.handover_calc_date": "Tanggal Kalkulasi:",
  "production.select_unit_cta": "Pilih Unit Proyek",
  "production.select_unit_desc": "Silakan pilih salah satu unit kavling di bawah menu master data atau daftar SPK aktif untuk menganalisis spesifikasi serta kalkulasi estimasi serah terima.",
  "production.materials_title": "Pengajuan Material & Logistik Lapangan",
  "production.materials_desc": "Daftar logistik material yang diajukan ke bagian keuangan perusahaan.",
  "production.btn_new_material": "Ajukan Material Baru",
  "production.col_req_no": "No. Pengajuan"
};

const enKeys = {
  "production.col_spk_linked": "Linked SPK",
  "production.col_material_desc": "Material Description",
  "production.col_kavling": "Lot Unit",
  "production.col_est_cost": "Estimated Cost",
  "production.col_req_date": "Request Date",
  "production.col_finance_status": "Finance Status",
  "production.mat_status_approved": "Approved",
  "production.mat_status_pending": "Pending Approval",
  "production.mat_status_rejected": "Rejected",
  "production.btn_submit_to_finance": "Submit to Finance",
  "production.complaints_title": "Unit Complaints & Quality Issue",
  "production.complaints_desc": "Monitor and resolve quality complaints from lot buyers.",
  "production.btn_new_complaint": "Create Complaint Ticket",
  "production.col_ticket_no": "Ticket No.",
  "production.col_customer": "Customer",
  "production.col_complaint_desc": "Complaint / Issues",
  "production.col_report_date": "Report Date",
  "production.status_open": "Open",
  "production.status_done": "Resolved",
  "production.btn_resolve": "Resolve",
  "production.handover_calc_date": "Calculation Date:",
  "production.select_unit_cta": "Select a Project Unit",
  "production.select_unit_desc": "Please select a lot unit from the list to analyze specifications and calculate estimation of handover.",
  "production.materials_title": "Field Material & Logistics Requests",
  "production.materials_desc": "List of material logistics requests submitted to corporate finance.",
  "production.btn_new_material": "Request New Material",
  "production.col_req_no": "Req No."
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
console.log('Successfully added remaining keys to dictionaries.ts!');
