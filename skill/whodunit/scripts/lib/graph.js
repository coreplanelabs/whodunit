const escapeHtml = (text) => text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
// Self-contained: the report embeds this function in its local graph script.
export function routeGraphEdge(edge, geometry) {
    const a = geometry.nodes[edge.from], b = geometry.nodes[edge.to];
    if (geometry.vertical && (a.bottom <= b.top || b.bottom <= a.top)) {
        const down = b.top >= a.bottom, x = (a.left + a.right) / 2, y = down ? a.bottom : a.top, t = down ? b.top : b.bottom, incoming = geometry.edges.filter((e) => e.to === edge.to), port = incoming.findIndex((e) => e.from === edge.from), u = b.left + ((b.right - b.left) * (port + 1)) / (incoming.length + 1), blocked = Object.entries(geometry.nodes).some(([id, r]) => id !== edge.from &&
            id !== edge.to &&
            r.top < Math.max(y, t) &&
            r.bottom > Math.min(y, t) &&
            r.left < Math.max(x, u) + 2 &&
            r.right > Math.min(x, u) - 2);
        if (blocked) {
            const side = edge.kind === "contradicts" ? 6 : geometry.width - 6, sign = down ? 1 : -1;
            return `M ${x} ${y} L ${x} ${y + sign * 12} L ${side} ${y + sign * 12} L ${side} ${t - sign * 12} L ${u} ${t - sign * 12} L ${u} ${t}`;
        }
        const mid = (y + t) / 2;
        return `M ${x} ${y} C ${x} ${mid} ${u} ${mid} ${u} ${t}`;
    }
    const forward = b.left > a.left, x = forward ? a.right : a.left, y = (a.top + a.bottom) / 2, t = forward ? b.left : b.right, u = (b.top + b.bottom) / 2, mid = (x + t) / 2;
    if (Math.abs(a.left - b.left) < 5) {
        const down = b.top > a.top, center = (a.left + a.right) / 2, start = down ? a.bottom : a.top, end = down ? b.top : b.bottom, side = edge.kind === "contradicts" ? 6 : geometry.width - 6, sign = down ? 1 : -1;
        return `M ${center} ${start} L ${center} ${start + sign * 12} L ${side} ${start + sign * 12} L ${side} ${end - sign * 12} L ${center} ${end - sign * 12} L ${center} ${end}`;
    }
    const blocked = Object.entries(geometry.nodes).some(([id, r]) => id !== edge.from &&
        id !== edge.to &&
        r.left < Math.max(x, t) &&
        r.right > Math.min(x, t) &&
        r.top < Math.max(y, u) + 2 &&
        r.bottom > Math.min(y, u) - 2);
    if (blocked) {
        const sign = forward ? 1 : -1, floor = Math.max(...Object.values(geometry.nodes).map((r) => r.bottom)) + 10;
        return `M ${x} ${y} L ${x + sign * 10} ${y} L ${x + sign * 10} ${floor} L ${t - sign * 10} ${floor} L ${t - sign * 10} ${u} L ${t} ${u}`;
    }
    return `M ${x} ${y} C ${mid} ${y} ${mid} ${u} ${t} ${u}`;
}
export function renderGraph(graph, root, sources) {
    const selected = graph.focusId ?? graph.nodes[0].id;
    const columns = [...new Set(graph.nodes.map((n) => n.column))].sort((a, b) => a - b);
    const groups = columns
        .map((column) => `<div class="dg-column">${graph.nodes
        .filter((n) => n.column === column)
        .map((n) => `<button type="button" class="dg-node" data-node="${n.id}" aria-pressed="${n.id === selected}" aria-controls="${root}-source-${n.id}"><span>${escapeHtml(n.label)}</span></button>`)
        .join("")}</div>`)
        .join("");
    const panels = graph.nodes
        .map((n) => `<div id="${root}-source-${n.id}" data-panel="${n.id}"${n.id === selected ? "" : " hidden"}><p>${escapeHtml(n.detail)}</p>${sources(n.sourceIds)}</div>`)
        .join("");
    const data = JSON.stringify(graph.edges).replaceAll("<", "\\u003c");
    return `<div class="dg-report" aria-label="${escapeHtml(graph.title)}">
<h3>${escapeHtml(graph.title)}</h3>
<div class="dg-legend"><span><i class="dg-cause"></i>Failure path</span>${graph.edges.some((edge) => edge.kind === "supports") ? '<span><i class="dg-support"></i>Supporting evidence</span>' : ""}${graph.edges.some((edge) => edge.kind === "contradicts") ? '<span><i class="dg-against"></i>Evidence against</span>' : ""}</div>
<div class="dg-map" style="--dg-columns:${columns.length}"><svg class="dg-links" aria-hidden="true"><defs><marker id="${root}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs><g class="dg-paths"></g></svg><div class="dg-grid">${groups}</div></div>
<div class="dg-inspector" aria-live="polite">${panels}</div>
<style>
#${root}{--dg-cause:light-dark(#146C24,#3FF35D);--dg-against:light-dark(#8047AB,#AB69EB)}
#${root} .dg-report{margin:22px 0;container-type:inline-size;container-name:whodunit-graph}#${root} .dg-legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--dc-muted);font-size:12px;margin:12px 0}#${root} .dg-legend span{display:flex;align-items:center;gap:7px}#${root} .dg-legend i{display:inline-block;width:20px;border-top:2px solid var(--dg-cause)}#${root} .dg-legend .dg-support{border-top-style:dotted}#${root} .dg-legend .dg-against{border-color:var(--dg-against);border-top-style:dashed}
#${root} .dg-map{--dg-vertical:0;position:relative;padding:18px 16px}#${root} .dg-links{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}#${root} .dg-grid{position:relative;display:grid;grid-template-columns:repeat(var(--dg-columns),minmax(0,1fr));gap:34px;align-items:center}#${root} .dg-column{display:flex;flex-direction:column;gap:28px}#${root} .dg-node{position:relative;width:100%;min-height:82px;text-align:left;padding:15px 12px;font:inherit;color:var(--dc-fg);background:var(--dc-soft);border:1px solid var(--dc-line);border-radius:10px;overflow-wrap:anywhere;cursor:pointer}#${root} .dg-node[aria-pressed=true]{border-color:var(--dg-cause);background:var(--dc-bg);box-shadow:0 0 0 2px color-mix(in srgb,var(--dg-cause) 15%,transparent)}#${root} .dg-inspector{margin-top:12px;border-left:2px solid var(--dg-cause);padding:0 14px}#${root} .dg-inspector [hidden]{display:none}#${root} .dg-link{fill:none;stroke:var(--dg-cause);stroke-width:1.6}#${root} .dg-link[data-kind=contradicts]{stroke:var(--dg-against);stroke-dasharray:5 4}#${root} .dg-link[data-kind=supports]{stroke-dasharray:2 3}
@container whodunit-graph (max-width:600px){#${root} .dg-grid{grid-template-columns:1fr;gap:32px}#${root} .dg-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}#${root} .dg-column>.dg-node:last-child:nth-child(odd){grid-column:1 / -1}#${root} .dg-map{--dg-vertical:1;padding:12px 16px}#${root} .dg-node{min-height:64px;padding:12px 10px;font-size:13px}}
</style>
<script>
(()=>{
 const root=document.getElementById('${root}');if(!root)return;
 const map=root.querySelector('.dg-map'),svg=map.querySelector('svg'),paths=svg.querySelector('.dg-paths'),edges=${data};
 const nodes=Array.from(root.querySelectorAll('[data-node]')),panels=Array.from(root.querySelectorAll('[data-panel]'));
 const route=${routeGraphEdge.toString()};
 const draw=()=>{const box=map.getBoundingClientRect();svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);paths.replaceChildren();
 const geometry={width:box.width,vertical:getComputedStyle(map).getPropertyValue('--dg-vertical').trim()==='1',edges,nodes:Object.fromEntries(nodes.map(node=>{const r=node.getBoundingClientRect();return [node.dataset.node,{left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top}];}))};
 edges.forEach(edge=>{const d=route(edge,geometry);
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('class','dg-link');path.dataset.kind=edge.kind;path.setAttribute('marker-end','url(#${root}-arrow)');paths.append(path);});};
 nodes.forEach(node=>node.addEventListener('click',()=>{nodes.forEach(n=>n.setAttribute('aria-pressed',String(n===node)));panels.forEach(p=>p.hidden=p.dataset.panel!==node.dataset.node);}));
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(map);else window.addEventListener('resize',draw);draw();
})();
</script>
</div>`;
}
