import { promises as fs } from 'fs';
import { db } from '../db/index';
import { siteplans, projects } from '../db/schema/master';
import { eq } from 'drizzle-orm';
import path from 'path';

async function copyAndSetImage() {
  const sourcePath = 'C:\\Users\\fakhr\\.gemini\\antigravity-ide\\brain\\dddbf7b9-e304-41e8-b492-5e425908a020\\.tempmediaStorage\\media_dddbf7b9-e304-41e8-b492-5e425908a020_1779887864513.jpg';
  const destDir = path.join(process.cwd(), 'public', 'uploads', 'siteplans');
  const destPath = path.join(destDir, 'siteplan_user_new.jpg');

  try {
    // 1. Create dir if not exists
    await fs.mkdir(destDir, { recursive: true });
    
    // 2. Copy file
    await fs.copyFile(sourcePath, destPath);
    console.log('Image copied successfully to', destPath);

    // 3. Find Perumahan Majalengka project
    const projectRows = await db.select().from(projects).where(eq(projects.code, 'PRJ-002'));
    if (projectRows.length === 0) {
      console.log('Project PRJ-002 not found!');
      return;
    }
    const prjId = projectRows[0].id;

    // 4. Update the siteplan
    const siteplanRows = await db.select().from(siteplans).where(eq(siteplans.projectId, prjId));
    if (siteplanRows.length === 0) {
      console.log('Siteplan for PRJ-002 not found! Creating one...');
      await db.insert(siteplans).values({
        id: crypto.randomUUID(),
        projectId: prjId,
        name: 'Siteplan Majalengka',
        imageUrl: '/uploads/siteplans/siteplan_user_new.jpg',
        version: 1,
        isActive: true,
        createdAt: new Date(),
      });
    } else {
      console.log('Updating existing siteplan for PRJ-002...');
      await db.update(siteplans)
        .set({ imageUrl: '/uploads/siteplans/siteplan_user_new.jpg' })
        .where(eq(siteplans.id, siteplanRows[0].id));
    }
    
    console.log('Database updated successfully! URL: /uploads/siteplans/siteplan_user_new.jpg');

  } catch (err) {
    console.error('Error:', err);
  }
}

copyAndSetImage();
