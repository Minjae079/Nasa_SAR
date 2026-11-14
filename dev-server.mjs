// 수정된 부분: remove the unused stat import; retain both application API handlers.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GET as getCoverage} from './api/coverage.js';
import {GET as getPreview} from './api/preview.js';
import {GET as getDatabaseStatus} from './api/database-status.js';
import {GET as getAnalyses} from './api/analyses.js';
import {GET as getModelResults} from './api/model-results.js';
import {isPublicFile} from './lib/staticFiles.js';
import {existsSync} from 'node:fs';

if (existsSync(new URL('.env.local', import.meta.url))) {
  process.loadEnvFile(new URL('.env.local', import.meta.url));
}

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT || 3000);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,`http://localhost:${port}`);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {Allow: 'GET, HEAD'}); res.end('Method not allowed'); return;
    }
    const handler = {'/api/coverage': getCoverage, '/api/preview': getPreview,
      '/api/database-status': getDatabaseStatus, '/api/analyses': getAnalyses,
      '/api/model-results': getModelResults}[u.pathname];
    if (handler) {
      const response=await handler(new Request(u.href));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let requested=decodeURIComponent(u.pathname);
    if(requested==='/' || requested==='') requested='/index.html';
    if(!isPublicFile(requested)) {res.writeHead(404);res.end('Not found');return;}
    const full=path.resolve(root,requested.slice(1));
    if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(full);
    res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  }catch(e){res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`SARSCOPE: http://localhost:${port}`));
