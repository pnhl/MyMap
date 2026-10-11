const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

exports.withGatewayMocks=(mocks={},globals={})=>{
 const input=globals.process?.env||{},env={routingGatewayUrl:input.EXPO_PUBLIC_ROUTING_GATEWAY_URL||'',routingProviders:input.EXPO_PUBLIC_ROUTING_PROVIDERS||'osrm,valhalla',osrmUrl:'https://router.project-osrm.org',valhallaUrl:'https://valhalla1.openstreetmap.de',...mocks['../config/env']?.env};
 const base=(env.routingGatewayUrl||'https://gateway.example.test').replace(/\/+$/,'');
 const gateway={gatewayUrl:value=>base+value,isGatewayUrl:value=>value.startsWith(base+'/'),gatewayCacheScope:()=> 'fixture-owner',gatewayFetch:(value,options)=>(globals.fetch||global.fetch)(base+value,options)};
 const module={exports:{}};const filename=path.resolve(__dirname,'../src/services/gatewayWebResources.ts');
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:()=>({env:{routingGatewayUrl:'',...env}})});
 return {'../config/env':{env},'./geoGateway':gateway,'../services/geoGateway':gateway,'./services/geoGateway':gateway,'../services/gatewayWebResources':module.exports,'../hooks/useGatewaySession':{useGatewaySession:()=>({owner:'',token:''})},...mocks,...(mocks.react?{react:{useState:initial=>[initial,()=>{}],...mocks.react}}:{})};
};
