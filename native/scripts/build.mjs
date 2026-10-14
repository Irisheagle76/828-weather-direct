import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nativeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot=path.resolve(nativeRoot,'../public');
const output=path.join(nativeRoot,'www');
await fs.mkdir(output,{recursive:true});
const plugin={
  name:'shared-mobile',
  setup(builder){
    builder.onResolve({filter:/^\//},args=>({path:path.join(publicRoot,args.path.split('?')[0])}));
    builder.onResolve({filter:/^\.\/notifications\.js$/},args=>{
      if(args.importer===path.join(publicRoot,'mobile','mobile.js'))return {path:path.join(nativeRoot,'src','notifications.js')};
    });
    builder.onLoad({filter:/live-look\.js$/},async args=>{
      const text=await fs.readFile(args.path,'utf8');
      return {contents:text.replace(/const localPreview = .*?;/,'const localPreview = false;'),loader:'js'};
    });
  }
};
await build({entryPoints:[path.join(nativeRoot,'src','entry.js')],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:path.join(output,'app.js'),plugins:[plugin],metafile:true}).then(async result=>{
  await fs.writeFile(path.join(output,'build-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs).map(p=>path.relative(path.resolve(nativeRoot,'..'),path.resolve(p))),null,2));
});
let html=await fs.readFile(path.join(publicRoot,'mobile','index.html'),'utf8');
html=html.replace('<script type="module" src="./mobile.js"></script>','<script type="module" src="./app.js"></script>').replace(/\s*<link rel="manifest"[^>]*>/,'');
await fs.writeFile(path.join(output,'index.html'),html);
await fs.copyFile(path.join(publicRoot,'mobile','mobile.css'),path.join(output,'mobile.css'));
await fs.copyFile(path.join(publicRoot,'828-brand-card.png'),path.join(output,'828-brand-card.png'));
await fs.mkdir(path.join(output,'images'),{recursive:true});
await fs.copyFile(path.join(publicRoot,'828-brand-card.png'),path.join(output,'images','828-brand-card.png'));
console.log('Native interface bundled into native/www (no admin pages or server secrets).');
