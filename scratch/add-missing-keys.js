const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

const idKeys = {
  "production.progress_photo_hint": "Maksimal 4 foto, format JPG/PNG/WebP, max 5MB",
  "production.progress_notes_ph": "Contoh: Pemasangan keramik lantai utama selesai dengan rapi...",
  "production.btn_save_progress": "Simpan Progress",
  "production.info_project": "Nama Proyek",
  "production.info_kavling": "Unit Kavling",
  "production.btn_next": "Lanjutkan",
  "production.material_desc_ph": "Detail material, volume, dan keperluan (Contoh: Semen 50 sak untuk cor pondasi)...",
  "production.material_lbl_urgency": "Tingkat Urgensi",
  "production.urgency_low": "Rendah (Stok Aman)",
  "production.urgency_medium": "Sedang (Hampir Habis)",
  "production.urgency_critical": "Sangat Mendesak (Habis)",
  "production.stock_safe": "Stok Cukup",
  "production.stock_low": "Menipis",
  "production.stock_critical": "Mendesak",
  "production.btn_back": "Kembali",
  "production.material_lbl_cost": "Estimasi Biaya",
  "production.material_cost_ph": "Masukkan nominal rupiah, contoh: 5000000",
  "production.material_est_cost_lbl": "Total Ajuan Material",
  "production.material_spk_ceiling": "Sisa Plafon Anggaran SPK",
  "production.btn_submit_material": "Kirim Ajuan Material",
  "production.cat_quality": "Kualitas",
  "production.cat_delay": "Keterlambatan",
  "production.cat_document": "Dokumen",
  "production.cat_payment": "Pembayaran",
  "production.cat_other": "Lainnya",
  "production.btn_submit_complaint": "Simpan Komplain",
  "production.dp_gate_paid": "Uang Muka (DP) Terbayar - SPK bisa diterbitkan",
  "production.dp_gate_warning": "Peringatan: Uang Muka (DP) Belum Lunas",
  "production.dp_gate_desc": "Konsumen belum melunasi kewajiban DP untuk unit ini. SPK sebaiknya ditangguhkan.",
  "production.spk_lbl_work_desc": "Deskripsi Detail Pekerjaan",
  "production.spk_title_ph": "Contoh: Pembangunan Fondasi dan Struktur Utama",
  "production.spk_work_desc_ph": "Masukkan rincian detail pekerjaan lapangan...",
  "production.spk_spec_ph": "Contoh: Semen Gresik, Besi Ulir 10mm, Batu Kali",
  "production.spk_rab_ph": "Masukkan nilai RAB SPK dalam rupiah",
  "production.rab_breakdown_title": "Rincian Anggaran Pekerjaan (RAB)",
  "production.btn_cancel": "Batal",
  "production.btn_publish_spk": "Terbitkan SPK",
  "production.btn_wait_dp": "Menunggu DP Lunas",
  "production.progress_lbl_component": "Komponen Pekerjaan",
  "production.progress_lbl_photos": "Foto Dokumentasi",
  "production.progress_photo_cta": "Klik atau seret foto ke sini untuk mengunggah",
  "production.handover_notes_ph": "Masukkan catatan perhitungan serah terima unit...",
  "production.btn_save_handover": "Simpan Estimasi Serah Terima",
  "production.complaint_desc_ph": "Rincian keluhan konsumen tentang kualitas bangunan..."
};

const enKeys = {
  "production.progress_photo_hint": "Maximum 4 photos, JPG/PNG/WebP format, max 5MB",
  "production.progress_notes_ph": "Example: Main floor tiling completed neatly...",
  "production.btn_save_progress": "Save Progress",
  "production.info_project": "Project Name",
  "production.info_kavling": "Lot Unit",
  "production.btn_next": "Next",
  "production.material_desc_ph": "Material details, volume, and usage (Example: 50 bags of cement for foundation)...",
  "production.material_lbl_urgency": "Urgency Level",
  "production.urgency_low": "Low (Safe Stock)",
  "production.urgency_medium": "Medium (Running Low)",
  "production.urgency_critical": "Critical (Out of Stock)",
  "production.stock_safe": "In Stock",
  "production.stock_low": "Low",
  "production.stock_critical": "Critical",
  "production.btn_back": "Back",
  "production.material_lbl_cost": "Estimated Cost",
  "production.material_cost_ph": "Enter amount in IDR, example: 5000000",
  "production.material_est_cost_lbl": "Total Material Request",
  "production.material_spk_ceiling": "Remaining SPK Budget Ceiling",
  "production.btn_submit_material": "Submit Material Request",
  "production.cat_quality": "Quality",
  "production.cat_delay": "Delay",
  "production.cat_document": "Document",
  "production.cat_payment": "Payment",
  "production.cat_other": "Other",
  "production.btn_submit_complaint": "Save Complaint",
  "production.dp_gate_paid": "Down Payment (DP) Paid - SPK can be issued",
  "production.dp_gate_warning": "Warning: Down Payment (DP) Not Fully Paid",
  "production.dp_gate_desc": "Customer has not settled DP obligation for this unit. SPK should be deferred.",
  "production.spk_lbl_work_desc": "Detailed Work Description",
  "production.spk_title_ph": "Example: Foundation and Main Structure Construction",
  "production.spk_work_desc_ph": "Enter details of field work description...",
  "production.spk_spec_ph": "Example: Gresik Cement, 10mm Deformed Bar, River Stone",
  "production.spk_rab_ph": "Enter SPK RAB value in Rupiah",
  "production.rab_breakdown_title": "Work Budget Details (BoQ)",
  "production.btn_cancel": "Cancel",
  "production.btn_publish_spk": "Issue SPK",
  "production.btn_wait_dp": "Awaiting DP Payment",
  "production.progress_lbl_component": "Work Component",
  "production.progress_lbl_photos": "Documentation Photos",
  "production.progress_photo_cta": "Click or drag photos here to upload",
  "production.handover_notes_ph": "Enter unit handover calculation notes...",
  "production.btn_save_handover": "Save Handover Estimation",
  "production.complaint_desc_ph": "Customer complaint details regarding building quality..."
};

// Split by lines
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

// Format new keys
const idLinesToAdd = Object.entries(idKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);
const enLinesToAdd = Object.entries(enKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);

// Insert id keys before idEndIndex
lines.splice(idEndIndex, 0, ...idLinesToAdd);

// Adjust enEndIndex because we added lines to id
enEndIndex += idLinesToAdd.length;

// Insert en keys before enEndIndex
lines.splice(enEndIndex, 0, ...enLinesToAdd);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully added missing keys to dictionaries.ts!');
