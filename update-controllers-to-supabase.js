#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of controllers to update
const controllers = [
  'auth.js',
  'inventory.js',
  'quotations.js',
  'customers.js',
  'sales.js',
  'dashboard.js',
  'reports.js',
  'inventoryHistory.js',
  'costHistory.js',
  'deviceFingerprint.js'
];

// Backup directory
const backupDir = path.join(__dirname, 'controllers-mongodb-backup');

// Create backup directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Function to backup a file
function backupFile(filename) {
  const sourcePath = path.join(__dirname, 'controllers', filename);
  const backupPath = path.join(backupDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, backupPath);
    console.log(`✅ Backed up ${filename}`);
  }
}

// Function to update imports in a file
function updateImports(content) {
  // Remove MongoDB model imports
  content = content.replace(/const\s+\w+\s*=\s*require\(['"][^'"]*\/models\/[^'"]*['"]\);?\s*\n/g, '');
  
  // Add Supabase import at the top
  if (!content.includes("require('../config/supabase')")) {
    content = `const { supabase } = require('../config/supabase');\n${content}`;
  }
  
  // Add bcrypt if not present and needed
  if (content.includes('bcrypt') && !content.includes("require('bcryptjs')")) {
    content = `const bcrypt = require('bcryptjs');\n${content}`;
  }
  
  return content;
}

// Function to convert MongoDB queries to Supabase
function convertQueries(content) {
  // Convert find() operations
  content = content.replace(
    /await\s+(\w+)\.find\(\s*(\{[^}]*\})?\s*\)/g,
    'await supabase.from(\'$1\').select(\'*\')'
  );
  
  content = content.replace(
    /await\s+(\w+)\.find\(\)/g,
    'await supabase.from(\'$1\').select(\'*\')'
  );
  
  // Convert findById operations
  content = content.replace(
    /await\s+(\w+)\.findById\(([^)]+)\)/g,
    'await supabase.from(\'$1\').select(\'*\').eq(\'id\', $2).single()'
  );
  
  // Convert findOne operations
  content = content.replace(
    /await\s+(\w+)\.findOne\(\s*\{\s*(\w+):\s*([^}]+)\s*\}\s*\)/g,
    'await supabase.from(\'$1\').select(\'*\').eq(\'$2\', $3).single()'
  );
  
  // Convert create operations
  content = content.replace(
    /await\s+(\w+)\.create\(([^)]+)\)/g,
    'await supabase.from(\'$1\').insert([$2]).select().single()'
  );
  
  // Convert findByIdAndUpdate operations
  content = content.replace(
    /await\s+(\w+)\.findByIdAndUpdate\(([^,]+),\s*([^,]+),\s*[^)]*\)/g,
    'await supabase.from(\'$1\').update($3).eq(\'id\', $2).select().single()'
  );
  
  // Convert findByIdAndDelete operations
  content = content.replace(
    /await\s+(\w+)\.findByIdAndDelete\(([^)]+)\)/g,
    'await supabase.from(\'$1\').delete().eq(\'id\', $2).select().single()'
  );
  
  // Convert countDocuments operations
  content = content.replace(
    /await\s+(\w+)\.countDocuments\(\s*(\{[^}]*\})?\s*\)/g,
    'await supabase.from(\'$1\').select(\'*\', { count: \'exact\', head: true })'
  );
  
  return content;
}

// Function to update error handling
function updateErrorHandling(content) {
  // Add Supabase error handling pattern
  const errorHandlingPattern = `
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }
      throw error;
    }`;
  
  // This is a basic pattern - more sophisticated error handling would be needed
  return content;
}

// Function to update field names
function updateFieldNames(content) {
  // Convert MongoDB field names to PostgreSQL snake_case
  content = content.replace(/\.isActive/g, '.is_active');
  content = content.replace(/isActive:/g, 'is_active:');
  content = content.replace(/createdAt/g, 'created_at');
  content = content.replace(/updatedAt/g, 'updated_at');
  content = content.replace(/\.password\b/g, '.password_hash');
  content = content.replace(/password:/g, 'password_hash:');
  
  return content;
}

// Function to update a single controller
function updateController(filename) {
  const filePath = path.join(__dirname, 'controllers', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }
  
  console.log(`🔄 Updating ${filename}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Apply transformations
  content = updateImports(content);
  content = convertQueries(content);
  content = updateErrorHandling(content);
  content = updateFieldNames(content);
  
  // Write updated content
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filename}`);
}

// Main execution
console.log('🚀 Starting MongoDB to Supabase controller migration...\n');

// Backup all files first
console.log('📦 Creating backups...');
controllers.forEach(backupFile);
console.log('');

// Update each controller
console.log('🔄 Updating controllers...');
controllers.forEach(updateController);

console.log('\n✅ Migration completed!');
console.log('\n📋 Next steps:');
console.log('1. Review each updated controller manually');
console.log('2. Test each endpoint');
console.log('3. Fix any remaining MongoDB references');
console.log('4. Update table names to match your Supabase schema');
console.log('\n💾 Backups saved in: controllers-mongodb-backup/');
