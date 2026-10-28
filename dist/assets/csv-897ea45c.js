function e(n){if(n==null)return"";const r=String(n);return/[",\r\n]/.test(r)?`"${r.replace(/"/g,'""')}"`:r}function s(n){return`"${(n==null?"":String(n)).replace(/"/g,'""')}"`}function f(n){return n==null?"":typeof n=="number"?Number.isFinite(n)?n:"":typeof n=="boolean"?n?"true":"false":typeof n=="object"?JSON.stringify(n):String(n)}function c(n,r){const i=[n.map(t=>e(t)).join(",")];for(const t of r)i.push(n.map(o=>e(f(t[o]))).join(","));return`${i.join(`\r
`)}\r
`}export{c as b,e,s as q};
