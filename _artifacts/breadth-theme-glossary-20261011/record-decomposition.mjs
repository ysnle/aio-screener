import { readFileSync, writeFileSync } from 'node:fs';
const path = 'architecture/decomposition-hotspots.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
const note = ' v57.39/P1621–P1623 keeps js/aio-chat.js +2 for the question-context compatibility facade after moving its selection implementation to src/ai/context/market-content.js; index.html glossary search styles move to native CSS and aio-core shrinks by one line. js/aio-pages.js +4 preserves distinct business-automation, medical-robot and humanoid classifications instead of merging unrelated companies to satisfy a sample floor. Classification accepts small groups while the strength model still requires three observed members. Record this bounded legacy registry/facade rationale in the eventual release commit.';
if (!data.history.includes('v57.39/P1621')) data.history += note;
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
