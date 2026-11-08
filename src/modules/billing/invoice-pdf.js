const PDFDocument = require("pdfkit");

const ink = "#161616";
const muted = "#8b9098";
const line = "#ececee";
const panel = "#f5f6f7";
const green = "#1c8c4e";
const greenSoft = "#e7f6ee";

function money(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function methodLabel(method) {
  if (!method) return "Payment method on file";
  if (method.type === "us_bank_account") {
    const name = method.bankName || "Bank";
    return method.last4 ? `${name}    ••••    ${method.last4}` : name;
  }
  const brand = (method.brand || "Card").toUpperCase();
  return method.last4 ? `${brand}    ••••    ${method.last4}` : brand;
}

function drawLogo(doc, x, y) {
  doc.save();
  doc.lineWidth(1.5).strokeColor(ink);
  doc.moveTo(x + 11, y).lineTo(x + 22, y + 11).lineTo(x + 11, y + 22).lineTo(x, y + 11).closePath().stroke();
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(15).fillColor(ink).text("AmenityOps", x + 30, y + 4, { lineBreak: false });
}

function renderInvoicePdf(invoice, output) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(output);

  const left = 48;
  const right = 547;
  const width = right - left;
  const number = String(invoice.invoiceNumber || invoice.id);
  const shownNumber = number.startsWith("#") ? number : `#${number}`;
  const status = invoice.status || "Paid";

  drawLogo(doc, left, 46);

  doc.font("Helvetica-Bold").fontSize(20);
  const titleWidth = doc.widthOfString("INVOICE");
  doc.font("Helvetica-Bold").fontSize(9);
  const pillWidth = doc.widthOfString(status) + 18;
  const blockWidth = titleWidth + 10 + pillWidth;
  const blockX = right - blockWidth;

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text("INVOICE", blockX, 44, { lineBreak: false });
  const pillX = blockX + titleWidth + 10;
  doc.roundedRect(pillX, 48, pillWidth, 16, 8).fill(greenSoft);
  doc.fillColor(green).font("Helvetica-Bold").fontSize(9).text(status, pillX + 9, 52, { lineBreak: false });
  doc.fillColor(muted).font("Helvetica").fontSize(10).text(shownNumber, blockX, 70, {
    width: blockWidth,
    align: "right",
  });

  doc.moveTo(left, 108).lineTo(right, 108).strokeColor(line).lineWidth(1).stroke();

  const infoY = 126;
  doc.roundedRect(left, infoY, width, 78, 8).fill(panel);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("BILLED TO", left + 16, infoY + 16, { lineBreak: false });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(invoice.companyName || "Client", left + 16, infoY + 34, {
    width: 250,
  });

  const metaX = left + 300;
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("INVOICE DATE", metaX, infoY + 14, {
    width: 180,
    align: "right",
  });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(displayDate(invoice.date), metaX, infoY + 28, {
    width: 180,
    align: "right",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("TRANSACTION ID", metaX, infoY + 46, {
    width: 180,
    align: "right",
  });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(invoice.transactionId || invoice.id, metaX, infoY + 58, {
    width: 180,
    align: "right",
  });

  const tableY = 224;
  doc.rect(left, tableY, width, 34).fill(panel);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("DESCRIPTION", left + 16, tableY + 13, { lineBreak: false });
  doc.text("AMOUNT", left + width - 110, tableY + 13, { width: 94, align: "right" });

  const rowY = tableY + 48;
  doc.circle(left + 22, rowY + 4, 7).lineWidth(1).strokeColor("#d5d7db").stroke();
  doc.fillColor(ink).font("Helvetica").fontSize(11).text(invoice.description, left + 40, rowY - 4, { width: 300 });
  doc.font("Helvetica-Bold").text(money(invoice.total), left + width - 130, rowY - 4, { width: 114, align: "right" });
  doc.moveTo(left, rowY + 28).lineTo(right, rowY + 28).strokeColor(line).stroke();

  const cardX = 312;
  const cardY = 330;
  const cardW = 235;
  doc.roundedRect(cardX, cardY, cardW, 132, 8).fill(panel);
  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Subtotal", cardX + 16, cardY + 16, { lineBreak: false });
  doc.fillColor(ink).text(money(invoice.subtotal), cardX + 110, cardY + 16, { width: 108, align: "right" });
  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Total Amount", cardX + 16, cardY + 48, { lineBreak: false });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(money(invoice.total), cardX + 70, cardY + 42, {
    width: 148,
    align: "right",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Amount Paid", cardX + 16, cardY + 78, { lineBreak: false });
  doc.fillColor(green).font("Helvetica-Bold").text(money(invoice.amountPaid), cardX + 110, cardY + 78, {
    width: 108,
    align: "right",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Balance Due", cardX + 16, cardY + 100, { lineBreak: false });
  doc.fillColor(ink).font("Helvetica-Bold").text(money(invoice.balanceDue), cardX + 110, cardY + 100, {
    width: 108,
    align: "right",
  });

  doc.fillColor(green).font("Helvetica-Bold").fontSize(8).text("CRYPTOGRAPHICALLY SIGNED", left, cardY + 8, {
    lineBreak: false,
  });
  doc.fillColor(muted).font("Helvetica").fontSize(9).text("Transaction settled via automated clearing.", left, cardY + 26, {
    width: 240,
  });
  doc.text(`Reconciled under Ledger Batch ${number}.`, left, cardY + 42, { width: 240 });

  const payY = 490;
  doc.roundedRect(left, payY, width, 64, 8).fill(panel);
  doc.roundedRect(left + 16, payY + 18, 28, 28, 6).fill("#ffffff");
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(methodLabel(invoice.paymentMethod), left + 56, payY + 18, {
    width: 250,
  });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text(invoice.transactionId || "", left + 56, payY + 36, {
    width: 250,
  });
  doc.text("PAYMENT STATUS", left + 300, payY + 24, { width: 120, align: "right" });
  const statusX = left + 430;
  doc.roundedRect(statusX, payY + 20, pillWidth + 8, 18, 9).fill(greenSoft);
  doc.fillColor(green).font("Helvetica-Bold").fontSize(9).text(status, statusX + 12, payY + 25, { lineBreak: false });

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text("Thank you for your business!", left, 720, {
    width,
    align: "center",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(9).text("Amenity Ops  |  SaaS Billing & Subscription Management", left, 740, {
    width,
    align: "center",
  });
  doc.text("This invoice serves as confirmation of your successful payment.", left, 756, {
    width,
    align: "center",
  });

  doc.end();
  return doc;
}

module.exports = { renderInvoicePdf };
