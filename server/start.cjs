'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {generate,root}=require('./creative-forge.cjs');
function createServer(options={}) {
  let busy=false, lastRequest=0;
  return http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/forge') {
      if(req.method!=='POST')return json(405,{error:'POST 요청만 지원합니다.'});
      // Local/private service. Prevent other web pages from spending the server key.
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return json(403,{error:'다른 사이트에서 요청할 수 없습니다.'});
      if(!String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'JSON 요청이 필요합니다.'});
      if(busy || Date.now()-lastRequest<2000)return json(429,{error:'잠시 후 다시 시도하세요.'});
      busy=true;lastRequest=Date.now();
      try {
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>12000){json(413,{error:'설명이 너무 깁니다.'});return;}chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch(_){return json(400,{error:'잘못된 JSON 요청입니다.'});}
        const result=await generate(body?.text,body?.name||'',options);
        json(200,result);
      }catch(e){json(e.status||502,{error:e.status?e.message:'AI 생성에 실패했습니다. 서버 설정을 확인하거나 다시 시도하세요.'});}
      finally{busy=false;}
      return;
    }
    if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);return res.end();}
    const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(file!=='index.html' && !/^(?:js|css|assets)\/[\w/.-]+\.(?:js|css|png|jpg|jpeg|webp|svg)$/.test(file)){res.writeHead(404);return res.end();}
    const resolved=path.resolve(root,file);
    if(!resolved.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
    fs.readFile(resolved,(err,data)=>{
      if(err){res.writeHead(404);return res.end();}
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
    });
  });
}
if(require.main===module)createServer({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'})
  .listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('오이붕: http://127.0.0.1:'+(Number(process.env.PORT)||3000)));
module.exports={createServer};
