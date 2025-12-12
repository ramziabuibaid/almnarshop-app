
// This file is a MIRROR of the Google Apps Script.
// If you modify this file, remind me to COPY/PASTE it to the Google Cloud Editor and Deploy.
// ==========================================
// 1. إعدادات النظام والثوابت
// ==========================================
const SPREADSHEET_ID = "1HH4lbAD7eBpiX14s9RT4T2mdDQColBfIBfz8_OdczHQ";
const IMAGES_FOLDER_ID = "1V4urFzmVibHsDUyJPkBah9jtkBzUZ1MM"; 

const SHEETS = {
  PRODUCTS: "Products",
  CUSTOMERS: "Customers",
  CRM: "CRM_Activity", // جدول متابعة الديون الجديد
  
  // الجداول القديمة (للقراءة فقط - الأرشيف المالي)
  SHOP_INVOICES: "ShopSalesInvoice",
  SHOP_DETAILS: "ShopSalesDetails",
  WH_INVOICES: "WarehouseSalesInvoice",
  WH_DETAILS: "WarehouseSalesDetails",
  SHOP_RECEIPTS: "ShopReceipts",
  WH_RECEIPTS: "WarhouseReceipts",
  
  // جداول الطلبات من الموقع
  WEB_ORDERS: "WebOrders",
  WEB_DETAILS: "WebOrderDetails",
  
  // نظام نقطة البيع النقدية (Cash POS)
  CASH_INVOICES: "CashInvoices",
  CASH_DETAILS: "CashDetails",
  
  // كاش الصور (لتسريع المتجر)
  CACHE_IMAGES: "System_Image_Cache" 
};

// ==========================================
// 2. معالجة طلبات القراءة (GET Router)
// ==========================================
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  
  // --- أ. خدمة عرض الصور (Image Proxy) ---
  if (params.imgId) {
    try {
      const file = DriveApp.getFileById(params.imgId);
      return ContentService.createResponseFromBlob(file.getBlob()).setMimeType(file.getMimeType());
    } catch (err) {
      return ContentService.createTextOutput("Img Error").setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // --- ب. واجهة التطبيق (API Routes) ---
  const action = params.action;
  let result = { status: "error", message: "Invalid action" };

  try {
    if (action === "login") {
      result = handleLogin(params.email);
    } else if (action === "getProducts") {
      result = getAllProductsCached();
    } else if (action === "getCustomerData") {
      result = getCustomerHistory(params.customerId);
    } else if (action === "getAllCustomers") {
      result = getAllCustomers();
    } else if (action === "getDashboardData") {
      result = getDashboardData(); // نظام التحصيل الجديد
    } else if (action === "getCashInvoices") {
      result = getCashInvoices(); // جلب الفواتير النقدية
    } else if (action === "getCashInvoice") {
      result = getCashInvoice(params.invoiceID); // جلب فاتورة واحدة
    }
  } catch (err) {
    result = { status: "error", message: err.toString() };
  }

  return jsonResponse(result);
}

// ==========================================
// 3. معالجة طلبات الكتابة (POST Router)
// ==========================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return jsonResponse({status:"error", message:"System Busy"}); }

  var result = { status: "error", message: "No action" };

  try {
    const postContent = e.postData && e.postData.contents ? e.postData.contents : "{}";
    const data = JSON.parse(postContent);

    // 1. طلبات المتجر
    if (data.action === "submitOrder") {
      result = saveCleanOrder(data.order);
    } 
    // 2. إدارة المنتجات والصور
    else if (data.action === "saveProduct") {
      result = saveProduct(data.product);
    } else if (data.action === "uploadImage") {
      result = saveImageToDrive(data.image);
    } 
    // 3. إدارة الزبائن
    else if (data.action === "saveCustomer") {
      result = saveCustomer(data.customer);
    } 
    // 4. نظام إدارة الذمم والتحصيل الجديد (CRM)
    else if (data.action === "logActivity") {
      // التعامل المرن مع البيانات (سواء جاءت في payload أو root)
      const payload = data.payload || data;
      result = logCRMBot(payload);
    } else if (data.action === "updatePTP") {
      const payload = data.payload || data;
      result = updatePTPStatus(payload);
    }
    // 5. نظام نقطة البيع النقدية (Cash POS)
    else if (data.action === "saveCashInvoice") {
      const payload = data.payload || data;
      result = saveCashInvoice(payload);
    } else if (data.action === "updateCashInvoice") {
      const payload = data.payload || data;
      result = updateCashInvoice(payload);
    }
    // غير معروف
    else {
      result = { status: "error", message: "Unknown action" };
    }

  } catch (err) {
    result = { status: "error", message: "Error: " + err.toString() };
  } finally {
    lock.releaseLock();
  }

  return jsonResponse(result);
}

