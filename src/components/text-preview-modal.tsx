"use client";

import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TextPreviewModalProps {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
  downloadName: string;
}

export function TextPreviewModal({
  open,
  title,
  text,
  onClose,
  downloadName,
}: TextPreviewModalProps) {
  if (!open || !text) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[84vh] w-full max-w-3xl flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-zinc-100">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <textarea
          value={text}
          readOnly
          className="min-h-[420px] flex-1 resize-none rounded-lg border border-zinc-800 bg-black/40 p-4 font-mono text-xs text-emerald-200 outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
            Salin
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Unduh
          </Button>
        </div>
      </div>
    </div>
  );
}
