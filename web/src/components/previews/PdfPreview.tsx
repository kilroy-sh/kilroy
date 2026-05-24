interface Props { src: string; }

export function PdfPreview({ src }: Props) {
  return (
    <iframe
      src={src}
      title="PDF preview"
      style={{ width: '100%', height: '80vh', border: 'none', background: '#fff' }}
    />
  );
}
