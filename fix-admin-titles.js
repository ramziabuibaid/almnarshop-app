const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findFiles(filePath, filter, fileList);
        } else if (filter.test(filePath)) {
            fileList.push(filePath);
        }
    }

    return fileList;
}

const adminPath = path.join(__dirname, 'app/admin');
const pageFiles = findFiles(adminPath, /page\.tsx$/);

let createdCount = 0;

for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Match the first static literal assignment of document.title
    // Exclude matches that are assigning variables like document.title = title;
    const match = content.match(/document\.title\s*=\s*(['"])(.*?)\1/);

    if (match) {
        const title = match[2];
        // ignore if it's too short or just a variable
        if (title.length < 2) continue;

        const dir = path.dirname(file);
        const layoutPath = path.join(dir, 'layout.tsx');

        if (!fs.existsSync(layoutPath)) {
            const layoutContent = `import { Metadata } from "next";\n\nexport const metadata: Metadata = {\n  title: "${title}",\n};\n\nexport default function Layout({ children }: { children: React.ReactNode }) {\n  return <>{children}</>;\n}\n`;
            fs.writeFileSync(layoutPath, layoutContent, 'utf8');
            console.log(`Created layout.tsx for ${title} in ${dir}`);
            createdCount++;
        }
    }
}

console.log(`Finished checking. Created ${createdCount} layouts.`);
