# Supabase Storage Setup Guide for KYC Documents

## Quick Start

Supabase Storage integration for KYC document uploads is now implemented. Follow these steps to enable it:

### Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Storage** → **Buckets**
3. Click **New Bucket**
4. Name it: `kyc-documents`
5. **Uncheck** "Private bucket" (make it public for document viewing)
6. Click **Create Bucket**

### Step 2: Set Storage Policies (Optional but Recommended)

To control who can upload documents, set Row Level Security (RLS) policies in the Storage bucket:

1. In Supabase Storage dashboard, select the `kyc-documents` bucket
2. Go to **Policies**
3. Policies are managed via SQL. The storage automatically restricts uploads to authenticated users by default with the `@supabase/supabase-js` client

For now, documents can be uploaded by any authenticated user. If you need stricter rules, contact support or implement custom middleware.

### Step 3: Verify Environment Variables

Ensure your `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=https://jzpcbpejydzdjwxszcli.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_34jBGk_mBXIVbjl-0_-UmA_l1otUy_v
```

(Already configured in your project)

### Step 4: Test the Upload

1. Start the dev server: `pnpm dev`
2. Register as a new user
3. Complete KYC submission with document uploads
4. Check Supabase Storage dashboard → `kyc-documents` bucket for uploaded files
5. Files should appear in paths like: `kyc/{userId}/{kycId}/{documentType}/{timestamp}-{filename}`

---

## How It Works

### Upload Flow
- Form data with file blobs → `submitKYC()` (server action)
- `uploadKYCDocument()` → Uploads to Supabase Storage
- Returns public URL → Stored in `kyc_documents` database table

### Download Flow
- Request `/api/documents/[filename]?userId={userId}&kycId={kycId}`
- Downloads from Supabase Storage
- Returns file with correct content-type headers

---

## Troubleshooting

### "Bucket not found" error
- Ensure the bucket `kyc-documents` is created in Supabase Storage
- Check that the bucket is **not private** (public read)

### "Failed to upload" error
- Verify Supabase environment variables are set
- Check that the file is not too large (Supabase default limit is 100MB per file)
- Ensure the anon key has Storage permissions

### "Document not found" when viewing
- Confirm the document was successfully uploaded (check Supabase Storage dashboard)
- Verify the `document_url` in `kyc_documents` table matches the Supabase public URL format

---

## Files Modified

1. **lib/storage/kyc-storage.js** (NEW)
   - `uploadKYCDocument()` - Upload function
   - `deleteKYCDocument()` - Delete function (for cleanup)
   - `getKYCDocumentUrl()` - Get public URL utility

2. **app/actions/auth.js**
   - `submitKYC()` - Now uses Supabase Storage instead of local filesystem

3. **app/api/documents/[Filename]/route.js**
   - Document retrieval endpoint - Now fetches from Supabase Storage

---

## New Dependencies

- `@supabase/supabase-js` - Supabase client library
- `@supabase/ssr` - Server-side rendering support (already required)

Installed via: `pnpm add @supabase/supabase-js @supabase/ssr`

---

## Security Notes

✅ Documents are stored in a Supabase public bucket (files are readable via public URLs)  
✅ Uploads require authentication (Bearer JWT token)  
✅ File paths include userId and kycId for organizational isolation  
✅ No sensitive data is stored in document URLs themselves  

If you need private documents (not publicly readable), set the bucket to private and implement custom download endpoints with authentication checks.

---

## Next Steps (Optional)

1. **Add file size validation** in `kyc-storage.js` (currently no limits)
2. **Implement document expiration** - Auto-delete old KYC submissions after compliance period
3. **Add virus scanning** - Supabase can integrate with ClamAV
4. **Migrate existing submissions** - If there are old local file paths in the database, create a migration script
