const fs = require('fs');

const files = [
  'app/master/customers/customer-form.tsx',
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
    console.log(`\n=================== ${file} ===================`);
    
    // Find the onSubmit function
    const onSubmitIndex = content.indexOf('const onSubmit');
    if (onSubmitIndex !== -1) {
      const block = content.substring(onSubmitIndex, onSubmitIndex + 600);
      console.log(block);
    } else {
      const handleSubmitIndex = content.indexOf('const handleSubmit');
      if (handleSubmitIndex !== -1) {
        const block = content.substring(handleSubmitIndex, handleSubmitIndex + 600);
        console.log(block);
      } else {
        console.log("No onSubmit or handleSubmit found.");
      }
    }
  }
});
