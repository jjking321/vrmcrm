import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Paperclip, X, Download, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getAttachmentUrl, type EmailAttachment } from '@/hooks/useGmail';

export interface DraftAttachment {
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const AttachmentPicker: React.FC<{
  companyId: string;
  attachments: DraftAttachment[];
  onChange: (next: DraftAttachment[]) => void;
}> = ({ companyId, attachments, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: DraftAttachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} is too large (max 25 MB)`);
        continue;
      }
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${companyId}/_drafts/${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(path, f, { contentType: f.type || 'application/octet-stream' });
      if (error) {
        toast.error(`Upload failed: ${f.name}`, { description: error.message });
        continue;
      }
      added.push({
        storage_path: path,
        filename: f.name,
        mime_type: f.type || 'application/octet-stream',
        size_bytes: f.size,
      });
    }
    setUploading(false);
    if (added.length) onChange([...attachments, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (att: DraftAttachment) => {
    await supabase.storage.from('email-attachments').remove([att.storage_path]);
    onChange(attachments.filter((a) => a.storage_path !== att.storage_path));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
        Attach files
      </Button>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.storage_path}
              className="flex items-center gap-1.5 text-xs bg-muted/60 rounded px-2 py-1"
            >
              <FileIcon className="w-3 h-3 text-muted-foreground" />
              <span className="truncate max-w-[180px]">{a.filename}</span>
              <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
              <button
                type="button"
                onClick={() => handleRemove(a)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessageAttachments: React.FC<{ items: EmailAttachment[] }> = ({ items }) => {
  if (items.length === 0) return null;
  const handleOpen = async (att: EmailAttachment) => {
    try {
      const url = await getAttachmentUrl(att.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error('Could not open attachment', { description: e.message });
    }
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <button
          key={a.id}
          onClick={() => handleOpen(a)}
          className="flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted rounded px-2 py-1 transition-colors"
        >
          <Download className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{a.filename}</span>
          <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
        </button>
      ))}
    </div>
  );
};