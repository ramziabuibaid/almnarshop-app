-- Archive module tables
CREATE TABLE IF NOT EXISTS archive_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'purchase_invoice',
      'sales_invoice',
      'receipt',
      'payment',
      'bank_statement',
      'journal_voucher',
      'company_document'
    )
  ),
  title TEXT NOT NULL,
  document_date DATE NOT NULL,
  reference_no TEXT,
  supplier_name TEXT,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  linked_table TEXT,
  linked_record_id TEXT,
  document_status TEXT NOT NULL DEFAULT 'original' CHECK (
    document_status IN ('original', 'copy', 'cancelled')
  ),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  drive_file_id TEXT NOT NULL UNIQUE,
  drive_web_view_link TEXT NOT NULL,
  drive_download_link TEXT,
  drive_folder_key TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_document_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archive_document_id UUID NOT NULL REFERENCES archive_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('created', 'updated', 'deleted', 'opened', 'linked')
  ),
  event_payload JSONB,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_documents_type ON archive_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_archive_documents_date ON archive_documents(document_date DESC);
CREATE INDEX IF NOT EXISTS idx_archive_documents_reference ON archive_documents(reference_no);
CREATE INDEX IF NOT EXISTS idx_archive_documents_supplier_name ON archive_documents(supplier_name);
CREATE INDEX IF NOT EXISTS idx_archive_documents_customer_id ON archive_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_archive_documents_linked ON archive_documents(linked_table, linked_record_id);
CREATE INDEX IF NOT EXISTS idx_archive_documents_created_at ON archive_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_events_doc_id ON archive_document_events(archive_document_id);
CREATE INDEX IF NOT EXISTS idx_archive_events_created_at ON archive_document_events(created_at DESC);

CREATE OR REPLACE FUNCTION update_archive_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_archive_documents_updated_at ON archive_documents;
CREATE TRIGGER trg_update_archive_documents_updated_at
BEFORE UPDATE ON archive_documents
FOR EACH ROW
EXECUTE FUNCTION update_archive_documents_updated_at();
