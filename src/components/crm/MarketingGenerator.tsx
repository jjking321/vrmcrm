import React, { useState } from 'react';
import { Property } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Mail, Phone, FileText, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketingGeneratorProps {
  property: Property;
}

type Tone = 'professional' | 'friendly' | 'urgent';
type Format = 'email' | 'cold_call_script' | 'direct_mail';

const MarketingGenerator: React.FC<MarketingGeneratorProps> = ({ property }) => {
  const [tone, setTone] = useState<Tone>('professional');
  const [format, setFormat] = useState<Format>('email');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const tones: { id: Tone; label: string }[] = [
    { id: 'professional', label: 'Professional' },
    { id: 'friendly', label: 'Friendly' },
    { id: 'urgent', label: 'Urgent' },
  ];

  const formats: { id: Format; label: string; icon: React.ReactNode }[] = [
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'cold_call_script', label: 'Call Script', icon: <Phone className="w-4 h-4" /> },
    { id: 'direct_mail', label: 'Direct Mail', icon: <FileText className="w-4 h-4" /> },
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    setGeneratedContent('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-marketing', {
        body: { property, tone, format },
      });

      if (error) {
        console.error('Generation error:', error);
        toast.error(error.message || 'Failed to generate marketing copy');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setGeneratedContent(data.content || '');
      toast.success('Marketing copy generated!');
    } catch (err) {
      console.error('Error generating content:', err);
      toast.error('Failed to generate marketing copy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedContent) return;
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border p-5">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-brand" />
        AI Marketing Generator
      </h3>

      {/* Format Selection */}
      <div className="mb-4">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Format</label>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all",
                format === f.id
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-card border-input text-muted-foreground hover:border-brand/50"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone Selection */}
      <div className="mb-4">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Tone</label>
        <div className="flex flex-wrap gap-2">
          {tones.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                tone === t.id
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-card border-input text-muted-foreground hover:border-brand/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-brand-foreground rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors mb-4"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate {formats.find(f => f.id === format)?.label}
          </>
        )}
      </button>

      {/* Generated Content */}
      {generatedContent && (
        <div className="relative group">
          <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
            {generatedContent}
          </div>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-card rounded-md shadow-soft border border-border text-muted-foreground hover:text-brand transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketingGenerator;
