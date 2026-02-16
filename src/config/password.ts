/**
 * Password resolution — supports plain text or shell command.
 *
 * `password_command` takes precedence over `password`.
 * The command is executed via the user's shell; stdout (trimmed) is the password.
 */

import { appLogger } from "../lib/logger.ts";

/**
 * Resolve a password from either a plain string or a shell command.
 *
 * @param opts.password        - Plain-text password
 * @param opts.password_command - Shell command whose stdout is the password
 * @param opts.label           - Human-readable label for error messages
 */
export async function resolvePassword(opts: {
  password?: string;
  password_command?: string;
  label?: string;
}): Promise<string> {
  const { password, password_command, label } = opts;

  if (password_command) {
    try {
      const proc = Bun.spawn(["sh", "-c", password_command], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new Error(
          `password_command exited with code ${exitCode}${stderr ? `: ${stderr.trim()}` : ""}`
        );
      }

      const resolved = stdout.trim();
      if (!resolved) {
        throw new Error("password_command returned empty output");
      }

      appLogger.debug(`Password resolved via command${label ? ` for ${label}` : ""}`);
      return resolved;
    } catch (err) {
      const ctx = label ? ` (${label})` : "";
      if (err instanceof Error && err.message.startsWith("password_command")) {
        throw new Error(`${err.message}${ctx}`);
      }
      throw new Error(
        `Failed to run password_command${ctx}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  if (password) {
    return password;
  }

  const ctx = label ? ` for ${label}` : "";
  throw new Error(
    `No password configured${ctx}. Set either "password" or "password_command" in config.toml`
  );
}
