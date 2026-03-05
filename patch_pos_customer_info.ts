import * as fs from 'fs';

let content = fs.readFileSync('app/admin/pos/page.tsx', 'utf-8');

const oldModalContent = `                    <div className="font-bold text-sm text-gray-900 font-cairo group-hover:text-blue-700 transition-colors">
                      {c.name || c.Name}
                    </div>
                    {c.phone && (
                      <div className="text-xs text-gray-500 mt-1 font-cairo">
                        {c.phone}
                      </div>
                    )}`;

const newModalContent = `                    <div className="flex justify-between items-start w-full gap-2">
                       <div className="flex flex-col gap-1 items-start">
                         <div className="font-bold text-sm text-gray-900 font-cairo group-hover:text-blue-700 transition-colors text-right">
                           {c.name || c.Name}
                         </div>
                         <div className="flex items-center gap-2 flex-wrap mt-0.5">
                           {c.phone && (
                             <span className="text-xs text-gray-500 font-cairo bg-gray-100 px-1.5 py-0.5 rounded">
                               {c.phone}
                             </span>
                           )}
                           {(c.customer_id || c.CustomerID || c.id) && (
                             <span className="text-xs text-blue-600 font-cairo bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title="رقم الزبون (النظام)">
                               #{c.customer_id || c.CustomerID || c.id}
                             </span>
                           )}
                           {c.external_id && (
                             <span className="text-xs text-purple-600 font-cairo bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100" title="رقم الشامل">
                               شامل: {c.external_id}
                             </span>
                           )}
                         </div>
                       </div>
                       
                       {/* Balance display */}
                       <div className="flex flex-col items-end shrink-0">
                         <span className="text-[10px] text-gray-500 font-cairo mb-0.5">الرصيد</span>
                         <span dir="ltr" className={\`text-sm font-bold font-cairo \${(c.balance || 0) < 0 ? 'text-red-600' : (c.balance || 0) > 0 ? 'text-green-600' : 'text-gray-700'}\`}>
                           {(c.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪
                         </span>
                       </div>
                    </div>`;

content = content.replace(oldModalContent, newModalContent);

fs.writeFileSync('app/admin/pos/page.tsx', content);
console.log('Done');
