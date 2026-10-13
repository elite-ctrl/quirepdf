#!/usr/bin/env python3
"""Install or remove the Mac copy of Quire for the current user."""

import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

BUNDLE = "com.quire.desk"


def home():
    override = os.environ.get("QUIRE_HOME", "").strip()
    return Path(override) if override else Path.home()


def apps_dir():
    return home() / "Applications"


def installed_app():
    return apps_dir() / "Quire.app"


def handlers_path():
    return home() / "Library" / "Preferences" / "com.apple.LaunchServices" / "com.apple.launchservices.secure.plist"


def pdf_handlers():
    return [
        {"LSHandlerContentType": "com.adobe.pdf", "LSHandlerRoleAll": BUNDLE},
        {
            "LSHandlerContentTag": "pdf",
            "LSHandlerContentTagClass": "public.filename-extension",
            "LSHandlerRoleAll": BUNDLE,
        },
    ]


def merge_handlers(data):
    kept = [item for item in data.get("LSHandlers", []) if item.get("LSHandlerRoleAll") != BUNDLE]
    kept.extend(pdf_handlers())
    data["LSHandlers"] = kept
    return data


def drop_handlers(data):
    data["LSHandlers"] = [item for item in data.get("LSHandlers", []) if item.get("LSHandlerRoleAll") != BUNDLE]
    return data


def load_plist(path):
    if not path.is_file():
        return {}
    with path.open("rb") as handle:
        return plistlib.load(handle)


def save_plist(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(data, handle, fmt=plistlib.FMT_BINARY)


def server_is_up(app):
    port_file = app / "Contents" / "Resources" / "quire.port"
    if not port_file.is_file():
        return False
    text = port_file.read_text(encoding="utf-8").strip().split()
    if not text or not text[0].isdigit():
        return False
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{text[0]}/__quire/launch.json", timeout=2) as response:
            response.read()
        return True
    except OSError:
        port_file.unlink(missing_ok=True)
        return False


def lsregister(*args):
    tool = Path("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")
    if tool.is_file():
        subprocess.run([str(tool), *args], check=False)


def install(source):
    source_app = Path(source) / "Quire.app"
    if not (source_app / "Contents" / "MacOS" / "Quire").is_file():
        print("Quire.app is missing. Unzip the folder and run Install Quire from inside it.")
        return 1
    dest = installed_app()
    if server_is_up(dest):
        print("Close the Quire window, then run Install again.")
        return 1
    apps_dir().mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source_app, dest)
    exe = dest / "Contents" / "MacOS" / "Quire"
    exe.chmod(0o755)
    try:
        subprocess.run(["xattr", "-dr", "com.apple.quarantine", str(dest)], check=False)
    except FileNotFoundError:
        pass
    save_plist(handlers_path(), merge_handlers(load_plist(handlers_path())))
    lsregister("-f", str(dest))
    command = Path(source) / "Uninstall Quire.command"
    if command.is_file():
        target = apps_dir() / "Uninstall Quire.command"
        shutil.copy2(command, target)
        target.chmod(0o755)
    print("")
    print("Quire is installed.")
    print("It is in your Applications folder.")
    print("Double-click a PDF to open it in Quire. Leave the Terminal window open while you work.")
    print("If a PDF still opens in Preview, right-click it, choose Open With, then Quire, and tick Always Open With.")
    print("Remove it later by double-clicking Uninstall Quire in Applications.")
    return 0


def uninstall():
    dest = installed_app()
    if server_is_up(dest):
        print("Close the Quire window, then run Uninstall again.")
        return 1
    save_plist(handlers_path(), drop_handlers(load_plist(handlers_path())))
    if dest.exists():
        lsregister("-u", str(dest))
        shutil.rmtree(dest, ignore_errors=True)
    command = apps_dir() / "Uninstall Quire.command"
    if command.is_file() and command.resolve() != Path(sys.argv[0]).resolve():
        command.unlink(missing_ok=True)
    print("Quire is removed. PDF files go back to whatever you choose in Finder.")
    return 0


def main(argv):
    if not argv or argv[0] not in ("install", "uninstall"):
        print("Use install or uninstall.")
        return 1
    if argv[0] == "install":
        if len(argv) < 2:
            print("Quire.app is missing. Unzip the folder and run Install Quire from inside it.")
            return 1
        return install(argv[1])
    return uninstall()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
