import React from 'react';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyImagePlaceholderProps {
  className?: string;
}

export const PropertyImagePlaceholder: React.FC<PropertyImagePlaceholderProps> = ({ className }) => (
  <div className={cn("w-full h-full bg-muted flex items-center justify-center", className)}>
    <Home className="w-1/3 h-1/3 text-muted-foreground/40 stroke-1" />
  </div>
);

interface PropertyImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

export const PropertyImage: React.FC<PropertyImageProps> = ({ src, alt = "", className }) => {
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  if (!src || hasError) {
    return <PropertyImagePlaceholder className={className} />;
  }

  return (
    <>
      {isLoading && <PropertyImagePlaceholder className={className} />}
      <img
        src={src}
        alt={alt}
        className={cn(className, isLoading && "hidden")}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
      />
    </>
  );
};
