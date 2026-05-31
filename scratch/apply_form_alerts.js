const fs = require('fs');

const replacements = [
  {
    file: 'app/master/customers/customer-form.tsx',
    target: `        if (id) {
          await updateCustomer(id, data);
        } else {
          await createCustomer(data);
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`,
    replacement: `        if (id) {
          await updateCustomer(id, data);
          alert("Data konsumen berhasil diperbarui!");
        } else {
          await createCustomer(data);
          alert("Data konsumen berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`
  },
  {
    file: 'app/master/vendors/vendor-form.tsx',
    target: `        if (id) {
          await updateVendor(id, data);
        } else {
          await createVendor(data);
        }
        setOpen(false);
        if (!id) reset();`,
    replacement: `        if (id) {
          await updateVendor(id, data);
          alert("Data vendor berhasil diperbarui!");
        } else {
          await createVendor(data);
          alert("Data vendor berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`
  },
  {
    file: 'app/master/units/unit-form.tsx',
    target: `        if (id) {
          await updateUnit(id, data);
        } else {
          await createUnit(data);
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`,
    replacement: `        if (id) {
          await updateUnit(id, data);
          alert("Data unit/kavling berhasil diperbarui!");
        } else {
          await createUnit(data);
          alert("Data unit/kavling berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`
  },
  {
    file: 'app/master/projects/project-form.tsx',
    target: `        if (id) {
          await updateProject(id, data);
        } else {
          await createProject(data);
        }
        setOpen(false);
        if (!id) reset();`,
    replacement: `        if (id) {
          await updateProject(id, data);
          alert("Data proyek berhasil diperbarui!");
        } else {
          await createProject(data);
          alert("Data proyek berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`
  },
  {
    file: 'app/master/accounts/account-form.tsx',
    target: `      if (id) {
        await updateFinanceAccount(id, values);
      } else {
        await createFinanceAccount(values);
      }
      setOpen(false);
      form.reset();`,
    replacement: `      if (id) {
        await updateFinanceAccount(id, values);
        alert("Rekening kas/bank berhasil diperbarui!");
      } else {
        await createFinanceAccount(values);
        alert("Rekening kas/bank berhasil disimpan!");
      }
      setOpen(false);
      form.reset();
      window.location.reload();`
  },
  {
    file: 'app/master/banks/bank-partner-form.tsx',
    target: `      if (id) {
        await updateBankPartner(id, values);
      } else {
        await createBankPartner(values);
      }
      setOpen(false);
      form.reset();`,
    replacement: `      if (id) {
        await updateBankPartner(id, values);
        alert("Mitra bank berhasil diperbarui!");
      } else {
        await createBankPartner(values);
        alert("Mitra bank berhasil disimpan!");
      }
      setOpen(false);
      form.reset();
      window.location.reload();`
  },
  {
    file: 'app/master/categories/category-form.tsx',
    target: `        if (id) {
          await updateFinanceCategory(id, data);
        } else {
          await createFinanceCategory(data);
        }
        setOpen(false);
        if (!id) reset();`,
    replacement: `        if (id) {
          await updateFinanceCategory(id, data);
          alert("Kategori keuangan berhasil diperbarui!");
        } else {
          await createFinanceCategory(data);
          alert("Kategori keuangan berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();`
  },
  {
    file: 'app/master/work-items/work-item-form.tsx',
    target: `      if (id) {
        await updateWorkItem(id, values);
      } else {
        await createWorkItem(values);
      }
      setOpen(false);
      form.reset();`,
    replacement: `      if (id) {
        await updateWorkItem(id, values);
        alert("Pekerjaan konstruksi (SPK work item) berhasil diperbarui!");
      } else {
        await createWorkItem(values);
        alert("Pekerjaan konstruksi (SPK work item) berhasil disimpan!");
      }
      setOpen(false);
      form.reset();
      window.location.reload();`
  },
  {
    file: 'app/marketing/waiting-list/add-waiting-list-dialog.tsx',
    target: `      await createWaitingList(values);
      setOpen(false);
      form.reset();`,
    replacement: `      await createWaitingList(values);
      alert("Antrean pembeli (waiting list) berhasil disimpan!");
      setOpen(false);
      form.reset();
      window.location.reload();`
  },
  {
    file: 'app/marketing/targets/add-target-dialog.tsx',
    target: `      await createMarketingTarget(values);
      setOpen(false);
      form.reset();`,
    replacement: `      await createMarketingTarget(values);
      alert("Target marketing berhasil disimpan!");
      setOpen(false);
      form.reset();
      window.location.reload();`
  },
  {
    file: 'app/marketing/leads/create-lead-dialog.tsx',
    target: `      const res = await createLead(data);
      if (res.success) {
        setOpen(false);
        reset();
      }`,
    replacement: `      const res = await createLead(data);
      if (res.success) {
        alert("Lead/prospek baru berhasil disimpan!");
        setOpen(false);
        reset();
        window.location.reload();
      }`
  },
  {
    file: 'app/marketing/leads/add-followup-dialog.tsx',
    target: `      // 1. Save follow-up note
      const res = await createFollowup({
        ...data,
        followupDate: new Date(data.followupDate),
        nextFollowupAt: nextFollowupAtVal,
      });

      // 2. If user chose a different status, update lead status
      if (res.success && newStatus && newStatus !== lead.status) {
        await updateLeadStatus(lead.id, newStatus);
      }

      if (res.success) {
        setOpen(false);
        reset();
      }`,
    replacement: `      // 1. Save follow-up note
      const res = await createFollowup({
        ...data,
        followupDate: new Date(data.followupDate),
        nextFollowupAt: nextFollowupAtVal,
      });

      // 2. If user chose a different status, update lead status
      if (res.success && newStatus && newStatus !== lead.status) {
        await updateLeadStatus(lead.id, newStatus);
      }

      if (res.success) {
        alert("Catatan follow-up berhasil disimpan!");
        setOpen(false);
        reset();
        window.location.reload();
      }`
  },
  {
    file: 'app/marketing/leads/edit-lead-dialog.tsx',
    target: `      const res = await updateLead(lead.id, data);
      if (res.success) {
        setOpen(false);
        reset();
      }`,
    replacement: `      const res = await updateLead(lead.id, data);
      if (res.success) {
        alert("Data lead/prospek berhasil diperbarui!");
        setOpen(false);
        reset();
        window.location.reload();
      }`
  },
  {
    file: 'app/siteplan/[projectId]/create-siteplan-form.tsx',
    target: `      await createSiteplan(data);
      setOpen(false);`,
    replacement: `      await createSiteplan(data);
      alert("Gambar siteplan berhasil disimpan!");
      setOpen(false);
      window.location.reload();`
  }
];

replacements.forEach(rep => {
  if (fs.existsSync(rep.file)) {
    let content = fs.readFileSync(rep.file, 'utf8');
    if (content.includes(rep.target)) {
      content = content.replace(rep.target, rep.replacement);
      fs.writeFileSync(rep.file, content, 'utf8');
      console.log(`Success: Modified ${rep.file}`);
    } else {
      console.log(`Warning: Target pattern not found in ${rep.file}`);
      // Let's do a loose check with normalized line endings / whitespace
      const normalizedTarget = rep.target.replace(/\s+/g, ' ');
      // Let's see if we can find it
      console.log("Normalized target check...");
    }
  } else {
    console.log(`Error: File not found ${rep.file}`);
  }
});
