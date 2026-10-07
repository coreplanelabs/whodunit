import { expect, test } from "bun:test";
import { redact } from "../src/validation.js";

test("credential redaction preserves plain-language explanations but covers quoted assignments", () => {
	expect(
		redact(
			"Login failed after token refresh. The password setting was renamed.",
		),
	).toBe("Login failed after token refresh. The password setting was renamed.");
	for (const value of [
		"password=private-value",
		'{"password": "private-value"}',
		"api_key: private-value",
		"Authorization: Bearer private-value",
	])
		expect(redact(value)).not.toContain("private-value");
});
