// A bounded proxy for NASA browse PNGs. Raw HDF5 never flows through this route.
const nasaHost='nisar.asf.earthdatacloud.nasa.gov';

export async function GET(request) {
  const url=new URL(request.url);
  const input=url.searchParams.get('url');
  if (!input || input.length>2000) return new Response('Missing or invalid image URL.',{status:400});
  let nasa;
  try { nasa=new URL(input); } catch { return new Response('Invalid URL.',{status:400}); }
  if (nasa.protocol!=='https:' || nasa.hostname!==nasaHost || nasa.port || nasa.username || nasa.password ||
      nasa.search || nasa.hash || !nasa.pathname.startsWith('/BROWSE/NISAR_L2_GCOV_') ||
      !/^\/BROWSE\/NISAR_L2_GCOV_[A-Z0-9_-]+\/NISAR_L2_PR_GCOV_[A-Z0-9_]+\/NISAR_L2_PR_GCOV_[A-Z0-9_]+\.png$/i.test(nasa.pathname)) {
    return new Response('Only ASF NISAR GCOV PNG previews are allowed.',{status:400});
  }
  const headers={Accept:'image/png'};
  if (process.env.EARTHDATA_TOKEN) headers.Authorization=`Bearer ${process.env.EARTHDATA_TOKEN}`;
  let upstream;
  try { upstream=await fetch(nasa,{headers,redirect:'error',signal:AbortSignal.timeout(16000)}); }
  catch { return new Response('NASA preview service unreachable.',{status:502}); }
  if (!upstream.ok) return new Response(`NASA preview not accessible (HTTP ${upstream.status}).`,{status:502});
  const type=upstream.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('image/png') && !type.toLowerCase().includes('application/octet-stream')) {
    return new Response('Unexpected preview response type.',{status:502});
  }
  const size=Number(upstream.headers.get('content-length')||0);
  if (size>24*1024*1024) return new Response('Preview exceeds 24MB limit.',{status:413});
  let body;
  try {body=await upstream.arrayBuffer();}
  catch {return new Response('Could not read preview image.',{status:502});}
  if (body.byteLength>24*1024*1024) return new Response('Preview exceeds 24MB limit.',{status:413});
  const png=new Uint8Array(body);
  if (png.length<8 || png[0]!==137 || png[1]!==80 || png[2]!==78 || png[3]!==71) return new Response('NASA response was not a PNG file.',{status:502});
  return new Response(body,{headers:{'Content-Type':'image/png','Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}});
}
