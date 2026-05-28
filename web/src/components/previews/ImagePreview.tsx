import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
}

export function ImagePreview({ src, alt }: Props) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className={`image-preview${zoomed ? ' image-preview-zoomed' : ''}`}>
      <img src={src} alt={alt} onClick={() => setZoomed((z) => !z)} />
    </div>
  );
}
