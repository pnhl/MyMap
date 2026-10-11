import {env} from '../config/env';

/** Resource authentication exists only in the current WebView document's memory. */
export function gatewayWebPrelude(token: string): string {
  const literal = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `
    const gatewayBase=${literal(env.routingGatewayUrl.replace(/\/+$/, '') + '/')};
    const gatewayToken=${literal(token)};
    const isProtectedResource=url=>gatewayBase!=='/'&&String(url).startsWith(gatewayBase);
    const resourceHeaders=url=>isProtectedResource(url)&&gatewayToken?{Authorization:'Bearer '+gatewayToken}:{};
    const loadResourceImage=(image,url,done)=>{
      if(!isProtectedResource(url)){image.onload=()=>done&&done();image.onerror=()=>done&&done(new Error('Image unavailable'));image.src=url;return;}
      fetch(url,{headers:resourceHeaders(url),redirect:'error',cache:'no-store'})
        .then(response=>{if(!response.ok)throw new Error('Map resource unavailable');return response.blob();})
        .then(blob=>{const objectUrl=URL.createObjectURL(blob);image.onload=()=>{URL.revokeObjectURL(objectUrl);if(done)done();};image.onerror=()=>{URL.revokeObjectURL(objectUrl);if(done)done(new Error('Map resource unavailable'));};image.src=objectUrl;})
        .catch(()=>{if(done)done(new Error('Map resource unavailable'));});
    };
    const leafletResourceLayer=(url,options)=>{
      if(!isProtectedResource(url))return L.tileLayer(url,options);
      const AuthenticatedTiles=L.TileLayer.extend({createTile:function(coords,done){const image=document.createElement('img');image.alt='';image.setAttribute('role','presentation');loadResourceImage(image,this.getTileUrl(coords),error=>done(error,image));return image;}});
      return new AuthenticatedTiles(url,options);
    };
  `;
}
