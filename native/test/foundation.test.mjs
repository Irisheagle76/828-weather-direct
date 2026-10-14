import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { apiRequestUrl, externalUrl } from '../src/urls.js';

test('native API transport uses explicit HTTPS origin and only router requests',()=>{
  assert.equal(apiRequestUrl('/api/router?route=weather'),'https://avlweather.com/api/router?route=weather');
  assert.equal(apiRequestUrl('https://attacker.test/api/router?route=weather'),null);
  assert.equal(apiRequestUrl('/admin/'),null);
  assert.equal(externalUrl('/hiking.html'),'https://avlweather.com/hiking.html');
  assert.equal(externalUrl('javascript:alert(1)'),null);
});
test('packaged interface is local and omits admin pages and browser push registration',async()=>{
  const config=JSON.parse(await fs.readFile(new URL('../capacitor.config.json',import.meta.url)));
  assert.equal(config.webDir,'www');
  assert.equal(config.server?.url,undefined);
  const html=await fs.readFile(new URL('../www/index.html',import.meta.url),'utf8');
  const bundle=await fs.readFile(new URL('../www/app.js',import.meta.url),'utf8');
  assert.match(html,/src=".\/app.js"/);
  assert.doesNotMatch(html,/src=".\/mobile.js"/);
  assert.doesNotMatch(bundle,/serviceWorker.register/);
  assert.match(bundle,/Native app notifications are being connected/);
  const inputs=JSON.parse(await fs.readFile(new URL('../www/build-inputs.json',import.meta.url)));
  assert.ok(inputs.some(p=>p.replaceAll('\\','/').includes('public/mobile/mobile.js')));
  assert.ok(inputs.every(p=>!/(^|[\\/])(admin|lib|api)([\\/])|\.env/.test(p)));
  assert.equal(bundle.includes('const localPreview = true'),false);
});
test('both native platform projects are present with matching app identity',async()=>{
  const gradle=await fs.readFile(new URL('../android/app/build.gradle',import.meta.url),'utf8');
  const xcode=await fs.readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj',import.meta.url),'utf8');
  assert.match(gradle,/com.avlweather.app/);
  assert.match(xcode,/com.avlweather.app/);
});
