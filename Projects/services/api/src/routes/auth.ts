import { Request, Response, Router } from "express";
import { randomBytes, randomInt } from "crypto";
import {
  createPasswordResetToken,
  createUser,
  deletePasswordResetToken,
  deletePendingRegistration,
  deleteUserAccount,
  findUserByEmail,
  findUserByIdentifier,
  getPasswordResetToken,
  getPendingRegistration,
  incrementPendingAttempts,
  purgeExpiredAuthRecords,
  upsertPendingRegistration,
  updateUserProfile,
  updateUserPassword,
} from "../storage/authStore";
import { deleteAllUserProjectData } from "../storage/projectsStore";
import {
  isChannelConfigured,
  sendAccountVerification,
  sendPasswordReset,
} from "../services/notificationService";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { createAuthToken } from "../utils/authToken";
import { isRateLimited } from "../middleware/rateLimit";
import { hashPassword, verifyPassword } from "../utils/password";

const router: Router = Router();
const verificationTtlMs = Number(process.env.ACCOUNT_VERIFICATION_TTL_MS ?? 10 * 60 * 1000);
const isProd = process.env.NODE_ENV === "production";
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSupervisorAllowlist() {
  return String(process.env.SUPERVISOR_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return `${hasPlus ? "+" : ""}${digits}`;
}

function makeResetToken(): string {
  return randomBytes(32).toString("hex");
}

function makeCode(): string {
  return String(randomInt(100000, 1000000));
}

function buildResetLink(resetToken: string) {
  const base = process.env.PASSWORD_RESET_URL || "sitesnap://reset-password";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(resetToken)}`;
}


function isUniqueViolation(err: unknown) {
  return Boolean(
    typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
  );
}

async function initiateRegistration(req: Request, res: Response) {
  if (isRateLimited(req, "register-initiate", 8, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many signup attempts. Please try again shortly." });
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "").trim();
  const phoneRaw = String(req.body?.phone ?? "").trim();
  const fullName = String(req.body?.fullName ?? "").trim() || "User";
  const supervisorAllowlist = getSupervisorAllowlist();
  const isSupervisorEmail = supervisorAllowlist.includes(email);
  const role = isSupervisorEmail ? "supervisor" : "worker";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";

  if (!email || !password || !phone) {
    return res.status(400).json({ error: "Email, phone, and password are required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (phone.replace(/\D/g, "").length < 8) {
    return res.status(400).json({ error: "Please enter a valid phone number with country code." });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: "Password must be at least 12 characters." });
  }

  try {
    await purgeExpiredAuthRecords();
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const emailChannel = isChannelConfigured("email");
    const smsChannel = isChannelConfigured("sms");
    if (isProd && !emailChannel.ok) {
      return res.status(500).json({ error: emailChannel.reason });
    }
    if (isProd && !smsChannel.ok) {
      return res.status(500).json({ error: smsChannel.reason });
    }

    const emailCode = makeCode();
    const smsCode = makeCode();
    const warnings: string[] = [];

    if (emailChannel.ok) {
      const emailDelivery = await sendAccountVerification({ channel: "email", email, code: emailCode });
      if (!emailDelivery.ok) {
        console.error(`[auth] Email verification delivery failed: ${emailDelivery.error}`);
        if (isProd) {
          return res.status(502).json({ error: emailDelivery.error || "Failed to send email verification code." });
        }
        warnings.push("Email provider unavailable in dev mode.");
      }
    } else {
      warnings.push(emailChannel.reason || "Email provider unavailable in dev mode.");
    }

    if (smsChannel.ok) {
      const smsDelivery = await sendAccountVerification({ channel: "sms", phone, code: smsCode });
      if (!smsDelivery.ok) {
        console.error(`[auth] SMS verification delivery failed: ${smsDelivery.error}`);
        if (isProd) {
          return res.status(502).json({ error: smsDelivery.error || "Failed to send SMS verification code." });
        }
        warnings.push("SMS provider unavailable in dev mode.");
      }
    } else {
      warnings.push(smsChannel.reason || "SMS provider unavailable in dev mode.");
    }

    const passwordHash = await hashPassword(password);
    await upsertPendingRegistration(
      email,
      `${passwordHash}::${fullName}::${role}`,
      phone,
      emailCode,
      smsCode,
      new Date(Date.now() + verificationTtlMs)
    );

    const isDevFallback = warnings.length > 0;
    return res.status(200).json({
      ok: true,
      message: isDevFallback
        ? "Dev mode: provider not configured, using local verification codes."
        : "Verification codes sent to your email and phone.",
      warnings: isDevFallback ? warnings : undefined,
      devCodes: !isProd && isDevFallback ? { emailCode, smsCode } : undefined,
      expiresInSeconds: Math.floor(verificationTtlMs / 1000),
    });
  } catch (error) {
    console.error("[auth] initiateRegistration failed", error);
    return res.status(500).json({ error: "Unable to start registration." });
  }
}

router.post("/auth/register", initiateRegistration);
router.post("/auth/register/initiate", initiateRegistration);

router.post("/auth/register/verify", async (req, res) => {
  if (isRateLimited(req, "register-verify", 12, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many verification attempts. Please try again shortly." });
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const emailCode = String(req.body?.emailCode ?? "").trim();
  const smsCode = String(req.body?.smsCode ?? "").trim();

  if (!email || !emailCode || !smsCode) {
    return res.status(400).json({ error: "Email, emailCode, and smsCode are required." });
  }

  try {
    await purgeExpiredAuthRecords();
    const pending = await getPendingRegistration(email);
    if (!pending) {
      return res.status(404).json({ error: "No pending signup found. Please register again." });
    }

    if (Date.now() > new Date(pending.expiresAt).getTime()) {
      await deletePendingRegistration(email);
      return res.status(400).json({ error: "Verification codes have expired. Please register again." });
    }

    if (pending.emailCode !== emailCode || pending.smsCode !== smsCode) {
      const attempts = await incrementPendingAttempts(email);
      if (attempts >= 5) {
        await deletePendingRegistration(email);
        return res.status(429).json({ error: "Too many invalid verification attempts. Please register again." });
      }
      return res.status(401).json({ error: "Verification codes are incorrect." });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      await deletePendingRegistration(email);
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const [passwordHash, fullName = "User", role = "worker"] = pending.passwordHash.split("::");
    await createUser(
      email,
      passwordHash,
      pending.phone,
      fullName,
      role === "supervisor" || role === "admin" ? role : "worker"
    );
    await deletePendingRegistration(email);
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(500).json({ error: "Account created but user lookup failed." });
    }
    return res.status(201).json({
      ok: true,
      token: createAuthToken({ email: user.email, fullName: user.fullName, role: user.role }),
      user: { email: user.email, name: user.fullName, role: user.role },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: "Account already exists for this email or phone." });
    }
    console.error("[auth] register verify failed", error);
    return res.status(500).json({ error: "Unable to verify registration." });
  }
});

async function loginHandler(req: Request, res: Response) {
  if (isRateLimited(req, "login", 15, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts. Please try again shortly." });
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "").trim();
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const existing = await findUserByEmail(email);
    if (!existing) {
      return res.status(404).json({ error: "Account not found. Please sign up first." });
    }

    const passwordOk = await verifyPassword(password, existing.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    return res.json({
      ok: true,
      token: createAuthToken({ email: existing.email, fullName: existing.fullName, role: existing.role }),
      user: { email: existing.email, name: existing.fullName, role: existing.role },
    });
  } catch (error) {
    console.error("[auth] login failed", error);
    return res.status(500).json({ error: "Login failed." });
  }
}

router.post("/auth/dev-login", loginHandler);
router.post("/auth/login", loginHandler);

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const user = await findUserByEmail(auth.email);
  if (!user && !hasDatabase) {
    return res.json({ user: { email: auth.email, name: auth.fullName, role: auth.role } });
  }
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: { email: user.email, name: user.fullName, role: user.role } });
});

router.patch("/auth/profile", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const fullName = String(req.body?.name ?? "").trim();
  const roleRaw = String(req.body?.role ?? "").trim().toLowerCase();
  const requestedRole =
    roleRaw === "worker" || roleRaw === "supervisor" || roleRaw === "admin"
      ? roleRaw
      : undefined;
  if (requestedRole && auth.role !== "admin") {
    return res.status(403).json({ error: "Only admins can change roles." });
  }
  const updated = await updateUserProfile(auth.email, {
    fullName: fullName || undefined,
    role: requestedRole,
  });
  if (!updated && !hasDatabase) {
    const nextName = fullName || auth.fullName;
    const nextRole = requestedRole || auth.role;
    const token = createAuthToken({ email: auth.email, fullName: nextName, role: nextRole });
    return res.json({ token, user: { email: auth.email, name: nextName, role: nextRole } });
  }
  if (!updated) return res.status(404).json({ error: "User not found." });
  const token = createAuthToken({ email: updated.email, fullName: updated.fullName, role: updated.role });
  return res.json({ token, user: { email: updated.email, name: updated.fullName, role: updated.role } });
});

// Permanently delete the authenticated user's account and all their data
router.delete("/auth/account", requireAuth, async (req: Request, res: Response) => {
  if (isRateLimited(req, "delete-account", 3, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many account deletion attempts." });
  }
  const auth = (req as AuthenticatedRequest).auth;
  try {
    await deleteAllUserProjectData(auth.email);
    await deleteUserAccount(auth.email);
    return res.json({ ok: true, message: "Account and all associated data have been permanently deleted." });
  } catch (error) {
    console.error("[auth] delete-account failed", error);
    return res.status(500).json({ error: "Failed to delete account." });
  }
});

// Change password — requires current password to be supplied
router.post("/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  if (isRateLimited(req, "change-password", 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many password change attempts. Please try again shortly." });
  }
  const auth = (req as AuthenticatedRequest).auth;
  const currentPassword = String(req.body?.currentPassword ?? "").trim();
  const newPassword = String(req.body?.newPassword ?? "").trim();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required." });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ error: "Password must be at least 12 characters." });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "New password must be different from current password." });
  }

  try {
    const user = await findUserByEmail(auth.email);
    if (!user) return res.status(404).json({ error: "User not found." });

    const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const nextHash = await hashPassword(newPassword);
    await updateUserPassword(auth.email, nextHash);
    return res.json({ ok: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("[auth] change-password failed", error);
    return res.status(500).json({ error: "Unable to change password." });
  }
});

// Refresh a valid (not-expired) token — returns a new token with a fresh expiry
router.post("/auth/refresh", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const user = await findUserByEmail(auth.email);
  // Fall back to token claims when no DB (in-memory/dev mode)
  const email = user?.email ?? auth.email;
  const fullName = user?.fullName ?? auth.fullName;
  const role = user?.role ?? auth.role;
  const token = createAuthToken({ email, fullName, role });
  return res.json({ token, user: { email, name: fullName, role } });
});

router.post("/auth/forgot-password", async (req, res) => {
  if (isRateLimited(req, "forgot-password", 8, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many reset requests. Please try again shortly." });
  }

  const identifier = String(req.body?.identifier ?? "").trim();
  const channel = String(req.body?.channel ?? "email").toLowerCase() === "sms" ? "sms" : "email";

  if (!identifier) {
    return res.status(400).json({ error: "Email or phone is required." });
  }

  try {
    await purgeExpiredAuthRecords();
    const channelConfig = isChannelConfigured(channel);
    if (isProd && !channelConfig.ok) {
      return res.status(500).json({ error: channelConfig.reason });
    }

    const normalizedIdentifier = identifier.toLowerCase();
    const normalizedPhone = normalizePhone(identifier);
    const user = await findUserByIdentifier(normalizedIdentifier, normalizedPhone);

    if (user) {
      const resetToken = makeResetToken();
      const resetLink = buildResetLink(resetToken);
      const resetCode = resetToken.slice(0, 8).toUpperCase();
      await createPasswordResetToken(resetToken, user.email, new Date(Date.now() + 1000 * 60 * 30));

      if (channelConfig.ok) {
        const delivery = await sendPasswordReset({
          channel,
          email: user.email,
          phone: user.phone ?? undefined,
          resetLink,
          resetCode,
        });

        if (!delivery.ok) {
          console.error(`[auth] Password reset delivery failed: ${delivery.error}`);
          if (isProd) {
            return res.status(502).json({ error: delivery.error || "Failed to send reset instructions." });
          }
          return res.json({
            ok: true,
            message: "Dev mode: provider not configured, using local reset token.",
            devResetToken: !isProd ? resetToken : undefined,
            devResetCode: !isProd ? resetCode : undefined,
            devResetLink: !isProd ? resetLink : undefined,
          });
        }
      } else {
        return res.json({
          ok: true,
          message: "Dev mode: provider not configured, using local reset token.",
          devResetToken: !isProd ? resetToken : undefined,
          devResetCode: !isProd ? resetCode : undefined,
          devResetLink: !isProd ? resetLink : undefined,
        });
      }
    }

    return res.json({
      ok: true,
      message:
        channel === "sms"
          ? "If an account exists, a reset code has been sent by text message."
          : "If an account exists, a reset link has been sent by email.",
    });
  } catch (error) {
    console.error("[auth] forgot-password failed", error);
    return res.status(500).json({ error: "Unable to process reset request." });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  if (isRateLimited(req, "reset-password", 12, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many reset attempts. Please try again shortly." });
  }

  const token = String(req.body?.token ?? "").trim();
  const newPassword = String(req.body?.newPassword ?? "").trim();

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and newPassword are required." });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ error: "Password must be at least 12 characters." });
  }

  try {
    await purgeExpiredAuthRecords();
    const resetRecord = await getPasswordResetToken(token);
    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid reset token." });
    }

    if (Date.now() > new Date(resetRecord.expiresAt).getTime()) {
      await deletePasswordResetToken(token);
      return res.status(400).json({ error: "Reset token has expired." });
    }

    const user = await findUserByEmail(resetRecord.email);
    if (!user) {
      await deletePasswordResetToken(token);
      return res.status(404).json({ error: "Account not found." });
    }

    const nextHash = await hashPassword(newPassword);
    await updateUserPassword(resetRecord.email, nextHash);
    await deletePasswordResetToken(token);
    return res.json({ ok: true, message: "Password has been reset." });
  } catch (error) {
    console.error("[auth] reset-password failed", error);
    return res.status(500).json({ error: "Unable to reset password." });
  }
});

export default router;
