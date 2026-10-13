#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PYTHON=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
fi
if [ -z "$PYTHON" ]; then
  /usr/bin/osascript -e 'display dialog "Quire needs Python 3. Install it from python.org, then try again." buttons {"OK"} with title "Quire"'
  exit 1
fi
APP="$HOME/Applications/Quire.app"
if [ ! -d "$APP" ]; then
  echo "Quire is not installed."
  echo
  read -r -p "Press Return to close." _
  exit 1
fi
"$PYTHON" "$APP/Contents/Resources/setup_mac.py" uninstall
echo
read -r -p "Press Return to close." _
