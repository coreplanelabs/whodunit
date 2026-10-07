export interface DebugGraph {
  title: string;
  focusId?: string;
  nodes: {
    id: string;
    label: string;
    detail: string;
    column: number;
    sourceIds: string[];
    assurance: "observed" | "reported" | "hypothesis" | "unknown";
  }[];
  edges: {
    from: string;
    to: string;
    kind: "causes" | "supports" | "contradicts";
  }[];
}
const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function renderGraph(
  graph: DebugGraph,
  root: string,
  sources: (ids: string[]) => string,
): string {
  const selected = graph.focusId ?? graph.nodes[0]!.id;
  const columns = [...new Set(graph.nodes.map((n) => n.column))].sort(
    (a, b) => a - b,
  );
  const groups = columns
    .map(
      (column) =>
        `<div class="dg-column">${graph.nodes
          .filter((n) => n.column === column)
          .map(
            (n) =>
              `<button type="button" class="dg-node" data-node="${n.id}" aria-pressed="${n.id === selected}" aria-controls="${root}-source-${n.id}"><span>${escapeHtml(n.label)}</span></button>`,
          )
          .join("")}</div>`,
    )
    .join("");
  const panels = graph.nodes
    .map(
      (n) =>
        `<div id="${root}-source-${n.id}" data-panel="${n.id}"${n.id === selected ? "" : " hidden"}><p>${escapeHtml(n.detail)}</p>${sources(n.sourceIds)}</div>`,
    )
    .join("");
  const data = JSON.stringify(graph.edges).replaceAll("<", "\\u003c");
  return `<div class="dg-report" aria-label="${escapeHtml(graph.title)}">
<h3>${escapeHtml(graph.title)}</h3>
<div class="dg-legend"><span><i class="dg-cause"></i>Failure path</span>${graph.edges.some((edge) => edge.kind === "supports") ? '<span><i class="dg-support"></i>Supporting evidence</span>' : ""}${graph.edges.some((edge) => edge.kind === "contradicts") ? '<span><i class="dg-against"></i>Evidence against</span>' : ""}</div>
<div class="dg-map" style="--dg-columns:${columns.length}"><svg class="dg-links" aria-hidden="true"><defs><marker id="${root}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs><g class="dg-paths"></g></svg><div class="dg-grid">${groups}</div></div>
<div class="dg-inspector" aria-live="polite">${panels}</div>
<style>
#${root}{--dg-cause:light-dark(#146C24,#3FF35D);--dg-against:light-dark(#8047AB,#AB69EB)}
#${root} .dg-report{margin:22px 0}#${root} .dg-legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--dc-muted);font-size:12px;margin:12px 0}#${root} .dg-legend span{display:flex;align-items:center;gap:7px}#${root} .dg-legend i{display:inline-block;width:20px;border-top:2px solid var(--dg-cause)}#${root} .dg-legend .dg-support{border-top-style:dotted}#${root} .dg-legend .dg-against{border-color:var(--dg-against);border-top-style:dashed}
#${root} .dg-map{position:relative;padding:18px 26px}#${root} .dg-links{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}#${root} .dg-grid{position:relative;display:grid;grid-template-columns:repeat(var(--dg-columns),minmax(0,1fr));gap:34px;align-items:center}#${root} .dg-column{display:flex;flex-direction:column;gap:28px}#${root} .dg-node{position:relative;width:100%;min-height:82px;text-align:left;padding:15px 12px;font:inherit;color:var(--dc-fg);background:var(--dc-soft);border:1px solid var(--dc-line);border-radius:10px;overflow-wrap:anywhere;cursor:pointer}#${root} .dg-node[aria-pressed=true]{border-color:var(--dg-cause);background:var(--dc-bg);box-shadow:0 0 0 2px color-mix(in srgb,var(--dg-cause) 15%,transparent)}#${root} .dg-inspector{margin-top:12px;border-left:2px solid var(--dg-cause);padding:0 14px}#${root} .dg-inspector [hidden]{display:none}#${root} .dg-link{fill:none;stroke:var(--dg-cause);stroke-width:1.6}#${root} .dg-link[data-kind=contradicts]{stroke:var(--dg-against);stroke-dasharray:5 4}#${root} .dg-link[data-kind=supports]{stroke-dasharray:2 3}
@media(max-width:600px){#${root} .dg-grid{grid-template-columns:1fr;gap:28px}#${root} .dg-column{gap:28px}#${root} .dg-map{padding:14px 30px}}
</style>
<script>
(()=>{
 const root=document.getElementById('${root}');if(!root)return;
 const map=root.querySelector('.dg-map'),svg=map.querySelector('svg'),paths=svg.querySelector('.dg-paths'),edges=${data};
 const nodes=Array.from(root.querySelectorAll('[data-node]')),panels=Array.from(root.querySelectorAll('[data-panel]'));
 const byId=new Map(nodes.map(n=>[n.dataset.node,n]));
 const draw=()=>{const box=map.getBoundingClientRect();svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);paths.replaceChildren();
 edges.forEach(edge=>{const a=byId.get(edge.from).getBoundingClientRect(),b=byId.get(edge.to).getBoundingClientRect();let d;
 if(Math.abs(a.left-b.left)<5&&edge.kind==='causes'){const x=a.left+a.width/2-box.left,y=b.top>a.top?a.bottom-box.top:a.top-box.top,t=b.top>a.top?b.top-box.top:b.bottom-box.top;d='M '+x+' '+y+' L '+x+' '+t;}
 else if(Math.abs(a.left-b.left)<5){const down=b.top>a.top,x=a.left+a.width/2-box.left,y=down?a.bottom-box.top:a.top-box.top,t=down?b.top-box.top:b.bottom-box.top,side=edge.kind==='contradicts'?10:box.width-10,sign=down?1:-1;d='M '+x+' '+y+' C '+x+' '+(y+sign*10)+' '+side+' '+(y+sign*10)+' '+side+' '+(y+sign*18)+' L '+side+' '+(t-sign*18)+' C '+side+' '+(t-sign*10)+' '+x+' '+(t-sign*10)+' '+x+' '+t;}
 else if(edge.kind==='contradicts'){const x=a.right-box.left,y=a.top+a.height/2-box.top,t=b.left+b.width/2-box.left,u=b.bottom-box.top,floor=Math.max(a.bottom,b.bottom)-box.top+12;d='M '+x+' '+y+' C '+(x+30)+' '+floor+' '+t+' '+floor+' '+t+' '+u;}
 else{const forward=b.left>a.left,x=forward?a.right-box.left:a.left-box.left,y=a.top+a.height/2-box.top,t=forward?b.left-box.left:b.right-box.left,u=b.top+b.height/2-box.top,m=(x+t)/2;d='M '+x+' '+y+' C '+m+' '+y+' '+m+' '+u+' '+t+' '+u;}
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('class','dg-link');path.dataset.kind=edge.kind;path.setAttribute('marker-end','url(#${root}-arrow)');paths.append(path);});};
 nodes.forEach(node=>node.addEventListener('click',()=>{nodes.forEach(n=>n.setAttribute('aria-pressed',String(n===node)));panels.forEach(p=>p.hidden=p.dataset.panel!==node.dataset.node);}));
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(map);else window.addEventListener('resize',draw);draw();
})();
</script>
</div>`;
}
