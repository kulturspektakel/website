#!/usr/bin/env python3
"""Replace the GCP-managed block in .env with values from `terraform output`.

Run after `terraform apply` (or via `yarn sync:gcp-env`). The block is
delimited by `# >>> gcp (terraform)` / `# <<< gcp (terraform)` markers — only
content between them is touched; other entries in .env are untouched.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TERRAFORM_DIR = ROOT / "terraform"
ENV_FILE = ROOT / ".env"

BLOCK_START = "# >>> gcp (terraform) — `yarn sync:gcp-env` rewrites this block; do not edit by hand"
BLOCK_END = "# <<< gcp (terraform)"


def main() -> int:
    outputs = json.loads(
        subprocess.check_output(
            ["terraform", f"-chdir={TERRAFORM_DIR}", "output", "-json"]
        )
    )

    def out(name: str) -> str:
        return outputs[name]["value"]

    # Compact the SA-key JSON to a single physical line. The `\n` escapes
    # inside `private_key` stay as the 2-char escape so a downstream
    # JSON.parse decodes them back to real newlines (what google-auth-library
    # wants).
    sa_key_json = json.dumps(
        json.loads(out("tasks_service_account_key_json")),
        separators=(",", ":"),
    )

    managed = {
        "GCP_PROJECT_ID": f'"{out("project_id")}"',
        "GCP_LOCATION": f'"{out("tasks_queue_location")}"',
        "GCP_TASKS_QUEUE": f'"{out("tasks_queue_name")}"',
        "GCP_TASKS_SERVICE_ACCOUNT_EMAIL": f'"{out("tasks_service_account_email")}"',
        "SITE_URL": f'"{out("site_url")}"',
        # Single-quoted so dotenv preserves the literal `\n` escapes inside
        # the JSON's private_key field.
        "GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON": f"'{sa_key_json}'",
        "GOOGLE_MAPS_API_KEY_SERVER": f'"{out("maps_server_key_string")}"',
        "GOOGLE_MAPS_API_KEY": f'"{out("maps_browser_key_string")}"',
        "GMAIL_SA_EMAIL": f'"{out("gmail_sa_email")}"',
        # Multi-line PEM; dotenv supports multi-line values inside double quotes.
        "GMAIL_SA_PRIVATE_KEY": f'"{out("gmail_sa_private_key")}"',
    }
    new_block = (
        BLOCK_START
        + "\n"
        + "\n".join(f"{k}={v}" for k, v in managed.items())
        + "\n"
        + BLOCK_END
        + "\n"
    )

    content = ENV_FILE.read_text()

    # Replace (or remove) the existing managed block first, then strip any
    # stray duplicates of managed vars elsewhere in the file (so the block is
    # the only source).
    block_pattern = re.escape(BLOCK_START) + r".*?" + re.escape(BLOCK_END) + r"\n?"
    had_block = re.search(block_pattern, content, re.DOTALL) is not None
    content = re.sub(block_pattern, "", content, count=1, flags=re.DOTALL)
    for name in managed:
        # Handle both single-line and multi-line ("..." spanning newlines)
        # entries when stripping stray duplicates outside the block.
        content = re.sub(
            rf'^{re.escape(name)}=(?:"[^"]*"|\'[^\']*\'|[^\n]*)\n',
            "",
            content,
            flags=re.MULTILINE,
        )

    content = content.rstrip("\n") + "\n\n" + new_block
    ENV_FILE.write_text(content)
    print(("updated" if had_block else "appended") + f" GCP block in {ENV_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