// ==========================================
// 4. دوال المنتجات والصور (المنطق الكامل)
// ==========================================

function getAllProductsCached() {
  const rows = getSheetData(SHEETS.PRODUCTS);
  if (!rows || rows.length === 0) return { status: "success", data: [] };

  // جلب خريطة الصور من الكاش
  const imageMap = getImageMapFromSheet();

  // دمج المنتجات مع روابط الصور المباشرة
  const products = rows.map(p => {
    const getLink = (colVal) => {
      const rawName = String(colVal || "").split("/").pop();
      if (rawName && imageMap[rawName]) {
        return "https://lh3.googleusercontent.com/d/" + imageMap[rawName];
      }
      return "";
    };

    return {
      ...p,
      ImageUrl: getLink(p.Image),
      ImageUrl2: getLink(p["Image 2"]),
      ImageUrl3: getLink(p["image 3"])
    };
  });

  return { status: "success", data: products };
}

function saveProduct(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.PRODUCTS);
  if (!sheet) return { status: "error", message: "Product sheet not found" };

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  if (p.ProductID) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(p.ProductID)) {
        rowIndex = i + 1;
        break;
      }
    }
  }

  // ترتيب الأعمدة بدقة
  const rowData = [
    p.ProductID || ("PRD-" + Math.floor(Math.random() * 1000000)),
    p["Shamel No"] || "", p.Name || "", p.Barcode || "",
    Number(p.CS_War) || 0, Number(p.CS_Shop) || 0, Number(p.CostPrice)|| 0,
    Number(p.T1Price) || 0, Number(p.T2Price) || 0, Number(p.SalePrice)|| 0,
    p.Type || "", p.Brand || "", p.Size || "", p.Color || "", p.Origin || "",
    p.Dimention || "", p.Warranty || "",
    p.Image || "", p["Image 2"] || "", p["image 3"] || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    return { status: "success", message: "Updated", productId: rowData[0] };
  } else {
    sheet.appendRow(rowData);
    return { status: "success", message: "Added", productId: rowData[0] };
  }
}

function saveImageToDrive(imgData) {
  if (!imgData || !imgData.data) return { status: "error", message: "No data" };
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const mainFolder = DriveApp.getFolderById(IMAGES_FOLDER_ID);
    const subName = "Products_Images";
    
    // البحث عن المجلد الفرعي
    let targetFolder;
    const folders = mainFolder.getFoldersByName(subName);
    if (folders.hasNext()) targetFolder = folders.next();
    else targetFolder = mainFolder.createFolder(subName);

    // إنشاء اسم فريد
    const timestamp = new Date().getTime();
    const extension = (imgData.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const newFileName = "Prd_" + timestamp + "." + extension;

    // حفظ الملف
    const decoded = Utilities.base64Decode(imgData.data);
    const blob = Utilities.newBlob(decoded, imgData.type, newFileName);
    const file = targetFolder.createFile(blob);
    const fileId = file.getId();

    // التحديث اللحظي للكاش (لتظهر الصورة فوراً)
    const cacheSheet = ss.getSheetByName(SHEETS.CACHE_IMAGES);
    if (cacheSheet) {
      cacheSheet.appendRow([newFileName, fileId]);
    }
    
    return { status: "success", filePath: subName + "/" + newFileName, fileName: newFileName };
  } catch (e) {
    return { status: "error", message: "Drive Error: " + e.toString() };
  }
}

// ==========================================
// 5. إدارة الزبائن وتسجيل الدخول (المنطق الكامل)
// ==========================================

function getAllCustomers() {
  const customers = getSheetData(SHEETS.CUSTOMERS);
  return { status: "success", data: customers };
}

