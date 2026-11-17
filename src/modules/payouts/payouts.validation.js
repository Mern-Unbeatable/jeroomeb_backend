const { z } = require("zod");

const requestPayoutSchema = z.object({
  inspectionId: z.uuid(),
});

module.exports = { requestPayoutSchema };
