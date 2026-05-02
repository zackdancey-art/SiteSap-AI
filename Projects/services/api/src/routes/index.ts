import { Router } from "express";
import authRouter from "./auth";
import { aiRouter } from "./ai";
import { uploadsRouter } from "./uploads";
import { healthRouter } from "./health";
import { projectsRouter } from "./projects";

const apiRouter: Router = Router();

apiRouter.use(authRouter);
apiRouter.use(aiRouter);
apiRouter.use(uploadsRouter);
apiRouter.use(healthRouter);
apiRouter.use(projectsRouter);

export { apiRouter };