function handleLogin(email) {
  if (!email) return { status: "error", message: "Email required" };
  const users = getSheetData(SHEETS.CUSTOMERS);
  
  // بحث غير حساس لحالة الأحرف
  const cleanEmail = String(email).trim().toLowerCase();
  const user = users.find(c => String(c.Email || "").trim().toLowerCase() === cleanEmail);
  
  if (user) {
    return { 
      status: "success", 
      data: {
        CustomerID: user.CustomerID,
        Name: user.Name,
        ShamelNO: user.ShamelNO,
        Balance: user.Balance,
        Phone: user.Phone,
        Role: user.Role || "Customer"
      }
    };
  }
  return { status: "error", message: "User not found" };
}

function saveCustomer(c) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CUSTOMERS);
  if (!sheet) return { status: "error", message: "Sheet not found" };

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  let existingRow = [];

  if (c.CustomerID) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(c.CustomerID)) {
        rowIndex = i + 1;
        existingRow = data[i];
        break;
      }
    }
  }

  // دالة لتنسيق التاريخ
  const formatDate = (val) => {
    if (!val) return "";
    try {
      const d = new Date(val);
      return Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "dd-MM-yyyy");
    } catch (e) { return val; }
  };

  // الدمج الذكي للبيانات (للحفاظ على القديم إذا لم يرسل الجديد)
  const rowData = [
    c.CustomerID || existingRow[0] || ("CUST-" + Math.floor(Math.random() * 1000000)),
    (c.ShamelNO !== undefined && c.ShamelNO !== "") ? c.ShamelNO : (existingRow[1] || ""),
    c.Name || existingRow[2] || "",
    c.Phone || existingRow[3] || "",
    (c.Balance !== undefined) ? c.Balance : (existingRow[4] || 0),
    c.CType || existingRow[5] || "",
    c.Type || existingRow[6] || "Customer",
    c.LastInvoiceDate ? formatDate(c.LastInvoiceDate) : (existingRow[7] instanceof Date ? formatDate(existingRow[7]) : existingRow[7]),
    c.LastPaymentDate ? formatDate(c.LastPaymentDate) : (existingRow[8] instanceof Date ? formatDate(existingRow[8]) : existingRow[8]),
    c["phone 2"] || existingRow[9] || "",
    c["phone 3"] || existingRow[10] || "",
    c.Address || existingRow[11] || "",
    c.PostalCode || existingRow[12] || "",
    c.Email || existingRow[13] || "",
    c.Notes || existingRow[14] || "",
    c.Role || existingRow[15] || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    return { status: "success", message: "Updated", id: rowData[0] };
  } else {
    sheet.appendRow(rowData);
    return { status: "success", message: "Added", id: rowData[0] };
  }
}

