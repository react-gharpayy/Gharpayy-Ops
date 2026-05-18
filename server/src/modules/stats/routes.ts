import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import type { Lead } from "../../../../src/contracts/entities.js";
import type { Tour } from "../../../../src/contracts/entities.js";
import { buildIstDayRange, getPeriodBounds, GOALS, type LeaderboardPeriod } from "./ist.js";

const STAFF_ROLES = ["super_admin", "manager", "admin", "member", "tcm"] as const;

async function getScopedMemberIdsForAdmin(tenantId: string, adminId: string) {
  const adminUser = await col<UserDoc>("users").findOne({ _id: adminId, tenantId });
  const adminZones = new Set(
    (adminUser?.zones ?? []).map((zone) => String(zone).trim().toLowerCase()).filter(Boolean),
  );

  if (adminZones.size === 0) return [] as string[];

  const allMembers = await col<UserDoc>("users")
    .find({ tenantId, role: { $in: ["member", "tcm"] }, status: { $in: ["active", "inactive"] } })
    .project({ _id: 1, zones: 1 })
    .toArray();

  return allMembers
    .filter((member) => {
      const memberZones = (member.zones ?? [])
        .map((z: string) => String(z).trim().toLowerCase())
        .filter(Boolean);
      return memberZones.some((z: string) => adminZones.has(z));
    })
    .map((member) => member._id);
}

