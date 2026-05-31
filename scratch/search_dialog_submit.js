const fs = require('fs');
const files = [
  'app/master/customers/customer-form.tsx',
  'app/marketing/bookings/add-booking-dialog.tsx',
  'app/master/vendors/vendor-form.tsx',
  'app/master/units/unit-form.tsx',
  'app/master/projects/project-form.tsx',
  'app/master/work-items/work-item-form.tsx',
  'app/marketing/waiting-list/add-waiting-list-dialog.tsx',
  'app/marketing/targets/add-target-dialog.tsx',
  'app/marketing/leads/create-lead-dialog.tsx',
  'app/marketing/leads/add-followup-dialog.tsx',
  'app/marketing/leads/edit-lead-dialog.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    console.log(`\n=================== ${file} ===================`);
    
    // Find transition, success, alert, window.location.reload
    let found = false;
    lines.forEach((line, idx) => {
      if (line.includes('window.location.reload') || line.includes('alert(') || line.includes('setOpen(false)') || line.includes('setSuccess(') || line.includes('res.success')) {
        console.log(`${idx + 1}: ${line.trim()}`);
        found = true;
      }
    });
    if (!found) {
      console.log("No matching patterns found.");
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});
