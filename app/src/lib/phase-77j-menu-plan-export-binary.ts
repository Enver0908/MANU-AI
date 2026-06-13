import { createRequire } from "node:module";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { ClientFacingMenuExportDocument } from "./phase-77j-menu-plan-export";

type PdfContent = Record<string, unknown> | string;
type PdfDocumentDefinition = {
  content: PdfContent[];
  defaultStyle?: Record<string, unknown>;
  styles?: Record<string, Record<string, unknown>>;
};

const require = createRequire(import.meta.url);

function docxParagraphsForDocument(document: ClientFacingMenuExportDocument) {
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: document.planTitle, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [
        new TextRun({ text: document.clientName, bold: true }),
        new TextRun(` · ${document.templateLabel}`),
      ],
    }),
  ];

  if (document.effectiveDate) {
    paragraphs.push(new Paragraph({ text: `Effective date: ${document.effectiveDate}` }));
  }
  if (document.clientFacingNotes) {
    paragraphs.push(new Paragraph({ text: document.clientFacingNotes }));
  }

  if (document.templateType === "simple_guidance") {
    if (document.preferredFoods.length > 0) {
      paragraphs.push(new Paragraph({ text: `Preferred foods: ${document.preferredFoods.join(", ")}` }));
    }
    if (document.avoidFoods.length > 0) {
      paragraphs.push(new Paragraph({ text: `Avoid foods: ${document.avoidFoods.join(", ")}` }));
    }
  }

  for (const section of document.sections) {
    if (section.items.length === 0 && section.alternatives.length === 0) continue;
    paragraphs.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
    for (const item of section.items) {
      paragraphs.push(
        new Paragraph({
          text: `${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`,
          bullet: { level: 0 },
        }),
      );
      if (item.recipe) {
        paragraphs.push(new Paragraph({ text: `Recipe: ${item.recipe.title}`, bullet: { level: 1 } }));
        for (const ingredient of item.recipe.ingredients) {
          paragraphs.push(new Paragraph({ text: ingredient, bullet: { level: 2 } }));
        }
        if (item.recipe.instructions) {
          paragraphs.push(new Paragraph({ text: item.recipe.instructions }));
        }
      }
    }
    for (const item of section.alternatives) {
      paragraphs.push(
        new Paragraph({
          text: `Alternative: ${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`,
          bullet: { level: 0 },
        }),
      );
    }
    if (section.exchangeGuidance) {
      paragraphs.push(new Paragraph({ text: `Exchange guidance: ${section.exchangeGuidance}` }));
    }
    if (section.weeklyTargetNote) {
      paragraphs.push(new Paragraph({ text: `Weekly target: ${section.weeklyTargetNote}` }));
    }
  }

  return paragraphs;
}

export async function generateMenuPlanDocxBuffer(document: ClientFacingMenuExportDocument) {
  const doc = new Document({
    sections: [{ children: docxParagraphsForDocument(document) }],
  });
  return Packer.toBuffer(doc);
}

function pdfContentForDocument(document: ClientFacingMenuExportDocument): PdfContent[] {
  const content: PdfContent[] = [
    { text: document.planTitle, style: "header" },
    { text: `${document.clientName} · ${document.templateLabel}`, margin: [0, 0, 0, 8] },
  ];

  if (document.effectiveDate) content.push({ text: `Effective date: ${document.effectiveDate}` });
  if (document.clientFacingNotes) content.push({ text: document.clientFacingNotes, margin: [0, 0, 0, 8] });

  if (document.templateType === "simple_guidance") {
    if (document.preferredFoods.length > 0) {
      content.push({ text: `Preferred foods: ${document.preferredFoods.join(", ")}` });
    }
    if (document.avoidFoods.length > 0) {
      content.push({ text: `Avoid foods: ${document.avoidFoods.join(", ")}`, margin: [0, 0, 0, 8] });
    }
  }

  for (const section of document.sections) {
    if (section.items.length === 0 && section.alternatives.length === 0) continue;
    content.push({ text: section.title, style: "subheader", margin: [0, 8, 0, 4] });
    const bullets: PdfContent[] = [];
    for (const item of section.items) {
      bullets.push(`${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`);
      if (item.recipe) {
        bullets.push(`Recipe: ${item.recipe.title}`);
        bullets.push(...item.recipe.ingredients.map((ingredient) => `  - ${ingredient}`));
        if (item.recipe.instructions) bullets.push(item.recipe.instructions);
      }
    }
    for (const item of section.alternatives) {
      bullets.push(`Alternative: ${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`);
    }
    content.push({ ul: bullets.map((entry) => (typeof entry === "string" ? entry : "")), margin: [0, 0, 0, 4] });
    if (section.exchangeGuidance) content.push({ text: `Exchange guidance: ${section.exchangeGuidance}` });
    if (section.weeklyTargetNote) content.push({ text: `Weekly target: ${section.weeklyTargetNote}` });
  }

  return content;
}

type PdfMakeRuntime = {
  virtualfs: { writeFileSync: (filename: string, content: Buffer) => void };
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
  createPdf: (docDefinition: PdfDocumentDefinition) => { getBuffer: () => Promise<Buffer> };
};

let pdfMakeRuntime: PdfMakeRuntime | null = null;

function loadPdfMakeRuntime() {
  if (pdfMakeRuntime) return pdfMakeRuntime;

  const vfsModule = require("pdfmake/build/vfs_fonts") as Record<string, string>;
  if (!vfsModule["Roboto-Regular.ttf"]) {
    throw new Error("menu_plan_export_pdf_fonts_unavailable");
  }

  const pdfmake = require("pdfmake") as PdfMakeRuntime;
  for (const [filename, encoded] of Object.entries(vfsModule)) {
    pdfmake.virtualfs.writeFileSync(filename, Buffer.from(encoded, "base64"));
  }

  pdfmake.addFonts({
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });

  pdfMakeRuntime = pdfmake;
  return pdfmake;
}

export async function generateMenuPlanPdfBuffer(document: ClientFacingMenuExportDocument) {
  const pdfmake = loadPdfMakeRuntime();
  const docDefinition: PdfDocumentDefinition = {
    content: pdfContentForDocument(document),
    defaultStyle: { font: "Roboto", fontSize: 11 },
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      subheader: { fontSize: 13, bold: true },
    },
  };

  return pdfmake.createPdf(docDefinition).getBuffer();
}
