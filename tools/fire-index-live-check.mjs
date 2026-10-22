import fs from 'node:fs';
import handler from '../lib/api-routes/drought-fire.js';
const started = Date.now();
let status, payload;
await handler({}, {setHeader() {}, status(n) {status=n; return this;}, json(value) {payload=value;}});
console.log(JSON.stringify({status, elapsedSeconds:(Date.now()-started)/1000, ...payload},null,2));
if (status !== 200) process.exitCode=1;
else {
  fs.mkdirSync('.tmp/fire-index', {recursive:true});
  fs.writeFileSync('.tmp/fire-index/live.json',JSON.stringify(payload,null,2));
}
