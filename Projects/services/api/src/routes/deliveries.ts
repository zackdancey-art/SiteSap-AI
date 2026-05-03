import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { listDeliveries, createDelivery, updateDelivery, deleteDelivery } from "../storage/deliveriesStore";
import { rateLimit } from "../middleware/rateLimit";

export const deliveriesRouter: Router = Router();
deliveriesRouter.use(requireAuth);

function getActor(req: AuthenticatedRequest) {
  return { email: req.auth.email, role: req.auth.role };
}

const DeliverySchema = z.object({
  siteId: z.string().min(1),
  date: z.string().min(1),
  supplier: z.string().default(""),
  items: z.array(z.string()).default([]),
  quantity: z.string().default(""),
  notes: z.string().default(""),
});

const DeliveryPatchSchema = DeliverySchema.omit({ siteId: true }).partial();

deliveriesRouter.get("/deliveries", async (req, res) => {
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const deliveries = await listDeliveries(getActor(req as unknown as AuthenticatedRequest), siteId);
  return res.json({ deliveries });
});

deliveriesRouter.post("/deliveries", rateLimit("deliveries-post", 60, 60 * 60 * 1000), async (req, res) => {
  const parsed = DeliverySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid delivery payload.", details: parsed.error.flatten() });
  const delivery = await createDelivery(getActor(req as unknown as AuthenticatedRequest), parsed.data);
  return res.status(201).json({ delivery });
});

deliveriesRouter.patch("/deliveries/:id", async (req, res) => {
  const parsed = DeliveryPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid delivery patch.", details: parsed.error.flatten() });
  const delivery = await updateDelivery(getActor(req as unknown as AuthenticatedRequest), req.params.id, parsed.data);
  if (!delivery) return res.status(404).json({ error: "Delivery not found." });
  return res.json({ delivery });
});

deliveriesRouter.delete("/deliveries/:id", async (req, res) => {
  const removed = await deleteDelivery(getActor(req as unknown as AuthenticatedRequest), req.params.id);
  if (!removed) return res.status(404).json({ error: "Delivery not found." });
  return res.json({ ok: true });
});
