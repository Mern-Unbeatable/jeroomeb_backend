const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

const reportInclude = {
  inspection: {
    include: {
      property: { select: { id: true, code: true, name: true } },
      template: { select: { id: true, name: true } },
      specialist: { include: { user: { select: { fullName: true } } } },
    },
  },
};

function toReport(report) {
  return {
    id: report.id,
    inspectionId: report.inspectionId,
    summary: report.summary,
    pdfUrl: report.pdfUrl,
    emailedAt: report.emailedAt,
    propertyId: report.inspection.property.id,
    propertyCode: report.inspection.property.code,
    propertyName: report.inspection.property.name,
    templateName: report.inspection.template.name,
    specialistName: report.inspection.specialist
      ? report.inspection.specialist.user.fullName
      : null,
    createdAt: report.createdAt,
  };
}

async function specialistId(actor) {
  if (actor.role !== "SPECIALIST") return null;
  const profile = await prisma.specialistProfile.findUnique({ where: { userId: actor.id } });
  return profile ? profile.id : "00000000-0000-0000-0000-000000000000";
}

async function list(actor) {
  const where = {};
  const ownId = await specialistId(actor);
  if (ownId) where.inspection = { specialistId: ownId };
  const reports = await prisma.report.findMany({
    where,
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return { reports: reports.map(toReport) };
}

async function getById(id, actor) {
  const report = await prisma.report.findUnique({ where: { id }, include: reportInclude });
  if (!report) throw new HttpError(404, "Report not found");
  const ownId = await specialistId(actor);
  if (ownId && report.inspection.specialistId !== ownId) {
    throw new HttpError(403, "You do not have access to this");
  }
  return { report: toReport(report) };
}

module.exports = { list, getById };