function getCustomerHistory(customerId) {
  if (!customerId) return { status: "error" };
  const cid = String(customerId);

  // 1. الفواتير
  const getInv = (sh, src) => getSheetData(sh).filter(r => String(r.CustomerID) === cid).map(r => ({...r, Source: src}));
  const shopInv = getInv(SHEETS.SHOP_INVOICES, "Shop");
  const whInv = getInv(SHEETS.WH_INVOICES, "Warehouse");
  
  const shopDetails = getSheetData(SHEETS.SHOP_DETAILS);
  const whDetails = getSheetData(SHEETS.WH_DETAILS);
  
  const attach = (invs, dets) => invs.map(i => {
    if (i.Date instanceof Date) i.Date = i.Date.toISOString();
    i.Details = dets.filter(d => String(d.InvoiceID) === String(i.InvoiceID));
    return i;
  });
  const invoices = [...attach(shopInv, shopDetails), ...attach(whInv, whDetails)].sort((a,b)=> new Date(b.Date)-new Date(a.Date));
  
  // 2. السندات
  const getRec = (sh, src) => getSheetData(sh).filter(r => String(r.CustomerID) === cid).map(r => {
    if (r.Date instanceof Date) r.Date = r.Date.toISOString();
    return {...r, Source: src};
  });
  const receipts = [...getRec(SHEETS.SHOP_RECEIPTS, "Shop"), ...getRec(SHEETS.WH_RECEIPTS, "Warehouse")].sort((a,b)=> new Date(b.Date)-new Date(a.Date));

  // 3. المتابعات (CRM Interactions)
  const crmSheet = getSheetData(SHEETS.CRM); // من الجدول الجديد CRM_Activity
  const interactions = crmSheet
    .filter(r => String(r.CustomerID) === cid)
    .map(r => {
      // تحويل البيانات من CRM_Activity إلى التنسيق المتوقع من Frontend
      const interaction = {
        // الحقول الأساسية
        InteractionID: r.ActivityID || r.InteractionID || r.id,
        id: r.ActivityID || r.InteractionID || r.id,
        interactionID: r.ActivityID || r.InteractionID || r.id,
        
        // التاريخ - استخدام CreatedAt كتاريخ التفاعل
        Date: r.CreatedAt,
        date: r.CreatedAt,
        InteractionDate: r.CreatedAt,
        interactionDate: r.CreatedAt,
        CreatedAt: r.CreatedAt,
        
        // الملاحظات
        Notes: r.Notes || '',
        notes: r.Notes || '',
        
        // القناة - استخدام ActionType
        Channel: r.ActionType || '',
        channel: r.ActionType || '',
        ActionType: r.ActionType || '',
        
        // الحالة - استخدام Outcome
        Status: r.Outcome || '',
        status: r.Outcome || '',
        Outcome: r.Outcome || '',
        
        // تاريخ المتابعة القادمة - استخدام PromiseDate
        NextFollowUpDate: r.PromiseDate || '',
        nextFollowUpDate: r.PromiseDate || '',
        PromiseDate: r.PromiseDate || '',
        
        // المبلغ الموعود
        PromiseAmount: r.PromiseAmount || 0,
        promiseAmount: r.PromiseAmount || 0,
        
        // الحالة
        PTP_Status: r.PTP_Status || '',
        ptp_Status: r.PTP_Status || '',
        
        // الحفاظ على جميع الحقول الأصلية
        ...r
      };
      
      // تحويل التواريخ إلى ISO strings
      if (interaction.CreatedAt instanceof Date) {
        interaction.CreatedAt = interaction.CreatedAt.toISOString();
        interaction.Date = interaction.CreatedAt;
        interaction.date = interaction.CreatedAt;
        interaction.InteractionDate = interaction.CreatedAt;
        interaction.interactionDate = interaction.CreatedAt;
      }
      
      if (interaction.PromiseDate instanceof Date) {
        interaction.PromiseDate = interaction.PromiseDate.toISOString();
        interaction.NextFollowUpDate = interaction.PromiseDate;
        interaction.nextFollowUpDate = interaction.PromiseDate;
      }
      
      return interaction;
    })
    .sort((a, b) => {
      const dateA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
      const dateB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
      return dateB - dateA; // الأحدث أولاً
    });

  return { 
    status: "success", 
    data: { invoices, receipts, interactions } 
  };
}

