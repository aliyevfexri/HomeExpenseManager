import multer from "multer";
import crypto from "crypto";
import path from "path";
import { config } from "./config";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.attachmentsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
});
