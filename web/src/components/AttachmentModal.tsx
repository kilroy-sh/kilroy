interface Props {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  downloadHref: string;
  downloadName: string | null;
}
export function AttachmentModal({ children }: Props) {
  return <div>{children}</div>;
}
