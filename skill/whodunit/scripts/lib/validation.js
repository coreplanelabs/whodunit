export function hasControlCharacters(value) {
    for (const character of value) {
        const code = character.charCodeAt(0);
        if (code < 32 || code === 127)
            return true;
    }
    return false;
}
export function redact(value) {
    return value
        .replace(/(?:gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|sk-[A-Za-z0-9_-]{10,}|AKIA[A-Z0-9]{16})/gu, "[REDACTED]")
        .replace(/bearer\s+\S+/giu, "[REDACTED]")
        .replace(/(?:token|secret|password|api[_-]?key)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|\S+)/giu, "[REDACTED]");
}
