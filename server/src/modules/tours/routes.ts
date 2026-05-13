import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { Tour } from "../../../../src/contracts/entities.js";

const ListQuery = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export function registerToursRoutes(app: FastifyInstance) {
  app.get("/api/tours", { preHandler: [requireAuth, requireScope("tour.read")] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    const role = req.user!.role;
    const myId = req.user!.sub;

    if (role === "member") {
      filter.$or = [{ assignedTo: myId }, { scheduledBy: myId }];
    }

    if (q.cursor) {
      filter._id = { $lt: q.cursor };
    }

    const items = await col<Tour>("tours")
      .find(filter)
      .sort({ _id: -1 })
      .limit(q.limit)
      .toArray();

    return reply.send({ items, nextCursor: items.length === q.limit ? items[items.length - 1]._id : null });
  });
}
