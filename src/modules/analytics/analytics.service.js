const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function changePercent(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sharePercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function lastMonths(count, now) {
  const start = monthStart(now);
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = addMonths(start, -index);
    months.push({
      key: monthKey(date),
      label: MONTHS[date.getUTCMonth()],
      fullService: 0,
      software: 0,
    });
  }
  return months;
}

function customerId(invoice) {
  if (typeof invoice.customer === "string") return invoice.customer;
  return invoice.customer && invoice.customer.id;
}

function paidAt(invoice) {
  const seconds = (invoice.status_transitions && invoice.status_transitions.paid_at) || invoice.created;
  return new Date(seconds * 1000);
}

function bucket(invoice, kindByCustomer) {
  const reason = invoice.billing_reason;
  const subscription =
    reason === "subscription_create" || reason === "subscription_cycle" || reason === "subscription_update";
  if (!subscription) return "addOn";
  const kind = kindByCustomer.get(customerId(invoice));
  if (kind === "FULL_SERVICE") return "fullService";
  if (kind === "SOFTWARE") return "software";
  return null;
}

async function paidInvoices(since) {
  const invoices = [];
  let startingAfter;
  try {
    for (let page = 0; page < 20; page += 1) {
      const listed = await stripe.invoices.list({
        status: "paid",
        created: { gte: Math.floor(since.getTime() / 1000) },
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      invoices.push(...listed.data);
      if (!listed.has_more || !listed.data.length) break;
      startingAfter = listed.data[listed.data.length - 1].id;
    }
    return invoices;
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Analytics could not be loaded");
  }
}

async function revenue(now) {
  const chartStart = addMonths(monthStart(now), -11);
  const yearStart = addMonths(monthStart(now), -23);
  const invoices = await paidInvoices(yearStart);
  const organizations = await prisma.organization.findMany({
    where: { stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true, planKind: true },
  });
  const kindByCustomer = new Map(
    organizations.map((organization) => [organization.stripeCustomerId, organization.planKind])
  );

  const months = lastMonths(12, now);
  const byMonth = new Map(months.map((month) => [month.key, month]));
  const thisMonth = monthKey(now);
  const previousMonth = monthKey(addMonths(monthStart(now), -1));
  let recent = 0;
  let prior = 0;
  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  let fullService = 0;
  let software = 0;
  let addOn = 0;

  for (const invoice of invoices) {
    const cents = Number(invoice.amount_paid || 0);
    if (!cents) continue;
    const when = paidAt(invoice);
    const key = monthKey(when);
    const kind = bucket(invoice, kindByCustomer);
    if (when >= chartStart) recent += cents;
    else prior += cents;
    if (key === thisMonth) {
      thisMonthTotal += cents;
      if (kind === "fullService") fullService += cents;
      else if (kind === "software") software += cents;
      else if (kind === "addOn") addOn += cents;
    } else if (key === previousMonth) {
      lastMonthTotal += cents;
    }
    const row = byMonth.get(key);
    if (row && (kind === "fullService" || kind === "software")) row[kind] += cents;
  }

  return {
    totalRevenue: { amount: money(recent), changePercent: changePercent(recent, prior) },
    revenueThisMonth: {
      amount: money(thisMonthTotal),
      changePercent: changePercent(thisMonthTotal, lastMonthTotal),
      month: MONTHS[now.getUTCMonth()],
    },
    fullServiceRevenue: {
      amount: money(fullService),
      sharePercent: sharePercent(fullService, thisMonthTotal),
      month: MONTHS[now.getUTCMonth()],
    },
    softwareRevenue: {
      amount: money(software),
      sharePercent: sharePercent(software, thisMonthTotal),
      month: MONTHS[now.getUTCMonth()],
    },
    addOnRevenue: {
      amount: money(addOn),
      sharePercent: sharePercent(addOn, thisMonthTotal),
      month: MONTHS[now.getUTCMonth()],
    },
    months: months.map((month) => ({
      month: month.key,
      label: month.label,
      fullService: money(month.fullService),
      software: money(month.software),
    })),
  };
}

async function operations(now) {
  const periodStart = addMonths(monthStart(now), -11);
  const [totalProperties, previousProperties, pendingProperties, inProgress, activeRightNow, grouped] =
    await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { createdAt: { lt: monthStart(now) } } }),
      prisma.property.count({ where: { roster: { none: {} } } }),
      prisma.inspection.count({ where: { status: "IN_PROGRESS" } }),
      prisma.inspection.count({ where: { status: "IN_PROGRESS", startedAt: { not: null } } }),
      prisma.inspection.groupBy({
        by: ["status"],
        where: { scheduledAt: { gte: periodStart } },
        _count: { _all: true },
      }),
    ]);

  const counts = { PENDING: 0, IN_PROGRESS: 0, RESOLVED_CLOSED: 0, CANCELLED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  const total = counts.PENDING + counts.IN_PROGRESS + counts.RESOLVED_CLOSED + counts.CANCELLED;

  return {
    totalProperties: {
      value: totalProperties,
      changePercent: changePercent(totalProperties, previousProperties),
    },
    pendingProperties: { value: pendingProperties },
    inspectionsInProgress: { value: inProgress, activeRightNow },
    inspections: {
      total,
      resolvedPercent: sharePercent(counts.RESOLVED_CLOSED, total),
      completed: counts.RESOLVED_CLOSED,
      inProgress: counts.IN_PROGRESS,
      pending: counts.PENDING,
      cancelled: counts.CANCELLED,
    },
  };
}