// ==========================================
// 6. منطق نظام الديون والتحصيل (CRM Dashboard)
// ==========================================

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const crmSheet = ss.getSheetByName(SHEETS.CRM);
  const custSheet = ss.getSheetByName(SHEETS.CUSTOMERS);
  
  if (!crmSheet) return { status: "success", data: [], message: "CRM Sheet not found" };

  const activities = crmSheet.getDataRange().getValues();
  // إذا الجدول فارغ
  if (activities.length < 2) return { status: "success", data: [] };

  const customers = custSheet ? custSheet.getDataRange().getValues() : [];
  
  // خريطة أسماء الزبائن
  let custMap = {};
  if (customers.length > 1) {
    for(let i=1; i<customers.length; i++) {
      custMap[String(customers[i][0])] = customers[i][2]; // ID -> Name
    }
  }

  const headers = activities[0];
  const idx = {
    ID: headers.indexOf("ActivityID"),
    CustID: headers.indexOf("CustomerID"),
    PromiseDate: headers.indexOf("PromiseDate"),
    PromiseAmount: headers.indexOf("PromiseAmount"),
    PTP_Status: headers.indexOf("PTP_Status"),
    Notes: headers.indexOf("Notes"),
    Outcome: headers.indexOf("Outcome")
  };

  // الحصول على المنطقة الزمنية للـ Spreadsheet
  const timezone = ss.getSpreadsheetTimeZone();
  
  // إنشاء تاريخ اليوم في المنطقة الزمنية المحلية
  const today = new Date();
  const todayStr = Utilities.formatDate(today, timezone, "yyyy-MM-dd");
  const todayParts = todayStr.split("-");
  const todayLocal = new Date(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
  todayLocal.setHours(0,0,0,0);
  
  const pending = [];

  // دالة مساعدة لتحويل التاريخ من أي صيغة إلى Date object (في المنطقة الزمنية المحلية)
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    
    // إذا كان Date object بالفعل من Google Sheets
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return null;
      // تحويل التاريخ إلى المنطقة الزمنية المحلية وتجاهل الوقت
      const dateStr = Utilities.formatDate(dateValue, timezone, "yyyy-MM-dd");
      const parts = dateStr.split("-");
      const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return localDate;
    }
    
    const dateStr = String(dateValue).trim();
    if (!dateStr) return null;
    
    // محاولة 1: YYYY-MM-DD
    const yyyyMMdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMMdd) {
      const [, year, month, day] = yyyyMMdd;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) return d;
    }
    
    // محاولة 2: DD-MM-YYYY
    const ddMMyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (ddMMyyyy) {
      const [, day, month, year] = ddMMyyyy;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) return d;
    }
    
    // محاولة 3: Date constructor العادي ثم تحويله
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dateStrFormatted = Utilities.formatDate(d, timezone, "yyyy-MM-dd");
      const parts = dateStrFormatted.split("-");
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    return null;
  };

  // دالة لتحويل Date object إلى YYYY-MM-DD باستخدام المنطقة الزمنية المحلية
  const formatDateToYYYYMMDD = (date) => {
    if (!date || isNaN(date.getTime())) return "";
    const dateStr = Utilities.formatDate(date, timezone, "yyyy-MM-dd");
    return dateStr;
  };

  for (let i = 1; i < activities.length; i++) {
    const row = activities[i];
    const status = String(row[idx.PTP_Status] || "").toLowerCase();
    
    // شروط التصفية: الوعد نشط ولم يُلغَ ولم يُؤرشف
    const isClosed = status === "fulfilled" || status === "paid" || status === "closed" || status === "archived";
    const hasDate = row[idx.PromiseDate] && String(row[idx.PromiseDate]).trim() !== "";

    if (!isClosed && hasDate) {
      let validDate = parseDate(row[idx.PromiseDate]);
      if (!validDate) continue;

      validDate.setHours(0,0,0,0);
      
      let type = "Upcoming";
      if (validDate.getFullYear() !== 2099) {
        if (validDate < todayLocal) type = "Overdue";
        else if (validDate.getTime() === todayLocal.getTime()) type = "Today";
      }

      pending.push({
        InteractionID: row[idx.ID],
        CustomerID: row[idx.CustID],
        CustomerName: custMap[String(row[idx.CustID])] || "Unknown",
        Notes: row[idx.Notes] || row[idx.Outcome] || "",
        PromiseAmount: row[idx.PromiseAmount] || 0,
        NextDate: formatDateToYYYYMMDD(validDate), // YYYY-MM-DD format using local timezone
        Type: type,
        RawStatus: status
      });
    }
  }
  
  pending.sort((a,b) => {
    const priority = { "Overdue": 1, "Today": 2, "Upcoming": 3 };
    if (priority[a.Type] !== priority[b.Type]) return priority[a.Type] - priority[b.Type];
    return new Date(a.NextDate) - new Date(b.NextDate);
  });

  return { status: "success", data: pending };
}

