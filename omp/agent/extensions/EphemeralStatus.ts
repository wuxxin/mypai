import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function ephemeralStatus(pi: ExtensionAPI): void {
    if (process.env.OMP_EPHEMERAL !== "1") {
        return;
    }

    pi.on("session_start", async (_event, ctx) => {
        try {
            if (ctx.sessionManager?.setSessionName) {
                await ctx.sessionManager.setSessionName("ephemeral", "user");
            }
        } catch {}

        try {
            if (ctx.ui?.setStatus) {
                const badge = ctx.ui.theme?.fg
                    ? ctx.ui.theme.fg("warning", "priv ⚡ no-hist")
                    : "priv ⚡ no-hist";
                ctx.ui.setStatus("ephemeral", badge);
            }
        } catch {}
    });
}
