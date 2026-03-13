import { Router } from "express";
import { authenticate, requireMinRole, AuthenticatedRequest } from "../../middleware";
import { Roles } from "../../common/types";
import { param } from "../../common/utils";
import { documentsService } from "./service";
import {
  uploadDocumentSchema,
  reviewDocumentSchema,
  correctExtractionSchema,
  documentQuerySchema,
} from "./validators";

const router = Router();

// POST /api/documents/upload
router.post("/upload", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = uploadDocumentSchema.parse(req.body);
    // File buffer would come from multer or similar middleware
    const doc = await documentsService.upload(input, Buffer.alloc(0), req.user!.id);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// GET /api/documents/:id
router.get("/:id", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const doc = await documentsService.getDocument(param(req, "id"));
    res.json(doc);
  } catch (err) { next(err); }
});

// GET /api/documents/:id/extraction — AI-extracted data with confidence
router.get("/:id/extraction", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const results = await documentsService.getExtraction(param(req, "id"));
    res.json(results);
  } catch (err) { next(err); }
});

// PUT /api/documents/:id/extraction/:fieldId/correct — Correct AI suggestion
router.put("/:id/extraction/:fieldId/correct", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = correctExtractionSchema.parse(req.body);
    const result = await documentsService.correctExtraction(param(req, "id"), param(req, "fieldId"), input, req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/documents/:id/review — Approve or reject
router.post("/:id/review", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = reviewDocumentSchema.parse(req.body);
    const item = await documentsService.reviewDocument(param(req, "id"), input, req.user!.id);
    res.json(item);
  } catch (err) { next(err); }
});

// GET /api/documents/review-queue
router.get("/review-queue", authenticate, requireMinRole(Roles.MANAGER), async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = documentQuerySchema.parse(req.query);
    const result = await documentsService.listReviewQueue(query.page, query.limit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/documents/:id/audit
router.get("/:id/audit", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const trail = await documentsService.getAuditTrail(param(req, "id"));
    res.json(trail);
  } catch (err) { next(err); }
});

export { router as documentsRouter };
