import { Router } from "express";
import modsRouter from "./mods";
import modDownloadsRouter from "./modDownloads";
import userRouter from "./user";
import authRouter from "./auth";
import pathSystem32Router from "./pathSystem32";
import codeRouter from "./code";
import botRouter from "./bot";
import hwidRouter from "./hwid";
import homeDownloadRouter from "./homeDownload";
import { requireAuth } from "../middleware/auth";
import { requireBotAuth } from "../middleware/botAuth";
import { requireHwid } from "../middleware/hwidAuth";
import appDownloadUrlRouter from "./app_downloadurl";
import fivemRouter from "./fivem";
import updatesRouter from "./updates";
import adminRouter from "./admin";

const router = Router();

router.use("/auth", authRouter);
router.use("/mod-downloads", modDownloadsRouter);
router.use("/mods", requireAuth, requireHwid, modsRouter);
router.use("/user", requireAuth, userRouter);
router.use("/paths", requireAuth, pathSystem32Router);
router.use("/code", requireAuth, codeRouter);
router.use("/bot", requireBotAuth, botRouter);
router.use("/app_downloadurl", appDownloadUrlRouter);
router.use("/fivem", fivemRouter);
router.use("/v1", fivemRouter);
router.use("/update", updatesRouter);
router.use("/hwid", requireAuth, hwidRouter);
router.use("/home-download", homeDownloadRouter);
router.use("/admin", adminRouter);

export default router;
