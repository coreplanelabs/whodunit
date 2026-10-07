const button = document.getElementById("copy");
button.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(
			document.getElementById("command").textContent,
		);
		button.textContent = "Copied";
		setTimeout(() => {
			button.textContent = "Copy";
		}, 1800);
	} catch {
		button.textContent = "Select to copy";
	}
});
