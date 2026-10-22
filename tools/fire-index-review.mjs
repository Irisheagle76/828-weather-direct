import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync('public/index.html','utf8');
const data = JSON.parse(fs.readFileSync('.tmp/fire-index/live.json','utf8'));
const start = html.indexOf('<article class="fold-tool-card fire"');
const card = html.slice(start, html.indexOf('</article>', start)+10).replace(' hidden>', '>');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('\n');
const css = fs.readFileSync('public/css/fire-curve.css','utf8');
const curve = fs.readFileSync('public/js/visuals/fire-curve.js','utf8').replaceAll('export function', 'function');
const helpers = html.slice(html.indexOf('    function fireHeadlineFor('), html.indexOf('    function updateText('));
const renderer = html.slice(html.indexOf('    function renderDroughtFireCard('), html.indexOf('    async function hydrateDroughtFireCard('));
const script = `function updateText(s,v){const e=document.querySelector(s);if(e)e.textContent=v;}
${curve}\n${helpers}\n${renderer}
renderDroughtFireCard(${JSON.stringify(data)});
document.querySelector('#fireInfoToggle').onclick=()=>{const open=document.querySelector('#fireInfoPanel').classList.toggle('open');document.querySelector('#fireInfoToggle').setAttribute('aria-expanded',String(open));};`;
new vm.Script(script);
const stamp = new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'});
fs.writeFileSync('.tmp/fire-index/review.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fire weather outlook review</title>${styles}<style>${css}\nbody{padding:24px}main{max-width:1000px;margin:auto}.fold-tool-card.fire{width:100%;box-sizing:border-box}@media(max-width:600px){body{padding:10px}.fold-tool-card.fire{padding:18px}}</style></head><body><main><p>Review snapshot · ${stamp} ET · Not a live forecast</p>${card}</main><script>${script}</script></body></html>`);
console.log(`Review updated: ${stamp} ET; peak fire ${data.outlook?.peak?.FRI}, ${data.outlook?.peak?.label}`);
