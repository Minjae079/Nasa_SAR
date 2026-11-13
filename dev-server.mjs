// 수정된 부분: remove the unused stat import; retain both application API handlers.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GET as getCoverage} from './api/coverage.js';
import {GET as getPreview} from './api/preview.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT || 3000);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,`http://localhost:${port}`);
    if (u.pathname==='/api/coverage' || u.pathname==='/api/preview') {
      const response=await (u.pathname==='/api/coverage'? getCoverage:getPreview)(new Request(u.href));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let requested=decodeURIComponent(u.pathname);
    if(requested==='/' || requested==='') requested='/index.html';
    if(requested.startsWith('/api/')||requested.startsWith('/lib/')||requested==='/dev-server.mjs'||requested==='/package.json'||requested.includes('..')) {res.writeHead(404);res.end('Not found');return;}
    const full=path.resolve(root,requested.slice(1));
    if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(full);
    res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  }catch(e){res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`SARSCOPE: http://localhost:${port}`));