export function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats/daily-progress", { preHandler: [requireAuth] }, async (req, reply) => {
    const role = req.user!.role;
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Forbidden" });
    }

    const q = z.object({ date: z.string().optional() }).parse(req.query);
    const { selectedDate, dayStart, dayEnd } = buildIstDayRange(q.date ?? null);
    const tenantId = req.user!.tenantId;

    let members: Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[] = [];

    if (role === "member" || role === "tcm") {
      const me = await col<UserDoc>("users").findOne(
        { _id: req.user!.sub, tenantId },
        { projection: { _id: 1, fullName: 1, zones: 1, role: 1 } },
      );
      members = me ? [me] : [];
    } else if (role === "admin") {
      const scopedMemberIds = await getScopedMemberIdsForAdmin(tenantId, req.user!.sub);
      if (scopedMemberIds.length === 0) {
        return reply.send({
          date: selectedDate,
          members: [],
          goals: GOALS,
          thresholds: GOALS,
        });
      }
      members = (await col<UserDoc>("users")
        .find({
          _id: { $in: scopedMemberIds },
          tenantId,
          role: { $in: ["member", "tcm"] },
          status: { $in: ["active", "inactive"] },
        })
        .project({ _id: 1, fullName: 1, zones: 1, role: 1 })
        .toArray()) as Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[];
    } else {
      members = (await col<UserDoc>("users")
        .find({ tenantId, role: { $in: ["member", "tcm"] }, status: { $in: ["active", "inactive"] } })
        .project({ _id: 1, fullName: 1, zones: 1, role: 1 })
        .toArray()) as Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[];
    }

    if (!members.length) {
      return reply.send({
        date: selectedDate,
        members: [],
        goals: GOALS,
        thresholds: GOALS,
      });
    }

    const memberIds = members.map((m) => m._id);

    const leadsAgg = await col<Lead>("leads")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            createdBy: { $in: memberIds },
            createdAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$createdBy", count: { $sum: 1 } } },
      ])
      .toArray();

    const toursAgg = await col<Tour>("tours")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            scheduledBy: { $in: memberIds },
            createdAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$scheduledBy", count: { $sum: 1 } } },
      ])
      .toArray();

    const leadsMap = new Map(leadsAgg.map((x) => [x._id, x.count]));
    const toursMap = new Map(toursAgg.map((x) => [x._id, x.count]));

    const result = members.map((member) => {
      const id = member._id;
      const leadsAdded = leadsMap.get(id) ?? 0;
      const toursScheduled = toursMap.get(id) ?? 0;
      const leadsDone = leadsAdded >= GOALS.leadsAdded;
      const toursDone = toursScheduled >= GOALS.toursScheduled;

      return {
        id,
        name: member.fullName,
        zones: member.zones ?? [],
        role: member.role === "tcm" ? "tcm" : "member",
        leadsAdded,
        toursScheduled,
        leadsDone,
        toursDone,
        allDone: leadsDone && toursDone,
        newLeads: leadsAdded,
        visitConfirmed: toursScheduled,
      };
    });

    result.sort((a, b) => {
      if (a.allDone !== b.allDone) return a.allDone ? -1 : 1;
      if (b.toursScheduled !== a.toursScheduled) return b.toursScheduled - a.toursScheduled;
      if (b.leadsAdded !== a.leadsAdded) return b.leadsAdded - a.leadsAdded;
      return String(a.name).localeCompare(String(b.name));
    });

    return reply.send({
      date: selectedDate,
      members: result,
      goals: GOALS,
      thresholds: GOALS,
      visitStageLabel: "Tours Scheduled",
      targets: {
        newLeads: GOALS.leadsAdded,
        visitConfirmed: GOALS.toursScheduled,
      },
    });
  });

  app.get("/api/stats/leaderboard", { preHandler: [requireAuth] }, async (req, reply) => {
    const role = req.user!.role;
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Forbidden" });
    }

    const q = z
      .object({
        period: z.enum(["this_month", "all_time", "today", "last_30_days", "custom"]).default("this_month"),
        zone: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);

    const period = q.period as LeaderboardPeriod;
    const tenantId = req.user!.tenantId;
    const zoneQuery = q.zone && q.zone !== "all" ? q.zone : null;

    let from: string | null = null;
    let to: string | null = null;

    if (period === "custom" && q.from && q.to) {
      const fromDate = new Date(q.from);
      const toDate = new Date(q.to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        from = fromDate.toISOString();
        toDate.setUTCHours(23, 59, 59, 999);
        to = toDate.toISOString();
      }
    } else if (period !== "custom") {
      const bounds = getPeriodBounds(period);
      from = bounds.from;
      to = bounds.to;
    }

    const tourMatch: Record<string, unknown> = {
      tenantId,
      scheduledBy: { $exists: true, $ne: "" },
    };

    if (from && to) {
      tourMatch.scheduledAt = { $gte: from, $lte: to };
    }

    type LeaderboardRow = {
      userId: string;
      name: string;
      role: string;
      toursCount: number;
      zones: { zone: string; count: number }[];
    };

    const rows = (await col<Tour>("tours")
      .aggregate([
        { $match: tourMatch },
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        {
          $unwind: {
            path: "$lead",
            preserveNullAndEmptyArrays: true,
          },
        },
        ...(zoneQuery
          ? [
              {
                $match: {
                  $or: [
                    { "lead.zoneCategory": zoneQuery },
                    { "lead.zoneId": zoneQuery },
                  ],
                },
              },
            ]
          : []),
        {
          $group: {
            _id: {
              memberId: "$scheduledBy",
              zone: {
                $cond: [
                  {
                    $gt: [
                      {
                        $strLenCP: {
                          $trim: {
                            input: { $ifNull: ["$lead.zoneCategory", ""] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                  "$lead.zoneCategory",
                  null,
                ],
              },
            },
            toursCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.memberId",
            toursCount: { $sum: "$toursCount" },
            zones: {
              $push: {
                zone: "$_id.zone",
                count: "$toursCount",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $match: {
            "user.role": { $in: ["member", "tcm"] },
            "user.status": { $ne: "deleted" },
            "user.tenantId": tenantId,
          },
        },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: { $ifNull: ["$user.fullName", "$user.username"] },
            role: "$user.role",
            toursCount: 1,
            zones: {
              $filter: {
                input: "$zones",
                as: "z",
                cond: { $ne: ["$$z.zone", null] },
              },
            },
          },
        },
        { $sort: { toursCount: -1, name: 1, userId: 1 } },
      ])
      .toArray()) as LeaderboardRow[];

    const rankings = rows.map((row, idx) => ({
      rank: idx + 1,
      userId: row.userId,
      name: row.name || "Unknown User",
      role: (row.role === "tcm" ? "tcm" : "member") as "tcm" | "member",
      toursCount: row.toursCount || 0,
      zones: (row.zones || []).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.zone).localeCompare(String(b.zone));
      }),
    }));

    return reply.send({
      period,
      from,
      to,
      generatedAt: new Date().toISOString(),
      rankings,
    });
  });
}
