import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
	@Get()
	getStatus(): { message: string } {
		return { message: "Querydon backend is running" };
	}
}
