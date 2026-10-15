import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('More tab returns from a product detail to menu and notifications',async()=>{
  const source=await readFile(new URL('../public/mobile/mobile.js',import.meta.url),'utf8');
  const navigation=source.slice(source.indexOf('function showMoreMenu()'),source.indexOf('async function loadCore('));
  const elements={
    '#moreDetail':{hidden:false},'#moreMenu':{hidden:true},'.notification-settings':{hidden:true},
    '#screen-more':{},'#screen-home':{},'.bottom-nav':{},'#mainContent':{focus(){}}
  };
  const context={
    $:selector=>elements[selector],$$:()=>[],detailRenderId:5,
    history:{replaceState(){}},window:{scrollTo(){}}
  };
  vm.createContext(context);
  vm.runInContext(navigation,context);
  vm.runInContext('navigate("more")',context);
  assert.equal(elements['#moreDetail'].hidden,true);
  assert.equal(elements['#moreMenu'].hidden,false);
  assert.equal(elements['.notification-settings'].hidden,false);
  assert.equal(context.detailRenderId,6,'Returning invalidates pending detail work');
  elements['#moreDetail'].hidden=false;
  elements['#moreMenu'].hidden=true;
  elements['.notification-settings'].hidden=true;
  vm.runInContext('navigate("home"); navigate("more")',context);
  assert.equal(elements['#moreDetail'].hidden,true);
  assert.equal(elements['#moreMenu'].hidden,false);
  assert.equal(elements['.notification-settings'].hidden,false);
  assert.match(source,/#moreBack"\)\.addEventListener\("click", \(\) => navigate\("more"\)\)/);
});