function logCRMBot(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.CRM);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CRM);
    sheet.appendRow(["ActivityID","CustomerID","CreatedAt","ActionType","Outcome","PromiseDate","PromiseAmount","PTP_Status","Notes","CreatedBy"]);
  }

  const id = "ACT-" + new Date().getTime();
  const ptpStatus = payload.PromiseDate ? "Active" : "Closed";

  // تحويل PromiseDate من YYYY-MM-DD إلى Date object للشيت
  let promiseDateValue = "";
  if (payload.PromiseDate) {
    const dateStr = String(payload.PromiseDate).trim();
    // محاولة تحويل YYYY-MM-DD إلى Date
    const yyyyMMdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMMdd) {
      const [, year, month, day] = yyyyMMdd;
      promiseDateValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // محاولة تحويل DD-MM-YYYY إلى Date
      const ddMMyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (ddMMyyyy) {
        const [, day, month, year] = ddMMyyyy;
        promiseDateValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // محاولة Date constructor العادي
        promiseDateValue = new Date(dateStr);
      }
    }
    
    // إذا فشل التحويل، احفظه كنص
    if (isNaN(promiseDateValue.getTime())) {
      promiseDateValue = dateStr;
    }
  }

  // معالجة PromiseAmount - الحفاظ على القيمة حتى لو كانت 0
  let promiseAmount = 0;
  if (payload.PromiseAmount !== undefined && payload.PromiseAmount !== null) {
    promiseAmount = Number(payload.PromiseAmount) || 0;
  }

  sheet.appendRow([
    id,
    payload.CustomerID,
    new Date(),
    payload.ActionType || "Call",
    payload.Outcome || "",
    promiseDateValue,
    promiseAmount, // استخدام القيمة المحسوبة
    ptpStatus,
    payload.Notes || "",
    "Admin"
  ]);

  return { status: "success", id: id };
}

function updatePTPStatus(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CRM);
  if (!sheet) return { status: "error", message: "Sheet not found" };

  const data = sheet.getDataRange().getValues();
  const idxID = data[0].indexOf("ActivityID");
  const idxStatus = data[0].indexOf("PTP_Status");

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxID]) === String(payload.ActivityID)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, idxStatus + 1).setValue(payload.NewStatus);
    return { status: "success" };
  }
  return { status: "error", message: "Activity ID not found" };
}

// ==========================================
// 7. دوال المساعدة (Helpers) - كاملة 100%
// ==========================================

// دالة حفظ الطلب
function saveCleanOrder(orderData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let oSheet = ss.getSheetByName(SHEETS.WEB_ORDERS);
  let dSheet = ss.getSheetByName(SHEETS.WEB_DETAILS);
  
  if(!oSheet) oSheet = ss.insertSheet(SHEETS.WEB_ORDERS).appendRow(["OrderID","Date","CustomerID","Status","Notes"]).getSheet();
  if(!dSheet) dSheet = ss.insertSheet(SHEETS.WEB_DETAILS).appendRow(["DetailID","OrderID","ProductID","Quantity","UnitPrice"]).getSheet();

  const oid = "WEB-" + Math.floor(Math.random()*1000000);
  oSheet.appendRow([oid, new Date(), orderData.customer?.CustomerID || "", "New", "Web App"]);
  
  const rows = (orderData.items||[]).map(i => [
    "DET-"+Math.floor(Math.random()*10000000), oid, i.ProductID||"", i.Quantity||1, i.SalePrice||0
  ]);
  
  if(rows.length) dSheet.getRange(dSheet.getLastRow()+1, 1, rows.length, 5).setValues(rows);
  return { status: "success", orderId: oid };
}

// دالة قراءة الشيت وتحويله لـ JSON
function getSheetData(name) { 
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const s = ss.getSheetByName(name);
  if(!s) return [];
  
  const data = s.getDataRange().getValues();
  if(data.length < 2) return []; // إذا كان فارغاً
  
  const headers = data.shift(); // سحب العناوين
  
  return data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = val.toISOString();
      }
      obj[header] = val;
    });
    return obj;
  });
}

// دالة جلب خريطة الصور من الكاش
function getImageMapFromSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CACHE_IMAGES);
  const map = {};
  if (!sheet) return map;
  
  const data = sheet.getDataRange().getValues();
  // نفترض العمود الأول هو اسم الملف، والثاني هو الآيدي
  for (let i = 0; i < data.length; i++) {
    map[data[i][0]] = data[i][1];
  }
  return map;
}

// دالة الرد الموحد
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// دالة تحديث كاش الصور (تعمل يدوياً أو عند الطلب)
function refreshImageCache() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.CACHE_IMAGES);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(SHEETS.CACHE_IMAGES);
  
  const rootFolder = DriveApp.getFolderById(IMAGES_FOLDER_ID);
  let fileList = [];
  
  function scanFolder(folder) {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      fileList.push([f.getName(), f.getId()]);
    }
    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      scanFolder(subFolders.next());
    }
  }
  
  scanFolder(rootFolder);
  
  if (fileList.length > 0) {
    sheet.getRange(1, 1, fileList.length, 2).setValues(fileList);
  }
  sheet.hideSheet();
}

