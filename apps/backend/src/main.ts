import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("api");
app.enableShutdownHooks();

const port = Number(process.env["PORT"] ?? 3000);
await app.listen(port);
Logger.log(`Backend listening on http://localhost:${String(port)}/api`, "Bootstrap");
