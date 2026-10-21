from fastapi import FastAPI, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from pathlib import Path
import os
import httpx

load_dotenv(Path(__file__).parent / '.env')

# Preview bridge: the site's /api routes live in the Next.js app.
NEXT_URL = os.environ['NEXT_INTERNAL_URL']
app = FastAPI()
client = httpx.AsyncClient(base_url=NEXT_URL, timeout=30)
HOP = {'host', 'content-length', 'connection', 'transfer-encoding', 'content-encoding'}


@app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    upstream = await client.request(request.method, f'/api/{path}', params=request.query_params,
                                    content=await request.body(), headers=headers)
    out = {k: v for k, v in upstream.headers.items() if k.lower() not in HOP}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=out)


@app.on_event('shutdown')
async def shutdown():
    await client.aclose()