// دالة منح الصلاحيات
function authorizeScript() {
  DriveApp.getRootFolder();
}

// ==========================================
// 8. نظام نقطة البيع النقدية (Cash POS)
// ==========================================

function saveCashInvoice(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // إنشاء أو الحصول على جدول الفواتير النقدية
  let invoiceSheet = ss.getSheetByName(SHEETS.CASH_INVOICES);
  if (!invoiceSheet) {
    invoiceSheet = ss.insertSheet(SHEETS.CASH_INVOICES);
    invoiceSheet.appendRow(["InvoiceID", "DateTime", "Status", "Notes", "discount"]);
  }
  
  // إنشاء أو الحصول على جدول التفاصيل
  let detailsSheet = ss.getSheetByName(SHEETS.CASH_DETAILS);
  if (!detailsSheet) {
    detailsSheet = ss.insertSheet(SHEETS.CASH_DETAILS);
    detailsSheet.appendRow(["DetailsID", "InvoiceID", "Mode", "ScannedBarcode", "FilterType", "FilterBrand", "FilterSize", "FilterColor", "ProductID", "Quantity", "UnitPrice"]);
  }
  
  // توليد InvoiceID: Cash-0000-XXX
  const invoiceData = invoiceSheet.getDataRange().getValues();
  const nextRow = invoiceData.length; // عدد الصفوف الحالية (بما في ذلك العنوان)
  const paddedRow = String(nextRow).padStart(4, '0');
  const randomNum = Math.floor(Math.random() * (999 - 10 + 1)) + 10; // رقم عشوائي بين 10 و 999
  const invoiceID = `Cash-${paddedRow}-${randomNum}`;
  
  // حفظ الفاتورة
  const invoiceRow = [
    invoiceID,
    new Date(),
    "Finalized",
    data.notes || "",
    data.discount || 0
  ];
  invoiceSheet.appendRow(invoiceRow);
  
  // حفظ التفاصيل
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    const detailRows = data.items.map(item => {
      const detailsID = "DET-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
      return [
        detailsID,
        invoiceID,
        item.mode || "Pick", // "Pick" or "Scan"
        item.scannedBarcode || "",
        item.filterType || item.Type || "",
        item.filterBrand || item.Brand || "",
        item.filterSize || item.Size || "",
        item.filterColor || item.Color || "",
        item.productID || item.ProductID || "",
        item.quantity || item.Quantity || 1,
        item.unitPrice || item.UnitPrice || item.SalePrice || 0
      ];
    });
    
    if (detailRows.length > 0) {
      detailsSheet.getRange(detailsSheet.getLastRow() + 1, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
    }
  }
  
  return { status: "success", invoiceID: invoiceID };
}

// جلب جميع الفواتير النقدية مع حساب القيمة الإجمالية
function getCashInvoices() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invoiceSheet = ss.getSheetByName(SHEETS.CASH_INVOICES);
  const detailsSheet = ss.getSheetByName(SHEETS.CASH_DETAILS);
  
  if (!invoiceSheet) {
    return { status: "success", data: [] };
  }
  
  const invoices = getSheetData(SHEETS.CASH_INVOICES);
  
  // حساب القيمة الإجمالية لكل فاتورة
  if (detailsSheet && invoices.length > 0) {
    const allDetails = getSheetData(SHEETS.CASH_DETAILS);
    
    const invoicesWithTotals = invoices.map(inv => {
      const invoiceID = inv.InvoiceID || inv.InvoiceID || '';
      const invoiceDetails = allDetails.filter(det => 
        String(det.InvoiceID || '') === String(invoiceID)
      );
      
      // حساب المجموع
      const subtotal = invoiceDetails.reduce((sum, item) => {
        const qty = item.Quantity || item.quantity || 0;
        const price = item.UnitPrice || item.unitPrice || 0;
        return sum + (qty * price);
      }, 0);
      
      // حساب الصافي (بعد الخصم)
      const discount = inv.discount || inv.discount || 0;
      const totalAmount = subtotal - discount;
      
      return {
        ...inv,
        totalAmount: totalAmount
      };
    });
    
    return { status: "success", data: invoicesWithTotals };
  }
  
  return { status: "success", data: invoices };
}

