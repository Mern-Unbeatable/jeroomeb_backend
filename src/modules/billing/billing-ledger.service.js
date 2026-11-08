const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");
const { allowedOrigins } = require("../../shared/cors");

const ledgerStatuses = ["PENDING_REVIEW", "APPROVED", "IN_PROGRESS", "ONGOING", "COMPLETED"];

const statusLabels = {
  PENDING_REVIEW: "Pending",
  APPROVED: "Active",
  IN_PROGRESS: "Ongoing",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

function dollars(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function stripeTime(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function returnUrl(value, fallback) {
  const target = value || fallback;
  let url;
  try {
    url = new URL(target);
  } catch {
    throw new HttpError(400, "Invalid return URL");
  }
  if (!allowedOrigins().has(url.origin)) {
    throw new HttpError(400, "Return URL is not allowed");
  }
  return target;
}

function checkoutSuccessUrl(value) {
  const target = returnUrl(value, "https://jeroomeb.maktechgroup.tech/billing/success");
  if (target.includes("{CHECKOUT_SESSION_ID}")) return target;
  return `${target}${target.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

async function fullServiceAccount(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (
    !organization ||
    organization.subscriptionStatus !== "ACTIVE" ||
    organization.planKind !== "FULL_SERVICE"
  ) {
    throw new HttpError(403, "The billing ledger is available on an active Service + Software plan");
  }
  return organization;
}

function cardSummary(method) {
  if (!method || typeof method === "string") return null;
  if (method.card) {
    return {
      type: "card",
      brand: method.card.brand,
      last4: method.card.last4,
      expMonth: method.card.exp_month,
      expYear: method.card.exp_year,
      updatedAt: stripeTime(method.created),
    };
  }
  if (method.us_bank_account) {
    return {
      type: "us_bank_account",
      bankName: method.us_bank_account.bank_name,
      last4: method.us_bank_account.last4,
      updatedAt: stripeTime(method.created),
    };
  }
  return { type: method.type, last4: null, updatedAt: stripeTime(method.created) };
}

async function currentPaymentMethod(organization) {
  if (!organization.stripeCustomerId) return null;
  try {
    const customer = await stripe.customers.retrieve(organization.stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;
    const summary = cardSummary(customer.invoice_settings.default_payment_method);
    if (summary || !organization.stripeSubscriptionId) return summary;
    const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId, {
      expand: ["default_payment_method"],
    });
    return cardSummary(subscription.default_payment_method);
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Billing details could not be loaded");
  }
}

function invoiceDescription(invoice) {
  const line = invoice.lines && invoice.lines.data && invoice.lines.data[0];
  if (invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_create") {
    return "Monthly SaaS Subscription Renewal";
  }
  if (invoice.billing_reason === "subscription_update") return "Subscription Adjustment";
  if (line && line.description) return line.description;
  return "Invoice";
}

function invoiceStatus(invoice) {
  if (invoice.status === "paid" && Number(invoice.total) === 0) return "Completed";
  if (invoice.status === "paid") return "Paid";
  if (invoice.status === "open") return "Open";
  if (invoice.status === "void") return "Void";
  if (invoice.status === "uncollectible") return "Uncollectible";
  return invoice.status;
}

function transactionId(invoice) {
  if (typeof invoice.payment_intent === "string") return invoice.payment_intent;
  if (invoice.payment_intent && invoice.payment_intent.id) return invoice.payment_intent.id;
  if (typeof invoice.charge === "string") return invoice.charge;
  if (invoice.charge && invoice.charge.id) return invoice.charge.id;
  return invoice.id;
}

function toInvoiceRow(invoice, paymentMethod) {
  return {
    id: invoice.id,
    date: stripeTime(invoice.status_transitions && invoice.status_transitions.paid_at) || stripeTime(invoice.created),
    transactionId: transactionId(invoice),
    description: invoiceDescription(invoice),
    amount: dollars(invoice.total),
    status: invoiceStatus(invoice),
    invoiceNumber: invoice.number || invoice.id,
    card: invoice.status === "paid" ? paymentMethod : null,
  };
}

async function listInvoices(organization, paymentMethod) {
  if (!organization.stripeCustomerId) return [];
  try {
    const listed = await stripe.invoices.list({
      customer: organization.stripeCustomerId,
      limit: 100,
    });
    return listed.data
      .filter((invoice) => invoice.status !== "draft")
      .map((invoice) => toInvoiceRow(invoice, paymentMethod))
      .sort((left, right) => new Date(right.date) - new Date(left.date));
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Billing details could not be loaded");
  }
}

function activityFor(status, isMain) {
  if (status === "PENDING_REVIEW") return "Service request submitted, pending approval";
  if (status === "COMPLETED") return "Service request completed";
  if (isMain) return "Monthly service period commenced";
  return "Service request approved and activated";
}

async function serviceLedger(user, organization) {
  const email = user.email.trim().toLowerCase();
  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: { in: ledgerStatuses },
      OR: [{ organizationId: organization.id }, { submittedById: user.id }, { email }],
    },
    include: { items: { include: { addOnService: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const rows = [];
  for (const request of requests) {
    const items = [...request.items].sort(
      (left, right) => left.addOnService.sortOrder - right.addOnService.sortOrder
    );
    const addOns = items.filter((item) => item.addOnService.sortOrder !== 0);
    const chosen = addOns.length ? addOns : items.slice(0, 1);
    for (const item of chosen) {
      const isMain = item.addOnService.sortOrder === 0;
      rows.push({
        service: item.addOnService.name,
        activity: activityFor(request.status, isMain),
        date: request.updatedAt,
        status: statusLabels[request.status] || request.status,
        requestId: request.id,
        requestCode: request.code,
      });
    }
  }
  return rows;
}

async function ledger(user) {
  const organization = await fullServiceAccount(user);
  const paymentMethod = await currentPaymentMethod(organization);
  const invoices = await listInvoices(organization, paymentMethod);
  const totalSettled = invoices
    .filter((invoice) => invoice.status === "Paid" || invoice.status === "Completed")
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  return {
    paymentMethod,
    invoices,
    totalSettled: totalSettled.toFixed(2),
    serviceLedger: await serviceLedger(user, organization),
  };
}

async function loadInvoice(id) {
  try {
    return await stripe.invoices.retrieve(id);
  } catch (error) {
    if (error && (error.code === "resource_missing" || error.statusCode === 404)) {
      throw new HttpError(404, "Invoice not found");
    }
    console.error(error);
    throw new HttpError(502, "Billing details could not be loaded");
  }
}

async function invoiceDetail(user, invoiceId) {
  const organization = await fullServiceAccount(user);
  const invoice = await loadInvoice(invoiceId);
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer && invoice.customer.id;
  if (!organization.stripeCustomerId || customerId !== organization.stripeCustomerId) {
    throw new HttpError(403, "You do not have access to this");
  }
  const paymentMethod = invoice.status === "paid" ? await currentPaymentMethod(organization) : null;
  const line = invoice.lines && invoice.lines.data && invoice.lines.data[0];
  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.number || invoice.id,
      status: invoiceStatus(invoice),
      companyName: organization.name,
      date: stripeTime(invoice.status_transitions && invoice.status_transitions.paid_at) || stripeTime(invoice.created),
      transactionId: transactionId(invoice),
      description: invoiceDescription(invoice),
      lineDescription: line && line.description ? line.description : invoiceDescription(invoice),
      subtotal: dollars(invoice.subtotal),
      total: dollars(invoice.total),
      amountPaid: dollars(invoice.amount_paid),
      balanceDue: dollars(invoice.amount_remaining),
      paymentMethod,
      downloadPath: `/api/v1/billing/invoices/${invoice.id}/pdf`,
    },
  };
}

async function startPaymentMethod(user, input) {
  const organization = await fullServiceAccount(user);
  if (!organization.stripeCustomerId) {
    throw new HttpError(403, "Complete payment before updating a payment method");
  }
  const payload = {
    mode: "setup",
    currency: "usd",
    customer: organization.stripeCustomerId,
    client_reference_id: organization.id,
    metadata: {
      purpose: "PAYMENT_METHOD",
      organizationId: organization.id,
      userId: user.id,
    },
    success_url: checkoutSuccessUrl(input.successUrl),
    cancel_url: returnUrl(input.cancelUrl, "https://jeroomeb.maktechgroup.tech/billing/cancel"),
  };
  try {
    const session = await stripe.checkout.sessions.create(payload);
    return { sessionId: session.id, url: session.url };
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Payment method could not be updated");
  }
}

async function confirmPaymentMethod(user, sessionId) {
  const organization = await fullServiceAccount(user);
  if (!organization.stripeCustomerId) {
    throw new HttpError(403, "Complete payment before updating a payment method");
  }
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent.payment_method"],
    });
  } catch (error) {
    console.error(error);
    throw new HttpError(400, "Payment session not found");
  }
  if (session.metadata.purpose !== "PAYMENT_METHOD" || session.metadata.organizationId !== organization.id) {
    throw new HttpError(403, "You do not have access to this payment");
  }
  const setupIntent = session.setup_intent;
  if (!setupIntent || typeof setupIntent === "string" || setupIntent.status !== "succeeded") {
    throw new HttpError(400, "Payment method was not saved");
  }
  const method = setupIntent.payment_method;
  const methodId = typeof method === "string" ? method : method.id;
  try {
    await stripe.customers.update(organization.stripeCustomerId, {
      invoice_settings: { default_payment_method: methodId },
    });
    if (organization.stripeSubscriptionId) {
      await stripe.subscriptions.update(organization.stripeSubscriptionId, {
        default_payment_method: methodId,
      });
    }
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Payment method could not be updated");
  }
  const summary = cardSummary(typeof method === "string" ? null : method);
  return { paymentMethod: summary };
}

module.exports = { ledger, invoiceDetail, startPaymentMethod, confirmPaymentMethod };
