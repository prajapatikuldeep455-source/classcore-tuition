const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'js', 'script.js');
const outDir = path.join(__dirname, 'js', 'features');
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const lines = fs.readFileSync(src, 'utf8').split('\n');

// We will split the file into chunks based on line boundaries
// Note: line numbers are 0-indexed in array.
const chunks = {
  'state.js': [0, 413],
  'utils.js': [414, 884],
  'students.js': [885, 1315],
  'batches_courses.js': [1316, 1540],
  'fees.js': [1541, 2403],
  'attendance_expenses.js': [2404, 3122],
  'settings_exams.js': [3123, 6208],
  'app.js': [6208, lines.length]
};

for (const [name, [start, end]] of Object.entries(chunks)) {
  const content = lines.slice(start, end).join('\n');
  const target = name === 'state.js' || name === 'app.js' 
    ? path.join(__dirname, 'js', name) 
    : path.join(__dirname, 'js', 'features', name);
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Wrote ${name} (${end-start} lines)`);
}
