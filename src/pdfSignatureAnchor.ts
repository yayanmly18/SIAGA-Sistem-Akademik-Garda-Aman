import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfSignatureLayout = {
  page: number
  x: number
  y: number
  width: number
  height: number
  nameY: number
}

type PositionedText = {
  str: string
  transform: number[]
  width: number
  height: number
}

const POINT_TO_MM = 25.4 / 72

/** Locate the Kaprodi signature cell in the actual uploaded PDF. */
export async function detectPdfSignatureLayout(file: File): Promise<PdfSignatureLayout | null> {
  let document: pdfjs.PDFDocumentProxy | null = null
  let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null
  try {
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    document = await loadingTask.promise

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      if (page.rotate !== 0) continue

      const [left, , right, top] = page.view
      const pageWidth = right - left
      const items = (await page.getTextContent()).items.filter(
        (item) => "str" in item && "transform" in item,
      ) as PositionedText[]
      const kaprodiItems = items.filter((item) => item.str.trim().toLocaleLowerCase() === "kaprodi")

      for (const kaprodi of kaprodiItems) {
        const labelY = kaprodi.transform[5]
        const dosen = items.find(
          (item) => item.str.trim().toLocaleLowerCase() === "dosen"
            && Math.abs(item.transform[5] - labelY) <= 4,
        )
        if (!dosen) continue

        const kaprodiCenter = kaprodi.transform[4] + kaprodi.width / 2
        const dosenCenter = dosen.transform[4] + dosen.width / 2
        const columnWidth = kaprodiCenter - dosenCenter
        if (columnWidth <= 0 || columnWidth > pageWidth * 0.6) continue

        const signatureWidthPt = Math.min(columnWidth * 0.64, 96)
        const labelTopPt = top - labelY - kaprodi.height
        const signatureTopPt = labelTopPt + 20
        const signatureHeightPt = 28
        const pageOriginX = kaprodi.transform[4] - left
        const cellCenterX = pageOriginX + kaprodi.width / 2

        return {
          page: pageNumber,
          x: (cellCenterX - signatureWidthPt / 2) * POINT_TO_MM,
          y: signatureTopPt * POINT_TO_MM,
          width: signatureWidthPt * POINT_TO_MM,
          height: signatureHeightPt * POINT_TO_MM,
          nameY: (signatureTopPt + signatureHeightPt + 2) * POINT_TO_MM,
        }
      }
    }
  } catch {
    return null
  } finally {
    await loadingTask?.destroy().catch(() => undefined)
  }

  return null
}
