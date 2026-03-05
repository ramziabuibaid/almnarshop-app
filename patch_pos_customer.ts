import * as fs from 'fs';

let content = fs.readFileSync('app/admin/pos/page.tsx', 'utf-8');

// 1. Import CustomerFormModal
if (!content.includes('import CustomerFormModal')) {
    content = content.replace(
        "import { validateSerialNumbers } from '@/lib/validation';",
        "import { validateSerialNumbers } from '@/lib/validation';\nimport CustomerFormModal from '@/components/admin/CustomerFormModal';"
    );
}

// 2. Add isCustomerModalOpen to state
if (!content.includes('const [isCustomerModalOpen, setIsCustomerModalOpen]')) {
    content = content.replace(
        "const [showCustomerModal, setShowCustomerModal] = useState(false);",
        "const [showCustomerModal, setShowCustomerModal] = useState(false);\n  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);"
    );
}

// 3. Add handleCustomerAdded function
if (!content.includes('const handleCustomerAdded = async (newCustomerId?: string)')) {
    content = content.replace(
        "const [customerSearchQuery, setCustomerSearchQuery] = useState('');",
        "const [customerSearchQuery, setCustomerSearchQuery] = useState('');\n\n  const handleCustomerAdded = async (newCustomerId?: string) => {\n    const updatedCustomers = await getAllCustomers();\n    setCustomers(updatedCustomers);\n    if (newCustomerId) {\n      const newCustomer = updatedCustomers.find((c) => (c.customer_id || c.CustomerID || c.id) === newCustomerId);\n      if (newCustomer) {\n        setSelectedCustomerId(newCustomerId);\n        setCustomerSearchQuery(newCustomer.name || newCustomer.Name || '');\n        setShowCustomerModal(false);\n      }\n    }\n    setIsCustomerModalOpen(false);\n  };"
    );
}

// 4. Update the Customer Selection Modal in POS
const oldModalContent = `            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg font-cairo">اختر الزبون (ذمة مالية)</h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث عن زبون بالاسم أو رقم الهاتف..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-cairo text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 bg-gray-50/50">
              {customers
                .filter(c => {
                  const searchStr = customerSearchQuery.toLowerCase();
                  return (
                    (c.name || c.Name || '').toLowerCase().includes(searchStr) ||
                    (c.phone || '').includes(searchStr)
                  );
                })`;

const newModalContent = `            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg font-cairo">اختر الزبون (ذمة مالية)</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-cairo text-sm font-bold"
                  title="إضافة زبون جديد"
                >
                  <Plus size={16} />
                  <span>إضافة زبون</span>
                </button>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                  title="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث عن زبون بالاسم، رقم الهاتف، أو رقم الهوية..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-cairo text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 bg-gray-50/50">
              {customers
                .filter(c => {
                  const searchWords = customerSearchQuery.toLowerCase().trim().split(/\\s+/).filter(Boolean);
                  if (searchWords.length === 0) return true;
                  
                  const name = String(c.name || c.Name || '').toLowerCase();
                  const cid = String(c.customer_id || c.CustomerID || '').toLowerCase();
                  const phone = String(c.phone || c.Phone || '').toLowerCase();
                  const searchableText = \`\${name} \${cid} \${phone}\`;
                  
                  return searchWords.every((word) => searchableText.includes(word));
                })`;

content = content.replace(oldModalContent, newModalContent);

// 5. Add CustomerFormModal component at the end
const endTag = '    </AdminLayout>\n  );\n}\n';
const customerModalAdd = `    </AdminLayout>
      {isCustomerModalOpen && (
        <CustomerFormModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSuccess={handleCustomerAdded}
        />
      )}
  );
}
`;

content = content.replace(endTag, customerModalAdd);

fs.writeFileSync('app/admin/pos/page.tsx', content);
console.log('Done');