// جلب فاتورة واحدة مع تفاصيلها
function getCashInvoice(invoiceID) {
  if (!invoiceID) {
    return { status: "error", message: "Invoice ID required" };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invoiceSheet = ss.getSheetByName(SHEETS.CASH_INVOICES);
  const detailsSheet = ss.getSheetByName(SHEETS.CASH_DETAILS);
  
  if (!invoiceSheet) {
    return { status: "error", message: "Invoice sheet not found" };
  }
  
  // جلب الفاتورة
  const invoices = getSheetData(SHEETS.CASH_INVOICES);
  const invoice = invoices.find(inv => String(inv.InvoiceID) === String(invoiceID));
  
  if (!invoice) {
    return { status: "error", message: "Invoice not found" };
  }
  
  // جلب التفاصيل
  let details = [];
  if (detailsSheet) {
    const allDetails = getSheetData(SHEETS.CASH_DETAILS);
    details = allDetails.filter(det => String(det.InvoiceID) === String(invoiceID));
  }
  
  return {
    status: "success",
    data: {
      invoice: invoice,
      details: details
    }
  };
}

// تحديث فاتورة نقدية
function updateCashInvoice(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invoiceSheet = ss.getSheetByName(SHEETS.CASH_INVOICES);
  const detailsSheet = ss.getSheetByName(SHEETS.CASH_DETAILS);
  
  if (!invoiceSheet || !detailsSheet) {
    return { status: "error", message: "Sheets not found" };
  }
  
  if (!data.invoiceID) {
    return { status: "error", message: "Invoice ID required" };
  }
  
  // تحديث الفاتورة
  const invoiceData = invoiceSheet.getDataRange().getValues();
  const headers = invoiceData[0];
  const invoiceIDIndex = headers.indexOf("InvoiceID");
  
  let invoiceRowIndex = -1;
  for (let i = 1; i < invoiceData.length; i++) {
    if (String(invoiceData[i][invoiceIDIndex]) === String(data.invoiceID)) {
      invoiceRowIndex = i + 1;
      break;
    }
  }
  
  if (invoiceRowIndex > 0) {
    const notesIndex = headers.indexOf("Notes");
    const discountIndex = headers.indexOf("discount");
    
    if (notesIndex >= 0 && data.notes !== undefined) {
      invoiceSheet.getRange(invoiceRowIndex, notesIndex + 1).setValue(data.notes);
    }
    if (discountIndex >= 0 && data.discount !== undefined) {
      invoiceSheet.getRange(invoiceRowIndex, discountIndex + 1).setValue(data.discount);
    }
  }
  
  // تحديث التفاصيل (حذف القديم وإضافة الجديد)
  if (data.items && Array.isArray(data.items)) {
    const detailsData = detailsSheet.getDataRange().getValues();
    const detailsHeaders = detailsData[0];
    const detailsInvoiceIDIndex = detailsHeaders.indexOf("InvoiceID");
    
    // حذف التفاصيل القديمة
    for (let i = detailsData.length - 1; i >= 1; i--) {
      if (String(detailsData[i][detailsInvoiceIDIndex]) === String(data.invoiceID)) {
        detailsSheet.deleteRow(i + 1);
      }
    }
    
    // إضافة التفاصيل الجديدة
    if (data.items.length > 0) {
      const detailRows = data.items.map(item => {
        const detailsID = "DET-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
        return [
          detailsID,
          data.invoiceID,
          item.mode || "Pick",
          item.scannedBarcode || "",
          item.filterType || item.Type || "",
          item.filterBrand || item.Brand || "",
          item.filterSize || item.Size || "",
          item.filterColor || item.Color || "",
          item.productID || item.ProductID || "",
          item.quantity || item.Quantity || 1,
          item.unitPrice || item.UnitPrice || item.SalePrice || 0
        ];
      });
      
      if (detailRows.length > 0) {
        detailsSheet.getRange(detailsSheet.getLastRow() + 1, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
      }
    }
  }
  
  return { status: "success", invoiceID: data.invoiceID };
}