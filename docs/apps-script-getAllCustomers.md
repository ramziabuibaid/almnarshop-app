# Google Apps Script: getAllCustomers Function

## Function to Add to Your Google Apps Script

Add this function to your Google Apps Script project to fetch all customers from your Google Sheets.

```javascript
/**
 * Get all customers from the Customers sheet
 * Action: getAllCustomers
 * 
 * Expected Sheet Structure:
 * - Sheet Name: "Customers" (or adjust SHEET_NAME constant)
 * - Columns: CustomerID, Name, Email, Phone, Type, Balance, Address, Photo, etc.
 * 
 * Returns: Array of customer objects
 */
function getAllCustomers() {
  try {
    // ===== CONFIGURATION =====
    // Adjust these constants to match your Google Sheets setup
    const SHEET_NAME = 'Customers'; // Change to your sheet name
    const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Your Google Sheets ID
    
    // Get the spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return {
        status: 'error',
        message: `Sheet "${SHEET_NAME}" not found`
      };
    }
    
    // Get all data (skip header row)
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      return {
        status: 'success',
        data: []
      };
    }
    
    // Get header row (first row)
    const headers = values[0].map(h => String(h).trim());
    
    // Map column names (case-insensitive matching)
    const getColumnIndex = (columnName) => {
      const lowerName = columnName.toLowerCase();
      return headers.findIndex(h => h.toLowerCase() === lowerName);
    };
    
    // Find column indices (adjust column names to match your sheet)
    const customerIdIndex = getColumnIndex('CustomerID') !== -1 ? getColumnIndex('CustomerID') : getColumnIndex('ID');
    const nameIndex = getColumnIndex('Name') !== -1 ? getColumnIndex('Name') : getColumnIndex('CustomerName');
    const emailIndex = getColumnIndex('Email');
    const phoneIndex = getColumnIndex('Phone') !== -1 ? getColumnIndex('Phone') : getColumnIndex('Mobile');
    const typeIndex = getColumnIndex('Type') !== -1 ? getColumnIndex('Type') : getColumnIndex('CustomerType');
    const balanceIndex = getColumnIndex('Balance') !== -1 ? getColumnIndex('Balance') : getColumnIndex('Credit');
    const addressIndex = getColumnIndex('Address');
    const photoIndex = getColumnIndex('Photo') !== -1 ? getColumnIndex('Photo') : getColumnIndex('Image');
    const shamelNoIndex = getColumnIndex('Shamel No') !== -1 ? getColumnIndex('Shamel No') : getColumnIndex('ShamelNo');
    
    // Process rows (skip header)
    const customers = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // Skip empty rows
      if (!row[customerIdIndex] && !row[nameIndex] && !row[emailIndex]) {
        continue;
      }
      
      // Build customer object
      const customer = {
        CustomerID: row[customerIdIndex] ? String(row[customerIdIndex]).trim() : '',
        Name: row[nameIndex] ? String(row[nameIndex]).trim() : '',
        Email: row[emailIndex] ? String(row[emailIndex]).trim().toLowerCase() : '',
        Phone: row[phoneIndex] ? String(row[phoneIndex]).trim() : '',
        Type: row[typeIndex] ? String(row[typeIndex]).trim() : 'Customer',
        Balance: row[balanceIndex] ? parseFloat(row[balanceIndex]) || 0 : 0,
        Address: row[addressIndex] ? String(row[addressIndex]).trim() : '',
        Photo: row[photoIndex] ? String(row[photoIndex]).trim() : '',
        'Shamel No': row[shamelNoIndex] ? String(row[shamelNoIndex]).trim() : '',
      };
      
      // Add all other columns as additional fields
      headers.forEach((header, index) => {
        if (!customer[header] && row[index]) {
          customer[header] = row[index];
        }
      });
      
      // Only add if has at least CustomerID or Name
      if (customer.CustomerID || customer.Name) {
        customers.push(customer);
      }
    }
    
    return {
      status: 'success',
      data: customers
    };
    
  } catch (error) {
    console.error('Error in getAllCustomers:', error);
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

/**
 * Handle getAllCustomers action in doPost/doGet
 * Add this to your main handler function
 */
function handleGetAllCustomers() {
  try {
    const result = getAllCustomers();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Integration with Existing doPost/doGet Handler

Add this case to your existing `doPost` or `doGet` function:

```javascript
function doPost(e) {
  try {
    const action = e.parameter.action || (e.postData && JSON.parse(e.postData.contents)?.action);
    
    if (action === 'getAllCustomers') {
      return handleGetAllCustomers();
    }
    
    // ... your other actions
    
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getAllCustomers') {
      return handleGetAllCustomers();
    }
    
    // ... your other actions
    
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Expected Response Format

```json
{
  "status": "success",
  "data": [
    {
      "CustomerID": "C001",
      "Name": "John Doe",
      "Email": "john@example.com",
      "Phone": "+1234567890",
      "Type": "Customer",
      "Balance": 1500.50,
      "Address": "123 Main St",
      "Photo": "https://...",
      "Shamel No": "12345"
    },
    // ... more customers
  ]
}
```

## Notes

1. **Sheet Name**: Adjust `SHEET_NAME` constant to match your actual sheet name
2. **Spreadsheet ID**: Either hardcode `SPREADSHEET_ID` or use `SpreadsheetApp.getActiveSpreadsheet().getId()` if the script is bound to the sheet
3. **Column Names**: The function tries to find columns with common names. Adjust the `getColumnIndex` calls if your columns have different names
4. **Type Values**: Expected values: "Customer", "Merchant", "Supplier", "Accounting"
5. **Balance**: Positive = Receivables (customer owes), Negative = Payables (we owe)

## Testing

Test the function by calling:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getAllCustomers
```

Or via POST:
```javascript
fetch('YOUR_SCRIPT_URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'getAllCustomers' })
})
```

