import React, { useState, useMemo } from 'react';
import { Property } from '@/types';
import { X, AlertTriangle, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DuplicateStrategy = 'skip' | 'update' | 'merge' | 'review';

interface DuplicateMatch {
  importRow: Record<string, any>;
  existingProperty: Property;
  normalizedAddress: string;
}

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateMatch[];
  nonDuplicates: Record<string, any>[];
  onConfirm: (
    strategy: DuplicateStrategy,
    reviewedDuplicates?: Map<string, 'keep_existing' | 'use_import' | 'merge'>
  ) => void;
}

// Normalize address for comparison
export function normalizeAddress(address: string, city: string, state: string): string {
  const streetSuffixes: Record<string, string> = {
    'street': 'st', 'st': 'st',
    'avenue': 'ave', 'ave': 'ave',
    'drive': 'dr', 'dr': 'dr',
    'road': 'rd', 'rd': 'rd',
    'lane': 'ln', 'ln': 'ln',
    'boulevard': 'blvd', 'blvd': 'blvd',
    'court': 'ct', 'ct': 'ct',
    'circle': 'cir', 'cir': 'cir',
    'place': 'pl', 'pl': 'pl',
    'way': 'way',
    'trail': 'trl', 'trl': 'trl',
  };
  
  let normalized = `${address} ${city} ${state}`
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Normalize street suffixes
  for (const [full, abbr] of Object.entries(streetSuffixes)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  
  return normalized;
}

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  nonDuplicates,
  onConfirm,
}) => {
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewDecisions, setReviewDecisions] = useState<Map<string, 'keep_existing' | 'use_import' | 'merge'>>(new Map());
  const [showReview, setShowReview] = useState(false);

  const currentDuplicate = duplicates[reviewIndex];

  const handleStrategySelect = (s: DuplicateStrategy) => {
    setStrategy(s);
    if (s === 'review') {
      setShowReview(true);
      setReviewIndex(0);
    } else {
      setShowReview(false);
    }
  };

  const handleReviewDecision = (decision: 'keep_existing' | 'use_import' | 'merge') => {
    const newDecisions = new Map(reviewDecisions);
    newDecisions.set(currentDuplicate.normalizedAddress, decision);
    setReviewDecisions(newDecisions);
    
    if (reviewIndex < duplicates.length - 1) {
      setReviewIndex(reviewIndex + 1);
    }
  };

  const handleConfirm = () => {
    if (strategy === 'review') {
      onConfirm(strategy, reviewDecisions);
    } else {
      onConfirm(strategy);
    }
    onClose();
  };

  const reviewProgress = useMemo(() => {
    return reviewDecisions.size;
  }, [reviewDecisions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Duplicates Found</h2>
              <p className="text-xs text-muted-foreground">
                {duplicates.length} properties match existing records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!showReview ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {nonDuplicates.length} new properties will be imported. How would you like to handle the {duplicates.length} duplicates?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleStrategySelect('skip')}
                  className={cn(
                    "w-full p-4 border rounded-xl text-left transition-all",
                    strategy === 'skip' ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Skip Duplicates</p>
                      <p className="text-sm text-muted-foreground">Keep existing records, ignore import data for duplicates</p>
                    </div>
                    {strategy === 'skip' && <Check className="w-5 h-5 text-brand" />}
                  </div>
                </button>

                <button
                  onClick={() => handleStrategySelect('update')}
                  className={cn(
                    "w-full p-4 border rounded-xl text-left transition-all",
                    strategy === 'update' ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Update Existing</p>
                      <p className="text-sm text-muted-foreground">Replace existing data with import data</p>
                    </div>
                    {strategy === 'update' && <Check className="w-5 h-5 text-brand" />}
                  </div>
                </button>

                <button
                  onClick={() => handleStrategySelect('merge')}
                  className={cn(
                    "w-full p-4 border rounded-xl text-left transition-all",
                    strategy === 'merge' ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Merge (Fill Gaps)</p>
                      <p className="text-sm text-muted-foreground">Only update empty fields with import data</p>
                    </div>
                    {strategy === 'merge' && <Check className="w-5 h-5 text-brand" />}
                  </div>
                </button>

                <button
                  onClick={() => handleStrategySelect('review')}
                  className={cn(
                    "w-full p-4 border rounded-xl text-left transition-all",
                    strategy === 'review' ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Review Each</p>
                      <p className="text-sm text-muted-foreground">Compare and decide for each duplicate individually</p>
                    </div>
                    {strategy === 'review' && <Check className="w-5 h-5 text-brand" />}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Review Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
                  disabled={reviewIndex === 0}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-muted-foreground">
                  {reviewIndex + 1} of {duplicates.length} • {reviewProgress} reviewed
                </span>
                <button
                  onClick={() => setReviewIndex(Math.min(duplicates.length - 1, reviewIndex + 1))}
                  disabled={reviewIndex === duplicates.length - 1}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Side by Side Comparison */}
              {currentDuplicate && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-border rounded-lg p-4 bg-muted/30">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Existing Record</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Address:</span> {currentDuplicate.existingProperty.address}</div>
                      <div><span className="text-muted-foreground">City:</span> {currentDuplicate.existingProperty.city}</div>
                      <div><span className="text-muted-foreground">Beds:</span> {currentDuplicate.existingProperty.bedrooms}</div>
                      <div><span className="text-muted-foreground">Owner:</span> {currentDuplicate.existingProperty.owner.name}</div>
                      {currentDuplicate.existingProperty.listingTitle && (
                        <div><span className="text-muted-foreground">Title:</span> {currentDuplicate.existingProperty.listingTitle}</div>
                      )}
                      {currentDuplicate.existingProperty.propertyManager && (
                        <div><span className="text-muted-foreground">Manager:</span> {currentDuplicate.existingProperty.propertyManager}</div>
                      )}
                    </div>
                  </div>
                  <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase mb-3">Import Data</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Address:</span> {currentDuplicate.importRow.address}</div>
                      <div><span className="text-muted-foreground">City:</span> {currentDuplicate.importRow.city}</div>
                      <div><span className="text-muted-foreground">Beds:</span> {currentDuplicate.importRow.bedrooms || '-'}</div>
                      <div><span className="text-muted-foreground">Owner:</span> {currentDuplicate.importRow.owner1FirstName} {currentDuplicate.importRow.owner1LastName}</div>
                      {currentDuplicate.importRow.listingTitle && (
                        <div><span className="text-muted-foreground">Title:</span> {currentDuplicate.importRow.listingTitle}</div>
                      )}
                      {currentDuplicate.importRow.propertyManager && (
                        <div><span className="text-muted-foreground">Manager:</span> {currentDuplicate.importRow.propertyManager}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleReviewDecision('keep_existing')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border",
                    reviewDecisions.get(currentDuplicate?.normalizedAddress) === 'keep_existing'
                      ? "bg-muted border-border text-foreground"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  Keep Existing
                </button>
                <button
                  onClick={() => handleReviewDecision('use_import')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border",
                    reviewDecisions.get(currentDuplicate?.normalizedAddress) === 'use_import'
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  Use Import
                </button>
                <button
                  onClick={() => handleReviewDecision('merge')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border",
                    reviewDecisions.get(currentDuplicate?.normalizedAddress) === 'merge'
                      ? "bg-brand/10 border-brand/30 text-brand"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  Merge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between bg-muted/30">
          {showReview && (
            <button
              onClick={() => setShowReview(false)}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Back to Options
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={strategy === 'review' && reviewProgress < duplicates.length}
              className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {strategy === 'review' 
                ? `Confirm (${reviewProgress}/${duplicates.length} reviewed)`
                : `Import ${nonDuplicates.length} New Properties`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
