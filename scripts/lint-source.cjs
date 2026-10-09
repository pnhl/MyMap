const fs=require('node:fs'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>/\.[cm]?tsx?$/.test(f)&&fs.existsSync(f));
let failures=0;
const approved={'react-native-google-mobile-ads':'src/components/NativeAdCardGoogle.tsx','@react-native-google-signin/google-signin':'src/components/GoogleFirebaseButtonNative.tsx'};
for(const file of new Set(files)){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const diagnostic of source.parseDiagnostics){console.error(file+': '+ts.flattenDiagnosticMessageText(diagnostic.messageText,' '));failures++;}
 for(const statement of source.statements){
  if(!ts.isImportDeclaration(statement)||!ts.isStringLiteral(statement.moduleSpecifier)||statement.importClause?.isTypeOnly)continue;
  const name=statement.moduleSpecifier.text;
  if(approved[name]&&approved[name]!==file){console.error(file+': Google-only SDK must load through the capability facade.');failures++;}
  if(/google-services\.json|GoogleService-Info\.plist/.test(name)){console.error(file+': Firebase private build configuration must not enter the JS bundle.');failures++;}
 }
}
if(failures)process.exitCode=1;else console.log('Source syntax and store-isolation lint passed.');
