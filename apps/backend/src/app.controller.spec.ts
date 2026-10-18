import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { AppController } from "./app.controller.js";

describe("AppController", () => {
	it("returns the status message", async () => {
		const moduleRef = await Test.createTestingModule({ controllers: [AppController] }).compile();

		expect(moduleRef.get(AppController).getStatus()).toEqual({ message: "Querydon backend is running" });
	});
});
