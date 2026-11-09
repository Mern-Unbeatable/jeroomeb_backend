const prisma = require("../../shared/prisma");

const SOFTWARE_PRODUCT = "Amenity OP's Application";

function dollars(value) {
  if (value == null) return null;
  return Number(value.toString()).toFixed(2);
}

function grouped(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sortBands(bands) {
  return [...bands].sort((left, right) => {
    if (left.maxUnits == null && right.maxUnits == null) return 0;
    if (left.maxUnits == null) return 1;
    if (right.maxUnits == null) return -1;
    return left.maxUnits - right.maxUnits;
  });
}

function contactOnly(band) {
  return Number(band.monthlyPrice.toString()) === 0;
}

function limitLabel(band, previous) {
  if (band.maxUnits == null && band.maxSquareFootage == null && previous && previous.maxUnits != null) {
    const footage = previous.maxSquareFootage == null ? "" : ` / ${grouped(previous.maxSquareFootage)} sq ft`;
    return `> ${grouped(previous.maxUnits)} units${footage}`;
  }
  if (band.maxUnits == null) return "Contact Us";
  const footage = band.maxSquareFootage == null ? "" : ` / ${grouped(band.maxSquareFootage)} sq ft`;
  return `≤ ${grouped(band.maxUnits)} units${footage}`;
}

function percent(current, threshold) {
  if (current == null || !threshold) return null;
  return Math.round((current / threshold) * 100);
}

async function loadBands(kind) {
  const bands = await prisma.servicePriceBand.findMany({
    where: { active: true, kind },
  });
  return sortBands(bands);
}

function presentPlans(bands, currentId) {
  return bands.map((band, index) => ({
    id: band.id,
    name: band.name,
    monthlyPrice: dollars(band.monthlyPrice),
    minUnits: band.minUnits,
    maxUnits: band.maxUnits,
    maxSquareFootage: band.maxSquareFootage,
    limitLabel: limitLabel(band, bands[index - 1]),
    contactOnly: contactOnly(band),
    current: band.id === currentId,
  }));
}

function tierProgress(subscribed, bands, property) {
  if (!subscribed) return null;
  const ordered = sortBands(bands);
  const index = ordered.findIndex((band) => band.id === subscribed.id);
  const next = index >= 0 ? ordered[index + 1] || null : null;
  const units = property ? property.unitCount : null;
  const footage = property ? property.squareFootage : null;
  const unitsFit = subscribed.maxUnits == null || units == null || units <= subscribed.maxUnits;
  const footageFit = subscribed.maxSquareFootage == null || footage == null || footage <= subscribed.maxSquareFootage;
  const withinCurrentTier = unitsFit && footageFit;

  return {
    withinCurrentTier,
    message: withinCurrentTier
      ? "Your current property size is within the applicable tier."
      : "Your property size has reached the next tier.",
    units: {
      current: units,
      threshold: subscribed.maxUnits,
      percent: percent(units, subscribed.maxUnits),
    },
    squareFootage: {
      current: footage,
      threshold: subscribed.maxSquareFootage,
      percent: percent(footage, subscribed.maxSquareFootage),
    },
    nextTier: next
      ? {
          id: next.id,
          name: next.name,
          monthlyPrice: dollars(next.monthlyPrice),
          maxUnits: next.maxUnits,
          maxSquareFootage: next.maxSquareFootage,
          contactOnly: contactOnly(next),
        }
      : null,
  };
}

module.exports = {
  SOFTWARE_PRODUCT,
  dollars,
  contactOnly,
  sortBands,
  limitLabel,
  loadBands,
  presentPlans,
  tierProgress,
};
