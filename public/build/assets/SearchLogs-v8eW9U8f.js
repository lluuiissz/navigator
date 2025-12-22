import{c as l,o as a,a as e,r as f,b as D,d as K,w as N,e as b,t as m,f as S,g as w,h,v as q,n as T,K as O,F as V,j as Q,T as z,k as X,m as B}from"./app-B36RCrEp.js";import{A as Z}from"./AuthenticatedLayout-BHMzsPgO.js";import{_ as ee}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{r as J}from"./MagnifyingGlassIcon-D2rTjlO5.js";import{r as M}from"./XMarkIcon-BfXVdOSS.js";import{r as R}from"./ArrowPathIcon-CMw2NyzL.js";/* empty css            */import"./logo-C5fiQHXv.js";import"./reactive-ASLQ1Ber.js";function te(i,v){return a(),l("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24","stroke-width":"1.5",stroke:"currentColor","aria-hidden":"true","data-slot":"icon"},[e("path",{"stroke-linecap":"round","stroke-linejoin":"round",d:"M15.75 19.5 8.25 12l7.5-7.5"})])}function oe(i,v){return a(),l("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24","stroke-width":"1.5",stroke:"currentColor","aria-hidden":"true","data-slot":"icon"},[e("path",{"stroke-linecap":"round","stroke-linejoin":"round",d:"m8.25 4.5 7.5 7.5-7.5 7.5"})])}const se={class:"py-4 max-w-7xl mx-auto sm:px-4 bg-white min-h-screen"},re={class:"grid grid-cols-1 md:grid-cols-3 gap-3 mb-6"},ne={class:"bg-white border border-green-200 rounded-lg p-4"},ae={class:"text-3xl font-bold text-green-900"},le={class:"bg-white border border-green-200 rounded-lg p-4"},ie={class:"text-3xl font-bold text-green-900"},de={class:"bg-white border border-green-200 rounded-lg p-4"},ue={class:"text-3xl font-bold text-green-900"},ge={class:"flex flex-col sm:flex-row gap-3 mb-6"},pe={class:"relative flex-1 max-w-md"},ce={class:"flex items-center gap-2"},xe={class:"flex gap-2 ml-auto"},me=["disabled"],be={class:"mb-4 flex gap-2"},he={class:"flex items-center gap-2 text-sm"},ve={class:"flex items-center gap-2 text-sm"},fe={class:"bg-white border border-green-200 rounded-lg overflow-hidden"},we={key:0,class:"text-center py-12"},ye={key:1,class:"text-center py-12"},ke={key:2,class:"overflow-x-auto"},_e={class:"min-w-full divide-y divide-green-200 text-sm"},$e={class:"divide-y divide-green-100"},Se={class:"px-4 py-2 text-green-900 font-medium"},Ce={class:"px-4 py-2 text-green-800"},Le={class:"inline-flex px-2 py-1 bg-green-100 text-green-900 rounded text-xs font-medium truncate"},De={class:"px-4 py-2 text-green-700 text-xs"},Ae={class:"px-4 py-2"},je=["onClick"],Fe={key:3,class:"px-6 py-4 border-t border-green-200 bg-green-50"},Ne={class:"flex flex-col sm:flex-row items-center justify-between gap-3"},qe={class:"text-sm text-green-700"},Ue={class:"flex items-center gap-1"},Ee=["disabled"],Te={class:"flex gap-1"},Oe=["onClick","disabled"],Ve=["disabled"],Qe={class:"p-5 border-b border-green-200 flex items-center justify-between"},ze={class:"p-5 overflow-y-auto max-h-[calc(75vh-140px)]"},Be={class:"bg-green-50 rounded-lg p-4 mb-4"},Je={class:"text-xs text-green-800 overflow-auto max-h-80 font-mono"},Me={__name:"SearchLogs",props:{searchLogs:{type:Array,default:()=>[]},pagination:{type:Object,default:()=>({current_page:1,last_page:1,total:0,per_page:15,from:1,to:1})}},setup(i){const v=i,u=f(""),p=f(""),c=f(""),k=f(!1),C=f(!1),r=f(null),_=f("json"),$=D(()=>{let s=v.searchLogs;if(u.value){const t=u.value.toLowerCase();s=s.filter(o=>o.query?.toLowerCase().includes(t)||o.guest?.name?.toLowerCase().includes(t))}return(p.value||c.value)&&(s=s.filter(t=>{const o=new Date(t.search_at);if(p.value&&o<new Date(p.value))return!1;if(c.value){const d=new Date(c.value);if(d.setHours(23,59,59,999),o>d)return!1}return!0})),s}),L=D(()=>u.value||p.value||c.value),A=D(()=>({total:$.value.length,uniqueQueries:new Set($.value.map(s=>s.query)).size,activeGuests:new Set($.value.map(s=>s.guest_id)).size})),U=s=>new Date(s).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),G=s=>{r.value=s,C.value=!0},j=()=>{C.value=!1,r.value=null},P=()=>{if(!r.value)return;const s={id:r.value.id,guest:{id:r.value.guest_id,name:r.value.guest?.name||"Unknown"},query:r.value.query,searchedAt:r.value.search_at,createdAt:r.value.created_at},t=JSON.stringify(s,null,2),o=new Blob([t],{type:"application/json"}),d=window.URL.createObjectURL(o),g=document.createElement("a");g.href=d,g.download=`search-log-${r.value.id}.json`,g.click(),window.URL.revokeObjectURL(d)},W=()=>{if(!r.value)return;const s={id:r.value.id,guest:{id:r.value.guest_id,name:r.value.guest?.name||"Unknown"},query:r.value.query,searchedAt:r.value.search_at,createdAt:r.value.created_at},t=JSON.stringify(s,null,2),o=window.open("","","height=600,width=800");o.document.write(`
        <html>
            <head>
                <title>Search Log ${r.value.id}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
                    pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 4px; }
                    h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h2>Search Log Details</h2>
                <pre>${t}</pre>
            </body>
        </html>
    `),o.document.close(),o.print()},E=(s=!0)=>{const t=s?$.value:v.searchLogs;if(t.length===0){alert("No logs to export");return}const o=new Date().toLocaleString(),d=s?"Filtered":"All";if(_.value==="json"){const g=t.map(y=>({id:y.id,guest:{id:y.guest_id,name:y.guest?.name||"Unknown"},query:y.query,searchedAt:y.search_at,createdAt:y.created_at})),x=JSON.stringify(g,null,2),n=window.open("","","height=600,width=800");n.document.write(`
            <html>
                <head>
                    <title>Search Logs Export - ${d}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
                        pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 4px; font-size: 11px; }
                        h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
                        .info { font-size: 12px; color: #666; margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h2>Search Logs Export (${d})</h2>
                    <div class="info">
                        <p><strong>Total Records:</strong> ${t.length}</p>
                        <p><strong>Export Date:</strong> ${o}</p>
                        ${s&&L.value?`
                            <p><strong>Filters Applied:</strong> Yes</p>
                            ${u.value?`<p><strong>Search Query:</strong> ${u.value}</p>`:""}
                            ${p.value?`<p><strong>Date From:</strong> ${p.value}</p>`:""}
                            ${c.value?`<p><strong>Date To:</strong> ${c.value}</p>`:""}
                        `:"<p><strong>Filters Applied:</strong> No (All logs)</p>"}
                    </div>
                    <pre>${x}</pre>
                </body>
            </html>
        `),n.document.close(),n.print()}else{const g=t.map(n=>`
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${n.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${n.guest?.name||"Unknown"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${n.query}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${U(n.search_at)}</td>
            </tr>
        `).join(""),x=window.open("","","height=600,width=900");x.document.write(`
            <html>
                <head>
                    <title>Search Logs Export - ${d}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #333; }
                        td { padding: 10px; border-bottom: 1px solid #ddd; }
                        .info { font-size: 12px; color: #666; margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h2>Search Logs Export (${d})</h2>
                    <div class="info">
                        <p><strong>Total Records:</strong> ${t.length}</p>
                        <p><strong>Export Date:</strong> ${o}</p>
                        ${s&&L.value?`
                            <p><strong>Filters Applied:</strong> Yes</p>
                            ${u.value?`<p><strong>Search Query:</strong> ${u.value}</p>`:""}
                            ${p.value?`<p><strong>Date From:</strong> ${p.value}</p>`:""}
                            ${c.value?`<p><strong>Date To:</strong> ${c.value}</p>`:""}
                        `:"<p><strong>Filters Applied:</strong> No (All logs)</p>"}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Guest Name</th>
                                <th>Query</th>
                                <th>Search Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${g}
                        </tbody>
                    </table>
                </body>
            </html>
        `),x.document.close(),x.print()}},I=()=>{k.value=!0,B.reload({preserveState:!0,onFinish:()=>{k.value=!1}})},F=s=>{B.get("/search-logs",{page:s},{preserveState:!0,preserveScroll:!0})},Y=()=>{u.value="",p.value="",c.value=""},H=D(()=>{const s=v.pagination.current_page,t=v.pagination.last_page,o=2,d=[],g=[];for(let n=1;n<=t;n++)(n===1||n===t||n>=s-o&&n<=s+o)&&d.push(n);let x=0;for(let n of d)x&&(n-x===2?g.push(x+1):n-x!==1&&g.push("...")),g.push(n),x=n;return g});return(s,t)=>(a(),K(Z,null,{default:N(()=>[e("div",se,[t[21]||(t[21]=e("div",{class:"mb-6"},[e("h2",{class:"text-2xl font-bold text-green-900"},"Search Logs"),e("p",{class:"mt-1 text-sm text-green-700"},"Guest search activity")],-1)),e("div",re,[e("div",ne,[t[11]||(t[11]=e("p",{class:"text-xs text-green-700 uppercase tracking-wide font-semibold mb-1"},"Total Searches",-1)),e("p",ae,m(A.value.total),1)]),e("div",le,[t[12]||(t[12]=e("p",{class:"text-xs text-green-700 uppercase tracking-wide font-semibold mb-1"},"Unique Queries",-1)),e("p",ie,m(A.value.uniqueQueries),1)]),e("div",de,[t[13]||(t[13]=e("p",{class:"text-xs text-green-700 uppercase tracking-wide font-semibold mb-1"},"Active Guests",-1)),e("p",ue,m(A.value.activeGuests),1)])]),e("div",ge,[e("div",pe,[b(h(J),{class:"absolute left-3 top-2.5 h-4 w-4 text-green-600"}),S(e("input",{"onUpdate:modelValue":t[0]||(t[0]=o=>u.value=o),type:"text",placeholder:"Search query or guest...",class:"w-full pl-9 pr-8 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"},null,512),[[q,u.value]]),u.value?(a(),l("button",{key:0,onClick:t[1]||(t[1]=o=>u.value=""),type:"button",class:"absolute right-3 top-2.5 text-green-600 hover:text-green-900 transition-colors"},[b(h(M),{class:"w-4 h-4"})])):w("",!0)]),e("div",ce,[S(e("input",{type:"date","onUpdate:modelValue":t[2]||(t[2]=o=>p.value=o),class:"px-3 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"},null,512),[[q,p.value]]),t[14]||(t[14]=e("span",{class:"text-green-700 text-sm"},"to",-1)),S(e("input",{type:"date","onUpdate:modelValue":t[3]||(t[3]=o=>c.value=o),class:"px-3 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"},null,512),[[q,c.value]])]),e("div",xe,[L.value?(a(),l("button",{key:0,onClick:Y,class:"px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"}," Clear Filters ")):w("",!0),L.value&&$.value.length>0?(a(),l("button",{key:1,onClick:t[4]||(t[4]=o=>E(!0)),class:"px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"}," Export Filtered ")):w("",!0),v.searchLogs.length>0?(a(),l("button",{key:2,onClick:t[5]||(t[5]=o=>E(!1)),class:"px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"}," Export All ")):w("",!0),e("button",{onClick:I,disabled:k.value,type:"button",class:"p-2 text-green-700 hover:text-green-900 hover:bg-green-50 rounded-lg transition disabled:opacity-50"},[b(h(R),{class:T(["h-4 w-4",k.value?"animate-spin":""])},null,8,["class"])],8,me)])]),e("div",be,[e("label",he,[S(e("input",{type:"radio","onUpdate:modelValue":t[6]||(t[6]=o=>_.value=o),value:"json",class:"cursor-pointer text-green-900 focus:ring-green-900"},null,512),[[O,_.value]]),t[15]||(t[15]=e("span",{class:"text-green-800"},"JSON Format",-1))]),e("label",ve,[S(e("input",{type:"radio","onUpdate:modelValue":t[7]||(t[7]=o=>_.value=o),value:"table",class:"cursor-pointer text-green-900 focus:ring-green-900"},null,512),[[O,_.value]]),t[16]||(t[16]=e("span",{class:"text-green-800"},"Table Format",-1))])]),e("div",fe,[k.value?(a(),l("div",we,[b(h(R),{class:"h-6 w-6 animate-spin mx-auto text-green-600 mb-2"}),t[17]||(t[17]=e("p",{class:"text-sm text-green-700"},"Loading...",-1))])):i.searchLogs.length===0?(a(),l("div",ye,[b(h(J),{class:"h-8 w-8 mx-auto text-green-300 mb-2"}),t[18]||(t[18]=e("h3",{class:"text-lg font-semibold text-green-900 mb-2"},"No search logs found",-1)),t[19]||(t[19]=e("p",{class:"text-sm text-green-700"},"Search logs will appear here once guests start searching",-1))])):(a(),l("div",ke,[e("table",_e,[t[20]||(t[20]=e("thead",{class:"bg-green-50"},[e("tr",null,[e("th",{class:"px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase"},"Guest"),e("th",{class:"px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase"},"Query"),e("th",{class:"px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase"},"Date"),e("th",{class:"px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase"},"Action")])],-1)),e("tbody",$e,[(a(!0),l(V,null,Q(i.searchLogs,o=>(a(),l("tr",{key:o.id,class:"hover:bg-green-50 transition-colors"},[e("td",Se,m(o.guest?.name||"Unknown"),1),e("td",Ce,[e("span",Le,m(o.query),1)]),e("td",De,m(U(o.search_at)),1),e("td",Ae,[e("button",{onClick:d=>G(o),class:"text-green-600 hover:text-green-800 font-medium text-xs transition-colors"}," View ",8,je)])]))),128))])])])),i.pagination.last_page>1?(a(),l("div",Fe,[e("div",Ne,[e("div",qe," Showing "+m(i.pagination.from)+" to "+m(i.pagination.to)+" of "+m(i.pagination.total),1),e("div",Ue,[e("button",{onClick:t[8]||(t[8]=o=>F(i.pagination.current_page-1)),disabled:i.pagination.current_page===1,type:"button",class:"p-2 text-green-700 hover:text-green-900 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"},[b(h(te),{class:"w-4 h-4"})],8,Ee),e("div",Te,[(a(!0),l(V,null,Q(H.value,o=>(a(),l("button",{key:o,onClick:d=>typeof o=="number"&&F(o),disabled:typeof o!="number",type:"button",class:T(["px-3 py-1 text-sm rounded-lg transition",o===i.pagination.current_page?"bg-green-900 text-white font-medium":"text-green-700 hover:text-green-900 hover:bg-white",typeof o!="number"?"cursor-default hover:bg-transparent":""])},m(o),11,Oe))),128))]),e("button",{onClick:t[9]||(t[9]=o=>F(i.pagination.current_page+1)),disabled:i.pagination.current_page===i.pagination.last_page,type:"button",class:"p-2 text-green-700 hover:text-green-900 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"},[b(h(oe),{class:"w-4 h-4"})],8,Ve)])])])):w("",!0)])]),b(z,{name:"modal-fade"},{default:N(()=>[C.value?(a(),l("div",{key:0,class:"fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4",onClick:j},[b(z,{name:"modal-scale"},{default:N(()=>[C.value?(a(),l("div",{key:0,class:"bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[75vh] overflow-hidden",onClick:t[10]||(t[10]=X(()=>{},["stop"]))},[e("div",Qe,[t[22]||(t[22]=e("h3",{class:"text-lg font-semibold text-green-900"},"Search Log Details",-1)),e("button",{onClick:j,class:"text-green-700 hover:text-green-900 transition-colors"},[b(h(M),{class:"w-5 h-5"})])]),e("div",ze,[e("div",Be,[e("pre",Je,m(JSON.stringify({id:r.value?.id,guest:{id:r.value?.guest_id,name:r.value?.guest?.name||"Unknown"},query:r.value?.query,searchedAt:r.value?.search_at,createdAt:r.value?.created_at},null,2)),1)])]),e("div",{class:"p-5 border-t border-green-200 flex gap-3 justify-end"},[e("button",{onClick:P,class:"px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition-colors"}," Export JSON "),e("button",{onClick:W,class:"px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition-colors"}," Export PDF "),e("button",{onClick:j,class:"px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 hover:bg-green-50 rounded-lg transition-colors"}," Close ")])])):w("",!0)]),_:1})])):w("",!0)]),_:1})]),_:1}))}},Ze=ee(Me,[["__scopeId","data-v-23aa1378"]]);export{Ze as default};
