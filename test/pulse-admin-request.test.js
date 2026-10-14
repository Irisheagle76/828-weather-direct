import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('admin editor includes checkbox choice in the actual publish request', async () => {
  const html=await readFile(new URL('../public/admin/tidbits/index.html',import.meta.url),'utf8');
  const start=html.indexOf('publishBtn.addEventListener("click", async () => {');
  const end=html.indexOf('// Init',start);
  const source=html.slice(start,end);
  for(const checked of [true,false]){
    let click, sent;
    const checkbox={checked};
    const context={
      publishBtn:{addEventListener(_name,fn){click=fn;},disabled:false},
      editor:{innerHTML:'<p>Clouds moving in.</p>'},
      publicationType:{value:'pulse'},eventTitle:{value:''},
      editingTimestamp:null,currentFile:null,currentMediaUrl:'',currentMediaType:null,
      hqImages:{files:[]},hqEnabled:{checked:false},headquartersGallery:[],
      mediaInput:{value:''},mediaFilename:{textContent:''},
      document:{getElementById(id){assert.equal(id,'notify-pulse');return checkbox;}},
      fetch:async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({pushResult:{sent:2,failed:0,skipped:false}})};},
      setStatus(){},clearEditingPulse(){},renderMediaLibrary(){},updatePreview(){},clearDraft(){},
      loadPublishedPulses:async()=>{},setTimeout(){},console
    };
    vm.runInNewContext(source,context);
    await click();
    assert.ok(sent,'Editor must submit a request');
    assert.equal(sent.sendPush,checked);
    assert.equal(sent.timestamp,null);
    assert.equal(checkbox.checked,false);
  }
});
