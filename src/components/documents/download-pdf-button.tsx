"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

export function DownloadPdfButton({
  filename,
  orientation = "portrait",
  lang = DEFAULT_LANG,
}: {
  filename: string;
  orientation?: "portrait" | "landscape";
  lang?: Lang;
}) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas-pro"),
      ]);

      const sheets = Array.from(document.querySelectorAll<HTMLElement>("[data-print-sheet]"));
      if (sheets.length === 0) return;

      const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i], { scale: 3, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", x, y, w, h);
      }

      pdf.save(filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className="print-hide" onClick={download} disabled={loading}>
      {loading ? t(lang, "generation_pdf") : t(lang, "telecharger_pdf")}
    </Button>
  );
}
