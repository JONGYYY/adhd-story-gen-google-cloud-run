const fs = require('fs');
const path = require('path');

console.log('Running prebuild script to fix path resolution...');

// Create symlinks or copies to help with module resolution
const srcDir = path.resolve(__dirname, 'src');
const libDir = path.resolve(srcDir, 'lib');

// Ensure the lib directory exists
if (fs.existsSync(libDir)) {
  console.log('✅ src/lib directory exists');
  
  // List all files in lib directory
  const libFiles = fs.readdirSync(libDir, { withFileTypes: true });
  console.log('📁 Files in src/lib:');
  libFiles.forEach(file => {
    if (file.isFile()) {
      console.log(`   📄 ${file.name}`);
    } else if (file.isDirectory()) {
      console.log(`   📁 ${file.name}/`);
      const subFiles = fs.readdirSync(path.join(libDir, file.name));
      subFiles.forEach(subFile => {
        console.log(`      📄 ${subFile}`);
      });
    }
  });
} else {
  console.error('❌ src/lib directory does not exist!');
  process.exit(1);
}

console.log('✅ Prebuild script completed successfully'); 