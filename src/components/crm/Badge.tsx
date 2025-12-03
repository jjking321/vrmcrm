import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  color: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, color, className }) => {
  const getColorClasses = (c: string) => {
    switch (c) {
      case 'slate': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'blue': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'indigo': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'violet': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'purple': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'pink': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'amber': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'cyan': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'emerald': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'red': return 'bg-red-100 text-red-700 border-red-200';
      case 'teal': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
      getColorClasses(color),
      className
    )}>
      {label}
    </span>
  );
};

interface StageBadgeProps {
  stageName: string;
  color: string;
}

export const StageBadge: React.FC<StageBadgeProps> = ({ stageName, color }) => {
  return <Badge label={stageName} color={color} />;
};

interface TagBadgeProps {
  tag: string;
  onRemove?: () => void;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ tag, onRemove }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-brand-50 text-brand-700 border border-brand-200">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-brand-900 ml-0.5">×</button>
      )}
    </span>
  );
};