async function report() {
  const now = new Date();
  const [moneyReport, operationReport] = await Promise.all([revenue(now), operations(now)]);
  return {
    cards: {
      totalProperties: operationReport.totalProperties,
      pendingProperties: operationReport.pendingProperties,
      inspectionsInProgress: operationReport.inspectionsInProgress,
      totalRevenue: moneyReport.totalRevenue,
      revenueThisMonth: moneyReport.revenueThisMonth,
      fullServiceRevenue: moneyReport.fullServiceRevenue,
      softwareRevenue: moneyReport.softwareRevenue,
      addOnRevenue: moneyReport.addOnRevenue,
    },
    revenue: { months: moneyReport.months },
    inspections: operationReport.inspections,
  };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(data) {
  const lines = [["Metric", "Value", "Change", "Share", "Month"].join(",")];
  const cards = [
    ["Total Properties", data.cards.totalProperties.value, data.cards.totalProperties.changePercent, "", ""],
    ["Pending Properties", data.cards.pendingProperties.value, "", "", ""],
    ["Inspections In Progress", data.cards.inspectionsInProgress.value, "", "", ""],
    ["Active Right Now", data.cards.inspectionsInProgress.activeRightNow, "", "", ""],
    ["Total Revenue", data.cards.totalRevenue.amount, data.cards.totalRevenue.changePercent, "", ""],
    ["Revenue This Month", data.cards.revenueThisMonth.amount, data.cards.revenueThisMonth.changePercent, "", data.cards.revenueThisMonth.month],
    ["Full-Service Revenue", data.cards.fullServiceRevenue.amount, "", data.cards.fullServiceRevenue.sharePercent, data.cards.fullServiceRevenue.month],
    ["Software-Only Revenue", data.cards.softwareRevenue.amount, "", data.cards.softwareRevenue.sharePercent, data.cards.softwareRevenue.month],
    ["Add-On Service", data.cards.addOnRevenue.amount, "", data.cards.addOnRevenue.sharePercent, data.cards.addOnRevenue.month],
    ["Inspections", data.inspections.total, "", data.inspections.resolvedPercent, ""],
    ["Completed", data.inspections.completed, "", "", ""],
    ["In Progress", data.inspections.inProgress, "", "", ""],
    ["Pending", data.inspections.pending, "", "", ""],
    ["Cancelled", data.inspections.cancelled, "", "", ""],
  ];
  for (const row of cards) lines.push(row.map(csvCell).join(","));
  lines.push("");
  lines.push(["Month", "Full Service", "Software Only"].join(","));
  for (const month of data.revenue.months) {
    lines.push([month.month, month.fullService, month.software].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

module.exports = { report, toCsv };
