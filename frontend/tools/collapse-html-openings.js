const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []){
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const full = path.join(dir, file);
    if(fs.statSync(full).isDirectory()){
      walk(full, filelist);
    } else if(full.endsWith('.html')){
      filelist.push(full);
    }
  });
  return filelist;
}

function collapseOpeningTags(content){
  // This regex finds an opening tag where the '>' is on a following line
  // and attributes are split across lines. It collapses them into one line.
  // It attempts to be conservative: stops at the first '>' after attributes.
  return content.replace(/<([a-zA-Z0-9-:]+)\s*\n([\s\S]*?)\n\s*>/gm, (match, tag, attrs) => {
    // If attrs already contains a '>' then skip
    if(attrs.includes('>')) return match;
    // Collapse whitespace in attributes to single spaces, preserve binding syntax
    const single = attrs.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return `<${tag} ${single}>`;
  });
}

const root = path.join(__dirname, '..', 'src', 'app');
const files = walk(root);
let changed = 0;
files.forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  const out = collapseOpeningTags(txt);
  if(out !== txt){
    fs.writeFileSync(f, out, 'utf8');
    console.log('Updated', f);
    changed++;
  }
});
console.log(`Done. Files updated: ${changed}`);
