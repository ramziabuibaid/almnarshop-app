import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export type ArchiveFolderKey =
  | 'purchase_invoice'
  | 'sales_invoice'
  | 'receipt'
  | 'payment'
  | 'bank_statement'
  | 'journal_voucher'
  | 'company_document';

const FOLDER_NAMES: Record<ArchiveFolderKey, string> = {
  purchase_invoice: 'PurchasesInvoices',
  sales_invoice: 'SalesInvoices',
  receipt: 'Receipts',
  payment: 'Payments',
  bank_statement: 'BankStatements',
  journal_voucher: 'JournalVouchers',
  company_document: 'CompanyDocuments',
};

const DEFAULT_ROOT_FOLDER_ID = '1IopKqQ5o-HZ5lCOABiZJDaPQgxq24Rp0';

export function getArchiveSubfolderName(folderKey: ArchiveFolderKey): string {
  return FOLDER_NAMES[folderKey];
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || DEFAULT_ROOT_FOLDER_ID;

  if (!clientEmail || !privateKeyRaw || !rootFolderId) {
    throw new Error('Google Drive env vars are missing');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

async function getDriveClient() {
  const auth = getAuth();
  await auth.authorize();
  return google.drive({ version: 'v3', auth });
}

async function getOrCreateSubfolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  folderName: string
): Promise<string> {
  const q = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `'${rootFolderId}' in parents`,
    'trashed=false',
  ].join(' and ');

  const existing = await drive.files.list({
    q,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error('Failed to create Drive subfolder');
  }
  return created.data.id;
}

export async function uploadArchiveFileToDrive(input: {
  folderKey: ArchiveFolderKey;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || DEFAULT_ROOT_FOLDER_ID;

  const drive = await getDriveClient();
  const subfolderName = getArchiveSubfolderName(input.folderKey);
  const subfolderId = await getOrCreateSubfolder(drive, rootFolderId, subfolderName);

  const created = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [subfolderId],
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(input.buffer),
    },
    fields: 'id,name,webViewLink,webContentLink,mimeType,size',
    supportsAllDrives: true,
  });

  const file = created.data;
  if (!file.id) {
    throw new Error('Drive upload failed: missing file id');
  }

  return {
    driveFileId: file.id,
    driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    driveDownloadLink: file.webContentLink || null,
    mimeType: file.mimeType || input.mimeType,
    fileSize: file.size ? Number(file.size) : input.buffer.length,
    folderName: subfolderName,
  };
}
