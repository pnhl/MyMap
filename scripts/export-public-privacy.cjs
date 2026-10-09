const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/content/legal.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleValue={exports:{}};
vm.runInNewContext(code,{module:moduleValue,exports:moduleValue.exports});
const {LEGAL_DOCUMENTS,LEGAL_VERSION}=moduleValue.exports;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const directory=path.join(root,'docs/admob-hosting');fs.mkdirSync(directory,{recursive:true});
for(const [id,document] of Object.entries(LEGAL_DOCUMENTS)){
  const body=document.sections.map(section=>`<section><h2>${escape(section.title)}</h2><p>${escape(section.body)}</p></section>`).join('\n');
  fs.writeFileSync(path.join(directory,id+'.html'),`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyMap · ${escape(document.title)}</title><style>body{margin:0;background:#faf9f6;color:#1f2c38;font:17px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:40px 24px}h1{font-size:32px;line-height:1.2}h2{font-size:21px;line-height:1.4;margin-top:32px}nav{display:flex;gap:18px;flex-wrap:wrap}a{color:#254ab4}p{white-space:pre-line}small{color:#5d6772}</style></head><body><main><nav><a href="privacy.html">Quyền riêng tư</a><a href="terms.html">Điều khoản</a><a href="about.html">Giới thiệu</a></nav><h1>MyMap · ${escape(document.title)}</h1><small>Phiên bản chính sách ${escape(LEGAL_VERSION)} · MyMap 1.0.0</small>${body}</main></body></html>`);
}
console.log('Public policy pages exported to docs/admob-hosting');
