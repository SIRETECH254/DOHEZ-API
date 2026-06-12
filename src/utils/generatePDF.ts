import PDFDocument from 'pdfkit';
import { WritableStreamBuffer } from 'stream-buffers';

type PDFKitDocument = InstanceType<typeof PDFDocument>;

const THEME_COLOR = '#7b1c1c';
const TEXT_COLOR = '#222222';
const MUTED_COLOR = '#666666';
const BORDER_COLOR = '#d9d9d9';

const formatDate = (value?: any): string => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
};

const formatMoney = (value: number): string => {
  return `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const drawSectionTitleTicket = (doc: PDFKitDocument, text: string, x: number, y: number, width: number): number => {
  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(THEME_COLOR)
    .text(text, x, y, { width });
  return y + 14;
};

const drawSectionTitleReceipt = (doc: PDFKitDocument, text: string, x: number, y: number, width: number): number => {
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(THEME_COLOR)
    .text(text, x, y, { width });
  return y + 16;
};

const drawLines = (doc: PDFKitDocument, lines: string[], x: number, y: number, width: number): number => {
  let currentY = y;
  lines.filter(Boolean).forEach((line) => {
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_COLOR)
      .text(line, x, currentY, { width });
    currentY += 14;
  });
  return currentY;
};

const drawKeyValueRows = (
  doc: PDFKitDocument,
  rows: Array<{ label: string; value: string }>,
  x: number,
  y: number,
  width: number
): number => {
  const labelWidth = Math.round(width * 0.45);
  const valueWidth = width - labelWidth;
  let currentY = y;

  rows.forEach((row) => {
    doc.font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(THEME_COLOR)
      .text(row.label, x, currentY, { width: labelWidth });
    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(TEXT_COLOR)
      .text(row.value, x + labelWidth, currentY, { width: valueWidth, align: 'right' });
    currentY += 14;
  });

  return currentY;
};

const renderTicketDocument = (
  doc: PDFKitDocument,
  ticket: any
): void => {
  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;
  const event = ticket.event as any;
  const padding = 20;

  doc.font('Helvetica');
  let currentY = 50;

  // --- 1. HEADER SECTION ---
  const headerHeight = 50;
  doc.rect(margin, currentY, contentWidth, headerHeight)
     .strokeColor(BORDER_COLOR)
     .lineWidth(1)
     .stroke();

  // Draw [D] Logo
  const logoBoxSize = 24;
  const logoX = margin + padding;
  const logoY = currentY + (headerHeight - logoBoxSize) / 2;
  
  doc.rect(logoX, logoY, logoBoxSize, logoBoxSize)
     .fillColor(THEME_COLOR)
     .fill();
  
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('D', logoX, logoY + 5, { width: logoBoxSize, align: 'center' });

  // DOHEZ and Event Name
  doc.fillColor(TEXT_COLOR)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('DOHEZ', logoX + logoBoxSize + 10, currentY + 17, { continued: true })
     .fillColor(MUTED_COLOR)
     .font('Helvetica')
     .fontSize(12)
     .text(`          ${(event?.name || 'Event').toUpperCase()}`, { align: 'left' });

  currentY += headerHeight;

  // --- 2. TICKET INFO & QR CODE SECTION ---
  const infoHeight = 180;
  doc.rect(margin, currentY, contentWidth, infoHeight)
     .strokeColor(BORDER_COLOR)
     .stroke();

  // Vertical Divider
  const dividerX = margin + contentWidth * 0.6;
  doc.moveTo(dividerX, currentY)
     .lineTo(dividerX, currentY + infoHeight)
     .strokeColor(BORDER_COLOR)
     .stroke();

  // Left Side: Ticket Details
  const detailsX = margin + padding;
  const detailsY = currentY + padding;

  doc.fillColor(TEXT_COLOR)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('TICKET', detailsX, detailsY);

  const rowStartY = detailsY + 35;
  const rowSpacing = 22;

  const drawRow = (label: string, value: string, y: number) => {
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(TEXT_COLOR)
       .text(label, detailsX, y);
    
    doc.font('Helvetica')
       .fontSize(10)
       .text(value, detailsX + 70, y, { width: dividerX - detailsX - 80 });
  };

  drawRow('Ticket #:', ticket.ticketNumber || 'N/A', rowStartY);
  drawRow('Status:', ticket.status || 'BOOKED', rowStartY + rowSpacing);
  drawRow('Tier:', ticket.type || 'Standard', rowStartY + rowSpacing * 2);

  // Right Side: QR Code
  if (ticket.qrCodeData) {
    const qrSize = 100;
    const qrX = dividerX + (contentWidth * 0.4 - qrSize) / 2;
    const qrY = currentY + 25;

    // QR Code Box
    doc.rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
       .strokeColor(BORDER_COLOR)
       .stroke();

    doc.image(ticket.qrCodeData, qrX, qrY, { width: qrSize });

    doc.fillColor(MUTED_COLOR)
       .font('Helvetica')
       .fontSize(8)
       .text('Scan for verification', dividerX, qrY + qrSize + 15, { width: contentWidth * 0.4, align: 'center' });
  }

  currentY += infoHeight;

  // --- 3. EVENT DETAILS SECTION ---
  const eventHeight = 85;
  doc.rect(margin, currentY, contentWidth, eventHeight)
     .strokeColor(BORDER_COLOR)
     .stroke();

  doc.fillColor(TEXT_COLOR)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('EVENT DETAILS', margin + padding, currentY + 15);

  doc.font('Helvetica')
     .fontSize(10)
     .text(`Venue: ${event?.venue || 'N/A'}`, margin + padding, currentY + 38)
     .text(`Date:  ${formatDate(event?.startDate)}`, margin + padding, currentY + 55);

  currentY += eventHeight;

  // --- 4. ATTENDEE INFO SECTION ---
  const attendeeHeight = 100;
  doc.rect(margin, currentY, contentWidth, attendeeHeight)
     .strokeColor(BORDER_COLOR)
     .stroke();

  doc.fillColor(TEXT_COLOR)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('ATTENDEE INFO', margin + padding, currentY + 15);

  doc.font('Helvetica')
     .fontSize(10)
     .text(`Name:  ${ticket.details?.name || 'N/A'}`, margin + padding, currentY + 38)
     .text(`Email: ${ticket.details?.email || 'N/A'}`, margin + padding, currentY + 55)
     .text(`Phone: ${ticket.details?.phone || 'N/A'}`, margin + padding, currentY + 72);

  currentY += attendeeHeight;

  // --- 5. FOOTER SECTION ---
  const footerHeight = 55;
  doc.rect(margin, currentY, contentWidth, footerHeight)
     .strokeColor(BORDER_COLOR)
     .stroke();

  doc.font('Helvetica')
     .fontSize(10)
     .fillColor(TEXT_COLOR)
     .text('Thank you for choosing DOHEZ.', margin + padding, currentY + 15)
     .text('Please present this ticket at the entrance.', margin + padding, currentY + 32);
};

const renderReceiptDocument = (
  doc: PDFKitDocument,
  receipt: any
): void => {
  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;
  const columnGap = 20;
  const columnWidth = (contentWidth - columnGap) / 2;
  const leftX = margin;
  const rightX = margin + columnWidth + columnGap;

  const headerY = 40;
  // Vendor Info
  const vendor = receipt.vendor as any;
  const branch = receipt.branch as any;
  
  doc.font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(TEXT_COLOR)
    .text(vendor?.name || 'DOHEZ Vendor', leftX, headerY, { width: columnWidth });
  doc.font('Helvetica')
    .fontSize(10)
    .fillColor(MUTED_COLOR)
    .text(branch?.name || 'Main Branch', leftX, headerY + 22, { width: columnWidth });

  doc.font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(THEME_COLOR)
    .text('RECEIPT', rightX, headerY, { width: columnWidth, align: 'right' });

  const metaY = headerY + 70;
  const metaRows = [
    { label: 'Receipt #', value: receipt.receiptNumber || 'N/A' },
    { label: 'Date', value: formatDate(receipt.issuedAt || receipt.createdAt) },
    { label: 'Payment Method', value: (receipt.paymentMethod || 'mpesa').toUpperCase() }
  ];

  let rightY = drawKeyValueRows(doc, metaRows, rightX, metaY, columnWidth);

  let leftY = metaY;
  leftY = drawSectionTitleReceipt(doc, 'Business Details', leftX, leftY, columnWidth);
  const businessLines = [
    vendor?.email || '',
    vendor?.phone || '',
    branch?.location?.address || ''
  ];
  leftY = drawLines(doc, businessLines, leftX, leftY, columnWidth);

  const tableY = Math.max(leftY, rightY) + 30;
  doc.moveTo(margin, tableY - 10)
    .lineTo(margin + contentWidth, tableY - 10)
    .strokeColor(BORDER_COLOR)
    .stroke();

  let currentY = tableY;
  currentY = drawSectionTitleReceipt(doc, 'Payment Summary', leftX, currentY, contentWidth);
  
  const summaryRows = [
    { label: 'Amount Paid', value: formatMoney(receipt.amountPaid) }
  ];
  
  if (receipt.order) summaryRows.push({ label: 'Order ID', value: String(receipt.order._id || receipt.order) });
  if (receipt.appointment) summaryRows.push({ label: 'Appointment ID', value: String(receipt.appointment._id || receipt.appointment) });
  if (receipt.ticket) summaryRows.push({ label: 'Ticket ID', value: String(receipt.ticket._id || receipt.ticket) });

  currentY = drawKeyValueRows(doc, summaryRows, leftX, currentY, contentWidth / 1.5);

  // Footer
  const footerY = doc.page.height - 60;
  doc.moveTo(margin, footerY)
    .lineTo(margin + contentWidth, footerY)
    .strokeColor(BORDER_COLOR)
    .stroke();
  
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED_COLOR)
    .text('This is an electronically generated receipt. Thank you for your business!', margin, footerY + 10, { width: contentWidth, align: 'center' });
};

export const generateTicketPDF = async (ticket: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = new WritableStreamBuffer();

      doc.pipe(stream);

      renderTicketDocument(doc, ticket);

      doc.end();

      stream.on('finish', () => {
        const buffer = stream.getContents() as Buffer;
        resolve(buffer);
      });

      stream.on('error', (error: Error) => {
        reject(error);
      });
    } catch (error: any) {
      reject(error);
    }
  });
};

export const generateReceiptPDF = async (receipt: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = new WritableStreamBuffer();

      doc.pipe(stream);

      renderReceiptDocument(doc, receipt);

      doc.end();

      stream.on('finish', () => {
        const buffer = stream.getContents() as Buffer;
        resolve(buffer);
      });

      stream.on('error', (error: Error) => {
        reject(error);
      });
    } catch (error: any) {
      reject(error);
    }
  });
};
